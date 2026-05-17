import { redirect } from 'next/navigation'
import {
  TrendingUp as TrendUpIcon,
  Users as UsersIcon,
  FileText as FileTextIcon,
  MessageSquare as MessageSquareIcon,
} from 'lucide-react'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { DEFAULT_ANALYTICS_DAYS } from '@/lib/constants/limits'
import { getStatsHistory, getStatsSummary } from '@/lib/actions/admin/stats'
import { StatsChartsWrapper as StatsCharts } from './StatsChartsWrapper'

// DAU など実時間集計を含むため、ISR/フルルートキャッシュを禁止しリクエスト毎に再計算する。
export const dynamic = 'force-dynamic'

export const metadata = {
  title: '統計情報 - BON-LOG 管理',
}

export default async function AdminStatsPage() {
  const [statsHistoryResult, summaryResult] = await Promise.all([
    getStatsHistory(DEFAULT_ANALYTICS_DAYS),
    getStatsSummary(),
  ])

  // 管理者権限なし、または集計取得失敗ならログインページへフォールバック。
  if (!statsHistoryResult.success || !statsHistoryResult.data) {
    redirect(ROUTE_LOGIN)
  }
  if (!summaryResult.success || !summaryResult.data) {
    redirect(ROUTE_LOGIN)
  }
  const statsHistory = statsHistoryResult.data
  const summary = summaryResult.data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendUpIcon className="w-6 h-6" />
        <h1 className="text-2xl font-bold">統計情報</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-muted/30 rounded-lg">
              <UsersIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">ユーザー</h3>
          </div>
          <p className="text-3xl font-bold">{summary.users.total.toLocaleString()}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">今日</p>
              <p className="font-medium text-foreground">+{summary.users.today}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今週</p>
              <p className="font-medium">+{summary.users.week}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今月</p>
              <p className="font-medium">+{summary.users.month}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-muted/30 rounded-lg">
              <FileTextIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">投稿</h3>
          </div>
          <p className="text-3xl font-bold">{summary.posts.total.toLocaleString()}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">今日</p>
              <p className="font-medium text-foreground">+{summary.posts.today}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今週</p>
              <p className="font-medium">+{summary.posts.week}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今月</p>
              <p className="font-medium">+{summary.posts.month}</p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-muted/30 rounded-lg">
              <MessageSquareIcon className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">コメント</h3>
          </div>
          <p className="text-3xl font-bold">{summary.comments.total.toLocaleString()}</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">今日</p>
              <p className="font-medium text-foreground">+{summary.comments.today}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今週</p>
              <p className="font-medium">+{summary.comments.week}</p>
            </div>
            <div>
              <p className="text-muted-foreground">今月</p>
              <p className="font-medium">+{summary.comments.month}</p>
            </div>
          </div>
        </div>
      </div>

      <StatsCharts data={statsHistory} />
    </div>
  )
}
