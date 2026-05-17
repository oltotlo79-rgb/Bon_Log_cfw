/**
 * CalendarWithNavigation の rendering / 月クリック時のナビゲーション挙動
 *
 * router.push が `/hormones/simulator?month={month}` で呼ばれることを担保する。
 */

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// HormoneAnnualCalendar をモックして onMonthClick の到達と引数を検証する
vi.mock('@/components/hormone/HormoneAnnualCalendar', () => ({
  HormoneAnnualCalendar: ({ hormones, onMonthClick }: { hormones: unknown[]; onMonthClick: (m: number) => void }) => (
    <div data-testid="cal">
      <span data-testid="hormone-count">{hormones.length}</span>
      <button data-testid="m1" onClick={() => onMonthClick(1)}>1月</button>
      <button data-testid="m6" onClick={() => onMonthClick(6)}>6月</button>
      <button data-testid="m12" onClick={() => onMonthClick(12)}>12月</button>
    </div>
  ),
}))

import { CalendarWithNavigation } from '@/app/(main)/hormones/calendar/CalendarWithNavigation'

const sampleHormones = [
  { name: 'オーキシン', slug: 'auxin', seasonalLevels: [] },
  { name: 'ジベレリン', slug: 'gibberellin', seasonalLevels: [] },
]

describe('CalendarWithNavigation', () => {
  it('hormones を HormoneAnnualCalendar に渡す', () => {
    const { getByTestId } = render(<CalendarWithNavigation hormones={sampleHormones} />)
    expect(getByTestId('hormone-count').textContent).toBe('2')
  })

  it('1月クリックで /hormones/simulator?month=1 に push', () => {
    const { getByTestId } = render(<CalendarWithNavigation hormones={sampleHormones} />)
    getByTestId('m1').click()
    expect(mockPush).toHaveBeenCalledWith('/hormones/simulator?month=1')
  })

  it('6月クリックで month=6', () => {
    mockPush.mockClear()
    const { getByTestId } = render(<CalendarWithNavigation hormones={sampleHormones} />)
    getByTestId('m6').click()
    expect(mockPush).toHaveBeenCalledWith('/hormones/simulator?month=6')
  })

  it('12月クリックで month=12（境界）', () => {
    mockPush.mockClear()
    const { getByTestId } = render(<CalendarWithNavigation hormones={sampleHormones} />)
    getByTestId('m12').click()
    expect(mockPush).toHaveBeenCalledWith('/hormones/simulator?month=12')
  })

  it('hormones が空でも例外を投げない', () => {
    expect(() => render(<CalendarWithNavigation hormones={[]} />)).not.toThrow()
  })
})
