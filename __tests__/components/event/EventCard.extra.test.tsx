/**
 * EventCard - extra branch coverage
 *
 * Targets:
 * - Ongoing event badge (startDate <= now && endDate >= now)
 * - Event with admissionFee shows fee badge
 * - Event with hasSales shows 即売あり badge
 * - Event with all location fields (prefecture + city + venue)
 */

import { render, screen } from '../../utils/test-utils'
import { EventCard } from '@/components/event/EventCard'

describe('EventCard - extra branches', () => {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const baseEvent = {
    id: 'event-1',
    title: 'テストイベント',
    startDate: tomorrow,
    endDate: null,
    prefecture: '東京都',
    city: null,
    venue: null,
    admissionFee: null,
    hasSales: false,
  }

  it('ongoing event (started, not ended) shows 開催中 badge', () => {
    const futureEnd = new Date()
    futureEnd.setDate(futureEnd.getDate() + 5)

    render(
      <EventCard event={{
        ...baseEvent,
        startDate: yesterday,
        endDate: futureEnd,
      }} />
    )

    expect(screen.getByText('開催中')).toBeInTheDocument()
    expect(screen.queryByText('終了')).not.toBeInTheDocument()
  })

  it('event with admissionFee shows fee badge', () => {
    render(
      <EventCard event={{
        ...baseEvent,
        admissionFee: '500円',
      }} />
    )

    expect(screen.getByText('500円')).toBeInTheDocument()
  })

  it('event with hasSales shows 即売あり badge', () => {
    render(
      <EventCard event={{
        ...baseEvent,
        hasSales: true,
      }} />
    )

    expect(screen.getByText('即売あり')).toBeInTheDocument()
  })

  it('event with all location fields shows full location string', () => {
    render(
      <EventCard event={{
        ...baseEvent,
        prefecture: '埼玉県',
        city: 'さいたま市',
        venue: '大宮盆栽美術館',
      }} />
    )

    expect(screen.getByText(/埼玉県.*さいたま市.*\/.*大宮盆栽美術館/)).toBeInTheDocument()
  })

  it('ended event with endDate in past shows 終了 and opacity', () => {
    const pastEnd = new Date()
    pastEnd.setDate(pastEnd.getDate() - 2)

    const { container } = render(
      <EventCard event={{
        ...baseEvent,
        startDate: new Date(pastEnd.getTime() - 86400000),
        endDate: pastEnd,
      }} />
    )

    expect(screen.getByText('終了')).toBeInTheDocument()
    expect(container.querySelector('.opacity-60')).toBeInTheDocument()
  })
})
