'use server'

import { prisma } from '@/lib/db'
import { requireAdmin, actionError } from '@/lib/actions/utils'
import { ANALYTICS_DAYS_RANGE, COHORT_MONTHS_DEFAULT, COHORT_ANALYSIS_MAX_RECORDS, CSV_EXPORT_MAX_ROWS, ONE_DAY_MS, ADMIN_TOP_GENRES_LIMIT, ADMIN_TOP_HASHTAGS_LIMIT } from '@/lib/constants/limits'
import { ERR_UNSUPPORTED_EXPORT_TYPE, ERR_OPERATION_FAILED } from '@/lib/constants/errors'
import { logger } from '@/lib/logger'
import { isoDateKey } from '@/lib/utils/date-key'

/**
 * コホート分析（登録週/月ごとのアクティブ率）。
 * OOM 防止のため `COHORT_ANALYSIS_MAX_RECORDS` で取得件数を頭打ちにする。
 */
export async function getCohortAnalysis(options?: {
  period?: 'weekly' | 'monthly'
  months?: number
}) {
  const admin = await requireAdmin('analytics:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const { period = 'monthly', months = COHORT_MONTHS_DEFAULT } = options || {}
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    const users = await prisma.user.findMany({
      where: { createdAt: { gte: startDate } },
      select: { id: true, createdAt: true },
      take: COHORT_ANALYSIS_MAX_RECORDS,
    })

    const userIds = users.map(u => u.id)
    const posts = await prisma.post.findMany({
      where: { userId: { in: userIds }, createdAt: { gte: startDate } },
      select: { userId: true, createdAt: true },
      take: COHORT_ANALYSIS_MAX_RECORDS,
    })

    const getCohortKey = (date: Date) => {
      if (period === 'weekly') {
        const d = new Date(date)
        const dayNum = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum)
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / ONE_DAY_MS) + 1) / 7)
        return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
      }
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    }
    const getMonthKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    const cohortMap = new Map<string, Set<string>>()
    for (const u of users) {
      const key = getCohortKey(u.createdAt)
      let cohortSet = cohortMap.get(key)
      if (!cohortSet) {
        cohortSet = new Set()
        cohortMap.set(key, cohortSet)
      }
      cohortSet.add(u.id)
    }

    const userCohort = new Map<string, string>()
    for (const u of users) {
      userCohort.set(u.id, getCohortKey(u.createdAt))
    }

    const retentionMap = new Map<string, Map<string, Set<string>>>()
    for (const p of posts) {
      const cohort = userCohort.get(p.userId)
      if (!cohort) continue
      const activeMonth = getMonthKey(p.createdAt)
      let monthMap = retentionMap.get(cohort)
      if (!monthMap) {
        monthMap = new Map()
        retentionMap.set(cohort, monthMap)
      }
      let activeSet = monthMap.get(activeMonth)
      if (!activeSet) {
        activeSet = new Set()
        monthMap.set(activeMonth, activeSet)
      }
      activeSet.add(p.userId)
    }

    const cohorts = [...cohortMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([cohort, userSet]) => ({ cohort, total: userSet.size }))

    const retention: { cohort: string; activeMonth: string; activeUsers: number }[] = []
    for (const [cohort, monthMap] of retentionMap.entries()) {
      for (const [activeMonth, userSet] of monthMap.entries()) {
        retention.push({ cohort, activeMonth, activeUsers: userSet.size })
      }
    }
    retention.sort((a, b) => a.cohort.localeCompare(b.cohort) || a.activeMonth.localeCompare(b.activeMonth))

    return { cohorts, retention }
  } catch (error) {
    logger.error('getCohortAnalysis failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function getContentAnalysis() {
  const admin = await requireAdmin('analytics:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const thirtyDaysAgo = new Date(Date.now() - ANALYTICS_DAYS_RANGE * ONE_DAY_MS)

    const genreData = await prisma.postGenre.groupBy({
      by: ['genreId'],
      where: {
        post: { createdAt: { gte: thirtyDaysAgo } },
      },
      _count: { postId: true },
      orderBy: { _count: { postId: 'desc' } },
      take: ADMIN_TOP_GENRES_LIMIT,
    })

    const genreIds = genreData.map(g => g.genreId)
    const genres = await prisma.genre.findMany({
      where: { id: { in: genreIds } },
      select: { id: true, name: true },
    })
    const genreMap = new Map(genres.map(g => [g.id, g.name]))

    const genreTrends = genreData.map(g => ({
      name: genreMap.get(g.genreId) || '不明',
      count: g._count.postId,
    }))

    const hashtagData = await prisma.postHashtag.groupBy({
      by: ['hashtagId'],
      where: {
        post: { createdAt: { gte: thirtyDaysAgo } },
      },
      _count: { postId: true },
      orderBy: { _count: { postId: 'desc' } },
      take: ADMIN_TOP_HASHTAGS_LIMIT,
    })

    const hashtagIds = hashtagData.map(h => h.hashtagId)
    const hashtags = await prisma.hashtag.findMany({
      where: { id: { in: hashtagIds } },
      select: { id: true, name: true },
    })
    const hashtagMap = new Map(hashtags.map(h => [h.id, h.name]))

    const topHashtags = hashtagData.map(h => ({
      tag: hashtagMap.get(h.hashtagId) || '不明',
      count: h._count.postId,
    }))

    // raw SQL を使う理由: groupBy(createdAt) はタイムスタンプ単位で集約してしまうため、
    // DATE() で日単位に丸め直す。
    const [postsByDay, likesByDay, commentsByDay] = await Promise.all([
      prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM posts
        WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
      prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM likes
        WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
      prisma.$queryRaw<Array<{ date: Date; count: bigint }>>`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM comments
        WHERE created_at >= ${thirtyDaysAgo}
        GROUP BY DATE(created_at)
        ORDER BY date
      `,
    ])

    const postsMap = new Map<string, number>()
    const likesMap = new Map<string, number>()
    const commentsMap = new Map<string, number>()

    for (const p of postsByDay) {
      const key = isoDateKey(new Date(p.date))
      postsMap.set(key, Number(p.count))
    }
    for (const l of likesByDay) {
      const key = isoDateKey(new Date(l.date))
      likesMap.set(key, Number(l.count))
    }
    for (const c of commentsByDay) {
      const key = isoDateKey(new Date(c.date))
      commentsMap.set(key, Number(c.count))
    }

    const dailyEngagement: { date: string; posts: number; likes: number; comments: number }[] = []
    for (let i = ANALYTICS_DAYS_RANGE; i >= 0; i--) {
      const d = new Date(Date.now() - i * ONE_DAY_MS)
      const key = isoDateKey(d)
      dailyEngagement.push({
        date: key,
        posts: postsMap.get(key) ?? 0,
        likes: likesMap.get(key) ?? 0,
        comments: commentsMap.get(key) ?? 0,
      })
    }

    return { genreTrends, topHashtags, dailyEngagement }
  } catch (error) {
    logger.error('getContentAnalysis failed', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_OPERATION_FAILED)
  }
}

export async function exportAnalyticsCSV(type: 'cohort' | 'content' | 'users') {
  const admin = await requireAdmin('analytics:export')
  if ('error' in admin) return actionError(admin.error)

  if (type === 'users') {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nickname: true,
        email: true,
        createdAt: true,
        isPremium: true,
        isSuspended: true,
        _count: { select: { posts: true, followers: true, following: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: CSV_EXPORT_MAX_ROWS,
    })

    const header = 'ID,ニックネーム,メール,登録日,プレミアム,停止,投稿数,フォロワー数,フォロー数'
    const rows = users.map(u =>
      `${u.id},${u.nickname},${u.email},${u.createdAt.toISOString()},${u.isPremium},${u.isSuspended},${u._count.posts},${u._count.followers},${u._count.following}`
    )
    return { csv: [header, ...rows].join('\n'), filename: `users_${new Date().toISOString().split('T')[0]}.csv` }
  }

  return actionError(ERR_UNSUPPORTED_EXPORT_TYPE)
}
