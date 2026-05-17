/**
 * カレンダー上部のツールバー: モード切替・月移動・「今日」・種別フィルタ・新規追加ボタン。
 *
 * 月移動と「今日」、モード切替は **すべて URL クエリ経由**で行う。これにより
 * 戻る・進むボタンや URL 共有が自然に機能する。
 *
 * @module components/bonsai/calendar/BonsaiCalendarToolbar
 */

'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useTransition } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import type { BonsaiCareType } from '@prisma/client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  BONSAI_CALENDAR_ANCHOR_PARAM,
  BONSAI_CALENDAR_MODE_PARAM,
  BONSAI_CARE_COLOR_CLASS,
  BONSAI_CARE_LABELS,
  BONSAI_CARE_TYPES,
  BONSAI_VIEW_CALENDAR,
  BONSAI_VIEW_PARAM,
  CALENDAR_MODES,
  CALENDAR_MODE_LABELS,
  CALENDAR_MODE_MONTH,
  CALENDAR_OVERLAY_COLOR_CLASS,
  CALENDAR_OVERLAY_KINDS,
  CALENDAR_OVERLAY_LABELS,
  type CalendarMode,
  type CalendarOverlayKind,
} from '@/lib/constants/bonsai-care'
import { formatAnchor, shiftAnchor } from '@/lib/utils/calendar-grid'

interface BonsaiCalendarToolbarProps {
  mode: CalendarMode
  anchor: Date
  selectedTypes: ReadonlySet<BonsaiCareType>
  selectedOverlays: ReadonlySet<CalendarOverlayKind>
  onToggleType: (type: BonsaiCareType) => void
  onToggleOverlay: (kind: CalendarOverlayKind) => void
  onAddClick: () => void
}

export function BonsaiCalendarToolbar({
  mode,
  anchor,
  selectedTypes,
  selectedOverlays,
  onToggleType,
  onToggleOverlay,
  onAddClick,
}: BonsaiCalendarToolbarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  /** URL を更新するヘルパー（既存パラメータを維持しつつ、指定キーだけ差し替え） */
  const buildUrl = useCallback(
    (overrides: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set(BONSAI_VIEW_PARAM, BONSAI_VIEW_CALENDAR)
      for (const [k, v] of Object.entries(overrides)) {
        if (v === null) params.delete(k)
        else params.set(k, v)
      }
      const qs = params.toString()
      return qs ? `/bonsai?${qs}` : '/bonsai'
    },
    [searchParams],
  )

  const navigateTo = useCallback(
    (overrides: Record<string, string | null>) => {
      startTransition(() => {
        router.replace(buildUrl(overrides), { scroll: false })
      })
    },
    [buildUrl, router],
  )

  const handlePrev = useCallback(() => {
    navigateTo({ [BONSAI_CALENDAR_ANCHOR_PARAM]: formatAnchor(shiftAnchor(anchor, -1)) })
  }, [anchor, navigateTo])

  const handleNext = useCallback(() => {
    navigateTo({ [BONSAI_CALENDAR_ANCHOR_PARAM]: formatAnchor(shiftAnchor(anchor, 1)) })
  }, [anchor, navigateTo])

  const handleToday = useCallback(() => {
    // anchor を現在月にリセット（モードはそのまま維持）
    const now = new Date()
    navigateTo({
      [BONSAI_CALENDAR_ANCHOR_PARAM]: formatAnchor(now),
    })
  }, [navigateTo])

  // タイトル: 月モードは「YYYY年M月」、複数月モードは「YYYY/M」のみ（最新月）
  const title = useMemo(() => {
    if (mode === CALENDAR_MODE_MONTH) {
      return `${anchor.getFullYear()}年${anchor.getMonth() + 1}月`
    }
    return `${anchor.getFullYear()}年${anchor.getMonth() + 1}月（${CALENDAR_MODE_LABELS[mode]}表示）`
  }, [mode, anchor])

  return (
    <div className="space-y-3" data-pending={isPending ? 'true' : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handlePrev}
            aria-label="前の月"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handleToday}>
            今日
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleNext}
            aria-label="次の月"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <h2
            aria-live="polite"
            className="ml-2 text-base font-semibold"
            data-testid="calendar-title"
          >
            {title}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* モード切替タブ */}
          <div role="tablist" aria-label="表示モード" className="inline-flex rounded-md border border-border bg-muted/30 p-0.5">
            {CALENDAR_MODES.map((m) => {
              const isActive = m === mode
              return (
                <Link
                  key={m}
                  href={buildUrl({ [BONSAI_CALENDAR_MODE_PARAM]: m })}
                  role="tab"
                  aria-selected={isActive}
                  scroll={false}
                  className={cn(
                    'rounded px-2 py-1 text-xs transition-colors',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {CALENDAR_MODE_LABELS[m]}
                </Link>
              )
            })}
          </div>

          <Button
            type="button"
            size="sm"
            onClick={onAddClick}
            className="gap-1"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            記録追加
          </Button>
        </div>
      </div>

      {/* 種別 / 重ね表示フィルタ（チップの色ドットがそのまま凡例として機能） */}
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">表示フィルタ（色は各種別を表します）</legend>
        {BONSAI_CARE_TYPES.map((type) => {
          const checked = selectedTypes.has(type)
          return (
            <label
              key={type}
              className={cn(
                'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                checked
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/40',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleType(type)}
                className="sr-only"
              />
              <span
                data-care-type={type}
                aria-hidden="true"
                className={cn(
                  'inline-block h-2.5 w-2.5 rounded-full',
                  BONSAI_CARE_COLOR_CLASS[type],
                )}
              />
              {BONSAI_CARE_LABELS[type]}
            </label>
          )
        })}
        {CALENDAR_OVERLAY_KINDS.map((kind) => {
          const checked = selectedOverlays.has(kind)
          return (
            <label
              key={kind}
              className={cn(
                'inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
                checked
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/40',
              )}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggleOverlay(kind)}
                className="sr-only"
              />
              <span
                data-overlay-kind={kind}
                aria-hidden="true"
                className={cn(
                  'inline-block h-2.5 w-2.5 rounded-full',
                  CALENDAR_OVERLAY_COLOR_CLASS[kind],
                )}
              />
              {CALENDAR_OVERLAY_LABELS[kind]}
            </label>
          )
        })}
      </fieldset>
    </div>
  )
}
