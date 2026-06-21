// @vitest-environment node
/**
 * lib/services/analytics-read-service.ts のユニットテスト
 *
 * fetchAnalyticsSummary が analytics-service の 3 関数を Promise.all で集約し、
 * AnalyticsSummaryData 型の shape を返すことを検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFetchPostAnalytics = vi.fn()
const mockFetchFollowerGrowth = vi.fn()
const mockFetchEngagementTrend = vi.fn()

vi.mock('@/lib/services/analytics-service', () => ({
  fetchPostAnalytics: (...args: unknown[]) => mockFetchPostAnalytics(...args),
  fetchFollowerGrowth: (...args: unknown[]) => mockFetchFollowerGrowth(...args),
  fetchEngagementTrend: (...args: unknown[]) => mockFetchEngagementTrend(...args),
}))

// analytics-read-service は server-only を import するため node 環境が必要
vi.mock('server-only', () => ({}))

const MOCK_POST_DATA = {
  totalPosts: 5,
  totalLikes: 30,
  totalComments: 10,
  avgEngagement: 8.0,
  topPosts: [
    {
      id: 'post-1',
      content: '盆栽日記',
      createdAt: new Date('2026-06-01T10:00:00.000Z'),
      likeCount: 20,
      commentCount: 5,
    },
  ],
  posts: [],
}

const MOCK_FOLLOWER_DATA = {
  currentFollowers: 100,
  totalNewInPeriod: 10,
  growth: [
    { date: '2026-06-01', newFollowers: 3, totalFollowers: 91 },
    { date: '2026-06-02', newFollowers: 7, totalFollowers: 98 },
  ],
}

const MOCK_TREND_DATA = {
  trend: [
    { date: '2026-06-01', posts: 2, likes: 15, comments: 3, engagement: 18 },
    { date: '2026-06-02', posts: 3, likes: 15, comments: 7, engagement: 22 },
  ],
}

describe('fetchAnalyticsSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchPostAnalytics.mockResolvedValue(MOCK_POST_DATA)
    mockFetchFollowerGrowth.mockResolvedValue(MOCK_FOLLOWER_DATA)
    mockFetchEngagementTrend.mockResolvedValue(MOCK_TREND_DATA)
  })

  it('analytics-service の 3 関数を呼び出す', async () => {
    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    await fetchAnalyticsSummary('user-1', 30)

    expect(mockFetchPostAnalytics).toHaveBeenCalledOnce()
    expect(mockFetchPostAnalytics).toHaveBeenCalledWith('user-1', 30)
    expect(mockFetchFollowerGrowth).toHaveBeenCalledOnce()
    expect(mockFetchFollowerGrowth).toHaveBeenCalledWith('user-1', 30)
    expect(mockFetchEngagementTrend).toHaveBeenCalledOnce()
    expect(mockFetchEngagementTrend).toHaveBeenCalledWith('user-1', 30)
  })

  it('period フィールドに days / start / end が含まれる', async () => {
    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    expect(result.period.days).toBe(30)
    expect(typeof result.period.start).toBe('string')
    expect(typeof result.period.end).toBe('string')
    // ISO 日付文字列 (YYYY-MM-DD) の形式
    expect(result.period.start).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(result.period.end).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // start < end
    expect(new Date(result.period.start) < new Date(result.period.end)).toBe(true)
  })

  it('posts フィールドが total/totalLikes/totalComments/avgEngagement/topPosts を持つ', async () => {
    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    expect(result.posts.total).toBe(5)
    expect(result.posts.totalLikes).toBe(30)
    expect(result.posts.totalComments).toBe(10)
    expect(result.posts.avgEngagement).toBe(8.0)
    expect(Array.isArray(result.posts.topPosts)).toBe(true)
  })

  it('topPosts の各要素が id/content/createdAt/likeCount/commentCount を持つ', async () => {
    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    const topPost = result.posts.topPosts[0]
    expect(topPost).toBeDefined()
    if (!topPost) return
    expect(topPost.id).toBe('post-1')
    expect(topPost.content).toBe('盆栽日記')
    expect(typeof topPost.createdAt).toBe('string')
    // createdAt が ISO 8601 文字列にシリアライズされている
    expect(topPost.createdAt).toContain('T')
    expect(typeof topPost.likeCount).toBe('number')
    expect(typeof topPost.commentCount).toBe('number')
  })

  it('followers フィールドが current/newInPeriod/growth を持つ', async () => {
    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    expect(result.followers.current).toBe(100)
    expect(result.followers.newInPeriod).toBe(10)
    expect(Array.isArray(result.followers.growth)).toBe(true)
    expect(result.followers.growth).toHaveLength(2)
  })

  it('followers.growth の各要素が date/newFollowers/totalFollowers を持つ', async () => {
    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    const entry = result.followers.growth[0]
    expect(entry).toBeDefined()
    if (!entry) return
    expect(typeof entry.date).toBe('string')
    expect(typeof entry.newFollowers).toBe('number')
    expect(typeof entry.totalFollowers).toBe('number')
  })

  it('engagementTrend フィールドが date/posts/likes/comments/engagement を持つ', async () => {
    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    expect(Array.isArray(result.engagementTrend)).toBe(true)
    expect(result.engagementTrend).toHaveLength(2)

    const entry = result.engagementTrend[0]
    expect(entry).toBeDefined()
    if (!entry) return
    expect(typeof entry.date).toBe('string')
    expect(typeof entry.posts).toBe('number')
    expect(typeof entry.likes).toBe('number')
    expect(typeof entry.comments).toBe('number')
    expect(typeof entry.engagement).toBe('number')
  })

  it('days=7 で呼ぶと period.days が 7 になる', async () => {
    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-2', 7)

    expect(result.period.days).toBe(7)
    expect(mockFetchPostAnalytics).toHaveBeenCalledWith('user-2', 7)
  })

  it('days=90 で呼ぶと period.days が 90 になる', async () => {
    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-3', 90)

    expect(result.period.days).toBe(90)
    expect(mockFetchFollowerGrowth).toHaveBeenCalledWith('user-3', 90)
  })

  it('topPosts が空の場合でも posts.topPosts が [] になる', async () => {
    mockFetchPostAnalytics.mockResolvedValueOnce({
      ...MOCK_POST_DATA,
      topPosts: [],
    })

    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    expect(result.posts.topPosts).toEqual([])
  })

  it('topPosts の content が null でも null のまま返す', async () => {
    mockFetchPostAnalytics.mockResolvedValueOnce({
      ...MOCK_POST_DATA,
      topPosts: [
        {
          id: 'post-null',
          content: null,
          createdAt: new Date('2026-06-10T00:00:00.000Z'),
          likeCount: 0,
          commentCount: 0,
        },
      ],
    })

    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    expect(result.posts.topPosts[0]!.content).toBeNull()
  })

  it('engagementTrend が空の場合でも [] を返す', async () => {
    mockFetchEngagementTrend.mockResolvedValueOnce({ trend: [] })

    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    expect(result.engagementTrend).toEqual([])
  })

  it('followers.growth が空の場合でも [] を返す', async () => {
    mockFetchFollowerGrowth.mockResolvedValueOnce({
      currentFollowers: 50,
      totalNewInPeriod: 0,
      growth: [],
    })

    const { fetchAnalyticsSummary } = await import('@/lib/services/analytics-read-service')
    const result = await fetchAnalyticsSummary('user-1', 30)

    expect(result.followers.growth).toEqual([])
    expect(result.followers.current).toBe(50)
    expect(result.followers.newInPeriod).toBe(0)
  })
})
