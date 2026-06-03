/**
 * @module components/event/EventCalendarWrapper
 */

'use client'

import { EventCalendar } from './EventCalendar'

interface Event {
  id: string
  title: string
  startDate: Date
  endDate: Date | null
  prefecture: string | null
}

interface EventCalendarWrapperProps {
  events: Event[]
  initialYear?: number
  initialMonth?: number
}

export function EventCalendarWrapper({ events, initialYear, initialMonth }: EventCalendarWrapperProps) {
  return <EventCalendar events={events} initialYear={initialYear} initialMonth={initialMonth} />
}
