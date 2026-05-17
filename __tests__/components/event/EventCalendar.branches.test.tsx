/**
 * EventCalendar - branch coverage tests
 *
 * Targets:
 * - initialYear/initialMonth props to set initial date
 * - getDateString fallback path (ISO match fails)
 * - dayEvents.length > CALENDAR_EVENTS_PER_DAY showing "+X件"
 * - Multi-day event spanning across days
 * - Event without endDate treated as single-day
 * - onMonthChange callback on prev/next/today
 * - Today button resets to current month
 * - Day not in current month gets dimmed background
 * - Weekend (Sunday/Saturday) day number colors
 */

import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { EventCalendar } from '@/components/event/EventCalendar'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

describe('EventCalendar - branch coverage', () => {
  const mockOnMonthChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initialYear/initialMonth sets the initial displayed month', () => {
    render(
      <EventCalendar
        events={[]}
        initialYear={2025}
        initialMonth={3}
      />
    )

    expect(screen.getByText('2025年3月')).toBeInTheDocument()
  })

  it('前月ボタンでonMonthChangeが呼ばれる', () => {
    render(
      <EventCalendar
        events={[]}
        initialYear={2025}
        initialMonth={6}
        onMonthChange={mockOnMonthChange}
      />
    )

    fireEvent.click(screen.getByLabelText('前月'))

    expect(screen.getByText('2025年5月')).toBeInTheDocument()
    expect(mockOnMonthChange).toHaveBeenCalledWith(2025, 4) // May = month 4 (0-indexed)
  })

  it('次月ボタンでonMonthChangeが呼ばれる', () => {
    render(
      <EventCalendar
        events={[]}
        initialYear={2025}
        initialMonth={6}
        onMonthChange={mockOnMonthChange}
      />
    )

    fireEvent.click(screen.getByLabelText('次月'))

    expect(screen.getByText('2025年7月')).toBeInTheDocument()
    expect(mockOnMonthChange).toHaveBeenCalledWith(2025, 6) // July = month 6
  })

  it('今日ボタンで現在月に戻りonMonthChangeが呼ばれる', () => {
    render(
      <EventCalendar
        events={[]}
        initialYear={2020}
        initialMonth={1}
        onMonthChange={mockOnMonthChange}
      />
    )

    fireEvent.click(screen.getByText('今日'))

    const now = new Date()
    expect(mockOnMonthChange).toHaveBeenCalledWith(now.getFullYear(), now.getMonth())
  })

  it('4件以上のイベントがある日には+X件が表示される', () => {
    const events = Array.from({ length: 5 }, (_, i) => ({
      id: `event-${i}`,
      title: `イベント${i}`,
      startDate: new Date(2025, 5, 15), // June 15, 2025
      endDate: null,
      prefecture: '東京都',
    }))

    render(
      <EventCalendar
        events={events}
        initialYear={2025}
        initialMonth={6}
      />
    )

    expect(screen.getByText('+2件')).toBeInTheDocument()
  })

  it('複数日にまたがるイベントが各日に表示される', () => {
    const events = [{
      id: 'multi-day',
      title: '長期イベント',
      startDate: new Date(2025, 5, 10), // June 10
      endDate: new Date(2025, 5, 12),   // June 12
      prefecture: '東京都',
    }]

    render(
      <EventCalendar
        events={events}
        initialYear={2025}
        initialMonth={6}
      />
    )

    // The event should appear on all 3 days
    const eventLinks = screen.getAllByText('長期イベント')
    expect(eventLinks.length).toBe(3)
  })

  it('endDateがないイベントは開始日のみに表示される', () => {
    const events = [{
      id: 'single-day',
      title: '単日イベント',
      startDate: new Date(2025, 5, 20),
      endDate: null,
      prefecture: '東京都',
    }]

    render(
      <EventCalendar
        events={events}
        initialYear={2025}
        initialMonth={6}
      />
    )

    const eventLinks = screen.getAllByText('単日イベント')
    expect(eventLinks.length).toBe(1)
  })

  it('onMonthChangeが未指定でもエラーにならない', () => {
    render(
      <EventCalendar
        events={[]}
        initialYear={2025}
        initialMonth={6}
      />
    )

    // Should not throw
    fireEvent.click(screen.getByLabelText('前月'))
    fireEvent.click(screen.getByLabelText('次月'))
    fireEvent.click(screen.getByText('今日'))
  })
})
