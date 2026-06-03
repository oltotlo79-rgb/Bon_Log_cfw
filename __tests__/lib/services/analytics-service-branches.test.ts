// @vitest-environment node
/**
 * analytics-service.ts のブランチ補完テスト
 *
 * 既存の analytics-service-coverage.test.ts では fetchGenrePerformance /
 * fetchFollowerGrowth / fetchPeriodComparison のみテストしている。
 * このファイルでは下記関数の未カバーブランチを補完する:
 *
 * - fetchPostAnalytics: 空配列, content=null, 全分岐の topPosts sort
 * - fetchLikeAnalytics: 0件, 曜日・時間・dailyData の集計
 * - fetchQuoteAnalytics: quotePost=null, content=null, repostCount分岐
 * - fetchKeywordAnalytics: content=null, stopWords 除外, URL除去, 短い単語フィルタ
 * - fetchEngagementTrend: 範囲外日付の post (stat=undefined ガード)
 * - fetchDetailedAnalytics: 集計と空ケース
 * - fetchBasicStats: 並列 count
 * - fetchPeriodComparison: previous=0 かつ current=0 → null 経路
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = {
  post: { findMany: vi.fn(), count: vi.fn() },
  like: { findMany: vi.fn(), count: vi.fn() },
  comment: { count: vi.fn() },
  follow: { count: vi.fn(), findMany: vi.fn() },
  postGenre: { findMany: vi.fn() },
  userAnalytics: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('fetchPostAnalytics', () => {
  it('投稿が0件のときは avgEngagement=0 になる', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])

    const { fetchPostAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchPostAnalytics('user-1', 7)

    expect(result).toEqual({
      totalPosts: 0,
      totalLikes: 0,
      totalComments: 0,
      avgEngagement: 0,
      topPosts: [],
      posts: [],
    })
  })

  it('content が null の投稿でも content=null のまま返す', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([
      {
        id: 'p1',
        content: null,
        createdAt: new Date(),
        _count: { likes: 1, comments: 0 },
      },
    ])

    const { fetchPostAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchPostAnalytics('user-1', 7)

    expect(result.posts[0].content).toBeNull()
    expect(result.topPosts[0].content).toBeNull()
  })

  it('エンゲージメント降順で topPosts をソートする', async () => {
    const now = new Date()
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { id: 'low', content: 'a', createdAt: now, _count: { likes: 1, comments: 0 } },
      { id: 'high', content: 'b', createdAt: now, _count: { likes: 50, comments: 10 } },
      { id: 'mid', content: 'c', createdAt: now, _count: { likes: 10, comments: 5 } },
    ])

    const { fetchPostAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchPostAnalytics('user-1', 7)

    expect(result.topPosts.map(p => p.id)).toEqual(['high', 'mid', 'low'])
    expect(result.totalLikes).toBe(61)
    expect(result.totalComments).toBe(15)
    expect(result.avgEngagement).toBe(Math.round((76 / 3) * 10) / 10)
  })

  it('内容が長い場合は CONTENT_PREVIEW_LENGTH で切り詰める', async () => {
    const long = 'あ'.repeat(500)
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { id: 'p1', content: long, createdAt: new Date(), _count: { likes: 0, comments: 0 } },
    ])

    const { fetchPostAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchPostAnalytics('user-1', 7)

    expect(result.posts[0].content?.length).toBeLessThan(long.length)
  })
})

describe('fetchLikeAnalytics', () => {
  it('いいねが0件のときは hourly/weekday が全て 0', async () => {
    mockPrisma.like.findMany.mockResolvedValueOnce([])

    const { fetchLikeAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchLikeAnalytics('user-1', 7)

    expect(result.totalLikes).toBe(0)
    expect(result.hourlyData).toHaveLength(24)
    expect(result.weekdayData).toHaveLength(7)
    expect(result.hourlyData.every(v => v === 0)).toBe(true)
    expect(result.weekdayData.every(v => v === 0)).toBe(true)
    expect(result.dailyData).toEqual([])
  })

  it('複数のいいねを時間・曜日・日付別に集計する', async () => {
    const d1 = new Date('2026-01-05T10:30:00Z')
    const d2 = new Date('2026-01-05T10:31:00Z')
    const d3 = new Date('2026-01-06T15:00:00Z')
    mockPrisma.like.findMany.mockResolvedValueOnce([
      { createdAt: d1 },
      { createdAt: d2 },
      { createdAt: d3 },
    ])

    const { fetchLikeAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchLikeAnalytics('user-1', 30)

    expect(result.totalLikes).toBe(3)
    expect(result.dailyData).toHaveLength(2)
    // peakHour / peakWeekday は最大値のインデックスを返す
    expect(typeof result.peakHour).toBe('number')
    expect(typeof result.peakWeekday).toBe('number')
  })
})

describe('スキャン安全上限 (warnIfScanCapped)', () => {
  it('いいねがスキャン上限に達したら logger.warn で可視化し標本集計する', async () => {
    const { ANALYTICS_MAX_SCAN_ROWS } = await import('@/lib/constants/limits')
    const cappedLikes = Array.from({ length: ANALYTICS_MAX_SCAN_ROWS }, () => ({
      createdAt: new Date('2026-01-05T10:00:00Z'),
    }))
    mockPrisma.like.findMany.mockResolvedValueOnce(cappedLikes)

    const loggerModule = await import('@/lib/logger')
    const { fetchLikeAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchLikeAnalytics('user-1', 30)

    expect(result.totalLikes).toBe(ANALYTICS_MAX_SCAN_ROWS)
    expect(loggerModule.default.warn).toHaveBeenCalledWith(
      expect.stringContaining('fetchLikeAnalytics'),
      expect.objectContaining({ userId: 'user-1', cap: ANALYTICS_MAX_SCAN_ROWS })
    )
  })

  it('上限未満なら warn を出さない', async () => {
    mockPrisma.like.findMany.mockResolvedValueOnce([{ createdAt: new Date() }])

    const loggerModule = await import('@/lib/logger')
    const { fetchLikeAnalytics } = await import('@/lib/services/analytics-service')
    await fetchLikeAnalytics('user-1', 30)

    expect(loggerModule.default.warn).not.toHaveBeenCalled()
  })
})

describe('fetchQuoteAnalytics', () => {
  it('quotePost=null や content=null も安全に扱える', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([
      {
        id: 'q1',
        content: null,
        createdAt: new Date(),
        user: { id: 'u1', nickname: 'u', avatarUrl: null },
        quotePost: null,
        _count: { likes: 0, comments: 0 },
      },
      {
        id: 'q2',
        content: 'hello',
        createdAt: new Date(),
        user: { id: 'u1', nickname: 'u', avatarUrl: null },
        quotePost: { id: 'orig', content: null },
        _count: { likes: 2, comments: 1 },
      },
    ])
    mockPrisma.post.count.mockResolvedValueOnce(7)

    const { fetchQuoteAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchQuoteAnalytics('user-1')

    expect(result.totalQuotes).toBe(2)
    expect(result.totalReposts).toBe(7)
    expect(result.quotes[0].content).toBeNull()
    expect(result.quotes[0].originalPostId).toBeNull()
    expect(result.quotes[0].originalContent).toBeNull()
    expect(result.quotes[1].originalPostId).toBe('orig')
    expect(result.quotes[1].originalContent).toBeNull()
  })

  it('引用も再投稿もゼロのケース', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    mockPrisma.post.count.mockResolvedValueOnce(0)

    const { fetchQuoteAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchQuoteAnalytics('user-1')

    expect(result).toEqual({ totalQuotes: 0, totalReposts: 0, quotes: [] })
  })
})

describe('fetchKeywordAnalytics', () => {
  it('content=null の投稿はスキップする', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { content: null },
      { content: '盆栽 黒松 を 育てる 楽しみ' },
    ])

    const { fetchKeywordAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchKeywordAnalytics('user-1', 30)

    expect(result.uniqueWords).toBeGreaterThan(0)
  })

  it('URL を除去してから集計する', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { content: '盆栽 https://example.com/path 黒松' },
    ])

    const { fetchKeywordAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchKeywordAnalytics('user-1', 30)

    // URL は除去されるためキーワードリストに含まれない
    expect(result.keywords.find(k => k.word.includes('http'))).toBeUndefined()
  })

  it('ストップワードは除外される', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { content: 'これ は テスト の 投稿 です' },
    ])

    const { fetchKeywordAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchKeywordAnalytics('user-1', 30)

    expect(result.keywords.find(k => k.word === 'は')).toBeUndefined()
    expect(result.keywords.find(k => k.word === 'の')).toBeUndefined()
    expect(result.keywords.find(k => k.word === 'です')).toBeUndefined()
  })

  it('MIN_KEYWORD_LENGTH 未満の短い単語は除外される', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { content: 'a bb ccc 盆 盆栽 黒松' },
    ])

    const { fetchKeywordAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchKeywordAnalytics('user-1', 30)

    // 1文字 'a', '盆' は除外される (MIN_KEYWORD_LENGTH=2)
    expect(result.keywords.find(k => k.word === 'a')).toBeUndefined()
    expect(result.keywords.find(k => k.word === '盆')).toBeUndefined()
  })

  it('全投稿が空の場合は空キーワードリストを返す', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])

    const { fetchKeywordAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchKeywordAnalytics('user-1', 30)

    expect(result).toEqual({ keywords: [], totalWords: 0, uniqueWords: 0 })
  })
})

describe('fetchEngagementTrend', () => {
  it('期間外の投稿は dailyStats に加算されない (stat=undefined ガード)', async () => {
    const longAgo = new Date()
    longAgo.setDate(longAgo.getDate() - 100) // 100日前
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { id: 'p1', createdAt: longAgo, _count: { likes: 99, comments: 99 } },
    ])

    const { fetchEngagementTrend } = await import('@/lib/services/analytics-service')
    const result = await fetchEngagementTrend('user-1', 7)

    expect(result.trend).toHaveLength(7)
    // 期間外の投稿のいいね・コメントは合計されない
    const totalLikes = result.trend.reduce((sum, t) => sum + t.likes, 0)
    expect(totalLikes).toBe(0)
  })

  it('期間内の投稿は対応日に加算される', async () => {
    // バケット範囲: today-7 〜 today-1。3日前を使えば確実に範囲内
    const threeDaysAgo = new Date()
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
    mockPrisma.post.findMany.mockResolvedValueOnce([
      { id: 'p1', createdAt: threeDaysAgo, _count: { likes: 5, comments: 3 } },
    ])

    const { fetchEngagementTrend } = await import('@/lib/services/analytics-service')
    const result = await fetchEngagementTrend('user-1', 7)

    expect(result.trend).toHaveLength(7)
    const total = result.trend.reduce((sum, t) => sum + t.engagement, 0)
    expect(total).toBe(8)
  })
})

describe('fetchDetailedAnalytics', () => {
  it('analyticsData が空でも totals がゼロで返る', async () => {
    mockPrisma.userAnalytics.findMany.mockResolvedValueOnce([])

    const { fetchDetailedAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchDetailedAnalytics('user-1', 7)

    expect(result.totals).toEqual({
      profileViews: 0,
      postViews: 0,
      likesReceived: 0,
      newFollowers: 0,
    })
    expect(result.dailyData).toEqual([])
    expect(result.period.days).toBe(7)
  })

  it('各日のデータを合計する', async () => {
    mockPrisma.userAnalytics.findMany.mockResolvedValueOnce([
      {
        date: new Date('2026-01-01'),
        profileViews: 10,
        postViews: 20,
        likesReceived: 5,
        newFollowers: 2,
      },
      {
        date: new Date('2026-01-02'),
        profileViews: 5,
        postViews: 10,
        likesReceived: 3,
        newFollowers: 1,
      },
    ])

    const { fetchDetailedAnalytics } = await import('@/lib/services/analytics-service')
    const result = await fetchDetailedAnalytics('user-1', 7)

    expect(result.totals).toEqual({
      profileViews: 15,
      postViews: 30,
      likesReceived: 8,
      newFollowers: 3,
    })
    expect(result.dailyData).toHaveLength(2)
  })
})

describe('fetchBasicStats', () => {
  it('4つの count を並列で取得する', async () => {
    mockPrisma.post.count.mockResolvedValueOnce(10)
    mockPrisma.follow.count
      .mockResolvedValueOnce(5) // followers
      .mockResolvedValueOnce(3) // following
    mockPrisma.like.count.mockResolvedValueOnce(20)

    const { fetchBasicStats } = await import('@/lib/services/analytics-service')
    const result = await fetchBasicStats('user-1')

    expect(result).toEqual({
      postsCount: 10,
      followersCount: 5,
      followingCount: 3,
      totalLikesReceived: 20,
    })
  })

  it('全てゼロのときもオブジェクトを返す', async () => {
    mockPrisma.post.count.mockResolvedValueOnce(0)
    mockPrisma.follow.count.mockResolvedValue(0)
    mockPrisma.like.count.mockResolvedValueOnce(0)

    const { fetchBasicStats } = await import('@/lib/services/analytics-service')
    const result = await fetchBasicStats('user-1')

    expect(result).toEqual({
      postsCount: 0,
      followersCount: 0,
      followingCount: 0,
      totalLikesReceived: 0,
    })
  })
})

describe('スキャン安全上限: fetchGenrePerformance / fetchFollowerGrowth', () => {
  it('fetchGenrePerformance は take 上限を付けてクエリする', async () => {
    const { ANALYTICS_MAX_SCAN_ROWS } = await import('@/lib/constants/limits')
    mockPrisma.postGenre.findMany.mockResolvedValueOnce([])

    const { fetchGenrePerformance } = await import('@/lib/services/analytics-service')
    await fetchGenrePerformance('user-1', 30)

    expect(mockPrisma.postGenre.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: ANALYTICS_MAX_SCAN_ROWS })
    )
  })

  it('fetchGenrePerformance は上限到達時に warn を出す', async () => {
    const { ANALYTICS_MAX_SCAN_ROWS } = await import('@/lib/constants/limits')
    const capped = Array.from({ length: ANALYTICS_MAX_SCAN_ROWS }, () => ({
      genre: { id: 'g1', name: '松柏類' },
      post: { _count: { likes: 1, comments: 0 } },
    }))
    mockPrisma.postGenre.findMany.mockResolvedValueOnce(capped)
    const loggerModule = await import('@/lib/logger')

    const { fetchGenrePerformance } = await import('@/lib/services/analytics-service')
    await fetchGenrePerformance('user-1', 30)

    expect(loggerModule.default.warn).toHaveBeenCalledWith(
      expect.stringContaining('fetchGenrePerformance'),
      expect.objectContaining({ userId: 'user-1', cap: ANALYTICS_MAX_SCAN_ROWS })
    )
  })

  it('fetchFollowerGrowth は take 上限を付けてクエリする', async () => {
    const { ANALYTICS_MAX_SCAN_ROWS } = await import('@/lib/constants/limits')
    mockPrisma.follow.count.mockResolvedValueOnce(0)
    mockPrisma.follow.findMany.mockResolvedValueOnce([])

    const { fetchFollowerGrowth } = await import('@/lib/services/analytics-service')
    await fetchFollowerGrowth('user-1', 30)

    expect(mockPrisma.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: ANALYTICS_MAX_SCAN_ROWS })
    )
  })
})

describe('fetchPeriodComparison: previous=0 / current=0 ブランチ', () => {
  it('previous=0 でも current=0 なら change は null', async () => {
    mockPrisma.post.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    mockPrisma.like.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(0)
    mockPrisma.comment.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    mockPrisma.follow.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(10)

    const { fetchPeriodComparison } = await import('@/lib/services/analytics-service')
    const result = await fetchPeriodComparison('user-1', 7)

    expect(result.posts.change).toBeNull()
    expect(result.likes.change).toBe(100) // previous=0, current>0 → 100
    expect(result.comments.change).toBeNull()
    // previous=10, current=0 → (0-10)/10*100 = -100
    expect(result.followers.change).toBe(-100)
  })
})
