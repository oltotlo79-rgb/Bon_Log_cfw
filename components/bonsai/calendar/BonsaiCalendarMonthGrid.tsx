/**
 * 1ヶ月モード用の標準カレンダー（7列×6行）。
 *
 * 月の前後の余白日（前月末・翌月頭）も埋めて 6 行分のグリッドを描画する。
 *
 * @module components/bonsai/calendar/BonsaiCalendarMonthGrid
 */

'use client'

import { memo, useMemo } from 'react'
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

import { BonsaiCalendarDayCell } from './BonsaiCalendarDayCell'
import {
  groupItemsByDate,
  groupLogsByDate,
  localDateKey,
} from '@/lib/utils/calendar-grid'
import type {
  BonsaiPostCalendarItem,
  BonsaiRecordCalendarItem,
  CareLogListItem,
} from '@/types/bonsai-care'

interface BonsaiCalendarMonthGridProps {
  anchor: Date
  logs: readonly CareLogListItem[]
  records: readonly BonsaiRecordCalendarItem[]
  posts: readonly BonsaiPostCalendarItem[]
  onSelectDate: (date: Date) => void
}

/** 曜日ヘッダ（日〜土）。週頭は週開始曜日に合わせて並び替えされる。 */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

function BonsaiCalendarMonthGridInner({
  anchor,
  logs,
  records,
  posts,
  onSelectDate,
}: BonsaiCalendarMonthGridProps) {
  const today = useMemo(() => new Date(), [])

  // グリッドの日付配列（前月末・翌月頭を埋めて 7×6=42 セル）
  const days = useMemo(() => {
    const monthStart = startOfMonth(anchor)
    const monthEnd = endOfMonth(anchor)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [anchor])

  const groupedLogs = useMemo(() => groupLogsByDate(logs), [logs])
  const groupedRecords = useMemo(
    () => groupItemsByDate(records, (r) => r.recordAt),
    [records],
  )
  const groupedPosts = useMemo(
    () => groupItemsByDate(posts, (p) => p.createdAt),
    [posts],
  )

  return (
    <div role="grid" aria-label="盆栽手入れカレンダー（月ビュー）">
      <div role="row" className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            role="columnheader"
            aria-label={label + '曜日'}
            className="py-1 text-center text-xs font-medium text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>
      <div role="rowgroup" className="grid grid-cols-7 gap-1">
        {days.map((date) => {
          const key = localDateKey(date)
          return (
            <BonsaiCalendarDayCell
              key={date.toISOString()}
              date={date}
              logs={groupedLogs.get(key) ?? []}
              recordCount={groupedRecords.get(key)?.length ?? 0}
              postCount={groupedPosts.get(key)?.length ?? 0}
              outsideMonth={!isSameMonth(date, anchor)}
              isToday={isSameDay(date, today)}
              onSelect={onSelectDate}
            />
          )
        })}
      </div>
    </div>
  )
}

export const BonsaiCalendarMonthGrid = memo(BonsaiCalendarMonthGridInner)
