/**
 * MixingChecker - 混用チェッカーの全分岐テスト
 *
 * shadcn/ui の Select は Radix UI ベースで jsdom 上では動かないため、
 * onValueChange を露出させた最小モックに差し替える。Radix の挙動を再現する
 * のではなく、コンポーネントが状態遷移時に正しく results を組み立てるかを検証する。
 *
 * 仕掛け: Select モックが SelectTrigger の id を再帰的に探し、
 * id をキーに onValueChange を globalThis 経由で登録する。
 * テスト側は __selectHandlers__.get(id)(value) で擬似的に選択を起こす。
 */

import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

// SelectTrigger の id を子孫から再帰的に探すヘルパー（モック内部用）
function findTriggerId(node: React.ReactNode): string | undefined {
  if (!node) return undefined
  if (Array.isArray(node)) {
    for (const child of node) {
      const id = findTriggerId(child)
      if (id) return id
    }
    return undefined
  }
  if (!React.isValidElement(node)) return undefined
  const props = node.props as { id?: string; children?: React.ReactNode }
  if (props.id && typeof props.id === 'string') return props.id
  return findTriggerId(props.children)
}

vi.mock('@/components/ui/select', () => {
  const handlers = new Map<string, (v: string) => void>()
  ;(globalThis as { __selectHandlers__?: Map<string, (v: string) => void> }).__selectHandlers__ = handlers

  return {
    Select: ({ children, onValueChange }: { children: React.ReactNode; value: string; onValueChange: (v: string) => void }) => {
      const id = findTriggerId(children)
      if (id) handlers.set(id, onValueChange)
      return <div data-testid={`select-${id ?? 'unknown'}`}>{children}</div>
    },
    SelectTrigger: ({ children, id }: { children: React.ReactNode; id: string }) => (
      <div data-testid={`trigger-${id}`}>{children}</div>
    ),
    SelectValue: ({ placeholder }: { placeholder: string }) => <span>{placeholder}</span>,
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectItem: ({ children }: { children: React.ReactNode; value: string }) => (
      <div role="option" aria-selected={false}>{children}</div>
    ),
  }
})

import { MixingChecker } from '@/components/pesticide/MixingChecker'

const pesticides = [
  { id: 'A', name: 'A 剤', slug: 'a', pesticideType: 'fungicide' },
  { id: 'B', name: 'B 剤', slug: 'b', pesticideType: 'insecticide' },
  { id: 'C', name: 'C 剤', slug: 'c', pesticideType: 'fungicide' },
]

const incompatibilities = [
  { pesticideId: 'A', incompatibleWithId: 'B' },
  // C は A・B どちらとも互換
]

function selectValue(triggerId: string, value: string): void {
  const handlers = (globalThis as { __selectHandlers__?: Map<string, (v: string) => void> }).__selectHandlers__
  const fn = handlers?.get(triggerId)
  if (!fn) throw new Error(`handler not registered for ${triggerId}`)
  // React 18+ では setState を act でラップしないと更新が flush されない
  act(() => { fn(value) })
}

describe('MixingChecker', () => {
  beforeEach(() => {
    const handlers = (globalThis as { __selectHandlers__?: Map<string, (v: string) => void> }).__selectHandlers__
    handlers?.clear()
  })

  it('初期表示: 結果カードは表示されない（hasSelection1 && hasSelection2 が偽のため）', () => {
    render(<MixingChecker pesticides={pesticides} incompatibilities={incompatibilities} />)
    expect(screen.queryByText('チェック結果')).not.toBeInTheDocument()
    // 免責は常に表示
    expect(screen.getByText(/データベースに登録された混用不可情報に基づきます/)).toBeInTheDocument()
  })

  it('1剤目だけ選択しても結果は表示されない', () => {
    const { rerender } = render(<MixingChecker pesticides={pesticides} incompatibilities={incompatibilities} />)
    selectValue('pesticide-1', 'A')
    rerender(<MixingChecker pesticides={pesticides} incompatibilities={incompatibilities} />)
    expect(screen.queryByText('チェック結果')).not.toBeInTheDocument()
  })

  it('1剤目と2剤目を選ぶと混用不可ペアが表示される（A x B = 不可）', () => {
    render(<MixingChecker pesticides={pesticides} incompatibilities={incompatibilities} />)
    selectValue('pesticide-1', 'A')
    selectValue('pesticide-2', 'B')

    expect(screen.getByText('チェック結果')).toBeInTheDocument()
    expect(screen.getByText('混用不可')).toBeInTheDocument()
    // A 剤 / B 剤 はオプション一覧と結果パネル両方に出るので getAllByText
    expect(screen.getAllByText(/A 剤/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/B 剤/).length).toBeGreaterThan(0)
    expect(screen.getByText(/データベース上で混用不可として登録されています/)).toBeInTheDocument()
  })

  it('1剤目と2剤目を選び、混用可能ペア（A x C = 可）は緑バッジ', () => {
    render(<MixingChecker pesticides={pesticides} incompatibilities={incompatibilities} />)
    selectValue('pesticide-1', 'A')
    selectValue('pesticide-2', 'C')

    expect(screen.getByText('チェック結果')).toBeInTheDocument()
    expect(screen.getByText('混用可能')).toBeInTheDocument()
    expect(screen.queryByText(/データベース上で混用不可として登録されています/)).not.toBeInTheDocument()
  })

  it('3剤目を追加するとペアが3組（1x2, 1x3, 2x3）になる', () => {
    render(<MixingChecker pesticides={pesticides} incompatibilities={incompatibilities} />)
    selectValue('pesticide-1', 'A')
    selectValue('pesticide-2', 'C')
    selectValue('pesticide-3', 'B')

    // A x C, A x B, C x B の 3 ペア
    // exactMatch のみ数える（免責文の「混用不可情報」は除外される）
    expect(screen.getAllByText('混用不可')).toHaveLength(1)
    expect(screen.getAllByText('混用可能')).toHaveLength(2)
  })

  it('3剤目だけ選択（1剤目・2剤目未選択）はチェック結果を出さない', () => {
    render(<MixingChecker pesticides={pesticides} incompatibilities={incompatibilities} />)
    selectValue('pesticide-3', 'A')
    expect(screen.queryByText('チェック結果')).not.toBeInTheDocument()
  })

  it('1剤目と3剤目（2剤目未選択）はチェック結果を出さない（showResults = hasSelection1 && hasSelection2）', () => {
    render(<MixingChecker pesticides={pesticides} incompatibilities={incompatibilities} />)
    selectValue('pesticide-1', 'A')
    selectValue('pesticide-3', 'B')
    expect(screen.queryByText('チェック結果')).not.toBeInTheDocument()
  })

  it('isIncompatible は逆方向の登録 (B,A) でも検出する', () => {
    const reversed = [{ pesticideId: 'B', incompatibleWithId: 'A' }]
    render(<MixingChecker pesticides={pesticides} incompatibilities={reversed} />)
    selectValue('pesticide-1', 'A')
    selectValue('pesticide-2', 'B')
    expect(screen.getByText('混用不可')).toBeInTheDocument()
  })

  it('未知の id を選択した場合 getName は id をそのまま返す（フォールバック）', () => {
    render(<MixingChecker pesticides={pesticides} incompatibilities={[]} />)
    selectValue('pesticide-1', 'unknown-1')
    selectValue('pesticide-2', 'unknown-2')
    expect(screen.getByText('混用可能')).toBeInTheDocument()
    // unknown id はオプション一覧には無いが、結果パネルでフォールバックとして出る
    expect(screen.getAllByText(/unknown-1/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/unknown-2/).length).toBeGreaterThan(0)
  })

  it('UI: 選択カードと免責は常にレンダリングされる', () => {
    render(<MixingChecker pesticides={pesticides} incompatibilities={incompatibilities} />)
    expect(screen.getByText('農薬を選択')).toBeInTheDocument()
    expect(screen.getByText('農薬 1')).toBeInTheDocument()
    expect(screen.getByText('農薬 2')).toBeInTheDocument()
    expect(screen.getByText(/農薬 3/)).toBeInTheDocument()
  })
})
