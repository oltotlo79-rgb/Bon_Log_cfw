// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
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
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

// rate-limitモック
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

// loggerモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// next/headersモック
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}))

// premiumモック
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }),
}))

// utilsモック（getStartOfToday, getStartOfNDaysAgo）
vi.mock('@/lib/utils', () => ({
  getStartOfToday: vi.fn(() => new Date('2024-01-15T00:00:00.000Z')),
  getStartOfNDaysAgo: vi.fn((n: number) => {
    const d = new Date('2024-01-15T00:00:00.000Z')
    d.setDate(d.getDate() - n)
    return d
  }),
  truncateText: vi.fn((text: string) => text),
  formatRelativeTime: vi.fn(() => '1時間前'),
}))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

describe('管理者統計情報アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
  })

  // ============================================================
  // getAdminStats
  // ============================================================

  describe('getAdminStats', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAdminStats } = await import('@/lib/actions/admin/stats')
      const result = await getAdminStats()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAdminStats } = await import('@/lib/actions/admin/stats')
      const result = await getAdminStats()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('全統計データを正常に返す', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(1000)  // totalUsers
        .mockResolvedValueOnce(5)     // todayUsers
        .mockResolvedValueOnce(50)    // activeUsersWeek
      mockPrisma.post.count
        .mockResolvedValueOnce(5000)  // totalPosts
        .mockResolvedValueOnce(25)    // todayPosts
      mockPrisma.report.count.mockResolvedValue(10)   // pendingReports
      mockPrisma.event.count.mockResolvedValue(100)   // totalEvents
      mockPrisma.bonsaiShop.count.mockResolvedValue(50) // totalShops

      const { getAdminStats } = await import('@/lib/actions/admin/stats')
      const result = await getAdminStats()

      if (!result.success || !result.data) throw new Error('Expected stats, got error')
      expect(result.data.totalUsers).toBe(1000)
      expect(result.data.todayUsers).toBe(5)
      expect(result.data.totalPosts).toBe(5000)
      expect(result.data.todayPosts).toBe(25)
      expect(result.data.pendingReports).toBe(10)
      expect(result.data.totalEvents).toBe(100)
      expect(result.data.totalShops).toBe(50)
      expect(result.data.activeUsersWeek).toBe(50)
    })

    it('統計値がすべて0の場合も正常に返す', async () => {
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.report.count.mockResolvedValue(0)
      mockPrisma.event.count.mockResolvedValue(0)
      mockPrisma.bonsaiShop.count.mockResolvedValue(0)

      const { getAdminStats } = await import('@/lib/actions/admin/stats')
      const result = await getAdminStats()

      if (!result.success || !result.data) throw new Error('Expected stats, got error')
      expect(result.data.totalUsers).toBe(0)
      expect(result.data.totalPosts).toBe(0)
      expect(result.data.pendingReports).toBe(0)
    })

    it('複数のユーザー数クエリを並列実行する（8つのcountクエリ）', async () => {
      mockPrisma.user.count.mockResolvedValue(100)
      mockPrisma.post.count.mockResolvedValue(500)
      mockPrisma.report.count.mockResolvedValue(3)
      mockPrisma.event.count.mockResolvedValue(20)
      mockPrisma.bonsaiShop.count.mockResolvedValue(15)

      const { getAdminStats } = await import('@/lib/actions/admin/stats')
      await getAdminStats()

      // user.countは3回呼ばれる（total, today, activeWeek）
      expect(mockPrisma.user.count).toHaveBeenCalledTimes(3)
      // post.countは2回呼ばれる（total, today）
      expect(mockPrisma.post.count).toHaveBeenCalledTimes(2)
      expect(mockPrisma.report.count).toHaveBeenCalledTimes(1)
      expect(mockPrisma.event.count).toHaveBeenCalledTimes(1)
      expect(mockPrisma.bonsaiShop.count).toHaveBeenCalledTimes(1)
    })

    it('返り値に必要な全フィールドが含まれる', async () => {
      mockPrisma.user.count.mockResolvedValue(10)
      mockPrisma.post.count.mockResolvedValue(20)
      mockPrisma.report.count.mockResolvedValue(1)
      mockPrisma.event.count.mockResolvedValue(5)
      mockPrisma.bonsaiShop.count.mockResolvedValue(3)

      const { getAdminStats } = await import('@/lib/actions/admin/stats')
      const result = await getAdminStats()

      if (!result.success || !result.data) throw new Error('Expected stats, got error')
      expect(result.data).toHaveProperty('totalUsers')
      expect(result.data).toHaveProperty('todayUsers')
      expect(result.data).toHaveProperty('totalPosts')
      expect(result.data).toHaveProperty('todayPosts')
      expect(result.data).toHaveProperty('pendingReports')
      expect(result.data).toHaveProperty('totalEvents')
      expect(result.data).toHaveProperty('totalShops')
      expect(result.data).toHaveProperty('activeUsersWeek')
    })
  })

  // ============================================================
  // getDailyActiveUsers
  // ============================================================

  describe('getDailyActiveUsers', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getDailyActiveUsers } = await import('@/lib/actions/admin/stats')
      const result = await getDailyActiveUsers()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getDailyActiveUsers } = await import('@/lib/actions/admin/stats')
      const result = await getDailyActiveUsers()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('今日のアクティブユーザー数を返す', async () => {
      mockPrisma.user.count.mockResolvedValue(42)

      const { getDailyActiveUsers } = await import('@/lib/actions/admin/stats')
      const result = await getDailyActiveUsers()

      expect(result).toEqual({ success: true, data: 42 })
    })

    it('アクティブユーザーが0の場合は0を返す', async () => {
      mockPrisma.user.count.mockResolvedValue(0)

      const { getDailyActiveUsers } = await import('@/lib/actions/admin/stats')
      const result = await getDailyActiveUsers()

      expect(result).toEqual({ success: true, data: 0 })
    })

    it('OR条件で投稿またはコメントしたユーザーを取得する', async () => {
      mockPrisma.user.count.mockResolvedValue(10)

      const { getDailyActiveUsers } = await import('@/lib/actions/admin/stats')
      await getDailyActiveUsers()

      expect(mockPrisma.user.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ posts: expect.any(Object) }),
              expect.objectContaining({ comments: expect.any(Object) }),
            ]),
          }),
        })
      )
    })
  })

  // ============================================================
  // getStatsHistory
  // ============================================================

  describe('getStatsHistory', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('デフォルト日数の履歴データを返す', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(100)

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory()

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      expect(Array.isArray(result.data)).toBe(true)
    })

    it('指定した日数分の配列を返す', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(100)

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory(7)

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      expect(result.data).toHaveLength(7)
    })

    it('30日分の履歴データを返す', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(500)

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory(30)

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      expect(result.data).toHaveLength(30)
    })

    it('各日付エントリにdate, users, posts, commentsフィールドが含まれる', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.user.count.mockResolvedValue(100)

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory(3)

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      result.data.forEach((entry) => {
        expect(entry).toHaveProperty('date')
        expect(entry).toHaveProperty('users')
        expect(entry).toHaveProperty('posts')
        expect(entry).toHaveProperty('comments')
      })
    })

    it('BigInt値をsafeBigIntToNumberで正しく変換する', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { date: new Date('2024-01-14'), count: BigInt(10) },
        ])
        .mockResolvedValueOnce([
          { date: new Date('2024-01-14'), count: BigInt(5) },
        ])
        .mockResolvedValueOnce([
          { date: new Date('2024-01-14'), count: BigInt(3) },
        ])
      mockPrisma.user.count.mockResolvedValue(100)

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory(3)

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      // BigIntが正常にNumberに変換されている（NaNや例外がない）
      result.data.forEach((entry) => {
        expect(typeof entry.posts).toBe('number')
        expect(typeof entry.comments).toBe('number')
        expect(typeof entry.users).toBe('number')
        expect(Number.isNaN(entry.posts)).toBe(false)
      })
    })

    it('Number.MAX_SAFE_INTEGERを超えるBigIntはNumber.MAX_SAFE_INTEGERを返す', async () => {
      // 今日の日付に合わせてBigInt超過をシミュレート
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { date: today, count: BigInt('99999999999999999') },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
      mockPrisma.user.count.mockResolvedValue(0)

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory(3)

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      // MAX_SAFE_INTEGERを超える場合は上限値になる
      const hasMaxSafeInt = result.data.some(e => e.posts === Number.MAX_SAFE_INTEGER)
      expect(hasMaxSafeInt).toBe(true)
    })

    it('累計ユーザー数はベースライン+日別新規ユーザーの累積で計算される', async () => {
      // dailyPosts, dailyComments, dailyNewUsersの順でモック
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // dailyPosts
        .mockResolvedValueOnce([]) // dailyComments
        .mockResolvedValueOnce([   // dailyNewUsers
          { date: new Date('2024-01-14'), count: BigInt(5) },
        ])
      mockPrisma.user.count.mockResolvedValue(100) // totalUsersBeforeStart

      const { getStatsHistory } = await import('@/lib/actions/admin/stats')
      const result = await getStatsHistory(2)

      if (!result.success || !result.data) throw new Error('Expected array, got error')
      // 累計ユーザーはベースライン100以上であるはず
      result.data.forEach((entry) => {
        expect(entry.users).toBeGreaterThanOrEqual(100)
      })
    })
  })

  // ============================================================
  // getStatsSummary
  // ============================================================

  describe('getStatsSummary', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      const result = await getStatsSummary()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      const result = await getStatsSummary()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('期間別統計サマリーを正常に返す', async () => {
      // 12個のcount呼び出し（users: 4, posts: 4, comments: 4）
      mockPrisma.user.count
        .mockResolvedValueOnce(1000)  // total
        .mockResolvedValueOnce(5)     // today
        .mockResolvedValueOnce(30)    // week
        .mockResolvedValueOnce(100)   // month
      mockPrisma.post.count
        .mockResolvedValueOnce(5000)  // total
        .mockResolvedValueOnce(25)    // today
        .mockResolvedValueOnce(180)   // week
        .mockResolvedValueOnce(800)   // month
      mockPrisma.comment.count
        .mockResolvedValueOnce(15000) // total
        .mockResolvedValueOnce(80)    // today
        .mockResolvedValueOnce(550)   // week
        .mockResolvedValueOnce(2400)  // month

      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      const result = await getStatsSummary()

      if (!result.success || !result.data) throw new Error('Expected summary, got error')
      expect(result.data.users.total).toBe(1000)
      expect(result.data.users.today).toBe(5)
      expect(result.data.users.week).toBe(30)
      expect(result.data.users.month).toBe(100)
      expect(result.data.posts.total).toBe(5000)
      expect(result.data.comments.total).toBe(15000)
    })

    it('返り値にusers, posts, commentsの3つのカテゴリが含まれる', async () => {
      mockPrisma.user.count.mockResolvedValue(10)
      mockPrisma.post.count.mockResolvedValue(20)
      mockPrisma.comment.count.mockResolvedValue(30)

      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      const result = await getStatsSummary()

      if (!result.success || !result.data) throw new Error('Expected summary, got error')
      expect(result.data).toHaveProperty('users')
      expect(result.data).toHaveProperty('posts')
      expect(result.data).toHaveProperty('comments')
    })

    it('各カテゴリにtotal, today, week, monthのサブフィールドがある', async () => {
      mockPrisma.user.count.mockResolvedValue(10)
      mockPrisma.post.count.mockResolvedValue(20)
      mockPrisma.comment.count.mockResolvedValue(30)

      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      const result = await getStatsSummary()

      if (!result.success || !result.data) throw new Error('Expected summary, got error')
      ;(['users', 'posts', 'comments'] as const).forEach((key) => {
        expect(result.data![key]).toHaveProperty('total')
        expect(result.data![key]).toHaveProperty('today')
        expect(result.data![key]).toHaveProperty('week')
        expect(result.data![key]).toHaveProperty('month')
      })
    })

    it('12個のクエリを並列実行する', async () => {
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.comment.count.mockResolvedValue(0)

      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      await getStatsSummary()

      expect(mockPrisma.user.count).toHaveBeenCalledTimes(4)
      expect(mockPrisma.post.count).toHaveBeenCalledTimes(4)
      expect(mockPrisma.comment.count).toHaveBeenCalledTimes(4)
    })

    it('全統計値が0の場合も正常に返す', async () => {
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.comment.count.mockResolvedValue(0)

      const { getStatsSummary } = await import('@/lib/actions/admin/stats')
      const result = await getStatsSummary()

      if (!result.success || !result.data) throw new Error('Expected summary, got error')
      expect(result.data.users.total).toBe(0)
      expect(result.data.posts.total).toBe(0)
      expect(result.data.comments.total).toBe(0)
    })
  })
})
