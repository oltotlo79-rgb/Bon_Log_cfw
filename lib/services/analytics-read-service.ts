/**
 * @module lib/services/analytics-read-service
 * モバイル API v1 §3.11 向けの分析サマリ集計。
 *
 * analytics-service.ts の各関数を並列 import して 1 つのサマリにまとめる読み取り専用レイヤー。
 * Web 側の lib/actions/analytics.ts・lib/services/analytics-service.ts は一切変更しない。
 *
 * Returns custom shape instead of ActionResult because this is a pure read
 * service called from the API route handler, not a Server Action.
 */

import 'server-only'

import {
  fetchPostAnalytics,
  fetchFollowerGrowth,
  fetchEngagementTrend,
} from '@/lib/services/analytics-service'
import type { AnalyticsPeriod } from '@/lib/constants/limits'

/** モバイル分析サマリの top posts 1 件 */
export interface AnalyticsTopPost {
  id: string
  content: string | null
  createdAt: string
  likeCount: number
  commentCount: number
}

/** モバイル分析サマリの日次エンゲージメント 1 件 */
export interface AnalyticsDailyEngagement {
  date: string
  posts: number
  likes: number
  comments: number
  engagement: number
}

/** モバイル分析サマリの follower growth 1 件 */
export interface AnalyticsFollowerGrowthEntry {
  date: string
  newFollowers: number
  totalFollowers: number
}

/** GET /api/v1/analytics/summary のレスポンス本体 */
export interface AnalyticsSummaryData {
  period: {
    days: number
    start: string
    end: string
  }
  posts: {
    total: number
    totalLikes: number
    totalComments: number
    avgEngagement: number
    topPosts: AnalyticsTopPost[]
  }
  followers: {
    current: number
    newInPeriod: number
    growth: AnalyticsFollowerGrowthEntry[]
  }
  engagementTrend: AnalyticsDailyEngagement[]
}

/**
 * 分析サマリを並列集計して返す。
 *
 * - 認証・プレミアム判定は呼び出し元 (route handler) が済ませている前提。
 * - Date は ISO 文字列にシリアライズ済みで返す（JSON 直渡し可）。
 * - N+1 なし: Promise.all で 3 集計クエリを並列実行。
 */
export async function fetchAnalyticsSummary(
  userId: string,
  days: AnalyticsPeriod,
): Promise<AnalyticsSummaryData> {
  const [postData, followerData, trendData] = await Promise.all([
    fetchPostAnalytics(userId, days),
    fetchFollowerGrowth(userId, days),
    fetchEngagementTrend(userId, days),
  ])

  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)

  return {
    period: {
      days,
      start: start.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    },
    posts: {
      total: postData.totalPosts,
      totalLikes: postData.totalLikes,
      totalComments: postData.totalComments,
      avgEngagement: postData.avgEngagement,
      topPosts: postData.topPosts.map((p) => ({
        id: p.id,
        content: p.content,
        createdAt: p.createdAt.toISOString(),
        likeCount: p.likeCount,
        commentCount: p.commentCount,
      })),
    },
    followers: {
      current: followerData.currentFollowers,
      newInPeriod: followerData.totalNewInPeriod,
      growth: followerData.growth.map((g) => ({
        date: g.date,
        newFollowers: g.newFollowers,
        totalFollowers: g.totalFollowers,
      })),
    },
    engagementTrend: trendData.trend.map((t) => ({
      date: t.date,
      posts: t.posts,
      likes: t.likes,
      comments: t.comments,
      engagement: t.engagement,
    })),
  }
}
