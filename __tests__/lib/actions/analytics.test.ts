// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'
import type { ActionResult } from '@/types/action-result'

/**
 * `ActionResult<T>` を旧フラット形状に展開する互換ヘルパー。
 * 成功時は `data` を展開、失敗時は `{ error }` を返すので、
 * 既存の `expect(result.totalPosts)` / `expect(result).toMatchObject({ error })`
 * のいずれのスタイルも書き換えずに動作する。
 */
function unwrap<T>(result: ActionResult<T>): (T extends object ? T : Record<string, never>) & { error?: string } {
  if (result.success) {
    return ((result.data ?? {}) as unknown) as (T extends object ? T : Record<string, never>) & { error?: string }
  }
  return { error: result.error } as (T extends object ? T : Record<string, never>) & { error?: string }
}

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// プレミアム判定モック
const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: () => mockIsPremiumUser(),
}))

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Analytics Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockIsPremiumUser.mockResolvedValue(true)
  })

  // ============================================================
  // getPostAnalytics
  // ============================================================

  describe('getPostAnalytics', async () => {
    it('投稿パフォーマンス分析を取得できる', async () => {
      const mockPosts = [
        { id: 'post-1', content: 'テスト投稿1', createdAt: new Date(), _count: { likes: 10, comments: 5 } },
        { id: 'post-2', content: 'テスト投稿2', createdAt: new Date(), _count: { likes: 20, comments: 10 } },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPostAnalytics(30))

      expect(result.totalPosts).toBe(2)
      expect(result.totalLikes).toBe(30)
      expect(result.totalComments).toBe(15)
      expect(result.avgEngagement).toBe(22.5)
      expect(result.topPosts).toHaveLength(2)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPostAnalytics())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPostAnalytics())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })

    it('投稿がない場合、0を返す', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([])

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPostAnalytics())

      expect(result.totalPosts).toBe(0)
      expect(result.avgEngagement).toBe(0)
    })
  })

  // ============================================================
  // getLikeAnalytics
  // ============================================================

  describe('getLikeAnalytics', async () => {
    it('いいね分析を取得できる', async () => {
      const now = new Date()
      const mockLikes = [
        { createdAt: new Date(now.setHours(10, 0, 0, 0)) },
        { createdAt: new Date(now.setHours(10, 0, 0, 0)) },
        { createdAt: new Date(now.setHours(14, 0, 0, 0)) },
      ]
      mockPrisma.like.findMany.mockResolvedValueOnce(mockLikes)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getLikeAnalytics(30))

      expect(result.totalLikes).toBe(3)
      expect(result.hourlyData).toHaveLength(24)
      expect(result.weekdayData).toHaveLength(7)
      expect(result.peakHour).toBeDefined()
      expect(result.peakWeekday).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getLikeAnalytics())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getLikeAnalytics())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })
  })

  // ============================================================
  // getQuoteAnalytics
  // ============================================================

  describe('getQuoteAnalytics', async () => {
    it('引用投稿分析を取得できる', async () => {
      const mockQuotes = [
        {
          id: 'quote-1',
          content: '引用コメント',
          user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
          quotePost: { id: mockPost.id, content: '元投稿' },
          _count: { likes: 5, comments: 2 },
          createdAt: new Date(),
        },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockQuotes)
      mockPrisma.post.count.mockResolvedValueOnce(10)

      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getQuoteAnalytics())

      expect(result.totalQuotes).toBe(1)
      expect(result.totalReposts).toBe(10)
      expect(result.quotes).toHaveLength(1)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getQuoteAnalytics())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getQuoteAnalytics())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })
  })

  // ============================================================
  // getKeywordAnalytics
  // ============================================================

  describe('getKeywordAnalytics', async () => {
    it('キーワード分析を取得できる', async () => {
      const mockPosts = [
        { content: '今日の盆栽は元気です' },
        { content: '盆栽の手入れをしました' },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getKeywordAnalytics(30))

      expect(result.keywords).toBeDefined()
      expect(result.totalWords).toBeGreaterThanOrEqual(0)
      expect(result.uniqueWords).toBeGreaterThanOrEqual(0)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getKeywordAnalytics())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getKeywordAnalytics())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })
  })

  // ============================================================
  // getEngagementTrend
  // ============================================================

  describe('getEngagementTrend', async () => {
    it('エンゲージメント推移を取得できる', async () => {
      const mockPosts = [
        { createdAt: new Date(), _count: { likes: 10, comments: 5 } },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      const result = unwrap(await getEngagementTrend(30))

      expect(result.trend).toBeDefined()
      expect(result.trend!.length).toBe(30)
      result.trend!.forEach((day: { date: string; posts: number; likes: number; comments: number; engagement: number }) => {
        expect(day).toHaveProperty('date')
        expect(day).toHaveProperty('posts')
        expect(day).toHaveProperty('likes')
        expect(day).toHaveProperty('comments')
        expect(day).toHaveProperty('engagement')
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      const result = unwrap(await getEngagementTrend())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      const result = unwrap(await getEngagementTrend())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })
  })

  // ============================================================
  // getAnalyticsDashboard
  // ============================================================

  describe('getAnalyticsDashboard', async () => {
    it('ダッシュボード全データを取得できる', async () => {
      // 各分析関数用のモック
      mockPrisma.post.findMany
        .mockResolvedValueOnce([]) // getPostAnalytics
        .mockResolvedValueOnce([]) // getQuoteAnalytics
        .mockResolvedValueOnce([]) // getKeywordAnalytics
        .mockResolvedValueOnce([]) // getEngagementTrend
      mockPrisma.like.findMany.mockResolvedValueOnce([])
      mockPrisma.post.count.mockResolvedValueOnce(0)

      const { getAnalyticsDashboard } = await import('@/lib/actions/analytics')
      const result = unwrap(await getAnalyticsDashboard(30))

      expect(result.postAnalytics).toBeDefined()
      expect(result.likeAnalytics).toBeDefined()
      expect(result.quoteAnalytics).toBeDefined()
      expect(result.keywordAnalytics).toBeDefined()
      expect(result.engagementTrend).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getAnalyticsDashboard } = await import('@/lib/actions/analytics')
      const result = unwrap(await getAnalyticsDashboard())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getAnalyticsDashboard } = await import('@/lib/actions/analytics')
      const result = unwrap(await getAnalyticsDashboard())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })
  })

  // ============================================================
  // getDetailedAnalytics
  // ============================================================

  describe('getDetailedAnalytics', async () => {
    it('詳細アナリティクスを取得できる', async () => {
      const mockAnalyticsData = [
        {
          date: new Date(),
          profileViews: 10,
          postViews: 100,
          likesReceived: 50,
          newFollowers: 5,
        },
      ]
      mockPrisma.userAnalytics.findMany.mockResolvedValueOnce(mockAnalyticsData)

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getDetailedAnalytics(30))

      expect(result.totals).toEqual({
        profileViews: 10,
        postViews: 100,
        likesReceived: 50,
        newFollowers: 5,
      })
      expect(result.dailyData).toHaveLength(1)
      expect(result.period).toBeDefined()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getDetailedAnalytics())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getDetailedAnalytics())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })

    it('エラー時はエラーメッセージを返す', async () => {
      mockPrisma.userAnalytics.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getDetailedAnalytics())

      expect(result).toMatchObject({ error: '分析データの取得に失敗しました' })
    })
  })

  // ============================================================
  // getBasicStats
  // ============================================================

  describe('getBasicStats', async () => {
    it('基本統計を取得できる', async () => {
      mockPrisma.post.count.mockResolvedValueOnce(50)
      mockPrisma.follow.count
        .mockResolvedValueOnce(100) // followers
        .mockResolvedValueOnce(80)  // following
      mockPrisma.like.count.mockResolvedValueOnce(500)

      const { getBasicStats } = await import('@/lib/actions/analytics')
      const result = unwrap(await getBasicStats())

      expect(result.postsCount).toBe(50)
      expect(result.followersCount).toBe(100)
      expect(result.followingCount).toBe(80)
      expect(result.totalLikesReceived).toBe(500)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getBasicStats } = await import('@/lib/actions/analytics')
      const result = unwrap(await getBasicStats())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

  })

  // ============================================================
  // getLikeAnalytics - 詳細データ
  // ============================================================

  describe('getLikeAnalytics - 詳細データ', async () => {
    it('複数日のいいねデータでdailyDataが正しくソートされる', async () => {
      const mockLikes = [
        { createdAt: new Date('2024-01-03T10:00:00') },
        { createdAt: new Date('2024-01-01T14:00:00') },
        { createdAt: new Date('2024-01-02T08:00:00') },
        { createdAt: new Date('2024-01-01T16:00:00') },
      ]
      mockPrisma.like.findMany.mockResolvedValueOnce(mockLikes)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getLikeAnalytics(30))

      expect(result.totalLikes).toBe(4)
      expect(result.dailyData).toBeDefined()
      if (result.dailyData) {
        for (let i = 1; i < result.dailyData.length; i++) {
          expect(result.dailyData[i]!.date >= result.dailyData[i - 1]!.date).toBe(true)
        }
      }
    })

    it('いいねがない場合', async () => {
      mockPrisma.like.findMany.mockResolvedValueOnce([])

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getLikeAnalytics(30))

      expect(result.totalLikes).toBe(0)
      expect(result.hourlyData).toHaveLength(24)
      expect(result.weekdayData).toHaveLength(7)
    })

    it('エラー時は例外がスローされる', async () => {
      mockPrisma.like.findMany.mockRejectedValueOnce(new Error('DB error'))

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      await expect(getLikeAnalytics(30)).rejects.toThrow('DB error')
    })
  })

  // ============================================================
  // getDetailedAnalytics - 複数日データ
  // ============================================================

  describe('getDetailedAnalytics - 複数日データ', async () => {
    it('複数日のデータを正しく集計する', async () => {
      const mockAnalyticsData = [
        {
          date: new Date('2024-01-01'),
          profileViews: 10,
          postViews: 100,
          likesReceived: 50,
          newFollowers: 5,
        },
        {
          date: new Date('2024-01-02'),
          profileViews: 20,
          postViews: 200,
          likesReceived: 60,
          newFollowers: 10,
        },
      ]
      mockPrisma.userAnalytics.findMany.mockResolvedValueOnce(mockAnalyticsData)

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getDetailedAnalytics(30))

      expect(result.totals).toEqual({
        profileViews: 30,
        postViews: 300,
        likesReceived: 110,
        newFollowers: 15,
      })
      expect(result.dailyData).toHaveLength(2)
    })

    it('データがない場合は全て0', async () => {
      mockPrisma.userAnalytics.findMany.mockResolvedValueOnce([])

      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getDetailedAnalytics(30))

      expect(result.totals).toEqual({
        profileViews: 0,
        postViews: 0,
        likesReceived: 0,
        newFollowers: 0,
      })
    })
  })

  // ============================================================
  // getEngagementTrend - 追加テスト
  // ============================================================

  describe('getEngagementTrend - 追加テスト', async () => {
    it('投稿がない場合はトレンドがすべて0', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([])

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      const result = unwrap(await getEngagementTrend(7))

      expect(result.trend).toBeDefined()
      expect(result.trend!.length).toBe(7)
      result.trend!.forEach((day: { posts: number; likes: number; comments: number }) => {
        expect(day.posts).toBe(0)
        expect(day.likes).toBe(0)
        expect(day.comments).toBe(0)
      })
    })

    it('エラー時は例外がスローされる', async () => {
      mockPrisma.post.findMany.mockRejectedValueOnce(new Error('DB error'))

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      await expect(getEngagementTrend(30)).rejects.toThrow('DB error')
    })
  })

  // ============================================================
  // getPostAnalytics - 追加テスト
  // ============================================================

  describe('getPostAnalytics - 追加テスト', async () => {
    it('エラー時は例外がスローされる', async () => {
      mockPrisma.post.findMany.mockRejectedValueOnce(new Error('DB error'))

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      await expect(getPostAnalytics(30)).rejects.toThrow('DB error')
    })
  })

  // ============================================================
  // getQuoteAnalytics - 追加テスト
  // ============================================================

  describe('getQuoteAnalytics - 追加テスト', async () => {
    it('エラー時は例外がスローされる', async () => {
      mockPrisma.post.findMany.mockRejectedValueOnce(new Error('DB error'))

      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')
      await expect(getQuoteAnalytics()).rejects.toThrow('DB error')
    })
  })

  // ============================================================
  // getKeywordAnalytics - 追加テスト
  // ============================================================

  describe('getKeywordAnalytics - 追加テスト', async () => {
    it('エラー時は例外がスローされる', async () => {
      mockPrisma.post.findMany.mockRejectedValueOnce(new Error('DB error'))

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      await expect(getKeywordAnalytics(30)).rejects.toThrow('DB error')
    })

    it('コンテンツがnullの投稿は無視する', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([
        { content: null },
        { content: '盆栽の手入れ' },
      ])

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getKeywordAnalytics(30))

      expect(result.keywords).toBeDefined()
    })
  })

  // ============================================================
  // getGenrePerformance
  // ============================================================

  describe('getGenrePerformance', async () => {
    it('ジャンル別パフォーマンスを取得できる', async () => {
      mockPrisma.postGenre.findMany.mockResolvedValueOnce([
        {
          genre: { id: 'g1', name: '松柏類' },
          post: { _count: { likes: 10, comments: 4 } },
        },
        {
          genre: { id: 'g1', name: '松柏類' },
          post: { _count: { likes: 6, comments: 2 } },
        },
        {
          genre: { id: 'g2', name: '雑木類' },
          post: { _count: { likes: 4, comments: 1 } },
        },
      ])

      const { getGenrePerformance } = await import('@/lib/actions/analytics')
      const result = unwrap(await getGenrePerformance(30))

      expect(result.genres).toBeDefined()
      expect(result.genres!.length).toBe(2)
      const matsu = result.genres!.find(g => g.name === '松柏類')!
      expect(matsu.postCount).toBe(2)
      // (10+6)/2 = 8, (4+2)/2 = 3, ((10+6)+(4+2))/2 = 11
      expect(matsu.avgLikes).toBe(8)
      expect(matsu.avgComments).toBe(3)
      expect(matsu.avgEngagement).toBe(11)
    })

    it('avgEngagement の降順でソートされる', async () => {
      mockPrisma.postGenre.findMany.mockResolvedValueOnce([
        { genre: { id: 'low', name: 'Low' }, post: { _count: { likes: 1, comments: 0 } } },
        { genre: { id: 'high', name: 'High' }, post: { _count: { likes: 100, comments: 50 } } },
        { genre: { id: 'mid', name: 'Mid' }, post: { _count: { likes: 10, comments: 5 } } },
      ])

      const { getGenrePerformance } = await import('@/lib/actions/analytics')
      const result = unwrap(await getGenrePerformance(30))

      expect(result.genres!.map(g => g.name)).toEqual(['High', 'Mid', 'Low'])
    })

    it('GENRE_PERFORMANCE_LIMIT (10) を超える件数は切り捨てられる', async () => {
      const many = Array.from({ length: 15 }, (_, i) => ({
        genre: { id: `g${i}`, name: `Genre ${i}` },
        post: { _count: { likes: 15 - i, comments: 0 } },
      }))
      mockPrisma.postGenre.findMany.mockResolvedValueOnce(many)

      const { getGenrePerformance } = await import('@/lib/actions/analytics')
      const result = unwrap(await getGenrePerformance(30))

      expect(result.genres!.length).toBe(10)
    })

    it('投稿がない場合は空配列を返す', async () => {
      mockPrisma.postGenre.findMany.mockResolvedValueOnce([])

      const { getGenrePerformance } = await import('@/lib/actions/analytics')
      const result = unwrap(await getGenrePerformance(30))

      expect(result.genres).toEqual([])
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getGenrePerformance } = await import('@/lib/actions/analytics')
      const result = unwrap(await getGenrePerformance())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getGenrePerformance } = await import('@/lib/actions/analytics')
      const result = unwrap(await getGenrePerformance())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })
  })

  // ============================================================
  // getFollowerGrowth
  // ============================================================

  describe('getFollowerGrowth', async () => {
    it('フォロワー成長を取得できる', async () => {
      // 期間内の新規フォロワーが range に確実に入るよう、3〜5日前の日付を生成
      const days = 30
      const dayAgo = (n: number) => {
        const d = new Date()
        d.setDate(d.getDate() - n)
        return d
      }
      mockPrisma.follow.count.mockResolvedValueOnce(100)
      mockPrisma.follow.findMany.mockResolvedValueOnce([
        { createdAt: dayAgo(5) },
        { createdAt: dayAgo(5) },
        { createdAt: dayAgo(3) },
      ])

      const { getFollowerGrowth } = await import('@/lib/actions/analytics')
      const result = unwrap(await getFollowerGrowth(days))

      expect(result.currentFollowers).toBe(100)
      expect(result.totalNewInPeriod).toBe(3)
      expect(result.growth).toBeDefined()
      // 期間日数ぶんの daily エントリ
      expect(result.growth!.length).toBe(days)
      // 最後の日の totalFollowers が currentFollowers と一致する
      // (runningTotal = 100-3 = 97 から始まり、+2 +1 で 100 に到達)
      const last = result.growth![result.growth!.length - 1]!
      expect(last.totalFollowers).toBe(100)
    })

    it('runningTotal は新規フォロワーの累積を正しく反映する', async () => {
      const days = 7
      const dayAgo = (n: number) => {
        const d = new Date()
        d.setDate(d.getDate() - n)
        return d
      }
      mockPrisma.follow.count.mockResolvedValueOnce(50)
      // 6日前に2人、4日前に1人
      mockPrisma.follow.findMany.mockResolvedValueOnce([
        { createdAt: dayAgo(6) },
        { createdAt: dayAgo(6) },
        { createdAt: dayAgo(4) },
      ])

      const { getFollowerGrowth } = await import('@/lib/actions/analytics')
      const result = unwrap(await getFollowerGrowth(days))

      // runningTotal は単調非減少
      const totals = result.growth!.map(g => g.totalFollowers)
      for (let i = 1; i < totals.length; i++) {
        expect(totals[i]!).toBeGreaterThanOrEqual(totals[i - 1]!)
      }
      // 新規合計と一致
      const newSum = result.growth!.reduce((s, g) => s + g.newFollowers, 0)
      expect(newSum).toBe(3)
    })

    it('フォロワーがいない場合は currentFollowers が 0', async () => {
      mockPrisma.follow.count.mockResolvedValueOnce(0)
      mockPrisma.follow.findMany.mockResolvedValueOnce([])

      const { getFollowerGrowth } = await import('@/lib/actions/analytics')
      const result = unwrap(await getFollowerGrowth(30))

      expect(result.currentFollowers).toBe(0)
      expect(result.totalNewInPeriod).toBe(0)
      expect(result.growth!.every(g => g.newFollowers === 0 && g.totalFollowers === 0)).toBe(true)
    })

    it('期間内に新規フォロワーがいない既存フォロワー保持', async () => {
      mockPrisma.follow.count.mockResolvedValueOnce(42)
      mockPrisma.follow.findMany.mockResolvedValueOnce([])

      const { getFollowerGrowth } = await import('@/lib/actions/analytics')
      const result = unwrap(await getFollowerGrowth(30))

      expect(result.currentFollowers).toBe(42)
      expect(result.totalNewInPeriod).toBe(0)
      // 全日 totalFollowers = 42 で一定
      expect(result.growth!.every(g => g.totalFollowers === 42 && g.newFollowers === 0)).toBe(true)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getFollowerGrowth } = await import('@/lib/actions/analytics')
      const result = unwrap(await getFollowerGrowth())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getFollowerGrowth } = await import('@/lib/actions/analytics')
      const result = unwrap(await getFollowerGrowth())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })
  })

  // ============================================================
  // getPeriodComparison
  // ============================================================

  describe('getPeriodComparison', async () => {
    // current: posts/likes/comments/follows, previous: posts/likes/comments/follows の順で
    // Promise.all されるため、count モックは 8 回 mockResolvedValueOnce を積む。
    // 順序: currentPosts, previousPosts, currentLikes, previousLikes,
    //       currentComments, previousComments, currentFollows, previousFollows
    function stubCounts(values: {
      posts: [number, number]
      likes: [number, number]
      comments: [number, number]
      follows: [number, number]
    }) {
      mockPrisma.post.count
        .mockResolvedValueOnce(values.posts[0])
        .mockResolvedValueOnce(values.posts[1])
      mockPrisma.like.count
        .mockResolvedValueOnce(values.likes[0])
        .mockResolvedValueOnce(values.likes[1])
      mockPrisma.comment.count
        .mockResolvedValueOnce(values.comments[0])
        .mockResolvedValueOnce(values.comments[1])
      mockPrisma.follow.count
        .mockResolvedValueOnce(values.follows[0])
        .mockResolvedValueOnce(values.follows[1])
    }

    it('期間比較データを取得できる (増加・減少・無変化を含む)', async () => {
      stubCounts({
        posts: [20, 10],     // +100%
        likes: [50, 100],    // -50%
        comments: [10, 10],  // 0%
        follows: [8, 4],     // +100%
      })

      const { getPeriodComparison } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPeriodComparison(30))

      expect(result.posts).toEqual({ current: 20, previous: 10, change: 100 })
      expect(result.likes).toEqual({ current: 50, previous: 100, change: -50 })
      expect(result.comments).toEqual({ current: 10, previous: 10, change: 0 })
      expect(result.followers).toEqual({ current: 8, previous: 4, change: 100 })
    })

    it('前期 0 で現期 > 0 の場合は change = 100', async () => {
      stubCounts({
        posts: [5, 0],
        likes: [0, 0],
        comments: [0, 0],
        follows: [0, 0],
      })

      const { getPeriodComparison } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPeriodComparison(30))

      expect(result.posts.change).toBe(100)
    })

    it('前期も現期も 0 の場合は change = null', async () => {
      stubCounts({
        posts: [0, 0],
        likes: [0, 0],
        comments: [0, 0],
        follows: [0, 0],
      })

      const { getPeriodComparison } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPeriodComparison(30))

      expect(result.posts.change).toBeNull()
      expect(result.likes.change).toBeNull()
      expect(result.comments.change).toBeNull()
      expect(result.followers.change).toBeNull()
    })

    it('小数点以下を四捨五入する', async () => {
      stubCounts({
        // (current - previous) / previous = 1/3 = 0.333..., *100 = 33.33..., round = 33
        posts: [4, 3],
        likes: [0, 0],
        comments: [0, 0],
        follows: [0, 0],
      })

      const { getPeriodComparison } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPeriodComparison(30))

      expect(result.posts.change).toBe(33)
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getPeriodComparison } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPeriodComparison())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('無料会員の場合、エラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValueOnce(false)

      const { getPeriodComparison } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPeriodComparison())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })
  })
})
