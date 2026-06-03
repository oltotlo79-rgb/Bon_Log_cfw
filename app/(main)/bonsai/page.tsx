/**
 * マイ盆栽ページ。
 *
 * `?view=calendar` でカレンダーモードに切り替え、それ以外は従来のタイムライン表示。
 * カレンダーモードは `next/dynamic` で遅延読み込みするため、
 * タイムラインのみを利用するユーザーのバンドルには影響しない。
 *
 */

import dynamic from 'next/dynamic'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { auth } from '@/lib/auth'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import {
  BONSAI_CALENDAR_ANCHOR_PARAM,
  BONSAI_CALENDAR_MODE_PARAM,
  BONSAI_VIEW_CALENDAR,
  BONSAI_VIEW_PARAM,
  BONSAI_VIEW_TIMELINE,
  CALENDAR_MODES,
  CALENDAR_MODE_MONTH,
  type BonsaiView,
  type CalendarMode,
} from '@/lib/constants/bonsai-care'
import { getBonsais } from '@/lib/actions/bonsai'
import {
  getBonsaiCalendarOverlaysInRange,
  getCareLogsInRange,
} from '@/lib/actions/bonsai-care-log'
import { BonsaiListClient } from '@/components/bonsai/BonsaiListClient'
import { BonsaiViewSwitcher } from '@/components/bonsai/calendar/BonsaiViewSwitcher'
import { PostDetailAdUnit } from '@/components/ads'
import {
  parseAnchor,
  resolveCalendarRange,
} from '@/lib/utils/calendar-grid'
import type {
  BonsaiPostCalendarItem,
  BonsaiRecordCalendarItem,
  CareLogListItem,
} from '@/types/bonsai-care'

// dynamic import: カレンダーは Client Component で重いので遅延読み込み
const BonsaiCalendarView = dynamic(
  () =>
    import('@/components/bonsai/calendar/BonsaiCalendarView').then(
      (m) => m.BonsaiCalendarView,
    ),
  {
    loading: () => (
      <div
        role="status"
        aria-live="polite"
        className="h-64 animate-pulse rounded-md bg-muted/40"
      />
    ),
  },
)

type SearchParamsInput = Promise<{
  [key: string]: string | string[] | undefined
}>

interface BonsaiPageProps {
  searchParams: SearchParamsInput
}

/** 文字列パラメータを取り出す（配列形式は最初の要素を採用） */
function pickString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function resolveView(input: string | undefined): BonsaiView {
  return input === BONSAI_VIEW_CALENDAR ? BONSAI_VIEW_CALENDAR : BONSAI_VIEW_TIMELINE
}

/** 任意の文字列が `CalendarMode` であるかを判定する型ガード。 */
function isCalendarMode(value: string): value is CalendarMode {
  return (CALENDAR_MODES as readonly string[]).includes(value)
}

function resolveMode(input: string | undefined): CalendarMode {
  if (!input) return CALENDAR_MODE_MONTH
  return isCalendarMode(input) ? input : CALENDAR_MODE_MONTH
}

export async function generateMetadata({
  searchParams,
}: BonsaiPageProps): Promise<Metadata> {
  const sp = await searchParams
  const view = resolveView(pickString(sp[BONSAI_VIEW_PARAM]))
  const isCalendar = view === BONSAI_VIEW_CALENDAR
  return {
    title: isCalendar ? 'マイ盆栽カレンダー' : 'マイ盆栽',
    description: isCalendar
      ? 'あなたの盆栽の手入れ記録をカレンダーで俯瞰'
      : 'あなたの盆栽コレクションを管理',
    robots: { index: false, follow: false },
  }
}

export default async function BonsaiListPage({ searchParams }: BonsaiPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  const sp = await searchParams
  const view = resolveView(pickString(sp[BONSAI_VIEW_PARAM]))
  const mode = resolveMode(pickString(sp[BONSAI_CALENDAR_MODE_PARAM]))
  const anchorParam = pickString(sp[BONSAI_CALENDAR_ANCHOR_PARAM])
  // 不正な anchor は今月にフォールバック（UX 優先・エラーは出さない）
  const anchor = (anchorParam && parseAnchor(anchorParam)) || new Date()

  if (view === BONSAI_VIEW_CALENDAR) {
    const { from, to } = resolveCalendarRange(mode, anchor)
    const fromIso = from.toISOString()
    const toIso = to.toISOString()
    const [logsResult, overlaysResult] = await Promise.all([
      getCareLogsInRange({ fromIso, toIso }),
      getBonsaiCalendarOverlaysInRange({ fromIso, toIso }),
    ])
    const initialLogs: CareLogListItem[] =
      logsResult.success && logsResult.data?.logs ? logsResult.data.logs : []
    const initialRecords: BonsaiRecordCalendarItem[] =
      overlaysResult.success && overlaysResult.data?.records
        ? overlaysResult.data.records
        : []
    const initialPosts: BonsaiPostCalendarItem[] =
      overlaysResult.success && overlaysResult.data?.posts
        ? overlaysResult.data.posts
        : []

    return (
      <div className="space-y-4">
        <h1 className="sr-only">マイ盆栽カレンダー</h1>
        <BonsaiViewSwitcher current={BONSAI_VIEW_CALENDAR} />
        <BonsaiCalendarView
          initialMode={mode}
          initialAnchor={anchor}
          initialLogs={initialLogs}
          initialRecords={initialRecords}
          initialPosts={initialPosts}
        />
        <aside aria-label="広告" className="mt-8">
          <PostDetailAdUnit />
        </aside>
      </div>
    )
  }

  // 既定: タイムラインビュー（既存挙動を完全維持）
  const result = await getBonsais()
  const bonsais = result.success ? (result.data?.bonsais ?? []) : []

  return (
    <div className="space-y-4">
      <h1 className="sr-only">マイ盆栽</h1>
      <BonsaiViewSwitcher current={BONSAI_VIEW_TIMELINE} />
      <BonsaiListClient initialBonsais={bonsais} />
      <aside aria-label="広告" className="mt-8">
        <PostDetailAdUnit />
      </aside>
    </div>
  )
}
