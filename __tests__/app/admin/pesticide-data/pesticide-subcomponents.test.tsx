/**
 * @file PesticideEditForm / PesticideRelations / PesticideHistoryTimeline の
 *       Client / Server Component 単体テスト。
 *
 * これらのコンポーネントは `app/admin/pesticide-data/[id]/page.tsx` から分離された
 * 専用コンポーネントで、Server Component 化リファクタ直後にカバレッジ 0% だったもの。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// updatePesticide は PesticideEditForm で呼ばれるためモック化する
const mockUpdatePesticide = vi.fn()
vi.mock('@/lib/actions/admin/pesticide-data', () => ({
  updatePesticide: (...args: unknown[]) => mockUpdatePesticide(...args),
}))

// useRouter().refresh を検証可能にする
const mockRouterRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRouterRefresh, push: vi.fn(), back: vi.fn() }),
}))

import { PesticideEditForm } from '@/app/admin/pesticide-data/[id]/PesticideEditForm'
import {
  PesticideRelations,
  type PesticideEffect,
  type PesticideIncompatible,
  type PesticideIngredient,
} from '@/app/admin/pesticide-data/[id]/PesticideRelations'
import { PesticideHistoryTimeline } from '@/app/admin/pesticide-data/[id]/PesticideHistoryTimeline'

// ============================================================
// PesticideEditForm
// ============================================================

describe('PesticideEditForm', () => {
  const baseInitial = {
    name: 'Base Pesticide',
    registrationNumber: 'R-001',
    pesticideType: 'fungicide' as const,
    description: 'desc',
    formulationTypeName: 'SP',
  }

  beforeEach(() => {
    mockUpdatePesticide.mockReset()
    mockRouterRefresh.mockReset()
  })

  it('初期値を全フィールドに反映する', () => {
    render(<PesticideEditForm id="id-1" initial={baseInitial} />)
    expect((screen.getByLabelText('農薬名 *') as HTMLInputElement).value).toBe('Base Pesticide')
    expect((screen.getByLabelText('登録番号') as HTMLInputElement).value).toBe('R-001')
    expect((screen.getByLabelText('種別 *') as HTMLSelectElement).value).toBe('fungicide')
    expect((screen.getByLabelText('剤型') as HTMLInputElement).value).toBe('SP')
    expect((screen.getByLabelText('説明') as HTMLTextAreaElement).value).toBe('desc')
  })

  it('nullable な registrationNumber / description / formulationTypeName を空文字に正規化する', () => {
    render(
      <PesticideEditForm
        id="id-2"
        initial={{
          name: 'N',
          registrationNumber: null,
          pesticideType: 'insecticide',
          description: null,
          formulationTypeName: null,
        }}
      />,
    )
    expect((screen.getByLabelText('登録番号') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('説明') as HTMLTextAreaElement).value).toBe('')
    expect((screen.getByLabelText('剤型') as HTMLInputElement).value).toBe('')
  })

  it('保存ボタンは名前が空白のときに disabled になる', () => {
    render(
      <PesticideEditForm
        id="id-3"
        initial={{ ...baseInitial, name: '   ' }}
      />,
    )
    const btn = screen.getByRole('button', { name: '保存' })
    expect(btn).toBeDisabled()
  })

  it('保存成功時に updatePesticide に trim / null 正規化した payload を渡し、router.refresh を呼ぶ', async () => {
    mockUpdatePesticide.mockResolvedValue({ success: true })
    render(<PesticideEditForm id="id-4" initial={baseInitial} />)

    fireEvent.change(screen.getByLabelText('農薬名 *'), { target: { value: '  Updated  ' } })
    fireEvent.change(screen.getByLabelText('登録番号'), { target: { value: '  ' } })
    fireEvent.change(screen.getByLabelText('種別 *'), { target: { value: 'acaricide' } })
    fireEvent.change(screen.getByLabelText('説明'), { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(mockUpdatePesticide).toHaveBeenCalledWith('id-4', {
        name: 'Updated',
        registrationNumber: null,
        pesticideType: 'acaricide',
        description: null,
      })
    })
    await waitFor(() => {
      expect(screen.getByText('保存しました')).toBeInTheDocument()
    })
    expect(mockRouterRefresh).toHaveBeenCalledTimes(1)
  })

  it('保存失敗時はエラーメッセージを表示し router.refresh は呼ばれない', async () => {
    mockUpdatePesticide.mockResolvedValue({ success: false, error: 'Save failed' })
    render(<PesticideEditForm id="id-5" initial={baseInitial} />)

    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })
    expect(mockRouterRefresh).not.toHaveBeenCalled()
  })
})

// ============================================================
// PesticideRelations
// ============================================================

describe('PesticideRelations', () => {
  it('空配列で「登録されていません」メッセージを3セクションとも表示する', () => {
    render(<PesticideRelations ingredients={[]} effects={[]} incompatibles={[]} />)
    expect(screen.getByText('有効成分は登録されていません')).toBeInTheDocument()
    expect(screen.getByText('効果データは登録されていません')).toBeInTheDocument()
    expect(screen.getByText('混用不可データは登録されていません')).toBeInTheDocument()
  })

  it('成分 / 効果 / 混用不可を正しくレンダリングする', () => {
    const ingredients: PesticideIngredient[] = [
      {
        activeIngredient: { name: '有効成分A', fracCode: 'F1', iracCode: null },
        contentLabel: '10%',
      },
      {
        activeIngredient: { name: '有効成分B', fracCode: null, iracCode: 'I3' },
        contentLabel: null,
      },
    ]
    const effects: PesticideEffect[] = [
      {
        id: 'e1',
        diseasePest: { name: '病害X', category: 'disease' },
        preventionLevel: 'high',
        treatmentLevel: 'medium',
        efficacyLevel: 'low',
        note: '備考1',
      },
      {
        id: 'e2',
        diseasePest: { name: '害虫Y', category: 'insect' },
        preventionLevel: null,
        treatmentLevel: null,
        efficacyLevel: 'unknown',
        note: null,
      },
    ]
    const incompatibles: PesticideIncompatible[] = [
      { incompatibleWith: { id: 'p-x', name: '混用不可P' } },
    ]

    render(
      <PesticideRelations
        ingredients={ingredients}
        effects={effects}
        incompatibles={incompatibles}
      />,
    )

    // 成分
    expect(screen.getByText('有効成分A')).toBeInTheDocument()
    expect(screen.getByText('有効成分B')).toBeInTheDocument()
    expect(screen.getByText('10%')).toBeInTheDocument()
    expect(screen.getByText('F1')).toBeInTheDocument()
    expect(screen.getByText('I3')).toBeInTheDocument()

    // 効果: 日本語ラベル
    expect(screen.getByText('高')).toBeInTheDocument()
    expect(screen.getByText('中')).toBeInTheDocument()
    expect(screen.getByText('低')).toBeInTheDocument()
    // 未知ラベルは元の値をそのまま表示
    expect(screen.getByText('unknown')).toBeInTheDocument()
    // note
    expect(screen.getByText('備考1')).toBeInTheDocument()

    // 混用不可: リンクになっている
    const link = screen.getByRole('link', { name: /混用不可P/ })
    expect(link).toHaveAttribute('href', '/admin/pesticide-data/p-x')
  })
})

// ============================================================
// PesticideHistoryTimeline
// ============================================================

describe('PesticideHistoryTimeline', () => {
  it('空配列時は「更新履歴はありません」を表示する', () => {
    render(<PesticideHistoryTimeline history={[]} />)
    expect(screen.getByText('更新履歴はありません')).toBeInTheDocument()
  })

  it('create / update / delete の3種の action を日本語ラベルと共に表示する', () => {
    const history = [
      {
        id: 'h1',
        action: 'create',
        performedBy: 'admin-abcdef1234567890',
        createdAt: new Date('2026-04-01T10:00:00Z'),
        changes: null,
      },
      {
        id: 'h2',
        action: 'update',
        performedBy: 'admin-abcdef1234567890',
        createdAt: new Date('2026-04-02T10:00:00Z'),
        changes: { name: ['old', 'new'] },
      },
      {
        id: 'h3',
        action: 'delete',
        performedBy: 'admin-abcdef1234567890',
        createdAt: new Date('2026-04-03T10:00:00Z'),
        changes: null,
      },
    ]
    render(<PesticideHistoryTimeline history={history} />)
    expect(screen.getByText('作成')).toBeInTheDocument()
    expect(screen.getByText('更新')).toBeInTheDocument()
    expect(screen.getByText('削除')).toBeInTheDocument()
    // changes が存在するエントリのみ details を持つ
    expect(screen.getAllByText('変更内容を表示').length).toBe(1)
  })

  it('未知 action はラベルをそのまま表示する（dotColor / badge のデフォルト分岐）', () => {
    render(
      <PesticideHistoryTimeline
        history={[
          {
            id: 'h-unknown',
            action: 'unknown_action',
            performedBy: 'admin-abcdef1234567890',
            createdAt: new Date('2026-04-03T10:00:00Z'),
            changes: null,
          },
        ]}
      />,
    )
    expect(screen.getByText('unknown_action')).toBeInTheDocument()
  })
})
