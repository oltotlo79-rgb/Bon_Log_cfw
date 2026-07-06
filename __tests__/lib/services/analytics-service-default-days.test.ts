// @vitest-environment node
/**
 * lib/services/analytics-service の各関数が `days` 省略時に
 * DEFAULT_ANALYTICS_DAYS (30日) を正しく適用することを検証する。
 *
 * 既存テストは全て明示的に days を渡しており、デフォルト引数の分岐が
 * 未カバーだったため、省略呼び出しでの実際の挙動差（日数依存の集計結果・
 * クエリの日付範囲）を確認する。
 */
import { vi } from 'vitest'
import { DEFAULT_ANALYTICS_DAYS } from '@/lib/constants/limits'

const mockPrisma = {
  post: { findMany: vi.fn(), count: vi.fn() },
  like: { findMany: vi.fn(), count: vi.fn() },
  comment: { count: vi.fn() },
  follow: { count: vi.fn(), findMany: vi.fn() },
  userAnalytics: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

function daysAgo(date: Date, now: Date): number {
  return Math.round((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000))
}

describe('analytics-service: days省略時のデフォルト値 (DEFAULT_ANALYTICS_DAYS)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetchPostAnalytics: days省略時は DEFAULT_ANALYTICS_DAYS 日前からのクエリになる', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    const { fetchPostAnalytics } = await import('@/lib/services/analytics-service')

    const now = new Date()
    await fetchPostAnalytics('user-1')

    const callArgs = mockPrisma.post.findMany.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } }
    }
    expect(daysAgo(callArgs.where.createdAt.gte, now)).toBe(DEFAULT_ANALYTICS_DAYS)
  })

  it('fetchLikeAnalytics: days省略時は DEFAULT_ANALYTICS_DAYS 日前からのクエリになる', async () => {
    mockPrisma.like.findMany.mockResolvedValueOnce([])
    const { fetchLikeAnalytics } = await import('@/lib/services/analytics-service')

    const now = new Date()
    await fetchLikeAnalytics('user-1')

    const callArgs = mockPrisma.like.findMany.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } }
    }
    expect(daysAgo(callArgs.where.createdAt.gte, now)).toBe(DEFAULT_ANALYTICS_DAYS)
  })

  it('fetchKeywordAnalytics: days省略時は DEFAULT_ANALYTICS_DAYS 日前からのクエリになる', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    const { fetchKeywordAnalytics } = await import('@/lib/services/analytics-service')

    const now = new Date()
    await fetchKeywordAnalytics('user-1')

    const callArgs = mockPrisma.post.findMany.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } }
    }
    expect(daysAgo(callArgs.where.createdAt.gte, now)).toBe(DEFAULT_ANALYTICS_DAYS)
  })

  it('fetchEngagementTrend: days省略時は trend が DEFAULT_ANALYTICS_DAYS 日分になる', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    const { fetchEngagementTrend } = await import('@/lib/services/analytics-service')

    const result = await fetchEngagementTrend('user-1')

    expect(result.trend).toHaveLength(DEFAULT_ANALYTICS_DAYS)
  })

  it('fetchFollowerGrowth: days省略時は growth が DEFAULT_ANALYTICS_DAYS 日分になる', async () => {
    mockPrisma.follow.count.mockResolvedValueOnce(0)
    mockPrisma.follow.findMany.mockResolvedValueOnce([])
    const { fetchFollowerGrowth } = await import('@/lib/services/analytics-service')

    const result = await fetchFollowerGrowth('user-1')

    expect(result.growth).toHaveLength(DEFAULT_ANALYTICS_DAYS)
  })

  it('fetchPeriodComparison: days省略時は currentStart が DEFAULT_ANALYTICS_DAYS 日前になる', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.like.count.mockResolvedValue(0)
    mockPrisma.comment.count.mockResolvedValue(0)
    mockPrisma.follow.count.mockResolvedValue(0)
    const { fetchPeriodComparison } = await import('@/lib/services/analytics-service')

    const now = new Date()
    await fetchPeriodComparison('user-1')

    const callArgs = mockPrisma.post.count.mock.calls[0]?.[0] as {
      where: { createdAt: { gte: Date } }
    }
    expect(daysAgo(callArgs.where.createdAt.gte, now)).toBe(DEFAULT_ANALYTICS_DAYS)
  })

  it('fetchDetailedAnalytics: days省略時は period.days が DEFAULT_ANALYTICS_DAYS になる', async () => {
    mockPrisma.userAnalytics.findMany.mockResolvedValueOnce([])
    const { fetchDetailedAnalytics } = await import('@/lib/services/analytics-service')

    const result = await fetchDetailedAnalytics('user-1')

    expect(result.period.days).toBe(DEFAULT_ANALYTICS_DAYS)
  })
})
