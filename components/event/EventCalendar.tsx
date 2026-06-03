/**
 * @module components/event/EventCalendar
 */

'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
} from 'date-fns'
import { ja } from 'date-fns/locale'
import { CALENDAR_EVENTS_PER_DAY } from '@/lib/constants/limits'
import { buildEventPath } from '@/lib/constants/path-builders'

interface Event {
  id: string
  title: string
  startDate: Date
  endDate: Date | null
  prefecture: string | null
}

interface EventCalendarProps {
  events: Event[]
  onMonthChange?: (year: number, month: number) => void
  initialYear?: number
  initialMonth?: number
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m15 18-6-6 6-6"/>
    </svg>
  )
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 18 6-6-6-6"/>
    </svg>
  )
}

export function EventCalendar({ events, onMonthChange, initialYear, initialMonth }: EventCalendarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const getInitialDate = useCallback(() => {
    if (initialYear && initialMonth) {
      return new Date(initialYear, initialMonth - 1, 1)
    }
    return new Date()
  }, [initialYear, initialMonth])

  const [currentMonth, setCurrentMonth] = useState(getInitialDate)

  const updateUrlParams = useCallback((year: number, month: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('year', year.toString())
    params.set('month', (month + 1).toString())
    router.replace(`/events?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart)
  const calendarEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // ISO 文字列から日付部分を直接抽出し、UTC 変換による日付ずれを防ぐ
  const getDateString = (date: Date | string): string => {
    const isoString = typeof date === 'string' ? date : date.toISOString()
    const match = isoString.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match?.[1]) {
      return match[1]
    }
    return format(new Date(date), 'yyyy-MM-dd')
  }

  // 複数日にまたがるイベントも対象に、タイムゾーン非依存の日付文字列で比較する
  const getEventsForDay = (day: Date) => {
    const dayStr = format(day, 'yyyy-MM-dd')

    return events.filter((event) => {
      const startStr = getDateString(event.startDate)
      const endStr = event.endDate ? getDateString(event.endDate) : startStr
      return dayStr >= startStr && dayStr <= endStr
    })
  }

  const handlePrevMonth = () => {
    const newMonth = subMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    updateUrlParams(newMonth.getFullYear(), newMonth.getMonth())
    onMonthChange?.(newMonth.getFullYear(), newMonth.getMonth())
  }

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1)
    setCurrentMonth(newMonth)
    updateUrlParams(newMonth.getFullYear(), newMonth.getMonth())
    onMonthChange?.(newMonth.getFullYear(), newMonth.getMonth())
  }

  const handleToday = () => {
    const today = new Date()
    setCurrentMonth(today)
    updateUrlParams(today.getFullYear(), today.getMonth())
    onMonthChange?.(today.getFullYear(), today.getMonth())
  }

  return (
    <div className="bg-card rounded-lg border">
      <div className="flex items-center justify-between p-4 border-b">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="前月"
        >
          <ChevronLeftIcon className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">
            {format(currentMonth, 'yyyy年M月', { locale: ja })}
          </h2>
          <button
            onClick={handleToday}
            className="text-sm px-3 py-1 border rounded-lg hover:bg-muted transition-colors"
          >
            今日
          </button>
        </div>

        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-muted rounded-lg transition-colors"
          aria-label="次月"
        >
          <ChevronRightIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b">
        {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
          <div
            key={day}
            className={`text-center text-sm font-medium py-2 ${
              index === 0 ? 'text-muted-foreground' : index === 6 ? 'text-muted-foreground' : ''
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          const dayEvents = getEventsForDay(day)
          const isCurrentMonth = isSameMonth(day, currentMonth)
          const isCurrentDay = isToday(day)
          const dayOfWeek = day.getDay()

          return (
            <div
              key={day.toISOString()}
              className={`min-h-[100px] p-1 border-b border-r ${
                !isCurrentMonth ? 'bg-muted/30' : ''
              } ${index % 7 === 0 ? 'border-l' : ''}`}
            >
              <div
                className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                  isCurrentDay
                    ? 'bg-primary text-primary-foreground'
                    : dayOfWeek === 0
                    ? 'text-muted-foreground'
                    : dayOfWeek === 6
                    ? 'text-muted-foreground'
                    : ''
                } ${!isCurrentMonth ? 'text-muted-foreground' : ''}`}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, CALENDAR_EVENTS_PER_DAY).map((event) => (
                  <Link
                    key={event.id}
                    href={buildEventPath(event.id)}
                    className="block text-xs bg-primary/10 text-primary px-1 py-0.5 rounded truncate hover:bg-primary/20 transition-colors"
                  >
                    {event.title}
                  </Link>
                ))}
                {dayEvents.length > CALENDAR_EVENTS_PER_DAY && (
                  <div className="text-xs text-muted-foreground px-1">
                    +{dayEvents.length - CALENDAR_EVENTS_PER_DAY}件
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
