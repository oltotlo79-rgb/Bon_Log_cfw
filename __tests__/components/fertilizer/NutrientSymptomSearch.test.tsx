/**
 * @file NutrientSymptomSearch の検索・フィルタ・リンク検証テスト
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { NutrientSymptomSearch } from '@/components/fertilizer/NutrientSymptomSearch'

describe('NutrientSymptomSearch', () => {
  it('初期表示で全症状（12件）が並び、タグクラウドが表示される', () => {
    render(<NutrientSymptomSearch />)
    // 代表的な症状が複数含まれる
    expect(screen.getByText('下位葉の黄化')).toBeInTheDocument()
    expect(screen.getByText('新葉の黄化')).toBeInTheDocument()
    expect(screen.getByText('葉の縁が枯れる')).toBeInTheDocument()
    // タグクラウド
    expect(screen.getByRole('button', { name: '黄化' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '枯れる' })).toBeInTheDocument()
  })

  it('検索クエリ「黄化」で該当症状だけに絞り込まれる', () => {
    render(<NutrientSymptomSearch />)
    fireEvent.change(screen.getByPlaceholderText(/症状を入力/), {
      target: { value: '黄化' },
    })
    // 黄化を含む 3 件が残る
    expect(screen.getByText('下位葉の黄化')).toBeInTheDocument()
    expect(screen.getByText('新葉の黄化')).toBeInTheDocument()
    expect(screen.getByText('葉脈間の黄化')).toBeInTheDocument()
    // 含まない症状は消える
    expect(screen.queryByText('葉の縁が枯れる')).not.toBeInTheDocument()
  })

  it('タグボタンをクリックするとクエリが設定され絞り込まれる', () => {
    render(<NutrientSymptomSearch />)
    fireEvent.click(screen.getByRole('button', { name: '紫色' }))
    const input = screen.getByPlaceholderText(/症状を入力/) as HTMLInputElement
    expect(input.value).toBe('紫色')
    expect(screen.getByText('葉が紫色')).toBeInTheDocument()
  })

  it('元素記号 (Fe 等) でも検索できる', () => {
    render(<NutrientSymptomSearch />)
    fireEvent.change(screen.getByPlaceholderText(/症状を入力/), {
      target: { value: 'Fe' },
    })
    // 鉄が関連する症状がヒット
    expect(screen.getByText('新葉の黄化')).toBeInTheDocument()
    expect(screen.getByText('葉脈間の黄化')).toBeInTheDocument()
  })

  it('該当しないクエリで「該当する症状が見つかりませんでした」を表示', () => {
    render(<NutrientSymptomSearch />)
    fireEvent.change(screen.getByPlaceholderText(/症状を入力/), {
      target: { value: 'xyz_no_match' },
    })
    expect(screen.getByText('該当する症状が見つかりませんでした')).toBeInTheDocument()
  })

  it('severity に応じて重度/中度/軽度のバッジが表示される', () => {
    render(<NutrientSymptomSearch />)
    // 重度の「下位葉の黄化」に「重度」バッジがある
    const highEntry = screen.getByText('下位葉の黄化').closest('div')?.parentElement
    expect(highEntry).not.toBeNull()
    expect(within(highEntry!).getByText('重度')).toBeInTheDocument()
    // 低重度の「耐寒性の低下」に「軽度」バッジ
    const lowEntry = screen.getByText('耐寒性の低下').closest('div')?.parentElement
    expect(lowEntry).not.toBeNull()
    expect(within(lowEntry!).getByText('軽度')).toBeInTheDocument()
  })

  it('各 nutrient エントリは /fertilizers/nutrients/<slug> へのリンクを持つ', () => {
    render(<NutrientSymptomSearch />)
    fireEvent.change(screen.getByPlaceholderText(/症状を入力/), {
      target: { value: '縁が枯れる' },
    })
    const link = screen.getByRole('link', { name: /カリウム/ })
    expect(link).toHaveAttribute('href', '/fertilizers/nutrients/potassium')
  })

  it('空文字・空白のみのクエリでは全件表示に戻る', () => {
    render(<NutrientSymptomSearch />)
    const input = screen.getByPlaceholderText(/症状を入力/)
    fireEvent.change(input, { target: { value: '紫色' } })
    expect(screen.queryByText('下位葉の黄化')).not.toBeInTheDocument()

    fireEvent.change(input, { target: { value: '   ' } })
    // 全件が復活
    expect(screen.getByText('下位葉の黄化')).toBeInTheDocument()
    expect(screen.getByText('全体の生育停滞')).toBeInTheDocument()
  })
})
