/**
 * 6ヶ月 / 12ヶ月モード用カレンダー（縦: 1-31日 / 横: 月）。
 *
 * - 列ヘッダ: 月ラベル（YYYY/M）
 * - 左端列: 日ラベル（1〜31、`position: sticky`）
 * - セル: 各月×各日の記録ドット。存在しない日（2/30 等）は空表示
 *
 * モバイルでは横スクロール可能。
 *
 * @module components/bonsai/calendar/BonsaiCalendarMultiMonthGrid
 */

'use client'

import { memo, useMemo } from 'react'
import { isSameDay } from 'date-fns'

import { BonsaiCalendarDayCell } from './BonsaiCalendarDayCell'
import {
  groupItemsByDate,
  groupLogsByDate,
  listDisplayMonths,
  localDateKey,
  resolveDateInMonth,
} from '@/lib/utils/calendar-grid'
import {
  CALENDAR_MODE_HALF_YEAR,
  CALENDAR_MODE_YEAR,
  type CalendarMode,
} from '@/lib/constants/bonsai-care'
import {
  MAX_DAYS_IN_MONTH,
  MULTIMONTH_CELL_MIN_WIDTH_PX,
} from '@/lib/constants/limits'
import type {
  BonsaiPostCalendarItem,
  BonsaiRecordCalendarItem,
  CareLogListItem,
} from '@/types/bonsai-care'

type MultiMonthMode = typeof CALENDAR_MODE_HALF_YEAR | typeof CALENDAR_MODE_YEAR

interface BonsaiCalendarMultiMonthGridProps {
  mode: MultiMonthMode
  anchor: Date
  logs: readonly CareLogListItem[]
  records: readonly BonsaiRecordCalendarItem[]
  posts: readonly BonsaiPostCalendarItem[]
  onSelectDate: (date: Date) => void
}

const DAY_LABELS = Array.from({ length: MAX_DAYS_IN_MONTH }, (_, i) => i + 1)

function formatMonthHeader(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

export function isMultiMonthMode(mode: CalendarMode): mode is MultiMonthMode {
  return mode === CALENDAR_MODE_HALF_YEAR || mode === CALENDAR_MODE_YEAR
}

function BonsaiCalendarMultiMonthGridInner({
  mode,
  anchor,
  logs,
  records,
  posts,
  onSelectDate,
}: BonsaiCalendarMultiMonthGridProps) {
  const today = useMemo(() => new Date(), [])
  const months = useMemo(() => listDisplayMonths(mode, anchor), [mode, anchor])
  const groupedLogs = useMemo(() => groupLogsByDate(logs), [logs])
  const groupedRecords = useMemo(
    () => groupItemsByDate(records, (r) => r.recordAt),
    [records],
  )
  const groupedPosts = useMemo(
    () => groupItemsByDate(posts, (p) => p.createdAt),
    [posts],
  )

  // CSS grid の列定義: 左端日ラベル列(auto) + 月数分の minmax 列
  const gridTemplateColumns = `auto repeat(${months.length}, minmax(${MULTIMONTH_CELL_MIN_WIDTH_PX}px, 1fr))`

  return (
    <div
      role="grid"
      aria-label={`盆栽手入れカレンダー（${months.length}ヶ月ビュー）`}
      className="overflow-x-auto"
    >
      <div className="grid gap-px text-xs" style={{ gridTemplateColumns }}>
        <div role="rowheader" className="sticky left-0 z-20 bg-background py-1 pr-2 text-right text-muted-foreground">
          日 / 月
        </div>
        {months.map((m) => (
          <div
            key={m.toISOString()}
            role="columnheader"
            className="bg-muted/40 px-1 py-1 text-center font-medium"
          >
            {formatMonthHeader(m)}
          </div>
        ))}

        {DAY_LABELS.map((day) => (
          <div role="row" key={day} className="contents">
            <div
              role="rowheader"
              className="sticky left-0 z-10 bg-background pr-2 text-right text-muted-foreground"
            >
              {day}
            </div>
            {months.map((m) => {
              const date = resolveDateInMonth(m.getFullYear(), m.getMonth(), day)
              if (date === null) {
                return (
                  <BonsaiCalendarDayCell
                    key={`${m.toISOString()}-${day}-empty`}
                    date={null}
                    logs={[]}
                    compact
                  />
                )
              }
              const key = localDateKey(date)
              return (
                <BonsaiCalendarDayCell
                  key={`${m.toISOString()}-${day}`}
                  date={date}
                  logs={groupedLogs.get(key) ?? []}
                  recordCount={groupedRecords.get(key)?.length ?? 0}
                  postCount={groupedPosts.get(key)?.length ?? 0}
                  compact
                  isToday={isSameDay(date, today)}
                  onSelect={onSelectDate}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export const BonsaiCalendarMultiMonthGrid = memo(BonsaiCalendarMultiMonthGridInner)
