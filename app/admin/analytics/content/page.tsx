/**
 * @file コンテンツ分析ページ
 * @description ジャンル別投稿数、人気ハッシュタグ、日別エンゲージメントを
 *              可視化する管理者ページ。
 * @route /admin/analytics/content
 */

import { redirect } from 'next/navigation'
import { ROUTE_LOGIN } from '@/lib/constants/routes'
import { getContentAnalysis } from '@/lib/actions/admin/analytics'
import { ContentAnalyticsClient } from './ContentAnalyticsClient'
import { BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'コンテンツ分析 - BON-LOG 管理',
}

export default async function ContentAnalyticsPage() {
  const result = await getContentAnalysis()

  if ('error' in result) {
    redirect(ROUTE_LOGIN)
  }

  const { genreTrends, topHashtags, dailyEngagement } = result

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6" />
        <h1 className="text-2xl font-bold">コンテンツ分析</h1>
      </div>

      {/* セクション1: ジャンル別投稿数 */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">ジャンル別投稿数</h2>
        {genreTrends.length === 0 ? (
          <p className="text-muted-foreground text-sm">データがありません</p>
        ) : (
          <div className="space-y-3">
            {genreTrends.map(genre => {
              const maxCount = genreTrends[0]?.count ?? 1
              const widthPercent = Math.max((genre.count / maxCount) * 100, 2)
              return (
                <div key={genre.name} className="flex items-center gap-3">
                  <span className="text-sm font-medium w-28 shrink-0 truncate">
                    {genre.name}
                  </span>
                  <div className="flex-1 bg-muted/30 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-green-600 dark:bg-green-500 h-full rounded-full flex items-center justify-end px-2 transition-all"
                      style={{ width: `${widthPercent}%` }}
                    >
                      <span className="text-xs font-medium text-white whitespace-nowrap">
                        {genre.count.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* セクション2: 人気ハッシュタグ */}
      <div className="bg-card rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">人気ハッシュタグ</h2>
        {topHashtags.length === 0 ? (
          <p className="text-muted-foreground text-sm">データがありません</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {topHashtags.map(tag => {
              const maxCount = topHashtags[0]?.count ?? 1
              const minCount = topHashtags[topHashtags.length - 1]?.count ?? 1
              const range = maxCount - minCount || 1
              const normalized = (tag.count - minCount) / range
              // フォントサイズ: 0.75rem ~ 1.75rem
              const fontSize = 0.75 + normalized * 1.0
              return (
                <span
                  key={tag.tag}
                  className="inline-block px-2 py-1 bg-muted/50 rounded-lg text-foreground hover:bg-muted transition-colors cursor-default"
                  style={{ fontSize: `${fontSize}rem` }}
                  title={`${tag.count}件`}
                >
                  #{tag.tag}
                  <span className="text-xs text-muted-foreground ml-1">
                    ({tag.count})
                  </span>
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* セクション3: 日別エンゲージメント + CSVエクスポート */}
      <ContentAnalyticsClient dailyEngagement={dailyEngagement} />
    </div>
  )
}
