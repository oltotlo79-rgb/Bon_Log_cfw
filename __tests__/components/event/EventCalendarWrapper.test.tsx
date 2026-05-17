import { vi } from 'vitest'
/**
 * イベントカレンダーラッパーコンポーネントのテスト
 */

import { render, screen } from '../../utils/test-utils'
import React from 'react'

// EventCalendarのモック（直接インポートされるためコンポーネント自体をモック）
const mockEventCalendar = vi.fn()
vi.mock('@/components/event/EventCalendar', () => ({
  EventCalendar: (props: Record<string, unknown>) => {
    mockEventCalendar(props)
    return <div data-testid="event-calendar">{JSON.stringify(props)}</div>
  },
}))

import { EventCalendarWrapper } from '@/components/event/EventCalendarWrapper'

describe('EventCalendarWrapper', () => {
  const sampleEvents = [
    {
      id: 'event-1',
      title: '盆栽展示会',
      startDate: new Date('2025-06-01'),
      endDate: new Date('2025-06-03'),
      prefecture: '東京都',
    },
    {
      id: 'event-2',
      title: '盆栽ワークショップ',
      startDate: new Date('2025-07-15'),
      endDate: null,
      prefecture: '大阪府',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // 1
  it('ラッパーコンポーネントをレンダリングする', () => {
    render(<EventCalendarWrapper events={sampleEvents} />)
    expect(screen.getByTestId('event-calendar')).toBeInTheDocument()
  })

  // 2
  it('eventsをカレンダーに渡す', () => {
    render(<EventCalendarWrapper events={sampleEvents} />)
    expect(mockEventCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        events: sampleEvents,
      })
    )
  })

  // 3
  it('initialYearをカレンダーに渡す', () => {
    render(<EventCalendarWrapper events={sampleEvents} initialYear={2025} />)
    expect(mockEventCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        initialYear: 2025,
      })
    )
  })

  // 4
  it('initialMonthをカレンダーに渡す', () => {
    render(<EventCalendarWrapper events={sampleEvents} initialMonth={6} />)
    expect(mockEventCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        initialMonth: 6,
      })
    )
  })

  // 5
  it('initialYear未指定時はundefinedが渡される', () => {
    render(<EventCalendarWrapper events={sampleEvents} />)
    expect(mockEventCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        initialYear: undefined,
      })
    )
  })

  // 6
  it('initialMonth未指定時はundefinedが渡される', () => {
    render(<EventCalendarWrapper events={sampleEvents} />)
    expect(mockEventCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        initialMonth: undefined,
      })
    )
  })

  // 7
  it('空のイベント配列で正常に動作する', () => {
    render(<EventCalendarWrapper events={[]} />)
    expect(mockEventCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [],
      })
    )
  })

  // 8
  it('多数のイベントで正常に動作する', () => {
    const manyEvents = Array.from({ length: 100 }, (_, i) => ({
      id: `event-${i}`,
      title: `イベント${i}`,
      startDate: new Date('2025-01-01'),
      endDate: null,
      prefecture: '東京都',
    }))
    render(<EventCalendarWrapper events={manyEvents} />)
    expect(mockEventCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        events: manyEvents,
      })
    )
  })

  // 9
  it('カレンダーが正しいpropsで表示される', () => {
    render(<EventCalendarWrapper events={sampleEvents} initialYear={2025} initialMonth={3} />)
    expect(mockEventCalendar).toHaveBeenCalledWith({
      events: sampleEvents,
      initialYear: 2025,
      initialMonth: 3,
    })
  })

  // 10
  it('コンポーネントがDOMに存在する', () => {
    const { container } = render(<EventCalendarWrapper events={sampleEvents} />)
    expect(container.firstChild).toBeTruthy()
  })

  // 11
  it('EventCalendarが直接レンダリングされる', () => {
    render(<EventCalendarWrapper events={sampleEvents} />)
    expect(screen.getByTestId('event-calendar')).toBeInTheDocument()
  })

  // 12
  it('再レンダリングが正常に動作する', () => {
    const { rerender } = render(<EventCalendarWrapper events={sampleEvents} />)
    const updatedEvents = [...sampleEvents, {
      id: 'event-3',
      title: '新規イベント',
      startDate: new Date('2025-08-01'),
      endDate: null,
      prefecture: '京都府',
    }]
    rerender(<EventCalendarWrapper events={updatedEvents} />)
    expect(mockEventCalendar).toHaveBeenLastCalledWith(
      expect.objectContaining({
        events: updatedEvents,
      })
    )
  })

  // 13
  it('initialYearとinitialMonthを両方渡せる', () => {
    render(<EventCalendarWrapper events={sampleEvents} initialYear={2026} initialMonth={12} />)
    expect(mockEventCalendar).toHaveBeenCalledWith(
      expect.objectContaining({
        initialYear: 2026,
        initialMonth: 12,
      })
    )
  })
})
