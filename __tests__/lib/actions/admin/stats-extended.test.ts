// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

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

// revalidatePathモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const mockAdminUser = {
  id: 'admin-user-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

describe('Admin Stats Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
  })

  // ============================================================
  // getAdminStats
  // ============================================================

  describe('getAdminStats', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getAdminStats } = await import('@/lib/actions/admin/stats')
      const result = await getAdminStats()

      expect(result).toMatchObject({ success: false, error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getAdminStats } = await import('@/lib/actions/admin/stats')
      const result = await getAdminStats()

      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })

    it('統計情報を取得できる', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(1000) // totalUsers
        .mockResolvedValueOnce(10)   // todayUsers
        .mockResolvedValueOnce(200)  // activeUsersWeek
      mockPrisma.post.count
        .mockResolvedValueOnce(5000) // totalPosts
        .mockResolvedValueOnce(50)   // todayPosts
      mockPrisma.report.count.mockResolvedValue(3)  // pendingReports
      mockPrisma.event.count.mockResolvedValue(89)   // totalEvents
      mockPrisma.bonsaiShop.count.mockResolvedValue(56) // totalShops

      const { getAdminStats } = await import('@/lib/actions/admin/stats')
      const result = await getAdminStats()

      if (!result.success || !result.data) throw new Error('Expected stats, got error')
      expect(result.data.totalUsers).toBe(1000)
      expect(result.data.todayUsers).toBe(10)
      expect(result.data.totalPosts).toBe(5000)
      expect(result.data.todayPosts).toBe(50)
      expect(result.data.pendingReports).toBe(3)
      expect(result.data.totalEvents).toBe(89)
      expect(result.data.totalShops).toBe(56)
      expect(result.data.activeUsersWeek).toBe(200)
    })
  })

  // ============================================================
  // getDailyActiveUsers
  // ============================================================

  describe('getDailyActiveUsers', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getDailyActiveUsers } = await import('@/lib/actions/admin/stats')
      const result = await getDailyActiveUsers()

      expect(result).toMatchObject({ success: false, error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getDailyActiveUsers } = await import('@/lib/actions/admin/stats')
      const result = await getDailyActiveUsers()

      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })

    it('今日のアクティブユーザー数を返す', async () => {
      mockPrisma.user.count.mockResolvedValue(123)

      const { getDailyActiveUsers } = await import('@/lib/actions/admin/stats')
      const result = await getDailyActiveUsers()

      expect(result).toEqual({ success: true, data: 123 })
      expect(mockPrisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                posts: expect.objectContaining({
                  some: expect.any(Object),
                }),
              }),
              expect.objectContaining({
                comments: expect.objectContaining({
                  some: expect.any(Object),
                }),
              }),
            ]),
          }),
        })
      )
    })
  })

  // ============================================================
  // getStatsHistory
  // ============================================================

  describe('getStatsHistory', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory()

      expect(result).toMatchObject({ success: false, error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory()

      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })

    it('過去N日間の統計データを取得できる', async () => {
      // dailyPosts
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])  // dailyPosts
        .mockResolvedValueOnce([])  // dailyComments
        .mockResolvedValueOnce([])  // dailyNewUsers
      mockPrisma.user.count.mockResolvedValue(100) // totalUsersBeforeStart

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory(7)

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data).toHaveLength(7)
      expect(result.data[0]).toHaveProperty('date')
      expect(result.data[0]).toHaveProperty('users')
      expect(result.data[0]).toHaveProperty('posts')
      expect(result.data[0]).toHaveProperty('comments')
      // All entries should have cumulative users = 100 (baseline) since no new users
      result.data.forEach((entry) => {
        expect(entry.users).toBe(100)
        expect(entry.posts).toBe(0)
        expect(entry.comments).toBe(0)
      })
    })

    it('日別データが正しくマッピングされる', async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayKey = today.toISOString().split('T')[0]

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ date: today, count: BigInt(5) }])   // dailyPosts
        .mockResolvedValueOnce([{ date: today, count: BigInt(10) }])  // dailyComments
        .mockResolvedValueOnce([{ date: today, count: BigInt(3) }])   // dailyNewUsers
      mockPrisma.user.count.mockResolvedValue(50) // totalUsersBeforeStart

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory(3)

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data).toHaveLength(3)
      const todayEntry = result.data.find((r) => r.date === todayKey)
      expect(todayEntry?.posts).toBe(5)
      expect(todayEntry?.comments).toBe(10)
      // cumulative users for today should include the 3 new users
      expect(todayEntry?.users).toBe(53)
    })

    it('デフォルトで30日分のデータを返す', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(0)

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory()

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      expect(Array.isArray(result.data)).toBe(true)
      expect(result.data).toHaveLength(30)
    })
  })

  // ============================================================
  // getStatsSummary
  // ============================================================

  describe('getStatsSummary', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      const result = await getStatsSummary()

      expect(result).toMatchObject({ success: false, error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      const result = await getStatsSummary()

      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })

    it('期間別統計サマリーを取得できる', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(5)    // today
        .mockResolvedValueOnce(30)   // week
        .mockResolvedValueOnce(100)  // month
      mockPrisma.post.count
        .mockResolvedValueOnce(5000) // total
        .mockResolvedValueOnce(25)   // today
        .mockResolvedValueOnce(180)  // week
        .mockResolvedValueOnce(800)  // month
      mockPrisma.comment.count
        .mockResolvedValueOnce(15000) // total
        .mockResolvedValueOnce(80)    // today
        .mockResolvedValueOnce(550)   // week
        .mockResolvedValueOnce(2400)  // month

      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      const result = await getStatsSummary()

      if (!result.success || !result.data) throw new Error('Expected summary, got error')
      expect(result.data.users).toEqual({
        total: 1000,
        today: 5,
        week: 30,
        month: 100,
      })
      expect(result.data.posts).toEqual({
        total: 5000,
        today: 25,
        week: 180,
        month: 800,
      })
      expect(result.data.comments).toEqual({
        total: 15000,
        today: 80,
        week: 550,
        month: 2400,
      })
    })
  })
})
