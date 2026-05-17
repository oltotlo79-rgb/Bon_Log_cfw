/**
 * NutrientAbsorptionDiagram - SVG 図解の状態分岐テスト
 *
 * 6 種の栄養素ボタン（N, P, K, Ca, Mg, Fe）のクリックで:
 * - 詳細パネルの表示・非表示
 * - 移動性（緑）/ 非移動性（アンバー）の色分岐
 * - 同一ボタン再クリックでトグル解除
 * - SVG 内のイオン円も再クリックで選択できる
 * を検証する。
 */

import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import { NutrientAbsorptionDiagram } from '@/components/fertilizer/NutrientAbsorptionDiagram'

describe('NutrientAbsorptionDiagram', () => {
  it('初期表示: 詳細パネルは表示されない、ヒントテキストが見える', () => {
    render(<NutrientAbsorptionDiagram />)
    // ヒントテキストは selected が null の時のみ
    expect(screen.getByText(/栄養素アイコンをタップして吸収経路を表示/)).toBeInTheDocument()
    // 凡例
    expect(screen.getByText(/移動性（師管で再転流）/)).toBeInTheDocument()
    expect(screen.getByText(/非移動性（道管のみ）/)).toBeInTheDocument()
  })

  it('6 つの栄養素ボタンがすべてレンダリングされる', () => {
    render(<NutrientAbsorptionDiagram />)
    expect(screen.getByRole('button', { name: /^N\s*窒素$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^P\s*リン酸$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^K\s*カリウム$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ca\s*カルシウム$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Mg\s*マグネシウム$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Fe\s*鉄$/ })).toBeInTheDocument()
  })

  it('窒素（移動性）を選択すると詳細パネルが表示され「移動性」バッジが付く', () => {
    render(<NutrientAbsorptionDiagram />)
    fireEvent.click(screen.getByRole('button', { name: /^N\s*窒素$/ }))
    // 詳細見出し
    expect(screen.getByText(/窒素（N）/)).toBeInTheDocument()
    // 移動性バッジ
    expect(screen.getByText('移動性')).toBeInTheDocument()
    // 非移動性は出ないはず
    expect(screen.queryByText('非移動性')).not.toBeInTheDocument()
    // 詳細セクション (吸収/役割/転流) が出る
    expect(screen.getByText('吸収:')).toBeInTheDocument()
    expect(screen.getByText('役割:')).toBeInTheDocument()
    expect(screen.getByText('転流:')).toBeInTheDocument()
    // ヒントは消える
    expect(screen.queryByText(/栄養素アイコンをタップして吸収経路を表示/)).not.toBeInTheDocument()
  })

  it('カルシウム（非移動性）を選択すると「非移動性」バッジが付く', () => {
    render(<NutrientAbsorptionDiagram />)
    fireEvent.click(screen.getByRole('button', { name: /^Ca\s*カルシウム$/ }))
    expect(screen.getByText('非移動性')).toBeInTheDocument()
    expect(screen.queryByText('移動性')).not.toBeInTheDocument()
    expect(screen.getByText(/カルシウム（Ca）/)).toBeInTheDocument()
  })

  it('鉄（非移動性）を選択すると詳細リンクのhrefが /fertilizers/nutrients/iron になる', () => {
    render(<NutrientAbsorptionDiagram />)
    fireEvent.click(screen.getByRole('button', { name: /^Fe\s*鉄$/ }))
    const link = screen.getByRole('link', { name: /鉄の詳細ページへ/ })
    expect(link).toHaveAttribute('href', '/fertilizers/nutrients/iron')
  })

  it('別の栄養素ボタンをクリックすると詳細が切り替わる', () => {
    render(<NutrientAbsorptionDiagram />)
    fireEvent.click(screen.getByRole('button', { name: /^N\s*窒素$/ }))
    expect(screen.getByText(/窒素（N）/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^K\s*カリウム$/ }))
    expect(screen.getByText(/カリウム（K）/)).toBeInTheDocument()
    expect(screen.queryByText(/窒素（N）/)).not.toBeInTheDocument()
  })

  it('同じ栄養素ボタンを再クリックすると選択解除（トグル）される', () => {
    render(<NutrientAbsorptionDiagram />)
    const nButton = screen.getByRole('button', { name: /^N\s*窒素$/ })
    fireEvent.click(nButton)
    expect(screen.getByText(/窒素（N）/)).toBeInTheDocument()
    fireEvent.click(nButton)
    // パネルもヒントも切り替わる
    expect(screen.queryByText(/窒素（N）/)).not.toBeInTheDocument()
    expect(screen.getByText(/栄養素アイコンをタップして吸収経路を表示/)).toBeInTheDocument()
  })

  it('SVG 内のイオン円グループ（onClick が g にバインドされた）からも選択できる', () => {
    const { container } = render(<NutrientAbsorptionDiagram />)
    // SVG 内の <g> でクリック可能なものを探す
    const groups = container.querySelectorAll('g.cursor-pointer')
    expect(groups.length).toBe(6) // 6 nutrients
    fireEvent.click(groups[0]!)
    // 何かが選択された（窒素の詳細）
    expect(screen.getByText(/窒素（N）/)).toBeInTheDocument()
  })

  it('SVG aria-label が「栄養素の吸収経路図」', () => {
    const { container } = render(<NutrientAbsorptionDiagram />)
    const svg = container.querySelector('svg[aria-label]')
    expect(svg).toHaveAttribute('aria-label', '栄養素の吸収経路図')
  })
})
