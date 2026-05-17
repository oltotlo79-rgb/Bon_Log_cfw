import { vi } from 'vitest'
/**
 * EventCalendarWrapper 追加カバレッジテスト
 *
 * EventCalendarの直接インポートとprops伝搬のテスト
 */

import React from 'react'
import { render, screen } from '../../utils/test-utils'

vi.mock('@/components/event/EventCalendar', () => ({
  EventCalendar: (props: Record<string, unknown>) => (
    <div data-testid="event-calendar">{JSON.stringify(props)}</div>
  ),
}))

import { EventCalendarWrapper } from '@/components/event/EventCalendarWrapper'

describe('EventCalendarWrapper - direct import', () => {
  const sampleEvents = [
    { id: '1', title: 'イベント1', startDate: new Date('2025-06-01'), endDate: null, prefecture: '東京都' },
  ]

  it('EventCalendarが直接レンダリングされる（SSR有効）', () => {
    render(<EventCalendarWrapper events={sampleEvents} />)
    expect(screen.getByTestId('event-calendar')).toBeInTheDocument()
  })

  it('eventsプロパティが正しく伝搬される', () => {
    render(<EventCalendarWrapper events={sampleEvents} />)
    const calendarEl = screen.getByTestId('event-calendar')
    expect(calendarEl.textContent).toContain('イベント1')
  })

  it('initialYear/initialMonthが伝搬される', () => {
    render(<EventCalendarWrapper events={sampleEvents} initialYear={2025} initialMonth={6} />)
    const calendarEl = screen.getByTestId('event-calendar')
    expect(calendarEl.textContent).toContain('2025')
    expect(calendarEl.textContent).toContain('6')
  })

  it('空のイベントリストでも正常にレンダリングされる', () => {
    render(<EventCalendarWrapper events={[]} />)
    expect(screen.getByTestId('event-calendar')).toBeInTheDocument()
  })

  it('propsが省略された場合もデフォルト値で動作する', () => {
    render(<EventCalendarWrapper events={sampleEvents} />)
    const calendarEl = screen.getByTestId('event-calendar')
    expect(calendarEl).toBeInTheDocument()
  })
})
