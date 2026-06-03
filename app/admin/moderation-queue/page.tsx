import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getModerationQueue } from '@/lib/actions/admin/moderation'
import { ModerationQueueList } from './ModerationQueueList'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { CursorPagination } from '@/components/admin/CursorPagination'
import type { ModerationStatus } from '@prisma/client'

const MODERATION_STATUS_SET = new Set<string>(['pending', 'approved', 'rejected', 'auto_flagged'])
function isModerationStatus(value: unknown): value is ModerationStatus {
  return typeof value === 'string' && MODERATION_STATUS_SET.has(value)
}

export const metadata = {
  title: 'モデレーションキュー - BON-LOG 管理',
}

interface PageProps {
  searchParams: Promise<{
    /** ステータスフィルター */
    status?: string
    /** ページネーション用カーソル */
    cursor?: string
    /** 経由した cursor のリスト（戻る操作用） */
    trail?: string
  }>
}

/**
 * 管理者用モデレーションキューページコンポーネント
 * 自動フラグされたコンテンツの審査・対応を行う
 *
 * @param searchParams - URLのクエリパラメータ
 * @returns モデレーションキューページのJSX要素
 */
export default async function AdminModerationQueuePage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = isModerationStatus(params.status) ? params.status : undefined
  const { cursor, trail } = parseAdminCursor(params)

  // キュー一覧取得
  const result = await getModerationQueue({ status, limit: DEFAULT_PAGE_LIMIT, cursor })

  if ('error' in result) {
    redirect(ROUTE_LOGIN)
  }

  const { items, total, nextCursor } = result

  // 統計用データ取得（全ステータスのカウント）
  const [pendingResult, autoFlaggedResult, approvedTodayResult, rejectedTodayResult] = await Promise.all([
    getModerationQueue({ status: 'pending', limit: 0 }),
    getModerationQueue({ status: 'auto_flagged', limit: 0 }),
    getModerationQueue({ status: 'approved', limit: 0 }),
    getModerationQueue({ status: 'rejected', limit: 0 }),
  ])

  const stats = {
    pending: 'error' in pendingResult ? 0 : pendingResult.total,
    autoFlagged: 'error' in autoFlaggedResult ? 0 : autoFlaggedResult.total,
    approvedTotal: 'error' in approvedTodayResult ? 0 : approvedTodayResult.total,
    rejectedTotal: 'error' in rejectedTodayResult ? 0 : rejectedTodayResult.total,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">モデレーションキュー</h1>
        <span className="text-sm text-muted-foreground">全 {total} 件</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">未対応</p>
          <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">自動フラグ</p>
          <p className="text-2xl font-bold text-red-600">{stats.autoFlagged}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">承認済み</p>
          <p className="text-2xl font-bold text-green-600">{stats.approvedTotal}</p>
        </div>
        <div className="bg-card rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">却下済み</p>
          <p className="text-2xl font-bold text-gray-600">{stats.rejectedTotal}</p>
        </div>
      </div>

      <div className="bg-card rounded-lg border p-4">
        <div className="flex flex-wrap gap-2">
          {[
            { value: '', label: 'すべて' },
            { value: 'pending', label: '未対応' },
            { value: 'auto_flagged', label: '自動フラグ' },
            { value: 'approved', label: '承認済み' },
            { value: 'rejected', label: '却下済み' },
          ].map((tab) => {
            const isActive = (status || '') === tab.value
            return (
              <a
                key={tab.value}
                href={`/admin/moderation-queue${tab.value ? `?status=${tab.value}` : ''}`}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                {tab.label}
              </a>
            )
          })}
        </div>
      </div>

      <ModerationQueueList
        items={items.map((item) => ({
          id: item.id,
          targetType: item.targetType,
          targetId: item.targetId,
          status: item.status,
          reason: item.reason,
          matchedWords: item.matchedWords,
          reviewedBy: item.reviewedBy,
          reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
          createdAt: item.createdAt.toISOString(),
        }))}
      />

      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        baseUrl="/admin/moderation-queue"
        filters={{ status: status || undefined }}
      />
    </div>
  )
}
