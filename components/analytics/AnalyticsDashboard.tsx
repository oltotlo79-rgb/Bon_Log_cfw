import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from './StatCard'
import { LikeChart } from './LikeChart'
import { KeywordCloud } from './KeywordCloud'
import { QuoteList } from './QuoteList'
import { TimeHeatmap } from './TimeHeatmap'
import { TopPostsList } from './TopPostsList'
import { GenreChart } from './GenreChart'
import { FollowerGrowthChart } from './FollowerGrowthChart'
import { BestTimeCard } from './BestTimeCard'
import { FileText, Heart, MessageSquare, TrendingUp, Repeat2, Users } from 'lucide-react'
import type {
  PostAnalytics,
  LikeAnalytics,
  QuoteAnalytics,
  KeywordAnalytics,
  EngagementTrend,
  GenrePerformance,
  FollowerGrowth,
  PeriodComparison,
} from '@/types/analytics'

type AnalyticsDashboardProps = {
  postAnalytics: PostAnalytics | null
  likeAnalytics: LikeAnalytics | null
  quoteAnalytics: QuoteAnalytics | null
  keywordAnalytics: KeywordAnalytics | null
  engagementTrend: EngagementTrend | null
  genrePerformance: GenrePerformance | null
  followerGrowth: FollowerGrowth | null
  periodComparison: PeriodComparison | null
}

export function AnalyticsDashboard({
  postAnalytics,
  likeAnalytics,
  quoteAnalytics,
  keywordAnalytics,
  engagementTrend,
  genrePerformance,
  followerGrowth,
  periodComparison,
}: AnalyticsDashboardProps) {
  return (
    <div className="space-y-6">
      {/* 統計サマリー - 前月比付き */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="投稿数"
          value={postAnalytics?.totalPosts ?? 0}
          icon={FileText}
          change={periodComparison?.posts.change}
        />
        <StatCard
          title="いいね"
          value={postAnalytics?.totalLikes ?? 0}
          icon={Heart}
          change={periodComparison?.likes.change}
        />
        <StatCard
          title="コメント"
          value={postAnalytics?.totalComments ?? 0}
          icon={MessageSquare}
          change={periodComparison?.comments.change}
        />
        <StatCard
          title="平均エンゲージメント"
          value={postAnalytics?.avgEngagement?.toFixed(1) ?? '0'}
          icon={TrendingUp}
        />
      </div>

      {/* 2段目: フォロワー + ベスト投稿時間 */}
      <div className="grid md:grid-cols-2 gap-6">
        {followerGrowth && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                フォロワー推移
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FollowerGrowthChart
                currentFollowers={followerGrowth.currentFollowers}
                totalNewInPeriod={followerGrowth.totalNewInPeriod}
                growth={followerGrowth.growth}
              />
            </CardContent>
          </Card>
        )}

        {likeAnalytics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                ベスト投稿タイミング
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BestTimeCard
                peakHour={likeAnalytics.peakHour}
                peakWeekday={likeAnalytics.peakWeekday}
                hourlyData={likeAnalytics.hourlyData}
                weekdayData={likeAnalytics.weekdayData}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* エンゲージメント推移チャート */}
      {engagementTrend && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">エンゲージメント推移</CardTitle>
          </CardHeader>
          <CardContent>
            <LikeChart data={engagementTrend.trend.map(t => ({ date: t.date, likes: t.likes, comments: t.comments }))} />
          </CardContent>
        </Card>
      )}

      {/* トップ投稿 + ジャンル別パフォーマンス */}
      <div className="grid md:grid-cols-2 gap-6">
        {postAnalytics && postAnalytics.topPosts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">トップ投稿</CardTitle>
            </CardHeader>
            <CardContent>
              <TopPostsList posts={postAnalytics.topPosts} />
            </CardContent>
          </Card>
        )}

        {genrePerformance && genrePerformance.genres.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ジャンル別パフォーマンス</CardTitle>
            </CardHeader>
            <CardContent>
              <GenreChart genres={genrePerformance.genres} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* 時間帯別ヒートマップ */}
      {likeAnalytics && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">時間帯別いいね</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeHeatmap
              hourlyData={likeAnalytics.hourlyData}
              weekdayData={likeAnalytics.weekdayData}
            />
          </CardContent>
        </Card>
      )}

      {/* キーワードクラウド + 引用投稿一覧 */}
      <div className="grid md:grid-cols-2 gap-6">
        {keywordAnalytics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">よく使うキーワード</CardTitle>
            </CardHeader>
            <CardContent>
              <KeywordCloud keywords={keywordAnalytics.keywords} />
            </CardContent>
          </Card>
        )}

        {quoteAnalytics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Repeat2 className="w-4 h-4" />
                引用された投稿 ({quoteAnalytics.totalQuotes})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <QuoteList quotes={quoteAnalytics.quotes} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
