import { getMonitoringStats } from '@/lib/actions/admin/monitoring'
import type { MonitoringStats } from '@/lib/actions/admin/monitoring'

export const metadata = {
  title: 'システム監視 - 管理画面',
}

export const dynamic = 'force-dynamic'

function StatusBadge({ status }: { status: 'healthy' | 'unhealthy' | 'degraded' }) {
  const styles = {
    healthy: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    degraded: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    unhealthy: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  }
  const labels = { healthy: '正常', degraded: '低速', unhealthy: '異常' }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
      <span className={`w-2 h-2 rounded-full ${
        status === 'healthy' ? 'bg-green-500' :
        status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
      }`} />
      {labels[status]}
    </span>
  )
}

function HealthCard({ title, status, latencyMs }: {
  title: string
  status: 'healthy' | 'unhealthy' | 'degraded'
  latencyMs: number
}) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{title}</h3>
        <StatusBadge status={status} />
      </div>
      <p className="text-2xl font-bold tabular-nums">
        {status === 'unhealthy' ? '---' : `${latencyMs}ms`}
      </p>
      <p className="text-xs text-muted-foreground mt-1">レイテンシ</p>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="bg-card rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value.toLocaleString()}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}

export default async function MonitoringPage() {
  const result = await getMonitoringStats()

  if (!result.success || !result.data) {
    const message = !result.success ? result.error : '監視データの取得に失敗しました'
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">システム監視</h1>
        <div className="bg-destructive/10 text-destructive p-4 rounded-lg">
          {message}
        </div>
      </div>
    )
  }

  const stats: MonitoringStats = result.data

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">システム監視</h1>
        <p className="text-sm text-muted-foreground">
          最終更新: {new Date(stats.health.timestamp).toLocaleString('ja-JP')}
        </p>
      </div>

      {/* インフラヘルス */}
      <section>
        <h2 className="text-lg font-semibold mb-3">インフラストラクチャ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <HealthCard
            title="PostgreSQL"
            status={stats.health.database.status}
            latencyMs={stats.health.database.latencyMs}
          />
          <HealthCard
            title="Redis (Upstash)"
            status={stats.health.redis.status}
            latencyMs={stats.health.redis.latencyMs}
          />
        </div>
      </section>

      {/* アプリケーション統計 */}
      <section>
        <h2 className="text-lg font-semibold mb-3">アプリケーション統計</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="総ユーザー数" value={stats.counts.totalUsers} />
          <StatCard label="総投稿数" value={stats.counts.totalPosts} />
          <StatCard label="本日のアクティブユーザー" value={stats.counts.activeUsersToday} />
          <StatCard label="本日の投稿数" value={stats.counts.postsToday} />
          <StatCard label="未処理の通報" value={stats.counts.pendingReports} sub="要対応" />
          <StatCard label="モデレーション待ち" value={stats.counts.pendingModeration} sub="要対応" />
        </div>
      </section>

      {/* セキュリティ */}
      <section>
        <h2 className="text-lg font-semibold mb-3">セキュリティ</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatCard
            label="レート制限ブロック（24時間）"
            value={stats.rateLimiting.recentBlocks}
            sub="rate_limit_exceeded イベント数"
          />
        </div>
      </section>

      {/* 外部監視セットアップガイド */}
      <section>
        <h2 className="text-lg font-semibold mb-3">外部監視</h2>
        <div className="bg-card rounded-lg border p-4 space-y-3">
          <div>
            <h3 className="font-medium text-sm">ヘルスチェックエンドポイント</h3>
            <code className="text-xs bg-muted px-2 py-1 rounded block mt-1">
              GET /api/health
            </code>
            <p className="text-xs text-muted-foreground mt-1">
              UptimeRobot等の外部監視サービスでこのURLを5分間隔で監視してください。
              200で正常、503でDB接続エラーを返します。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-sm">Vercel デプロイ通知</h3>
            <p className="text-xs text-muted-foreground">
              Vercel Dashboard → Settings → Notifications → Slack/Discord Webhook を設定してください。
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
