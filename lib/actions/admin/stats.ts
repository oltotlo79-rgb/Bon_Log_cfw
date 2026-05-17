'use server'

import { prisma } from '@/lib/db'
import { unstable_cache } from 'next/cache'
import { DEFAULT_ANALYTICS_DAYS, WEEK_DAYS, ADMIN_STATS_CACHE_TTL_SECONDS } from '@/lib/constants/limits'
import { CACHE_TAGS } from '@/lib/cache'
import { requireAdmin, actionError, actionSuccess, type ActionResult } from '@/lib/actions/utils'
import { ERR_ANALYTICS_FETCH_FAILED } from '@/lib/constants/errors'
import { logger } from '@/lib/logger'
import { getStartOfToday, getStartOfNDaysAgo } from '@/lib/utils'
import { REPORT_STATUS } from '@/lib/constants/status'

// bigint を安全に number へ変換 (Number.MAX_SAFE_INTEGER を超える場合はクランプ)。
function safeBigIntToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER
  }
  return Number(value)
}

export type AdminStats = {
  totalUsers: number
  todayUsers: number
  totalPosts: number
  todayPosts: number
  pendingReports: number
  totalEvents: number
  totalShops: number
  activeUsersWeek: number
}

const fetchAdminStatsFromDb = unstable_cache(
  async (): Promise<AdminStats> => {
    const today = getStartOfToday()
    const weekAgo = getStartOfNDaysAgo(WEEK_DAYS)

    const [
      totalUsers,
      todayUsers,
      totalPosts,
      todayPosts,
      pendingReports,
      totalEvents,
      totalShops,
      activeUsersWeek,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.post.count(),
      prisma.post.count({ where: { createdAt: { gte: today } } }),
      prisma.report.count({ where: { status: REPORT_STATUS.PENDING } }),
      prisma.event.count(),
      prisma.bonsaiShop.count(),
      prisma.user.count({
        where: { posts: { some: { createdAt: { gte: weekAgo } } } },
      }),
    ])

    return {
      totalUsers,
      todayUsers,
      totalPosts,
      todayPosts,
      pendingReports,
      totalEvents,
      totalShops,
      activeUsersWeek,
    }
  },
  ['admin-stats'],
  { revalidate: ADMIN_STATS_CACHE_TTL_SECONDS, tags: [CACHE_TAGS.ADMIN_STATS] },
)

export async function getAdminStats(): Promise<ActionResult<AdminStats>> {
  const admin = await requireAdmin('stats:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const data = await fetchAdminStatsFromDb()
    return actionSuccess(data)
  } catch (error) {
    logger.error('Get admin stats error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_ANALYTICS_FETCH_FAILED)
  }
}

const fetchDailyActiveUsersFromDb = unstable_cache(
  async () => {
    const today = getStartOfToday()
    return prisma.user.count({
      where: {
        OR: [
          { posts: { some: { createdAt: { gte: today } } } },
          { comments: { some: { createdAt: { gte: today } } } },
        ],
      },
    })
  },
  ['admin-dau'],
  { revalidate: ADMIN_STATS_CACHE_TTL_SECONDS, tags: [CACHE_TAGS.ADMIN_STATS] },
)

export async function getDailyActiveUsers(): Promise<ActionResult<number>> {
  const admin = await requireAdmin('stats:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const data = await fetchDailyActiveUsersFromDb()
    return actionSuccess(data)
  } catch (error) {
    logger.error('Get daily active users error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_ANALYTICS_FETCH_FAILED)
  }
}

export type StatsHistoryEntry = {
  date: string
  users: number
  posts: number
  comments: number
}

export async function getStatsHistory(
  days: number = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<StatsHistoryEntry[]>> {
  const admin = await requireAdmin('stats:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - (days - 1))
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 1)
    endDate.setHours(0, 0, 0, 0)

    // N+1 を避けるため、3 つの groupBy で全日分を一括取得 (従来 N*3 = 90 クエリ → 4 クエリ)。
    const [dailyPosts, dailyComments, totalUsersBeforeStart, dailyNewUsers] = await Promise.all([
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE_TRUNC('day', "created_at") as date, COUNT(*)::bigint as count
        FROM "posts"
        WHERE "created_at" >= ${startDate} AND "created_at" < ${endDate}
        GROUP BY DATE_TRUNC('day', "created_at")
      `,
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE_TRUNC('day', "created_at") as date, COUNT(*)::bigint as count
        FROM "comments"
        WHERE "created_at" >= ${startDate} AND "created_at" < ${endDate}
        GROUP BY DATE_TRUNC('day', "created_at")
      `,
      prisma.user.count({
        where: { createdAt: { lt: startDate } },
      }),
      prisma.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE_TRUNC('day', "created_at") as date, COUNT(*)::bigint as count
        FROM "users"
        WHERE "created_at" >= ${startDate} AND "created_at" < ${endDate}
        GROUP BY DATE_TRUNC('day', "created_at")
      `,
    ])

    const toDateKey = (d: Date) => d.toISOString().slice(0, 10)

    const postsMap = new Map<string | undefined, number>(
      dailyPosts.map((r: { date: Date; count: bigint }) => [toDateKey(new Date(r.date)), safeBigIntToNumber(r.count)]),
    )
    const commentsMap = new Map<string | undefined, number>(
      dailyComments.map((r: { date: Date; count: bigint }) => [toDateKey(new Date(r.date)), safeBigIntToNumber(r.count)]),
    )
    const newUsersMap = new Map<string | undefined, number>(
      dailyNewUsers.map((r: { date: Date; count: bigint }) => [toDateKey(new Date(r.date)), safeBigIntToNumber(r.count)]),
    )

    const results: StatsHistoryEntry[] = []
    let cumulativeUsers = totalUsersBeforeStart

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const dateKey = toDateKey(date)
      cumulativeUsers += newUsersMap.get(dateKey) ?? 0

      results.push({
        date: dateKey,
        users: cumulativeUsers,
        posts: postsMap.get(dateKey) ?? 0,
        comments: commentsMap.get(dateKey) ?? 0,
      })
    }

    return actionSuccess(results)
  } catch (error) {
    logger.error('Get stats history error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_ANALYTICS_FETCH_FAILED)
  }
}

export type DailyVisitorsEntry = { date: string; visitors: number }

/**
 * 過去 N 日間の Daily Visitors（実訪問者数）履歴を返す。
 *
 * Why: `daily_visitors` テーブルは `(date, visitor_id)` UNIQUE 制約により同一訪問者の
 * 同日複数アクセスを 1 件に集約している。`bon_log_visitor_id` HttpOnly Cookie で識別され、
 * 認証中なら `user_id` がバックフィルされる (未認証訪問者も計測対象、JS 無効端末は除外)。
 * 日付は UTC 起点、チャート側で JST に整形する。
 */
export async function getDailyVisitorsHistory(
  days: number = DEFAULT_ANALYTICS_DAYS,
): Promise<ActionResult<DailyVisitorsEntry[]>> {
  const admin = await requireAdmin('stats:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const now = new Date()
    const startDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1), 0, 0, 0, 0))
    const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0))

    const rows = await prisma.$queryRaw<Array<{ date: Date; visitors: bigint }>>`
      SELECT date, COUNT(*)::bigint AS visitors
      FROM daily_visitors
      WHERE date >= ${startDate} AND date < ${endDate}
      GROUP BY date
      ORDER BY date
    `

    const toDateKey = (d: Date) => d.toISOString().slice(0, 10)
    const visitorsMap = new Map<string | undefined, number>(
      rows.map((r) => [toDateKey(new Date(r.date)), safeBigIntToNumber(r.visitors)]),
    )

    // 活動 0 の日も埋めて連続した配列にする (チャート描画でギャップを作らないため)。
    const results: DailyVisitorsEntry[] = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i, 0, 0, 0, 0))
      const dateKey = toDateKey(date)
      results.push({ date: dateKey ?? '', visitors: visitorsMap.get(dateKey) ?? 0 })
    }

    return actionSuccess(results)
  } catch (error) {
    logger.error('Get visitors history error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_ANALYTICS_FETCH_FAILED)
  }
}

export type PeriodStats = { total: number; today: number; week: number; month: number }
export type StatsSummary = {
  users: PeriodStats
  posts: PeriodStats
  comments: PeriodStats
}

export async function getStatsSummary(): Promise<ActionResult<StatsSummary>> {
  const admin = await requireAdmin('stats:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const today = getStartOfToday()
    const weekAgo = getStartOfNDaysAgo(WEEK_DAYS)
    const monthAgo = new Date(today)
    monthAgo.setMonth(monthAgo.getMonth() - 1)

    const [
      totalUsers,
      todayUsers,
      weekUsers,
      monthUsers,
      totalPosts,
      todayPosts,
      weekPosts,
      monthPosts,
      totalComments,
      todayComments,
      weekComments,
      monthComments,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.post.count(),
      prisma.post.count({ where: { createdAt: { gte: today } } }),
      prisma.post.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.post.count({ where: { createdAt: { gte: monthAgo } } }),
      prisma.comment.count(),
      prisma.comment.count({ where: { createdAt: { gte: today } } }),
      prisma.comment.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.comment.count({ where: { createdAt: { gte: monthAgo } } }),
    ])

    return actionSuccess({
      users: { total: totalUsers, today: todayUsers, week: weekUsers, month: monthUsers },
      posts: { total: totalPosts, today: todayPosts, week: weekPosts, month: monthPosts },
      comments: { total: totalComments, today: todayComments, week: weekComments, month: monthComments },
    })
  } catch (error) {
    logger.error('Get stats summary error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_ANALYTICS_FETCH_FAILED)
  }
}
