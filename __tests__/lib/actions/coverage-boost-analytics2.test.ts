// @vitest-environment node
import { vi } from 'vitest'
vi.unmock('@/lib/actions/analytics')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

const mockLogger = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  log: vi.fn(),
}
vi.mock('@/lib/logger', () => ({

  __esModule: true,
  default: mockLogger,
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

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  mockIsPremiumUser.mockResolvedValue(true)
})

describe('analytics.ts - カバレッジ向上テスト', async () => {
  describe('getPostAnalytics', async () => {
    it('投稿数が0の場合、avgEngagementが0になる', async () => {
      const { getPostAnalytics } = await import('@/lib/actions/analytics')

      mockPrisma.post.findMany.mockResolvedValue([])

      const result = unwrap(await getPostAnalytics(30))

      expect(result).toEqual({
        totalPosts: 0,
        totalLikes: 0,
        totalComments: 0,
        avgEngagement: 0,
        topPosts: [],
        posts: [],
      })
    })

    it('contentがnullの場合、nullとして返される', async () => {
      const { getPostAnalytics } = await import('@/lib/actions/analytics')

      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'p1',
          content: null,
          createdAt: new Date('2024-01-01'),
          _count: { likes: 5, comments: 2 },
        },
      ] as never)

      const result = unwrap(await getPostAnalytics(30))

      expect(result).toMatchObject({
        totalPosts: 1,
        topPosts: [
          expect.objectContaining({
            id: 'p1',
            content: null,
          }),
        ],
        posts: [
          expect.objectContaining({
            id: 'p1',
            content: null,
          }),
        ],
      })
    })

    it('contentが100文字を超える場合、切り詰められる', async () => {
      const { getPostAnalytics } = await import('@/lib/actions/analytics')

      const longContent = 'あ'.repeat(150)
      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'p1',
          content: longContent,
          createdAt: new Date('2024-01-01'),
          _count: { likes: 5, comments: 2 },
        },
      ] as never)

      const result = unwrap(await getPostAnalytics(30))

      expect(result).toMatchObject({
        posts: [
          expect.objectContaining({
            content: longContent.slice(0, 100),
          }),
        ],
      })
    })
  })

  describe('getQuoteAnalytics', async () => {
    it('quotePost.idがnullの場合、nullとして返される', async () => {
      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')

      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'q1',
          content: 'quote content',
          createdAt: new Date('2024-01-01'),
          user: { id: 'u2', nickname: 'user2', avatarUrl: null },
          quotePost: null,
          _count: { likes: 3, comments: 1 },
        },
      ] as never)

      mockPrisma.post.count.mockResolvedValue(5)

      const result = unwrap(await getQuoteAnalytics())

      expect(result).toMatchObject({
        totalQuotes: 1,
        totalReposts: 5,
        quotes: [
          expect.objectContaining({
            id: 'q1',
            originalPostId: null,
            originalContent: null,
          }),
        ],
      })
    })

    it('quotePost.contentがnullの場合、nullとして返される', async () => {
      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')

      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'q1',
          content: 'quote',
          createdAt: new Date('2024-01-01'),
          user: { id: 'u2', nickname: 'user2', avatarUrl: null },
          quotePost: { id: 'orig1', content: null },
          _count: { likes: 3, comments: 1 },
        },
      ] as never)

      mockPrisma.post.count.mockResolvedValue(0)

      const result = unwrap(await getQuoteAnalytics())

      expect(result).toMatchObject({
        quotes: [
          expect.objectContaining({
            originalPostId: 'orig1',
            originalContent: null,
          }),
        ],
      })
    })

    it('contentが200文字を超える場合、切り詰められる', async () => {
      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')

      const longContent = 'あ'.repeat(250)
      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'q1',
          content: longContent,
          createdAt: new Date('2024-01-01'),
          user: { id: 'u2', nickname: 'user2', avatarUrl: null },
          quotePost: { id: 'orig1', content: 'original' },
          _count: { likes: 3, comments: 1 },
        },
      ] as never)

      mockPrisma.post.count.mockResolvedValue(0)

      const result = unwrap(await getQuoteAnalytics())

      expect(result).toMatchObject({
        quotes: [
          expect.objectContaining({
            content: longContent.slice(0, 200),
          }),
        ],
      })
    })

    it('quotePost contentが100文字超の場合切り詰められる', async () => {
      const { getQuoteAnalytics } = await import('@/lib/actions/analytics')

      const longOriginal = 'あ'.repeat(150)
      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'q1',
          content: 'short',
          createdAt: new Date('2024-01-01'),
          user: { id: 'u2', nickname: 'user2', avatarUrl: null },
          quotePost: { id: 'orig1', content: longOriginal },
          _count: { likes: 3, comments: 1 },
        },
      ] as never)

      mockPrisma.post.count.mockResolvedValue(0)

      const result = unwrap(await getQuoteAnalytics())

      expect(result).toMatchObject({
        quotes: [
          expect.objectContaining({
            originalContent: longOriginal.slice(0, 100),
          }),
        ],
      })
    })
  })

  describe('getKeywordAnalytics', async () => {
    it('post.contentがnullの場合、スキップされる', async () => {
      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')

      mockPrisma.post.findMany.mockResolvedValue([
        { content: null },
        { content: '盆栽 盆栽 盆栽' },
      ] as never)

      const result = unwrap(await getKeywordAnalytics(30))

      expect(result).toMatchObject({
        keywords: [{ word: '盆栽', count: 3 }],
        totalWords: 3,
        uniqueWords: 1,
      })
    })

    it('投稿が0件の場合、空の結果を返す', async () => {
      const { getKeywordAnalytics } = await import('@/lib/actions/analytics')

      mockPrisma.post.findMany.mockResolvedValue([])

      const result = unwrap(await getKeywordAnalytics(30))

      expect(result).toEqual({
        keywords: [],
        totalWords: 0,
        uniqueWords: 0,
      })
    })
  })

  describe('getEngagementTrend', async () => {
    it('dailyStats[dateKey]が存在しない日はスキップされる', async () => {
      const { getEngagementTrend } = await import('@/lib/actions/analytics')

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 100)

      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'p1',
          createdAt: futureDate,
          _count: { likes: 5, comments: 2 },
        },
      ] as never)

      const result = unwrap(await getEngagementTrend(30))

      expect(result).toMatchObject({
        trend: expect.arrayContaining([
          expect.objectContaining({
            posts: 0,
            likes: 0,
            comments: 0,
          }),
        ]),
      })
    })
  })

  describe('recordProfileView', async () => {
    it('エラー時もログを出力して actionError を返す（スローしない）', async () => {
      const { recordProfileView } = await import('@/lib/actions/analytics')

      const error = new Error('DB error')
      mockPrisma.userAnalytics.upsert.mockRejectedValue(error)

      const result = await recordProfileView('u1')
      expect(result).toMatchObject({ success: false })

      expect(mockLogger.error).toHaveBeenCalledWith('Record profile view error:', error)
    })
  })

  describe('recordPostView', async () => {
    it('エラー時もログを出力して actionError を返す（スローしない）', async () => {
      const { recordPostView } = await import('@/lib/actions/analytics')

      const error = new Error('DB error')
      mockPrisma.userAnalytics.upsert.mockRejectedValue(error)

      const result = await recordPostView('u1')
      expect(result).toMatchObject({ success: false })

      expect(mockLogger.error).toHaveBeenCalledWith('Record post view error:', error)
    })
  })

  describe('recordLikeReceived', async () => {
    it('エラー時もログを出力して actionError を返す（スローしない）', async () => {
      const { recordLikeReceived } = await import('@/lib/actions/analytics')

      const error = new Error('DB error')
      mockPrisma.userAnalytics.upsert.mockRejectedValue(error)

      const result = await recordLikeReceived('u1')
      expect(result).toMatchObject({ success: false })

      expect(mockLogger.error).toHaveBeenCalledWith('Record like received error:', error)
    })
  })

  describe('recordNewFollower', async () => {
    it('エラー時もログを出力して actionError を返す（スローしない）', async () => {
      const { recordNewFollower } = await import('@/lib/actions/analytics')

      const error = new Error('DB error')
      mockPrisma.userAnalytics.upsert.mockRejectedValue(error)

      const result = await recordNewFollower('u1')
      expect(result).toMatchObject({ success: false })

      expect(mockLogger.error).toHaveBeenCalledWith('Record new follower error:', error)
    })
  })

  describe('getDetailedAnalytics', async () => {
    it('エラー時にエラーメッセージを返す', async () => {
      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')

      const error = new Error('DB error')
      mockPrisma.userAnalytics.findMany.mockRejectedValue(error)

      const result = unwrap(await getDetailedAnalytics(30))

      expect(result).toMatchObject({ error: '分析データの取得に失敗しました' })
      expect(mockLogger.error).toHaveBeenCalledWith('Get detailed analytics error:', error)
    })

    it('正常時にデータを返す', async () => {
      const { getDetailedAnalytics } = await import('@/lib/actions/analytics')

      const date1 = new Date('2024-01-01')
      const date2 = new Date('2024-01-02')

      mockPrisma.userAnalytics.findMany.mockResolvedValue([
        {
          userId: 'u1',
          date: date1,
          profileViews: 10,
          postViews: 20,
          likesReceived: 5,
          newFollowers: 2,
        },
        {
          userId: 'u1',
          date: date2,
          profileViews: 15,
          postViews: 25,
          likesReceived: 8,
          newFollowers: 3,
        },
      ] as never)

      const result = unwrap(await getDetailedAnalytics(30))

      expect(result).toMatchObject({
        totals: {
          profileViews: 25,
          postViews: 45,
          likesReceived: 13,
          newFollowers: 5,
        },
        dailyData: [
          {
            date: '2024-01-01',
            profileViews: 10,
            postViews: 20,
            likesReceived: 5,
            newFollowers: 2,
          },
          {
            date: '2024-01-02',
            profileViews: 15,
            postViews: 25,
            likesReceived: 8,
            newFollowers: 3,
          },
        ],
        period: expect.objectContaining({
          days: 30,
        }),
      })
    })
  })

  describe('getLikeAnalytics', async () => {
    it('いいねが0件の場合、正しく処理される', async () => {
      const { getLikeAnalytics } = await import('@/lib/actions/analytics')

      mockPrisma.like.findMany.mockResolvedValue([])

      const result = unwrap(await getLikeAnalytics(30))

      expect(result).toMatchObject({
        totalLikes: 0,
        hourlyData: Array(24).fill(0),
        weekdayData: Array(7).fill(0),
        dailyData: [],
        peakHour: 0,
        peakWeekday: 0,
      })
    })
  })

  describe('getBasicStats', async () => {
    it('認証されていない場合、エラーを返す', async () => {
      const { getBasicStats } = await import('@/lib/actions/analytics')

      mockAuth.mockResolvedValueOnce(null)

      const result = unwrap(await getBasicStats())

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('正常にカウントを取得する', async () => {
      const { getBasicStats } = await import('@/lib/actions/analytics')

      mockPrisma.post.count.mockResolvedValue(10)
      mockPrisma.follow.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
      mockPrisma.like.count.mockResolvedValue(20)

      const result = unwrap(await getBasicStats())

      expect(result).toEqual({
        postsCount: 10,
        followersCount: 5,
        followingCount: 3,
        totalLikesReceived: 20,
      })
    })
  })
})
