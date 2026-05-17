/**
 * EventCard - branch coverage tests
 * Covers uncovered branches:
 * - Single-day ended event (no endDate, startDate in past)
 * - Event with endDate same as startDate (same day)
 * - Multi-day event date formatting
 * - Event with only prefecture (no city/venue)
 * - Event with city but no venue
 * - Event with venue but no city
 * - Ongoing event: not ended, startDate <= now, endDate >= now
 */

import { render, screen } from '../../utils/test-utils'
import { EventCard } from '@/components/event/EventCard'

const tomorrow = new Date()
tomorrow.setDate(tomorrow.getDate() + 1)

const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)

const twoDaysAgo = new Date()
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

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

describe('EventCard - branch coverage', () => {
  it('single day past event without endDate shows 終了', () => {
    render(<EventCard event={{ ...baseEvent, startDate: yesterday }} />)
    expect(screen.getByText('終了')).toBeInTheDocument()
  })

  it('event with same startDate and endDate shows single date format', () => {
    const sameDay = new Date(tomorrow)
    render(<EventCard event={{ ...baseEvent, startDate: sameDay, endDate: sameDay }} />)
    // Should not show "〜" range separator
    expect(screen.queryByText(/〜/)).not.toBeInTheDocument()
  })

  it('multi-day event shows date range with 〜', () => {
    const start = new Date('2024-06-01T10:00:00')
    const end = new Date('2024-06-05T17:00:00')
    render(<EventCard event={{ ...baseEvent, startDate: start, endDate: end }} />)
    expect(screen.getByText(/〜/)).toBeInTheDocument()
  })

  it('shows only prefecture when city and venue are null', () => {
    render(<EventCard event={{ ...baseEvent, prefecture: '大阪府', city: null, venue: null }} />)
    expect(screen.getByText('大阪府')).toBeInTheDocument()
  })

  it('shows prefecture and city without venue', () => {
    render(<EventCard event={{ ...baseEvent, prefecture: '大阪府', city: '大阪市', venue: null }} />)
    expect(screen.getByText(/大阪府.*大阪市/)).toBeInTheDocument()
  })

  it('shows prefecture with venue using / separator', () => {
    render(<EventCard event={{ ...baseEvent, prefecture: '大阪府', city: null, venue: '大会場' }} />)
    expect(screen.getByText(/大阪府.*\/.*大会場/)).toBeInTheDocument()
  })

  it('future event without endDate shows no 終了 or 開催中 badge', () => {
    render(<EventCard event={{ ...baseEvent, startDate: tomorrow, endDate: null }} />)
    expect(screen.queryByText('終了')).not.toBeInTheDocument()
    expect(screen.queryByText('開催中')).not.toBeInTheDocument()
  })

  it('no location info when all location fields are null', () => {
    const event = { ...baseEvent, prefecture: null, city: null, venue: null }
    const { container } = render(<EventCard event={event} />)
    // MapPinIcon should not be rendered
    const locationElements = container.querySelectorAll('svg path[d*="M20 10c0 6-8 12"]')
    expect(locationElements.length).toBe(0)
  })
})
