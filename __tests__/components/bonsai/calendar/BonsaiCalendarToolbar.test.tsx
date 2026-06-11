import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BonsaiCareType } from '@prisma/client'

import { BonsaiCalendarToolbar } from '@/components/bonsai/calendar/BonsaiCalendarToolbar'
import {
  CALENDAR_MODE_HALF_YEAR,
  CALENDAR_MODE_MONTH,
  CALENDAR_MODE_YEAR,
} from '@/lib/constants/bonsai-care'

const mockReplace = vi.fn()
const mockUseSearchParams = vi.fn()
vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return {
    ...actual,
    useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: vi.fn(), back: vi.fn(), forward: vi.fn(), prefetch: vi.fn() }),
    useSearchParams: () => mockUseSearchParams(),
  }
})

function setup(overrides?: Partial<Parameters<typeof BonsaiCalendarToolbar>[0]>) {
  const onToggleType = vi.fn()
  const onToggleOverlay = vi.fn()
  const onAddClick = vi.fn()
  render(
    <BonsaiCalendarToolbar
      mode={CALENDAR_MODE_MONTH}
      anchor={new Date(2026, 3, 1)}
      selectedTypes={new Set()}
      selectedOverlays={new Set()}
      onToggleType={onToggleType}
      onToggleOverlay={onToggleOverlay}
      onAddClick={onAddClick}
      {...overrides}
    />,
  )
  return { onToggleType, onToggleOverlay, onAddClick }
}

describe('BonsaiCalendarToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseSearchParams.mockReturnValue(new URLSearchParams('view=calendar&mode=month&anchor=2026-04'))
  })

  it('タイトルを表示', () => {
    setup({ mode: CALENDAR_MODE_MONTH })
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('2026年4月')
  })

  it('複数月モードのタイトルにモード名を含む', () => {
    setup({ mode: CALENDAR_MODE_HALF_YEAR })
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('6ヶ月')
  })

  it('前の月ボタンで anchor=2026-03 に router.replace', () => {
    setup({ mode: CALENDAR_MODE_MONTH })
    fireEvent.click(screen.getByRole('button', { name: '前の月' }))
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('anchor=2026-03'),
      { scroll: false },
    )
  })

  it('次の月ボタンで anchor=2026-05 に router.replace', () => {
    setup({ mode: CALENDAR_MODE_MONTH })
    fireEvent.click(screen.getByRole('button', { name: '次の月' }))
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('anchor=2026-05'),
      { scroll: false },
    )
  })

  it('全モードで ←→ は ±1 ヶ月のみ移動（half-year でも 6 ヶ月戻らない）', () => {
    setup({ mode: CALENDAR_MODE_HALF_YEAR })
    fireEvent.click(screen.getByRole('button', { name: '次の月' }))
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('anchor=2026-05'),
      { scroll: false },
    )
  })

  it('全モードで ←→ は ±1 ヶ月のみ移動（year でも 12 ヶ月戻らない）', () => {
    setup({ mode: CALENDAR_MODE_YEAR })
    fireEvent.click(screen.getByRole('button', { name: '前の月' }))
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('anchor=2026-03'),
      { scroll: false },
    )
  })

  it('「今日」ボタンで anchor を現在月にリセット', () => {
    setup({ mode: CALENDAR_MODE_MONTH })
    fireEvent.click(screen.getByRole('button', { name: '今日' }))
    expect(mockReplace).toHaveBeenCalledTimes(1)
    // 引数に anchor= を含む（具体年月は実行時依存のため正規表現で）
    expect(mockReplace.mock.calls[0]![0]!).toMatch(/anchor=\d{4}-(0[1-9]|1[0-2])/)
  })

  it('モードタブクリックで href が mode を切り替える', () => {
    setup({ mode: CALENDAR_MODE_MONTH })
    const halfYearTab = screen.getByRole('tab', { name: '6ヶ月' })
    expect(halfYearTab.getAttribute('href')).toContain('mode=half-year')
  })

  it('種別フィルタのチェックボックスをクリックすると onToggleType', () => {
    const { onToggleType } = setup({ mode: CALENDAR_MODE_MONTH })
    // 「消毒」ラベルをクリック
    fireEvent.click(screen.getByLabelText('消毒'))
    expect(onToggleType).toHaveBeenCalledWith(BonsaiCareType.pesticide)
  })

  it('「記録追加」ボタンで onAddClick', () => {
    const { onAddClick } = setup({ mode: CALENDAR_MODE_MONTH })
    fireEvent.click(screen.getByRole('button', { name: /記録追加/ }))
    expect(onAddClick).toHaveBeenCalled()
  })

  it('selectedTypes に含まれる種別はチェック済みで描画', () => {
    setup({
      mode: CALENDAR_MODE_MONTH,
      selectedTypes: new Set([BonsaiCareType.pesticide]),
    })
    const checkbox = screen.getByLabelText('消毒') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
  })

  it('各フィルタチップに種別色ドットを描画（凡例として機能）', () => {
    const { container } = render(
      <BonsaiCalendarToolbar
        mode={CALENDAR_MODE_MONTH}
        anchor={new Date(2026, 3, 1)}
        selectedTypes={new Set()}
        selectedOverlays={new Set()}
        onToggleType={vi.fn()}
        onToggleOverlay={vi.fn()}
        onAddClick={vi.fn()}
      />,
    )
    const pesticideDot = container.querySelector('[data-care-type="pesticide"]')
    expect(pesticideDot).not.toBeNull()
    expect(pesticideDot?.className).toContain('bg-red-500')

    const solidFertDot = container.querySelector('[data-care-type="solid_fertilizer"]')
    expect(solidFertDot?.className).toContain('bg-amber-500')

    const muroInDot = container.querySelector('[data-care-type="muro_in"]')
    expect(muroInDot?.className).toContain('bg-indigo-500')
  })

  it('成長記録 / タグ付け投稿の凡例チップとフィルタを描画する', () => {
    const { container } = render(
      <BonsaiCalendarToolbar
        mode={CALENDAR_MODE_MONTH}
        anchor={new Date(2026, 3, 1)}
        selectedTypes={new Set()}
        selectedOverlays={new Set()}
        onToggleType={vi.fn()}
        onToggleOverlay={vi.fn()}
        onAddClick={vi.fn()}
      />,
    )
    const recordDot = container.querySelector('[data-overlay-kind="record"]')
    expect(recordDot).not.toBeNull()
    expect(recordDot?.className).toContain('bg-lime-600')

    const postDot = container.querySelector('[data-overlay-kind="post"]')
    expect(postDot).not.toBeNull()
    expect(postDot?.className).toContain('bg-pink-500')
  })

  it('overlay フィルタチップをクリックすると onToggleOverlay が呼ばれる', () => {
    const { onToggleOverlay } = setup({})
    fireEvent.click(screen.getByLabelText('成長記録'))
    expect(onToggleOverlay).toHaveBeenCalledWith('record')
    fireEvent.click(screen.getByLabelText('タグ付け投稿'))
    expect(onToggleOverlay).toHaveBeenCalledWith('post')
  })
})
