// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
// moderationQueue と securityEvent は createMockPrismaClient に含まれない場合がある
if (!mockPrisma.moderationQueue) {
  mockPrisma.moderationQueue = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}
if (!mockPrisma.securityEvent) {
  mockPrisma.securityEvent = {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

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

// utilsモック
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

// Redisモック
const mockRedisSet = vi.fn()
const mockRedisGet = vi.fn()
vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({
    set: mockRedisSet,
    get: mockRedisGet,
  }),
}))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

describe('システム監視アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    // デフォルトでDBヘルスチェック成功
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
    // デフォルトでRedisヘルスチェック成功
    mockRedisSet.mockResolvedValue('OK')
    mockRedisGet.mockResolvedValue('pong')
  })

  describe('getMonitoringStats', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('DBとRedisの正常なヘルスステータスを返す', async () => {
      mockPrisma.user.count.mockResolvedValue(100)
      mockPrisma.post.count.mockResolvedValue(500)
      mockPrisma.report.count.mockResolvedValue(3)
      mockPrisma.moderationQueue.count.mockResolvedValue(2)
      mockPrisma.securityEvent.count.mockResolvedValue(5)

      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      const stats = result.data!
      expect(stats.health.database.status).toBe('healthy')
      expect(stats.health.redis.status).toBe('healthy')
      expect(stats.health.timestamp).toBeDefined()
    })

    it('正しいカウント値を返す', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(1000)  // totalUsers
        .mockResolvedValueOnce(42)    // activeUsersToday
      mockPrisma.post.count
        .mockResolvedValueOnce(5000)  // totalPosts
        .mockResolvedValueOnce(25)    // postsToday
      mockPrisma.report.count.mockResolvedValue(7)
      mockPrisma.moderationQueue.count.mockResolvedValue(3)
      mockPrisma.securityEvent.count.mockResolvedValue(10)

      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      const stats = result.data!
      expect(stats.counts.totalUsers).toBe(1000)
      expect(stats.counts.totalPosts).toBe(5000)
      expect(stats.counts.activeUsersToday).toBe(42)
      expect(stats.counts.postsToday).toBe(25)
      expect(stats.counts.pendingReports).toBe(7)
      expect(stats.counts.pendingModeration).toBe(3)
    })

    it('レート制限ブロック数を返す', async () => {
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.report.count.mockResolvedValue(0)
      mockPrisma.moderationQueue.count.mockResolvedValue(0)
      mockPrisma.securityEvent.count.mockResolvedValue(15)

      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data!.rateLimiting.recentBlocks).toBe(15)

      // securityEvent.countが呼ばれたことを確認
      expect(mockPrisma.securityEvent.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            eventType: 'rate_limit_exceeded',
          }),
        })
      )
    })

    it('DB接続エラー時はunhealthyを返す', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('DB connection failed'))
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.report.count.mockResolvedValue(0)
      mockPrisma.moderationQueue.count.mockResolvedValue(0)
      mockPrisma.securityEvent.count.mockResolvedValue(0)

      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data!.health.database.status).toBe('unhealthy')
      expect(result.data!.health.database.latencyMs).toBe(0)
    })

    it('Redis接続エラー時はunhealthyを返す', async () => {
      mockRedisSet.mockRejectedValue(new Error('Redis connection failed'))
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.report.count.mockResolvedValue(0)
      mockPrisma.moderationQueue.count.mockResolvedValue(0)
      mockPrisma.securityEvent.count.mockResolvedValue(0)

      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data!.health.redis.status).toBe('unhealthy')
      expect(result.data!.health.redis.latencyMs).toBe(0)
    })

    it('Redisの応答が不正な場合はdegradedを返す', async () => {
      mockRedisGet.mockResolvedValue('wrong-value')
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.report.count.mockResolvedValue(0)
      mockPrisma.moderationQueue.count.mockResolvedValue(0)
      mockPrisma.securityEvent.count.mockResolvedValue(0)

      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data!.health.redis.status).toBe('degraded')
    })

    it('Promise.allでのエラー時はエラーメッセージを返す', async () => {
      mockPrisma.user.count.mockRejectedValue(new Error('DB error'))
      mockPrisma.post.count.mockRejectedValue(new Error('DB error'))
      mockPrisma.report.count.mockRejectedValue(new Error('DB error'))
      mockPrisma.moderationQueue.count.mockRejectedValue(new Error('DB error'))

      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()

      expect(result).toMatchObject({
        success: false,
        error: '監視データの取得に失敗しました',
      })
    })

    it('securityEventのcountエラーはrecentBlocks=0で処理を続行する', async () => {
      mockPrisma.user.count.mockResolvedValue(10)
      mockPrisma.post.count.mockResolvedValue(20)
      mockPrisma.report.count.mockResolvedValue(1)
      mockPrisma.moderationQueue.count.mockResolvedValue(0)
      mockPrisma.securityEvent.count.mockRejectedValue(new Error('Table not found'))

      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data!.rateLimiting.recentBlocks).toBe(0)
    })

    it('全カウントが0の場合も正常に返す', async () => {
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.post.count.mockResolvedValue(0)
      mockPrisma.report.count.mockResolvedValue(0)
      mockPrisma.moderationQueue.count.mockResolvedValue(0)
      mockPrisma.securityEvent.count.mockResolvedValue(0)

      const { getMonitoringStats } = await import('@/lib/actions/admin/monitoring')
      const result = await getMonitoringStats()

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('Expected success')
      expect(result.data!.counts.totalUsers).toBe(0)
      expect(result.data!.counts.totalPosts).toBe(0)
      expect(result.data!.counts.activeUsersToday).toBe(0)
      expect(result.data!.counts.postsToday).toBe(0)
      expect(result.data!.counts.pendingReports).toBe(0)
      expect(result.data!.counts.pendingModeration).toBe(0)
      expect(result.data!.rateLimiting.recentBlocks).toBe(0)
    })
  })
})
