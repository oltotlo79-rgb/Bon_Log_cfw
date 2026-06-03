/**
 * アナリティクス機能のServer Actions
 *
 * 認証・権限チェック後、サービス層に処理を委譲する薄いレイヤー。
 * ビジネスロジックは `lib/services/analytics-service.ts` に集約。
 * 戻り値は CLAUDE.md ルール2 に従い `ActionResult<T>` で統一する。
 *
 * @module lib/actions/analytics
 */

'use server'

import { requireAuth, actionSuccess, actionError } from '@/lib/actions/utils'
import type { ActionResult } from '@/types/action-result'
import { ERR_PREMIUM_ONLY, ERR_ANALYTICS_FETCH_FAILED } from '@/lib/constants/errors'
import { isPremiumUser } from '@/lib/premium'
import logger from '@/lib/logger'
import { DEFAULT_ANALYTICS_DAYS } from '@/lib/constants/limits'
import {
  fetchPostAnalytics,
  fetchLikeAnalytics,
  fetchQuoteAnalytics,
  fetchKeywordAnalytics,
  fetchEngagementTrend,
  fetchGenrePerformance,
  fetchFollowerGrowth,
  fetchPeriodComparison,
  fetchDetailedAnalytics,
  fetchBasicStats,
} from '@/lib/services/analytics-service'

type PremiumAuthResult =
  | { success: false; error: string }
  | { success: true; userId: string }

/** プレミアム認証チェック。失敗時は ActionResult 形式のエラーを返す。 */
async function ensurePremiumAuth(): Promise<PremiumAuthResult> {
  const auth = await requireAuth()
  if ('error' in auth) return { success: false, error: auth.error }
  const isPremium = await isPremiumUser(auth.userId)
  if (!isPremium) return { success: false, error: ERR_PREMIUM_ONLY }
  return { success: true, userId: auth.userId }
}

export async function getPostAnalytics(
  days = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<Awaited<ReturnType<typeof fetchPostAnalytics>>>> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)
  return actionSuccess(await fetchPostAnalytics(auth.userId, days))
}

export async function getLikeAnalytics(
  days = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<Awaited<ReturnType<typeof fetchLikeAnalytics>>>> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)
  return actionSuccess(await fetchLikeAnalytics(auth.userId, days))
}

export async function getQuoteAnalytics(): Promise<
  ActionResult<Awaited<ReturnType<typeof fetchQuoteAnalytics>>>
> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)
  return actionSuccess(await fetchQuoteAnalytics(auth.userId))
}

export async function getKeywordAnalytics(
  days = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<Awaited<ReturnType<typeof fetchKeywordAnalytics>>>> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)
  return actionSuccess(await fetchKeywordAnalytics(auth.userId, days))
}

export async function getEngagementTrend(
  days = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<Awaited<ReturnType<typeof fetchEngagementTrend>>>> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)
  return actionSuccess(await fetchEngagementTrend(auth.userId, days))
}

export async function getGenrePerformance(
  days = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<Awaited<ReturnType<typeof fetchGenrePerformance>>>> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)
  return actionSuccess(await fetchGenrePerformance(auth.userId, days))
}

export async function getFollowerGrowth(
  days = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<Awaited<ReturnType<typeof fetchFollowerGrowth>>>> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)
  return actionSuccess(await fetchFollowerGrowth(auth.userId, days))
}

export async function getPeriodComparison(
  days = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<Awaited<ReturnType<typeof fetchPeriodComparison>>>> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)
  return actionSuccess(await fetchPeriodComparison(auth.userId, days))
}

type AnalyticsDashboardData = {
  postAnalytics: Awaited<ReturnType<typeof fetchPostAnalytics>>
  likeAnalytics: Awaited<ReturnType<typeof fetchLikeAnalytics>>
  quoteAnalytics: Awaited<ReturnType<typeof fetchQuoteAnalytics>>
  keywordAnalytics: Awaited<ReturnType<typeof fetchKeywordAnalytics>>
  engagementTrend: Awaited<ReturnType<typeof fetchEngagementTrend>>
}

export async function getAnalyticsDashboard(
  days = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<AnalyticsDashboardData>> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)
  const userId = auth.userId

  const [
    postAnalytics,
    likeAnalytics,
    quoteAnalytics,
    keywordAnalytics,
    engagementTrend,
  ] = await Promise.all([
    fetchPostAnalytics(userId, days),
    fetchLikeAnalytics(userId, days),
    fetchQuoteAnalytics(userId),
    fetchKeywordAnalytics(userId, days),
    fetchEngagementTrend(userId, days),
  ])

  return actionSuccess({
    postAnalytics,
    likeAnalytics,
    quoteAnalytics,
    keywordAnalytics,
    engagementTrend,
  })
}

export async function getDetailedAnalytics(
  days: number = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<Awaited<ReturnType<typeof fetchDetailedAnalytics>>>> {
  const auth = await ensurePremiumAuth()
  if (!auth.success) return actionError(auth.error)

  try {
    return actionSuccess(await fetchDetailedAnalytics(auth.userId, days))
  } catch (error) {
    logger.error('Get detailed analytics error:', error)
    return actionError(ERR_ANALYTICS_FETCH_FAILED)
  }
}

export async function getBasicStats(): Promise<
  ActionResult<Awaited<ReturnType<typeof fetchBasicStats>>>
> {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  return actionSuccess(await fetchBasicStats(auth.userId))
}
