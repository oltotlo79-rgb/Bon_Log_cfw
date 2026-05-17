/**
 * カレンダーの 1 日セル（月ビュー / マルチ月ビュー共用）。
 *
 * - イベントあり: 種別色ドット最大 `MAX_DOTS_PER_CELL`、超過時は「+N」
 * - 存在しない日（2月30日等）: `aria-hidden` でフォーカス対象外
 * - クリックで親に通知（Sheet 表示など）
 *
 * `React.memo` で props が変わらない限り再レンダリングしない。
 *
 * @module components/bonsai/calendar/BonsaiCalendarDayCell
 */

'use client'

import { memo } from 'react'
import type { BonsaiCareType } from '@prisma/client'

import { cn } from '@/lib/utils'
import {
  BONSAI_CARE_COLOR_CLASS,
  BONSAI_CARE_LABELS,
  CALENDAR_OVERLAY_COLOR_CLASS,
  CALENDAR_OVERLAY_LABELS,
  CALENDAR_OVERLAY_POST,
  CALENDAR_OVERLAY_RECORD,
} from '@/lib/constants/bonsai-care'
import { MAX_DOTS_PER_CELL } from '@/lib/constants/limits'
import type { CareLogListItem } from '@/types/bonsai-care'

interface BonsaiCalendarDayCellProps {
  /** 表示対象日（null なら存在しない日として扱う） */
  date: Date | null
  /** 同日の手入れログ（昇順済み想定） */
  logs: readonly CareLogListItem[]
  /** 同日の成長記録件数（>0 のときドット表示） */
  recordCount?: number
  /** 同日のタグ付け投稿件数（>0 のときドット表示） */
  postCount?: number
  /** マルチ月ビューでの圧縮表示 */
  compact?: boolean
  /** 同月外（月ビューで前後月の日）の薄表示 */
  outsideMonth?: boolean
  /** 今日マーカー */
  isToday?: boolean
  /** クリック時のコールバック（存在しない日では呼ばれない） */
  onSelect?: (date: Date) => void
}

/** ログ配列から重複なしの種別を昇順で取り出す（ドット表示用）。 */
function uniqueTypes(logs: readonly CareLogListItem[]): BonsaiCareType[] {
  const set = new Set<BonsaiCareType>()
  for (const log of logs) set.add(log.type)
  return Array.from(set)
}

function buildAriaLabel(
  date: Date,
  logs: readonly CareLogListItem[],
  recordCount: number,
  postCount: number,
): string {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
  const datePart = formatter.format(date)

  const parts: string[] = []
  if (logs.length > 0) {
    const uniq = uniqueTypes(logs)
    const labels = uniq.map((t) => BONSAI_CARE_LABELS[t]).join('、')
    parts.push(`${labels}を記録（${logs.length}件）`)
  }
  if (recordCount > 0) {
    parts.push(`${CALENDAR_OVERLAY_LABELS[CALENDAR_OVERLAY_RECORD]}${recordCount}件`)
  }
  if (postCount > 0) {
    parts.push(`${CALENDAR_OVERLAY_LABELS[CALENDAR_OVERLAY_POST]}${postCount}件`)
  }
  if (parts.length === 0) return `${datePart}、記録なし`
  return `${datePart}、${parts.join('、')}`
}

function BonsaiCalendarDayCellInner({
  date,
  logs,
  recordCount = 0,
  postCount = 0,
  compact = false,
  outsideMonth = false,
  isToday = false,
  onSelect,
}: BonsaiCalendarDayCellProps) {
  if (date === null) {
    // 存在しない日（2月30日等）: フォーカス不可、装飾のみ
    return (
      <div
        aria-hidden="true"
        tabIndex={-1}
        className={cn(
          'flex select-none items-center justify-center text-muted-foreground/30',
          compact ? 'h-8 text-xs' : 'h-20 text-sm',
        )}
      >
        —
      </div>
    )
  }

  const types = uniqueTypes(logs)
  // care 種別ドットに加えて、record / post が存在すれば 1 ドットずつ追加
  const overlaySlots = (recordCount > 0 ? 1 : 0) + (postCount > 0 ? 1 : 0)
  const visibleCareDotCount = Math.max(0, MAX_DOTS_PER_CELL - overlaySlots)
  const visibleCareTypes = types.slice(0, visibleCareDotCount)
  const overflow = types.length - visibleCareTypes.length

  const handleClick = () => onSelect?.(date)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(date)
    }
  }

  const hasAnyEvent = logs.length > 0 || recordCount > 0 || postCount > 0

  return (
    <button
      type="button"
      role="gridcell"
      aria-label={buildAriaLabel(date, logs, recordCount, postCount)}
      data-date={date.toISOString()}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group flex flex-col items-stretch rounded-md border text-left transition-colors',
        'border-border bg-background hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isToday && 'border-primary bg-primary/5',
        outsideMonth && 'opacity-40',
        compact ? 'h-8 p-0.5' : 'h-20 p-1.5',
      )}
    >
      <span
        className={cn(
          'leading-none',
          compact ? 'text-[10px]' : 'text-xs',
          isToday ? 'font-bold text-primary' : 'text-muted-foreground',
        )}
      >
        {date.getDate()}
      </span>
      {hasAnyEvent && (
        <div
          className={cn(
            'mt-auto flex flex-wrap items-center',
            compact ? 'gap-[2px]' : 'gap-1',
          )}
          aria-hidden="true"
        >
          {visibleCareTypes.map((type) => (
            <span
              key={type}
              data-care-type={type}
              className={cn(
                'inline-block rounded-full',
                BONSAI_CARE_COLOR_CLASS[type],
                compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
              )}
            />
          ))}
          {recordCount > 0 && (
            <span
              data-overlay-kind={CALENDAR_OVERLAY_RECORD}
              className={cn(
                'inline-block rounded-full',
                CALENDAR_OVERLAY_COLOR_CLASS[CALENDAR_OVERLAY_RECORD],
                compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
              )}
            />
          )}
          {postCount > 0 && (
            <span
              data-overlay-kind={CALENDAR_OVERLAY_POST}
              className={cn(
                'inline-block rounded-full',
                CALENDAR_OVERLAY_COLOR_CLASS[CALENDAR_OVERLAY_POST],
                compact ? 'h-1.5 w-1.5' : 'h-2 w-2',
              )}
            />
          )}
          {overflow > 0 && (
            <span
              data-overflow="true"
              className={cn(
                'rounded bg-muted px-1 text-muted-foreground',
                compact ? 'text-[9px]' : 'text-[10px]',
              )}
            >
              +{overflow}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

export const BonsaiCalendarDayCell = memo(BonsaiCalendarDayCellInner)
