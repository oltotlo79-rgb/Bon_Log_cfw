/**
 * カレンダービューのトップコンポーネント。
 *
 * - mode（month / half-year / year）に応じてグリッドを切り替え
 * - URL クエリ（mode / anchor）の変化に応じてサーバーから再取得
 * - 種別フィルタはクライアント状態（URL に持たせない）。多数選択時の URL 肥大を避けつつ、
 *   セッション内の即応性を確保する。
 *
 * @module components/bonsai/calendar/BonsaiCalendarView
 */

'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import type { BonsaiCareType } from '@prisma/client'

import { BonsaiCalendarMonthGrid } from './BonsaiCalendarMonthGrid'
import {
  BonsaiCalendarMultiMonthGrid,
  isMultiMonthMode,
} from './BonsaiCalendarMultiMonthGrid'
import { BonsaiCalendarToolbar } from './BonsaiCalendarToolbar'
import { BonsaiCareLogForm } from './BonsaiCareLogForm'
import { BonsaiCareLogSheet } from './BonsaiCareLogSheet'
import {
  CALENDAR_MODE_MONTH,
  CALENDAR_OVERLAY_POST,
  CALENDAR_OVERLAY_RECORD,
  type CalendarMode,
  type CalendarOverlayKind,
} from '@/lib/constants/bonsai-care'
import {
  groupItemsByDate,
  groupLogsByDate,
  localDateKey,
  resolveCalendarRange,
} from '@/lib/utils/calendar-grid'
import {
  getBonsaiCalendarOverlaysInRange,
  getCareLogsInRange,
} from '@/lib/actions/bonsai-care-log'
import type {
  BonsaiPostCalendarItem,
  BonsaiRecordCalendarItem,
  CareLogListItem,
} from '@/types/bonsai-care'
import { useToast } from '@/hooks/use-toast'

interface BonsaiCalendarViewProps {
  initialMode: CalendarMode
  initialAnchor: Date
  initialLogs: readonly CareLogListItem[]
  initialRecords: readonly BonsaiRecordCalendarItem[]
  initialPosts: readonly BonsaiPostCalendarItem[]
}

/**
 * `Date` は親 Server Component から props 経由で渡るため、Client 側で
 * 再 hydration されるとオブジェクト同一性が変わる。useMemo の依存には
 * `getTime()` を使う。
 */
export function BonsaiCalendarView({
  initialMode,
  initialAnchor,
  initialLogs,
  initialRecords,
  initialPosts,
}: BonsaiCalendarViewProps) {
  const { toast } = useToast()

  // クライアント側で props と同期する正規化された値
  const mode = initialMode
  const anchor = initialAnchor

  const [logs, setLogs] = useState<readonly CareLogListItem[]>(initialLogs)
  const [records, setRecords] = useState<readonly BonsaiRecordCalendarItem[]>(initialRecords)
  const [posts, setPosts] = useState<readonly BonsaiPostCalendarItem[]>(initialPosts)
  const [, startTransition] = useTransition()

  // 種別フィルタ（クライアント状態）
  const [selectedTypes, setSelectedTypes] = useState<ReadonlySet<BonsaiCareType>>(new Set())
  // 重ね表示（成長記録 / タグ付け投稿）のフィルタ
  const [selectedOverlays, setSelectedOverlays] = useState<ReadonlySet<CalendarOverlayKind>>(
    new Set(),
  )

  // Sheet（日付詳細）状態
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetDate, setSheetDate] = useState<Date | null>(null)

  // Form（追加・編集）状態
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CareLogListItem | null>(null)
  const [formDefaultDate, setFormDefaultDate] = useState<Date | undefined>(undefined)

  // initial* が更新されたら state も更新（URL 変更によるサーバー再フェッチ後）
  useEffect(() => {
    setLogs(initialLogs)
  }, [initialLogs])
  useEffect(() => {
    setRecords(initialRecords)
  }, [initialRecords])
  useEffect(() => {
    setPosts(initialPosts)
  }, [initialPosts])

  // 表示用の logs（フィルタ適用後）
  const visibleLogs = useMemo(() => {
    if (selectedTypes.size === 0) return logs
    return logs.filter((l) => selectedTypes.has(l.type))
  }, [logs, selectedTypes])

  // 表示用の overlays（フィルタ適用後）。selectedOverlays が空のときは両方表示。
  const visibleRecords = useMemo(() => {
    if (selectedOverlays.size === 0) return records
    return selectedOverlays.has(CALENDAR_OVERLAY_RECORD) ? records : []
  }, [records, selectedOverlays])
  const visiblePosts = useMemo(() => {
    if (selectedOverlays.size === 0) return posts
    return selectedOverlays.has(CALENDAR_OVERLAY_POST) ? posts : []
  }, [posts, selectedOverlays])

  const grouped = useMemo(() => groupLogsByDate(visibleLogs), [visibleLogs])
  const groupedRecords = useMemo(
    () => groupItemsByDate(visibleRecords, (r) => r.recordAt),
    [visibleRecords],
  )
  const groupedPosts = useMemo(
    () => groupItemsByDate(visiblePosts, (p) => p.createdAt),
    [visiblePosts],
  )

  /** Sheet 起動時に渡す当日ログ・記録・投稿を取得 */
  const sheetLogs = useMemo<readonly CareLogListItem[]>(() => {
    if (!sheetDate) return []
    return grouped.get(localDateKey(sheetDate)) ?? []
  }, [grouped, sheetDate])
  const sheetRecords = useMemo<readonly BonsaiRecordCalendarItem[]>(() => {
    if (!sheetDate) return []
    return groupedRecords.get(localDateKey(sheetDate)) ?? []
  }, [groupedRecords, sheetDate])
  const sheetPosts = useMemo<readonly BonsaiPostCalendarItem[]>(() => {
    if (!sheetDate) return []
    return groupedPosts.get(localDateKey(sheetDate)) ?? []
  }, [groupedPosts, sheetDate])

  const reloadLogs = useCallback(() => {
    const { from, to } = resolveCalendarRange(mode, anchor)
    const fromIso = from.toISOString()
    const toIso = to.toISOString()
    startTransition(async () => {
      const [careResult, overlayResult] = await Promise.all([
        getCareLogsInRange({ fromIso, toIso }),
        getBonsaiCalendarOverlaysInRange({ fromIso, toIso }),
      ])
      if (!careResult.success) {
        toast({
          title: '読み込みに失敗しました',
          description: careResult.error,
          variant: 'destructive',
        })
        return
      }
      // success=true 時の data は actionSuccess(...) で必ず付与される
      setLogs(careResult.data?.logs ?? [])
      if (overlayResult.success) {
        setRecords(overlayResult.data?.records ?? [])
        setPosts(overlayResult.data?.posts ?? [])
      }
    })
  }, [mode, anchor, toast])

  const handleSelectDate = useCallback((date: Date) => {
    setSheetDate(date)
    setSheetOpen(true)
  }, [])

  const handleAdd = useCallback(() => {
    setEditing(null)
    setFormDefaultDate(sheetDate ?? undefined)
    setSheetOpen(false)
    setFormOpen(true)
  }, [sheetDate])

  const handleAddFromToolbar = useCallback(() => {
    setEditing(null)
    setFormDefaultDate(undefined)
    setFormOpen(true)
  }, [])

  const handleEdit = useCallback((log: CareLogListItem) => {
    setEditing(log)
    setSheetOpen(false)
    setFormOpen(true)
  }, [])

  const handleSaved = useCallback(() => {
    reloadLogs()
  }, [reloadLogs])

  const handleToggleType = useCallback((type: BonsaiCareType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const handleToggleOverlay = useCallback((kind: CalendarOverlayKind) => {
    setSelectedOverlays((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  return (
    <section
      id={`bonsai-view-panel-calendar`}
      role="tabpanel"
      aria-label="盆栽手入れカレンダー"
      className="space-y-4"
    >
      <BonsaiCalendarToolbar
        mode={mode}
        anchor={anchor}
        selectedTypes={selectedTypes}
        selectedOverlays={selectedOverlays}
        onToggleType={handleToggleType}
        onToggleOverlay={handleToggleOverlay}
        onAddClick={handleAddFromToolbar}
      />

      {mode === CALENDAR_MODE_MONTH ? (
        <BonsaiCalendarMonthGrid
          anchor={anchor}
          logs={visibleLogs}
          records={visibleRecords}
          posts={visiblePosts}
          onSelectDate={handleSelectDate}
        />
      ) : isMultiMonthMode(mode) ? (
        <BonsaiCalendarMultiMonthGrid
          mode={mode}
          anchor={anchor}
          logs={visibleLogs}
          records={visibleRecords}
          posts={visiblePosts}
          onSelectDate={handleSelectDate}
        />
      ) : null}

      <BonsaiCareLogSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        date={sheetDate}
        logs={sheetLogs}
        records={sheetRecords}
        posts={sheetPosts}
        onEdit={handleEdit}
        onAdd={handleAdd}
        onChanged={reloadLogs}
      />

      <BonsaiCareLogForm
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        defaultDate={formDefaultDate}
        onSaved={handleSaved}
      />
    </section>
  )
}
