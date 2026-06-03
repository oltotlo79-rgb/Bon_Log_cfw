import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import {
  Shield,
  ShieldAlert,
  KeyRound,
  Smartphone,
} from 'lucide-react'
import { getSecurityDashboard, getSecurityEvents } from '@/lib/actions/admin/security'
import { SecurityEventList } from './SecurityEventList'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { parseAdminCursor } from '@/lib/utils/admin-cursor'
import { toJsonObject } from '@/lib/utils/json'
import { CursorPagination } from '@/components/admin/CursorPagination'

export const metadata = {
  title: 'セキュリティダッシュボード - BON-LOG 管理',
}

/**
 * 静的生成を無効化
 */
export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{
    eventType?: string
    ipAddress?: string
    dateFrom?: string
    dateTo?: string
    cursor?: string
    trail?: string
  }>
}

/** イベント種別の日本語ラベル */
const EVENT_TYPE_LABELS: Record<string, string> = {
  failed_login: 'ログイン失敗',
  password_change: 'パスワード変更',
  '2fa_toggle': '2FA切替',
  email_change: 'メール変更',
}

/**
 * セキュリティダッシュボードページコンポーネント
 *
 * @param searchParams - URLのクエリパラメータ
 * @returns セキュリティダッシュボードのJSX要素
 */
export default async function SecurityDashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const eventType = params.eventType || ''
  const ipAddress = params.ipAddress || ''
  const dateFrom = params.dateFrom || ''
  const dateTo = params.dateTo || ''
  const { cursor, trail } = parseAdminCursor(params)

  // ダッシュボードサマリーとイベント一覧を並列取得
  const [dashboardResult, eventsResult] = await Promise.all([
    getSecurityDashboard(),
    getSecurityEvents({
      eventType: eventType || undefined,
      ipAddress: ipAddress || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      limit: DEFAULT_PAGE_LIMIT,
      cursor,
    }),
  ])

  // 権限エラー時はリダイレクト
  if ('error' in dashboardResult) {
    redirect(ROUTE_LOGIN)
  }

  if ('error' in eventsResult) {
    redirect(ROUTE_LOGIN)
  }

  const dashboard = dashboardResult
  const { events, total, nextCursor } = eventsResult

  // バーチャート用の最大値を算出
  const maxEventCount = dashboard.eventsByType.length > 0
    ? Math.max(...dashboard.eventsByType.map(e => e.count))
    : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-7 h-7" />
          セキュリティダッシュボード
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          セキュリティイベントの監視と分析
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">ログイン失敗（24h）</span>
          </div>
          <p className={`text-3xl font-bold ${dashboard.failedLoginsToday > 0 ? 'text-destructive' : ''}`}>
            {dashboard.failedLoginsToday.toLocaleString()}
          </p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">ログイン失敗（7日）</span>
          </div>
          <p className="text-3xl font-bold">
            {dashboard.failedLoginsWeek.toLocaleString()}
          </p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg">
              <KeyRound className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">パスワード変更（24h）</span>
          </div>
          <p className="text-3xl font-bold">
            {dashboard.passwordChangesToday.toLocaleString()}
          </p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg">
              <Smartphone className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">2FA切替（24h）</span>
          </div>
          <p className="text-3xl font-bold">
            {dashboard.twoFactorTogglesToday.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">疑わしいIPアドレス</h2>
          {dashboard.topFailedIps.length === 0 ? (
            <p className="text-sm text-muted-foreground">過去24時間に疑わしいIPはありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">IPアドレス</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">失敗回数</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.topFailedIps.map((ip) => (
                    <tr key={ip.ipAddress} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2 px-3 font-mono text-sm">{ip.ipAddress}</td>
                      <td className="py-2 px-3 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          ip.count >= 10
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : ip.count >= 5
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400'
                              : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        }`}>
                          {ip.count}回
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">イベント種別（過去7日）</h2>
          {dashboard.eventsByType.length === 0 ? (
            <p className="text-sm text-muted-foreground">過去7日間にイベントはありません</p>
          ) : (
            <div className="space-y-3">
              {dashboard.eventsByType.map((evt) => {
                const barWidth = Math.max((evt.count / maxEventCount) * 100, 2)
                return (
                  <div key={evt.type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {EVENT_TYPE_LABELS[evt.type] || evt.type}
                      </span>
                      <span className="text-sm text-muted-foreground">{evt.count}件</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-3">
                      <div
                        className="bg-primary rounded-full h-3 transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* セキュリティイベント一覧（Client Component） */}
      <Suspense fallback={<div className="text-sm text-muted-foreground">イベントログを読み込み中...</div>}>
        <SecurityEventList
          events={events.map(e => ({
            ...e,
            createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : String(e.createdAt),
            details: toJsonObject(e.details),
          }))}
          eventType={eventType}
          ipAddress={ipAddress}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </Suspense>

      <CursorPagination
        cursor={cursor}
        trail={trail}
        nextCursor={nextCursor}
        total={total}
        baseUrl="/admin/security"
        filters={{ eventType, ipAddress, dateFrom, dateTo }}
      />
    </div>
  )
}
