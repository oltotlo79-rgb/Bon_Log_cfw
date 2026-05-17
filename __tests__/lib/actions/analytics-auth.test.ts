// @vitest-environment node

/**
 * analytics.ts 認証統合テスト
 *
 * ensurePremiumAuth ヘルパーの統合テスト
 * 認証とプレミアムチェックの組み合わせ
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: () => mockIsPremiumUser(),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

const importModule = () => import('@/lib/actions/analytics')

describe('Analytics Auth Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockIsPremiumUser.mockResolvedValue(true)
  })

  describe('ensurePremiumAuth - 統合認証チェック', () => {
    it('認証もプレミアムも成功の場合、データを返す', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { id: 'p1', content: 'test', createdAt: new Date(), _count: { likes: 5, comments: 2 } },
      ])

      const { getPostAnalytics } = await importModule()
      const result = await getPostAnalytics(30)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toHaveProperty('totalPosts')
      }
    })

    it('認証失敗 → ActionErrorを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPostAnalytics } = await importModule()
      const result = await getPostAnalytics()

      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('プレミアムチェック失敗 → ActionErrorを返す', async () => {
      mockIsPremiumUser.mockResolvedValue(false)

      const { getPostAnalytics } = await importModule()
      const result = await getPostAnalytics()

      expect(result).toMatchObject({ success: false, error: 'プレミアム会員限定機能です' })
    })

    it('isPremiumUserが例外をスローした場合、エラーが伝播する', async () => {
      mockIsPremiumUser.mockRejectedValue(new Error('DB connection failed'))

      const { getPostAnalytics } = await importModule()

      await expect(getPostAnalytics()).rejects.toThrow('DB connection failed')
    })

    it('全プレミアム専用関数で認証チェックが一貫している', async () => {
      mockAuth.mockResolvedValue(null)
      const mod = await importModule()

      // 全てのプレミアム関数で認証エラーが返される
      const premiumFunctions = [
        () => mod.getPostAnalytics(),
        () => mod.getLikeAnalytics(),
        () => mod.getQuoteAnalytics(),
        () => mod.getKeywordAnalytics(),
        () => mod.getEngagementTrend(),
        () => mod.getGenrePerformance(),
        () => mod.getFollowerGrowth(),
        () => mod.getPeriodComparison(),
        () => mod.getAnalyticsDashboard(),
        () => mod.getDetailedAnalytics(),
      ]

      for (const fn of premiumFunctions) {
        const result = await fn()
        expect(result).toMatchObject({ success: false })
      }
    })

    it('getBasicStats は無料ユーザーでも利用可能', async () => {
      mockIsPremiumUser.mockResolvedValue(false)
      mockPrisma.post.count.mockResolvedValue(10)
      mockPrisma.like.count.mockResolvedValue(50)
      mockPrisma.follow.count.mockResolvedValue(5)
      mockPrisma.userAnalytics.findUnique.mockResolvedValue(null)

      const { getBasicStats } = await importModule()
      const result = await getBasicStats()

      // エラーではない（無料ユーザーでもOK）
      expect(result).not.toMatchObject({ success: false })
    })
  })
})
