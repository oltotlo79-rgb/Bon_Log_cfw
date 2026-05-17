/**
 * `/bonsai` ページのビュー切替（タイムライン ⇔ カレンダー）。
 *
 * URL クエリ `view` を変更してナビゲートする。Server Component に
 * リクエストし直す形にすることで、戻る/進むも自然に機能する。
 *
 * @module components/bonsai/calendar/BonsaiViewSwitcher
 */

'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'
import { CalendarDays, List } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  BONSAI_VIEW_CALENDAR,
  BONSAI_VIEW_PARAM,
  BONSAI_VIEW_TIMELINE,
  type BonsaiView,
} from '@/lib/constants/bonsai-care'

interface BonsaiViewSwitcherProps {
  current: BonsaiView
}

const TABS: ReadonlyArray<{
  view: BonsaiView
  label: string
  Icon: typeof CalendarDays
}> = [
  { view: BONSAI_VIEW_TIMELINE, label: 'タイムライン', Icon: List },
  { view: BONSAI_VIEW_CALENDAR, label: 'カレンダー', Icon: CalendarDays },
]

export function BonsaiViewSwitcher({ current }: BonsaiViewSwitcherProps) {
  // 既存のクエリ（mode・anchor 等）は保持したまま view だけ差し替える
  const searchParams = useSearchParams()
  const hrefMap = useMemo(() => {
    const result: Record<BonsaiView, string> = {
      [BONSAI_VIEW_TIMELINE]: '/bonsai',
      [BONSAI_VIEW_CALENDAR]: '/bonsai',
    }
    for (const { view } of TABS) {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      params.set(BONSAI_VIEW_PARAM, view)
      // タイムラインに戻るときは calendar 専用の mode/anchor は不要
      if (view === BONSAI_VIEW_TIMELINE) {
        params.delete('mode')
        params.delete('anchor')
      }
      const qs = params.toString()
      result[view] = qs ? `/bonsai?${qs}` : '/bonsai'
    }
    return result
  }, [searchParams])

  return (
    <div
      role="tablist"
      aria-label="盆栽の表示形式"
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1"
    >
      {TABS.map(({ view, label, Icon }) => {
        const isActive = current === view
        return (
          <Link
            key={view}
            href={hrefMap[view]}
            role="tab"
            aria-selected={isActive}
            aria-controls={`bonsai-view-panel-${view}`}
            tabIndex={isActive ? 0 : -1}
            scroll={false}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              isActive
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
