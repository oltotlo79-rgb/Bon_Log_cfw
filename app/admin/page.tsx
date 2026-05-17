import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getAdminStats, getDailyVisitorsHistory } from '@/lib/actions/admin/stats'
import { getReportStats } from '@/lib/actions/report'
import { getPendingShopChangeRequestCount } from '@/lib/actions/shop'
import {
  ADMIN_VISITORS_DAYS_RANGES,
  ADMIN_VISITORS_DEFAULT_DAYS,
  type AdminVisitorsDaysRange,
} from '@/lib/constants/limits'
import { SentryErrors } from './SentryErrors'
import { DailyVisitorsChart } from './DailyVisitorsChart'
import {
  Users as UsersIcon,
  FileText as FileTextIcon,
  AlertTriangle as AlertTriangleIcon,
  Calendar as CalendarIcon,
  MapPin as MapPinIcon,
  Mail as MailIcon,
  Crown as CrownIcon,
  Activity as ActivityIcon,
  ArrowRight as ArrowRightIcon,
  MessageSquare as MessageSquareIcon,
  Star as StarIcon,
} from 'lucide-react'

export const metadata = {
  title: '管理者ダッシュボード - BON-LOG 管理',
  // 管理画面は検索エンジンに公開しない（認証必須・運用情報を含む）
  robots: { index: false, follow: false },
}

/**
 * `?range=` の生文字列を `ADMIN_VISITORS_DAYS_RANGES` の閉じた集合に正規化する。
 * 不正値・未指定はデフォルトにフォールバック。許可リスト方式で任意数値の流入を弾く。
 */
function resolveVisitorsDaysRange(raw: string | undefined): AdminVisitorsDaysRange {
  if (!raw) return ADMIN_VISITORS_DEFAULT_DAYS
  const candidate = Number(raw)
  if (!Number.isFinite(candidate)) return ADMIN_VISITORS_DEFAULT_DAYS
  return (
    ADMIN_VISITORS_DAYS_RANGES.find((d) => d === candidate) ?? ADMIN_VISITORS_DEFAULT_DAYS
  )
}

/**
 * DAU 等のリアルタイム集計が含まれるため、ISR / フルルートキャッシュを禁止して
 * リクエスト毎に再計算する（auth() による暗黙的動的化に依存せず明示する）。
 */
export const dynamic = 'force-dynamic'

type AdminDashboardPageProps = {
  searchParams: Promise<{ range?: string }>
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardPageProps) {
  const { range: rangeParam } = await searchParams
  const visitorsRangeDays = resolveVisitorsDaysRange(rangeParam)

  const [statsResult, reportResult, shopRequestResult, visitorsHistoryResult] = await Promise.all([
    getAdminStats(),
    getReportStats(),
    getPendingShopChangeRequestCount(),
    getDailyVisitorsHistory(visitorsRangeDays),
  ])

  // 管理者権限なし、または集計取得失敗ならログインページへフォールバック (UI 上は同じ扱いで安全側に倒す)。
  if (!statsResult.success || !statsResult.data) {
    redirect(ROUTE_LOGIN)
  }
  const stats = statsResult.data

  // 訪問者履歴は失敗時もダッシュボード全体を落とさず、グラフ非表示に縮退させる。
  const visitorsHistory = visitorsHistoryResult.success ? (visitorsHistoryResult.data ?? []) : []
  const visitorsTotalRange = visitorsHistory.reduce((acc, d) => acc + d.visitors, 0)
  const visitorsPeak = visitorsHistory.reduce((acc, d) => Math.max(acc, d.visitors), 0)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {/* 主要統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg">
              <UsersIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">総ユーザー数</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</p>
          <p className="text-sm text-foreground mt-1">+{stats.todayUsers} 今日</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg">
              <FileTextIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">総投稿数</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalPosts.toLocaleString()}</p>
          <p className="text-sm text-foreground mt-1">+{stats.todayPosts} 今日</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 rounded-lg">
              <AlertTriangleIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">未対応通報</span>
          </div>
          <p className="text-3xl font-bold text-destructive">{stats.pendingReports}</p>
          <Link href="/admin/reports" className="text-sm text-muted-foreground hover:underline mt-1 inline-flex items-center gap-1">
            確認する <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded-lg">
              <ActivityIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">週間アクティブ</span>
          </div>
          <p className="text-3xl font-bold">{stats.activeUsersWeek.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mt-1">過去7日間</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-lg">
              <MessageSquareIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">未対応変更リクエスト</span>
          </div>
          <p className={`text-3xl font-bold ${shopRequestResult.count > 0 ? 'text-foreground' : ''}`}>
            {shopRequestResult.count}
          </p>
          <Link href="/admin/shop-requests" className="text-sm text-muted-foreground hover:underline mt-1 inline-flex items-center gap-1">
            確認する <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* サブ統計: イベント・盆栽園 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400 rounded-lg">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">登録イベント数</span>
          </div>
          <p className="text-2xl font-bold">{stats.totalEvents.toLocaleString()}</p>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-lg">
              <MapPinIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-muted-foreground">登録盆栽園数</span>
          </div>
          <p className="text-2xl font-bold">{stats.totalShops.toLocaleString()}</p>
        </div>
      </div>

      {/* 過去 N 日のアクセス推移（ユニーク訪問者）グラフ */}
      {visitorsHistory.length > 0 && (
        <div className="bg-card rounded-lg border p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
            <h2 className="text-lg font-semibold">過去{visitorsRangeDays}日のアクセス推移</h2>
            <p className="text-xs text-muted-foreground">
              延べ {visitorsTotalRange.toLocaleString()} 人 / ピーク {visitorsPeak.toLocaleString()} 人
            </p>
          </div>
          {/* 期間切替タブ */}
          <div
            role="tablist"
            aria-label="アクセス推移の表示期間"
            className="flex flex-wrap gap-2 mb-3"
          >
            {ADMIN_VISITORS_DAYS_RANGES.map((days) => {
              const isActive = days === visitorsRangeDays
              return (
                <Link
                  key={days}
                  href={`/admin?range=${days}`}
                  role="tab"
                  aria-selected={isActive}
                  // active 時はリンクとしての遷移を無効化（再クリックの no-op を明示）
                  aria-current={isActive ? 'page' : undefined}
                  // ページ全体のスクロール位置をタブ切替で巻き戻さない
                  scroll={false}
                  prefetch={false}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  過去{days}日
                </Link>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            ユニーク訪問者数 = HttpOnly Cookie `bon_log_visitor_id` で識別される、ページをロードした人数（同一訪問者の同日複数アクセスは 1 回として集計）。未認証訪問者も含む。JS 無効端末・スクレイパー等のビーコン不発射クライアントは計測対象外。
          </p>
          <DailyVisitorsChart data={visitorsHistory} />
        </div>
      )}

      {/* 通報統計: ステータス別・種別別 */}
      {'stats' in reportResult && reportResult.stats && (
        <div className="bg-card rounded-lg border p-6">
          <h2 className="text-lg font-semibold mb-4">通報統計</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-muted-foreground">{reportResult.stats.pending}</p>
              <p className="text-sm text-muted-foreground">未対応</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-muted-foreground">{reportResult.stats.reviewed}</p>
              <p className="text-sm text-muted-foreground">確認中</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-muted-foreground">{reportResult.stats.resolved}</p>
              <p className="text-sm text-muted-foreground">対応完了</p>
            </div>
            <div className="text-center p-3 bg-muted/30 rounded-lg">
              <p className="text-2xl font-bold text-muted-foreground">{reportResult.stats.dismissed}</p>
              <p className="text-sm text-muted-foreground">却下</p>
            </div>
          </div>

          {reportResult.stats.byType && Object.keys(reportResult.stats.byType).length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h3 className="text-sm font-medium mb-2">種別ごとの通報</h3>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(reportResult.stats.byType) as [string, number][]).map(([type, count]) => (
                  <span key={type} className="px-3 py-1 bg-muted rounded-full text-sm">
                    {type === 'post' && '投稿'}
                    {type === 'comment' && 'コメント'}
                    {type === 'event' && 'イベント'}
                    {type === 'shop' && '盆栽園'}
                    {type === 'user' && 'ユーザー'}
                    : {count}件
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* クイックアクション */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">クイックアクション</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Link
            href="/admin/users"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <UsersIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm">ユーザー管理</span>
          </Link>
          <Link
            href="/admin/posts"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <FileTextIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm">投稿管理</span>
          </Link>
          <Link
            href="/admin/reviews"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <StarIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm">レビュー管理</span>
          </Link>
          <Link
            href="/admin/reports"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <AlertTriangleIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm">通報管理</span>
          </Link>
          <Link
            href="/admin/premium"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <CrownIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm">プレミアム管理</span>
          </Link>
          <Link
            href="/admin/contact"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <MailIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm">お問い合わせ</span>
          </Link>
          <Link
            href="/admin/logs"
            className="flex flex-col items-center gap-2 p-4 border rounded-lg hover:bg-muted transition-colors"
          >
            <ActivityIcon className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm">操作ログ</span>
          </Link>
        </div>
      </div>

      <SentryErrors />
    </div>
  )
}
