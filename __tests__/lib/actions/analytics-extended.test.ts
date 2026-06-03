// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/analytics')

import { createMockPrismaClient } from '../../utils/test-utils'

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
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

// ロガーモック
vi.mock('@/lib/logger', () => ({

  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))


/**
 * `ActionResult<T>` を旧フラット形状に展開する互換ヘルパー（analytics 移行用）。
 * 成功時は `data` を展開、失敗時は `{ error }` を返す。
 */
function unwrap<T>(result: import('@/types/action-result').ActionResult<T>): (T extends object ? T : Record<string, never>) & { error?: string } {
  if (result.success) {
    return ((result.data ?? {}) as unknown) as (T extends object ? T : Record<string, never>) & { error?: string }
  }
  return { error: result.error } as (T extends object ? T : Record<string, never>) & { error?: string }
}

describe('Analytics Actions Extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockIsPremiumUser.mockResolvedValue(true)
  })

  // ============================================================
  // getPostAnalytics
  // ============================================================

  describe('getPostAnalytics', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPostAnalytics())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('プレミアムでない場合はエラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValue(false)

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPostAnalytics())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })

    it('投稿分析データを返す', async () => {
      const mockPosts = [
        { id: 'p1', content: 'テスト1', createdAt: new Date(), _count: { likes: 10, comments: 5 } },
        { id: 'p2', content: 'テスト2', createdAt: new Date(), _count: { likes: 20, comments: 10 } },
      ]
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)

      const { getPostAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPostAnalytics(30))

      expect(result.totalPosts).toBe(2)
      expect(result.totalLikes).toBe(30)
      expect(result.totalComments).toBe(15)
    })

  })

  // ============================================================
  // getLikeAnalytics
  // ============================================================

  describe('getLikeAnalytics', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getLikeAnalytics())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('プレミアムでない場合はエラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValue(false)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getLikeAnalytics())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })

    it('いいね分析データを返す', async () => {
      const mockLikes = [
        { createdAt: new Date() },
        { createdAt: new Date() },
      ]
      mockPrisma.like.findMany.mockResolvedValueOnce(mockLikes)

      const { getLikeAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getLikeAnalytics(30))

      expect(result.totalLikes).toBe(2)
      expect(result.hourlyData).toHaveLength(24)
      expect(result.weekdayData).toHaveLength(7)
    })
  })

  // ============================================================
  // getQuoteAnalytics
  // ============================================================

  describe('getQuoteAnalytics', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getQuoteAnalytics())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('引用分析データを返す', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([
        {
          id: 'q1',
          content: '引用',
          user: { id: 'u2', nickname: 'User2', avatarUrl: null },
          quotePost: { id: 'p1', content: '元投稿' },
          _count: { likes: 5, comments: 2 },
          createdAt: new Date(),
        },
      ])
      mockPrisma.post.count.mockResolvedValueOnce(3)

      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getQuoteAnalytics())

      expect(result.totalQuotes).toBe(1)
      expect(result.totalReposts).toBe(3)
    })
  })

  // ============================================================
  // getKeywordAnalytics
  // ============================================================

  describe('getKeywordAnalytics', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getKeywordAnalytics())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('キーワード分析データを返す', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([
        { content: '盆栽の手入れ' },
        { content: '盆栽展示会' },
      ])

      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')
      const result = unwrap(await getKeywordAnalytics(30))

      expect(result.keywords).toBeDefined()
      expect(result.totalWords).toBeGreaterThanOrEqual(0)
    })
  })

  // ============================================================
  // getEngagementTrend
  // ============================================================

  describe('getEngagementTrend', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      const result = unwrap(await getEngagementTrend())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('トレンドデータを返す', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([
        { createdAt: new Date(), _count: { likes: 5, comments: 2 } },
      ])

      const { getEngagementTrend } = await import('@/lib/actions/analytics')
      const result = unwrap(await getEngagementTrend(30))

      expect(result.trend).toBeDefined()
      expect(result.trend!.length).toBe(30)
    })
  })

  // ============================================================
  // getGenrePerformance
  // ============================================================

  describe('getGenrePerformance', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getGenrePerformance } = await import('@/lib/actions/analytics')
      const result = unwrap(await getGenrePerformance())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('プレミアムでない場合はエラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValue(false)

      const { getGenrePerformance } = await import('@/lib/actions/analytics')
      const result = unwrap(await getGenrePerformance())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })

    it('ジャンル別パフォーマンスデータを取得できる', async () => {
      mockPrisma.postGenre.findMany.mockResolvedValueOnce([
        {
          genre: { id: 'g1', name: '松柏類' },
          post: { _count: { likes: 10, comments: 5 } },
        },
      ])

      const { getGenrePerformance } = await import('@/lib/actions/analytics')
      const result = unwrap(await getGenrePerformance(30))

      expect(result).toBeDefined()
    })
  })

  // ============================================================
  // getFollowerGrowth
  // ============================================================

  describe('getFollowerGrowth', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getFollowerGrowth } = await import('@/lib/actions/analytics')
      const result = unwrap(await getFollowerGrowth())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('プレミアムでない場合はエラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValue(false)

      const { getFollowerGrowth } = await import('@/lib/actions/analytics')
      const result = unwrap(await getFollowerGrowth())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })

    it('フォロワー推移データを取得できる', async () => {
      mockPrisma.follow.count.mockResolvedValueOnce(100)
      mockPrisma.follow.findMany.mockResolvedValueOnce([
        { createdAt: new Date() },
      ])

      const { getFollowerGrowth } = await import('@/lib/actions/analytics')
      const result = unwrap(await getFollowerGrowth(30))

      expect(result).toBeDefined()
    })
  })

  // ============================================================
  // getPeriodComparison
  // ============================================================

  describe('getPeriodComparison', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPeriodComparison } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPeriodComparison())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('プレミアムでない場合はエラーを返す', async () => {
      mockIsPremiumUser.mockResolvedValue(false)

      const { getPeriodComparison } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPeriodComparison())

      expect(result).toMatchObject({ error: 'プレミアム会員限定機能です' })
    })

    it('前期比較データを取得できる', async () => {
      // current period
      mockPrisma.post.count.mockResolvedValueOnce(10)
      mockPrisma.like.count.mockResolvedValueOnce(50)
      mockPrisma.comment.count.mockResolvedValueOnce(20)
      mockPrisma.follow.count.mockResolvedValueOnce(5)
      // previous period
      mockPrisma.post.count.mockResolvedValueOnce(8)
      mockPrisma.like.count.mockResolvedValueOnce(40)
      mockPrisma.comment.count.mockResolvedValueOnce(15)
      mockPrisma.follow.count.mockResolvedValueOnce(3)

      const { getPeriodComparison } = await import('@/lib/actions/analytics')
      const result = unwrap(await getPeriodComparison(30))

      expect(result).toBeDefined()
    })
  })

  // ============================================================
  // getBasicStats
  // ============================================================

  describe('getBasicStats', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getBasicStats } = await import('@/lib/actions/analytics')
      const result = unwrap(await getBasicStats())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('基本統計を返す', async () => {
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
  })
})
