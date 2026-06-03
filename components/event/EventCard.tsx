/**
 * @module components/event/EventCard
 */

import Link from 'next/link'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'
import { buildEventPath } from '@/lib/constants/path-builders'

interface EventCardProps {
  event: {
    id: string
    title: string
    startDate: Date
    endDate: Date | null
    prefecture: string | null
    city: string | null
    venue: string | null
    admissionFee: string | null
    hasSales: boolean
  }
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
      <line x1="16" x2="16" y1="2" y2="6"/>
      <line x1="8" x2="8" y1="2" y2="6"/>
      <line x1="3" x2="21" y1="10" y2="10"/>
    </svg>
  )
}

function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>
  )
}

function formatEventDate(startDate: Date, endDate: Date | null): string {
  const start = new Date(startDate)
  const startStr = format(start, 'M月d日(E)', { locale: ja })

  if (!endDate) {
    return startStr
  }

  const end = new Date(endDate)
  if (start.toDateString() === end.toDateString()) {
    return startStr
  }

  const endStr = format(end, 'M月d日(E)', { locale: ja })
  return `${startStr} 〜 ${endStr}`
}

export function EventCard({ event }: EventCardProps) {
  const now = new Date()
  const startDate = new Date(event.startDate)
  const endDate = event.endDate ? new Date(event.endDate) : null

  const isEnded = endDate ? endDate < now : startDate < now
  // 終了日がない単日イベントは「開催中」にしない
  const isOngoing = !isEnded && startDate <= now && endDate && endDate >= now

  return (
    <Link
      href={buildEventPath(event.id)}
      className={`block bg-card border rounded-lg p-4 hover:bg-muted/50 transition-colors ${
        isEnded ? 'opacity-60' : ''
      }`}
    >
      <h3 className="font-semibold mb-2 line-clamp-2">{event.title}</h3>

      <div className="space-y-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 flex-shrink-0" />
          <span>{formatEventDate(event.startDate, event.endDate)}</span>
        </div>

        {(event.prefecture || event.city || event.venue) && (
          <div className="flex items-center gap-2">
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            <span>
              {event.prefecture}
              {event.city && ` ${event.city}`}
              {event.venue && ` / ${event.venue}`}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mt-3">
        {event.admissionFee && (
          <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
            {event.admissionFee}
          </span>
        )}
        {event.hasSales && (
          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
            即売あり
          </span>
        )}
        {isEnded && (
          <span className="text-xs px-2 py-0.5 bg-muted-foreground/20 text-muted-foreground rounded-full">
            終了
          </span>
        )}
        {isOngoing && (
          <span className="text-xs px-2 py-0.5 bg-muted/50 text-muted-foreground rounded-full">
            開催中
          </span>
        )}
      </div>
    </Link>
  )
}
