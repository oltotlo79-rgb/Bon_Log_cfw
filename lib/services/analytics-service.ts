/**
 * アナリティクス サービス層
 *
 * 認証・権限チェックを含まない純粋なビジネスロジック。
 * Server Action / API Route / Cron の3箇所から再利用可能。
 *
 * @module lib/services/analytics-service
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import logger from '@/lib/logger'

import {
  DEFAULT_ANALYTICS_DAYS,
  ANALYTICS_POSTS_LIMIT,
  ANALYTICS_MAX_SCAN_ROWS,
  TOP_POSTS_LIMIT,
  GENRE_PERFORMANCE_LIMIT,
  CONTENT_PREVIEW_LENGTH,
  QUOTE_CONTENT_PREVIEW_LENGTH,
  TOP_KEYWORDS_LIMIT,
  MIN_KEYWORD_LENGTH,
} from '@/lib/constants/limits'
import { getStartOfNDaysAgo, getEndOfDay } from '@/lib/utils'
import { isoDateKey } from '@/lib/utils/date-key'

/**
 * スキャン安全上限への到達を可視化する（サイレント切り捨て防止）。
 * 投稿系は 1 日上限により現実には到達しないが、いいね集計など件数が読めないクエリで
 * 上限に達した場合は集計が標本値になる旨を warn で残す。
 */
function warnIfScanCapped(fn: string, userId: string, rowCount: number): void {
  if (rowCount >= ANALYTICS_MAX_SCAN_ROWS) {
    logger.warn(`${fn}: scan cap reached; aggregation is sampled`, {
      userId,
      cap: ANALYTICS_MAX_SCAN_ROWS,
    })
  }
}

export async function fetchPostAnalytics(userId: string, days = DEFAULT_ANALYTICS_DAYS) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const posts = await prisma.post.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
    },
    include: {
      _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: ANALYTICS_MAX_SCAN_ROWS,
  })
  warnIfScanCapped('fetchPostAnalytics', userId, posts.length)

  type PostWithCount = typeof posts[number]
  const totalLikes = posts.reduce((sum: number, p: PostWithCount) => sum + p._count.likes, 0)
  const totalComments = posts.reduce((sum: number, p: PostWithCount) => sum + p._count.comments, 0)
  const avgEngagement = posts.length > 0 ? (totalLikes + totalComments) / posts.length : 0

  const topPosts = [...posts]
    .sort((a: PostWithCount, b: PostWithCount) => (b._count.likes + b._count.comments) - (a._count.likes + a._count.comments))
    .slice(0, TOP_POSTS_LIMIT)

  return {
    totalPosts: posts.length,
    totalLikes,
    totalComments,
    avgEngagement: Math.round(avgEngagement * 10) / 10,
    topPosts: topPosts.map((p: PostWithCount) => ({
      id: p.id,
      content: p.content?.slice(0, CONTENT_PREVIEW_LENGTH) ?? null,
      createdAt: p.createdAt,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
    })),
    posts: posts.map((p: PostWithCount) => ({
      id: p.id,
      content: p.content?.slice(0, CONTENT_PREVIEW_LENGTH) ?? null,
      createdAt: p.createdAt,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
    })),
  }
}

export async function fetchLikeAnalytics(userId: string, days = DEFAULT_ANALYTICS_DAYS) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const likes = await prisma.like.findMany({
    where: {
      post: { userId },
      createdAt: { gte: startDate },
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: ANALYTICS_MAX_SCAN_ROWS,
  })
  warnIfScanCapped('fetchLikeAnalytics', userId, likes.length)

  const hourlyData = Array(24).fill(0)
  const weekdayData = Array(7).fill(0)
  const dailyData: Record<string, number> = {}

  likes.forEach((like: typeof likes[number]) => {
    const date = new Date(like.createdAt)
    const hour = date.getHours()
    const day = date.getDay()
    if (hourlyData[hour] !== undefined) hourlyData[hour]++
    if (weekdayData[day] !== undefined) weekdayData[day]++
    const dateKey = isoDateKey(date)
    dailyData[dateKey] = (dailyData[dateKey] ?? 0) + 1
  })

  const dailyArray = Object.entries(dailyData)
    .map(([date, count]: [string, number]) => ({ date, count }))
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

  return {
    totalLikes: likes.length,
    hourlyData,
    weekdayData,
    dailyData: dailyArray,
    peakHour: hourlyData.indexOf(Math.max(...hourlyData)),
    peakWeekday: weekdayData.indexOf(Math.max(...weekdayData)),
  }
}

export async function fetchQuoteAnalytics(userId: string) {
  const [quotes, repostCount] = await Promise.all([
    prisma.post.findMany({
      where: { quotePost: { userId } },
      include: {
        user: { select: USER_MINIMAL_SELECT },
        quotePost: { select: { id: true, content: true } },
        _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: ANALYTICS_POSTS_LIMIT,
    }),
    prisma.post.count({
      where: { repostPost: { userId } },
    }),
  ])

  return {
    totalQuotes: quotes.length,
    totalReposts: repostCount,
    quotes: quotes.map((q: typeof quotes[number]) => ({
      id: q.id,
      content: q.content?.slice(0, QUOTE_CONTENT_PREVIEW_LENGTH) ?? null,
      user: q.user,
      originalPostId: q.quotePost?.id ?? null,
      originalContent: q.quotePost?.content?.slice(0, CONTENT_PREVIEW_LENGTH) ?? null,
      likeCount: q._count.likes,
      commentCount: q._count.comments,
      createdAt: q.createdAt,
    })),
  }
}

export async function fetchKeywordAnalytics(userId: string, days = DEFAULT_ANALYTICS_DAYS) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const posts = await prisma.post.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
      content: { not: null },
    },
    select: { content: true },
    orderBy: { createdAt: 'desc' },
    take: ANALYTICS_MAX_SCAN_ROWS,
  })
  warnIfScanCapped('fetchKeywordAnalytics', userId, posts.length)

  const wordCount: Record<string, number> = {}
  const stopWords = new Set([
    'の', 'は', 'が', 'を', 'に', 'で', 'と', 'も', 'や', 'か',
    'です', 'ます', 'した', 'して', 'する', 'ある', 'いる',
    'この', 'その', 'あの', 'こと', 'もの', 'ため',
    'から', 'まで', 'より', 'など', 'ない', 'なる',
    'いう', 'れる', 'られ', 'せる', 'させ', 'よう',
    'という', 'これ', 'それ', 'あれ', 'どれ',
  ])

  posts.forEach((post: typeof posts[number]) => {
    if (!post.content) return
    const words = post.content
      .replace(/https?:\/\/[^\s]+/g, '')
      .replace(/[、。！？「」『』【】（）\s\n]/g, ' ')
      .split(' ')
      .filter((w: string) => w.length >= MIN_KEYWORD_LENGTH && !stopWords.has(w))
    words.forEach((word: string) => {
      wordCount[word] = (wordCount[word] || 0) + 1
    })
  })

  const keywords = Object.entries(wordCount)
    .sort((a: [string, number], b: [string, number]) => b[1] - a[1])
    .slice(0, TOP_KEYWORDS_LIMIT)
    .map(([word, count]: [string, number]) => ({ word, count }))

  return {
    keywords,
    totalWords: Object.values(wordCount).reduce((a: number, b: number) => a + b, 0),
    uniqueWords: Object.keys(wordCount).length,
  }
}

export async function fetchEngagementTrend(userId: string, days = DEFAULT_ANALYTICS_DAYS) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const posts = await prisma.post.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
    },
    include: {
      _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
    },
    orderBy: { createdAt: 'asc' },
    take: ANALYTICS_MAX_SCAN_ROWS,
  })
  warnIfScanCapped('fetchEngagementTrend', userId, posts.length)

  const dailyStats: Record<string, { posts: number; likes: number; comments: number }> = {}

  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    dailyStats[isoDateKey(date)] = { posts: 0, likes: 0, comments: 0 }
  }

  posts.forEach((post: typeof posts[number]) => {
    const dateKey = isoDateKey(post.createdAt)
    const stat = dailyStats[dateKey]
    if (stat) {
      stat.posts++
      stat.likes += post._count.likes
      stat.comments += post._count.comments
    }
  })

  type DailyStatsEntry = { posts: number; likes: number; comments: number }
  const trend = Object.entries(dailyStats)
    .map(([date, stats]: [string, DailyStatsEntry]) => ({
      date,
      ...stats,
      engagement: stats.likes + stats.comments,
    }))
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date))

  return { trend }
}

export async function fetchGenrePerformance(userId: string, days = DEFAULT_ANALYTICS_DAYS) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const postGenres = await prisma.postGenre.findMany({
    where: {
      post: {
        userId,
        createdAt: { gte: startDate },
      },
    },
    include: {
      genre: { select: { id: true, name: true } },
      post: {
        include: {
          _count: { select: { likes: true, comments: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: { post: { createdAt: 'desc' } },
    take: ANALYTICS_MAX_SCAN_ROWS,
  })
  warnIfScanCapped('fetchGenrePerformance', userId, postGenres.length)

  const genreMap: Record<string, {
    name: string
    postCount: number
    totalLikes: number
    totalComments: number
  }> = {}

  for (const pg of postGenres) {
    const genreId = pg.genre.id
    if (!genreMap[genreId]) {
      genreMap[genreId] = { name: pg.genre.name, postCount: 0, totalLikes: 0, totalComments: 0 }
    }
    genreMap[genreId].postCount++
    genreMap[genreId].totalLikes += pg.post._count.likes
    genreMap[genreId].totalComments += pg.post._count.comments
  }

  const genres = Object.values(genreMap)
    .map(g => ({
      name: g.name,
      postCount: g.postCount,
      avgLikes: g.postCount > 0 ? Math.round((g.totalLikes / g.postCount) * 10) / 10 : 0,
      avgComments: g.postCount > 0 ? Math.round((g.totalComments / g.postCount) * 10) / 10 : 0,
      avgEngagement: g.postCount > 0
        ? Math.round(((g.totalLikes + g.totalComments) / g.postCount) * 10) / 10
        : 0,
    }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement)
    .slice(0, GENRE_PERFORMANCE_LIMIT)

  return { genres }
}

export async function fetchFollowerGrowth(userId: string, days = DEFAULT_ANALYTICS_DAYS) {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const currentFollowers = await prisma.follow.count({
    where: { followingId: userId },
  })

  const follows = await prisma.follow.findMany({
    where: {
      followingId: userId,
      createdAt: { gte: startDate },
    },
    select: { createdAt: true },
    // 件数が読めないクエリのためスキャン上限でガード。上限到達時は集計が標本値になる
    // (currentFollowers は count() で正確、日次内訳のみ最新側を優先して標本化)。
    orderBy: { createdAt: 'desc' },
    take: ANALYTICS_MAX_SCAN_ROWS,
  })
  warnIfScanCapped('fetchFollowerGrowth', userId, follows.length)

  const dailyNewFollowers: Record<string, number> = {}
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    dailyNewFollowers[isoDateKey(date)] = 0
  }

  for (const f of follows) {
    const dateKey = isoDateKey(f.createdAt)
    if (dailyNewFollowers[dateKey] !== undefined) {
      dailyNewFollowers[dateKey]++
    }
  }

  const sortedDates = Object.keys(dailyNewFollowers).sort()
  const totalNewInPeriod = follows.length
  let runningTotal = currentFollowers - totalNewInPeriod

  const growth = sortedDates.map(date => {
    const newFollowers = dailyNewFollowers[date] ?? 0
    runningTotal += newFollowers
    return {
      date,
      newFollowers,
      totalFollowers: runningTotal,
    }
  })

  return { currentFollowers, totalNewInPeriod, growth }
}

export async function fetchPeriodComparison(userId: string, days = DEFAULT_ANALYTICS_DAYS) {
  const now = new Date()
  const currentStart = new Date(now)
  currentStart.setDate(currentStart.getDate() - days)
  const previousStart = new Date(currentStart)
  previousStart.setDate(previousStart.getDate() - days)

  const [currentPosts, previousPosts, currentLikes, previousLikes, currentComments, previousComments, currentFollows, previousFollows] = await Promise.all([
    prisma.post.count({ where: { userId, createdAt: { gte: currentStart } } }),
    prisma.post.count({ where: { userId, createdAt: { gte: previousStart, lt: currentStart } } }),
    prisma.like.count({ where: { post: { userId }, createdAt: { gte: currentStart } } }),
    prisma.like.count({ where: { post: { userId }, createdAt: { gte: previousStart, lt: currentStart } } }),
    prisma.comment.count({ where: { post: { userId }, deletedAt: null, createdAt: { gte: currentStart } } }),
    prisma.comment.count({ where: { post: { userId }, deletedAt: null, createdAt: { gte: previousStart, lt: currentStart } } }),
    prisma.follow.count({ where: { followingId: userId, createdAt: { gte: currentStart } } }),
    prisma.follow.count({ where: { followingId: userId, createdAt: { gte: previousStart, lt: currentStart } } }),
  ])

  function calcChange(current: number, previous: number): number | null {
    if (previous === 0) return current > 0 ? 100 : null
    return Math.round(((current - previous) / previous) * 100)
  }

  return {
    posts: { current: currentPosts, previous: previousPosts, change: calcChange(currentPosts, previousPosts) },
    likes: { current: currentLikes, previous: previousLikes, change: calcChange(currentLikes, previousLikes) },
    comments: { current: currentComments, previous: previousComments, change: calcChange(currentComments, previousComments) },
    followers: { current: currentFollows, previous: previousFollows, change: calcChange(currentFollows, previousFollows) },
  }
}

export async function fetchDetailedAnalytics(userId: string, days = DEFAULT_ANALYTICS_DAYS) {
  const startDate = getStartOfNDaysAgo(days)
  const endDate = getEndOfDay()

  const analyticsData = await prisma.userAnalytics.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  })

  type TotalsType = { profileViews: number; postViews: number; likesReceived: number; newFollowers: number }
  const totals = analyticsData.reduce(
    (acc: TotalsType, data: typeof analyticsData[number]) => ({
      profileViews: acc.profileViews + data.profileViews,
      postViews: acc.postViews + data.postViews,
      likesReceived: acc.likesReceived + data.likesReceived,
      newFollowers: acc.newFollowers + data.newFollowers,
    }),
    { profileViews: 0, postViews: 0, likesReceived: 0, newFollowers: 0 }
  )

  const dailyData = analyticsData.map((data: typeof analyticsData[number]) => ({
    date: data.date.toISOString().split('T')[0],
    profileViews: data.profileViews,
    postViews: data.postViews,
    likesReceived: data.likesReceived,
    newFollowers: data.newFollowers,
  }))

  return {
    totals,
    dailyData,
    period: {
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      days,
    },
  }
}

export async function fetchBasicStats(userId: string) {
  const [postsCount, followersCount, followingCount, likesCount] = await Promise.all([
    prisma.post.count({ where: { userId, isHidden: false } }),
    prisma.follow.count({ where: { followingId: userId } }),
    prisma.follow.count({ where: { followerId: userId } }),
    prisma.like.count({ where: { post: { userId } } }),
  ])

  return {
    postsCount,
    followersCount,
    followingCount,
    totalLikesReceived: likesCount,
  }
}
