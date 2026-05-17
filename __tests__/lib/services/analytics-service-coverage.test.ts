// @vitest-environment node

import { vi } from 'vitest'

const mockPrisma = {
  postGenre: { findMany: vi.fn() },
  follow: { count: vi.fn(), findMany: vi.fn() },
  post: { count: vi.fn() },
  like: { count: vi.fn() },
  comment: { count: vi.fn() },
  userAnalytics: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

describe('Analytics Service - Coverage Boost (lines 257-388)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // fetchGenrePerformance
  // ============================================================
  describe('fetchGenrePerformance', () => {
    it('ジャンル別パフォーマンスを計算する', async () => {
      mockPrisma.postGenre.findMany.mockResolvedValueOnce([
        {
          genre: { id: 'genre-1', name: '松柏類' },
          post: { _count: { likes: 10, comments: 5 } },
        },
        {
          genre: { id: 'genre-1', name: '松柏類' },
          post: { _count: { likes: 20, comments: 3 } },
        },
        {
          genre: { id: 'genre-2', name: '雑木類' },
          post: { _count: { likes: 5, comments: 1 } },
        },
      ])

      const { fetchGenrePerformance } = await import('@/lib/services/analytics-service')
      const result = await fetchGenrePerformance('user-1', 30)

      expect(result.genres).toHaveLength(2)
      // 松柏類: 2 posts, avg likes = 15, avg comments = 4
      const shohaku = result.genres.find(g => g.name === '松柏類')
      expect(shohaku).toBeDefined()
      expect(shohaku!.postCount).toBe(2)
      expect(shohaku!.avgLikes).toBe(15)
      expect(shohaku!.avgComments).toBe(4)
      expect(shohaku!.avgEngagement).toBe(19)

      // 雑木類: 1 post, avg likes = 5, avg comments = 1
      const zoki = result.genres.find(g => g.name === '雑木類')
      expect(zoki).toBeDefined()
      expect(zoki!.postCount).toBe(1)
      expect(zoki!.avgLikes).toBe(5)
      expect(zoki!.avgComments).toBe(1)
      expect(zoki!.avgEngagement).toBe(6)
    })

    it('ジャンルが無い場合は空配列を返す', async () => {
      mockPrisma.postGenre.findMany.mockResolvedValueOnce([])

      const { fetchGenrePerformance } = await import('@/lib/services/analytics-service')
      const result = await fetchGenrePerformance('user-1')

      expect(result.genres).toEqual([])
    })

    it('エンゲージメント降順でソートされる', async () => {
      mockPrisma.postGenre.findMany.mockResolvedValueOnce([
        {
          genre: { id: 'g1', name: 'Low' },
          post: { _count: { likes: 1, comments: 0 } },
        },
        {
          genre: { id: 'g2', name: 'High' },
          post: { _count: { likes: 100, comments: 50 } },
        },
      ])

      const { fetchGenrePerformance } = await import('@/lib/services/analytics-service')
      const result = await fetchGenrePerformance('user-1')

      expect(result.genres[0].name).toBe('High')
      expect(result.genres[1].name).toBe('Low')
    })
  })

  // ============================================================
  // fetchFollowerGrowth
  // ============================================================
  describe('fetchFollowerGrowth', () => {
    it('フォロワー推移データを返す', async () => {
      mockPrisma.follow.count.mockResolvedValueOnce(10) // currentFollowers

      mockPrisma.follow.findMany.mockResolvedValueOnce([])

      const { fetchFollowerGrowth } = await import('@/lib/services/analytics-service')
      const result = await fetchFollowerGrowth('user-1', 3)

      expect(result.currentFollowers).toBe(10)
      expect(result.totalNewInPeriod).toBe(0)
      expect(result.growth).toHaveLength(3)
      // With 0 new followers, running total should be currentFollowers throughout
      result.growth.forEach(entry => {
        expect(entry.totalFollowers).toBe(10)
        expect(entry.newFollowers).toBe(0)
      })
      // Each entry has date, newFollowers, totalFollowers
      expect(result.growth[0]).toHaveProperty('date')
      expect(result.growth[0]).toHaveProperty('newFollowers')
      expect(result.growth[0]).toHaveProperty('totalFollowers')
    })

    it('新規フォロワーがある場合の推移を正しく計算する', async () => {
      mockPrisma.follow.count.mockResolvedValueOnce(5) // currentFollowers

      // Create a follow that matches one of the buckets
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7)
      // Create a follow on the start date itself
      const followDate = new Date(startDate)
      followDate.setDate(followDate.getDate() + 1) // day 2 of the period

      mockPrisma.follow.findMany.mockResolvedValueOnce([
        { createdAt: followDate },
      ])

      const { fetchFollowerGrowth } = await import('@/lib/services/analytics-service')
      const result = await fetchFollowerGrowth('user-1', 7)

      expect(result.currentFollowers).toBe(5)
      expect(result.totalNewInPeriod).toBe(1)
      expect(result.growth).toHaveLength(7)
    })

    it('フォロワーゼロの場合', async () => {
      mockPrisma.follow.count.mockResolvedValueOnce(0)
      mockPrisma.follow.findMany.mockResolvedValueOnce([])

      const { fetchFollowerGrowth } = await import('@/lib/services/analytics-service')
      const result = await fetchFollowerGrowth('user-1', 7)

      expect(result.currentFollowers).toBe(0)
      expect(result.totalNewInPeriod).toBe(0)
      expect(result.growth).toHaveLength(7)
      result.growth.forEach(entry => {
        expect(entry.newFollowers).toBe(0)
        expect(entry.totalFollowers).toBe(0)
      })
    })
  })

  // ============================================================
  // fetchPeriodComparison
  // ============================================================
  describe('fetchPeriodComparison', () => {
    it('前期比較データを返す', async () => {
      // current: posts=10, previous: posts=5 → 100% increase
      mockPrisma.post.count
        .mockResolvedValueOnce(10)  // currentPosts
        .mockResolvedValueOnce(5)   // previousPosts
      mockPrisma.like.count
        .mockResolvedValueOnce(20)  // currentLikes
        .mockResolvedValueOnce(10)  // previousLikes
      mockPrisma.comment.count
        .mockResolvedValueOnce(8)   // currentComments
        .mockResolvedValueOnce(4)   // previousComments
      mockPrisma.follow.count
        .mockResolvedValueOnce(15)  // currentFollows
        .mockResolvedValueOnce(0)   // previousFollows

      const { fetchPeriodComparison } = await import('@/lib/services/analytics-service')
      const result = await fetchPeriodComparison('user-1', 7)

      expect(result.posts.current).toBe(10)
      expect(result.posts.previous).toBe(5)
      expect(result.posts.change).toBe(100) // (10-5)/5 * 100

      expect(result.likes.current).toBe(20)
      expect(result.likes.previous).toBe(10)
      expect(result.likes.change).toBe(100)

      expect(result.comments.current).toBe(8)
      expect(result.comments.previous).toBe(4)
      expect(result.comments.change).toBe(100)

      expect(result.followers.current).toBe(15)
      expect(result.followers.previous).toBe(0)
      expect(result.followers.change).toBe(100) // previous=0, current>0 → 100
    })

    it('前期がゼロで当期もゼロの場合は change が null', async () => {
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.like.count.mockResolvedValue(0)
      mockPrisma.comment.count.mockResolvedValue(0)
      mockPrisma.follow.count.mockResolvedValue(0)

      const { fetchPeriodComparison } = await import('@/lib/services/analytics-service')
      const result = await fetchPeriodComparison('user-1', 7)

      expect(result.posts.change).toBeNull()
      expect(result.likes.change).toBeNull()
      expect(result.comments.change).toBeNull()
      expect(result.followers.change).toBeNull()
    })

    it('減少時はマイナスの変化率を返す', async () => {
      mockPrisma.post.count
        .mockResolvedValueOnce(3)   // currentPosts
        .mockResolvedValueOnce(10)  // previousPosts
      mockPrisma.like.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(20)
      mockPrisma.comment.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(8)
      mockPrisma.follow.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(5)

      const { fetchPeriodComparison } = await import('@/lib/services/analytics-service')
      const result = await fetchPeriodComparison('user-1', 7)

      expect(result.posts.change).toBe(-70) // (3-10)/10 * 100
      expect(result.likes.change).toBe(-75)
      expect(result.comments.change).toBe(-75)
      expect(result.followers.change).toBe(-80)
    })
  })
})
