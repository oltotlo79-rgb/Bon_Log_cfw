import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { auth } from '@/lib/auth'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { isPremiumUser } from '@/lib/premium'
import {
  getPostAnalytics,
  getLikeAnalytics,
  getQuoteAnalytics,
  getKeywordAnalytics,
  getEngagementTrend,
  getGenrePerformance,
  getFollowerGrowth,
  getPeriodComparison,
} from '@/lib/actions/analytics'
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard'
import { PeriodFilter } from '@/components/analytics/PeriodFilter'
import { PremiumUpgradeCard } from '@/components/subscription/PremiumUpgradeCard'
import { BarChart3, Loader2 } from 'lucide-react'
import {
  DEFAULT_ANALYTICS_DAYS,
  isAnalyticsPeriod,
} from '@/lib/constants/limits'

export const metadata = {
  title: '投稿分析',
}

/**
 * 分析データを取得して表示する非同期コンポーネント。
 * Suspense境界内で使用し、データ取得中はフォールバックを表示する。
 */
async function AnalyticsContent({ days }: { days: number }) {
  const [
    postAnalytics,
    likeAnalytics,
    quoteAnalytics,
    keywordAnalytics,
    engagementTrend,
    genrePerformance,
    followerGrowth,
    periodComparison,
  ] = await Promise.all([
    getPostAnalytics(days),
    getLikeAnalytics(days),
    getQuoteAnalytics(),
    getKeywordAnalytics(days),
    getEngagementTrend(days),
    getGenrePerformance(days),
    getFollowerGrowth(days),
    getPeriodComparison(days),
  ])

  return (
    <AnalyticsDashboard
      postAnalytics={postAnalytics.success ? postAnalytics.data ?? null : null}
      likeAnalytics={likeAnalytics.success ? likeAnalytics.data ?? null : null}
      quoteAnalytics={quoteAnalytics.success ? quoteAnalytics.data ?? null : null}
      keywordAnalytics={keywordAnalytics.success ? keywordAnalytics.data ?? null : null}
      engagementTrend={engagementTrend.success ? engagementTrend.data ?? null : null}
      genrePerformance={genrePerformance.success ? genrePerformance.data ?? null : null}
      followerGrowth={followerGrowth.success ? followerGrowth.data ?? null : null}
      periodComparison={periodComparison.success ? periodComparison.data ?? null : null}
    />
  )
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>
}) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect(ROUTE_LOGIN)
  }

  const isPremium = await isPremiumUser(session.user.id)

  if (!isPremium) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4">
        <div className="flex items-center gap-3 mb-6">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">投稿分析</h1>
        </div>
        <PremiumUpgradeCard
          title="投稿分析は有料会員限定機能です"
          description="プレミアム会員になると、投稿のパフォーマンスを詳しく分析できます。"
        />
      </div>
    )
  }

  const params = await searchParams
  const rawDays = Number(params.days)
  const days = isAnalyticsPeriod(rawDays) ? rawDays : DEFAULT_ANALYTICS_DAYS

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* ヘッダー + 期間フィルター */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">投稿分析</h1>
        </div>
        <Suspense fallback={null}>
          <PeriodFilter />
        </Suspense>
      </div>

      <Suspense fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-muted-foreground">分析データを読み込み中...</span>
        </div>
      }>
        <AnalyticsContent days={days} />
      </Suspense>
    </div>
  )
}
