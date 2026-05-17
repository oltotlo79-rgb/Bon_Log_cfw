import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  user: { findUnique: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  adminLog: { findMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn((ops: unknown) =>
    typeof ops === 'function'
      ? (ops as (...args: unknown[]) => unknown)(mockPrisma)
      : Promise.all(ops as Promise<unknown>[])
  ),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}))
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4 }),
}))

describe('getAdminLogs', async () => {
  const { getAdminLogs } = await import('@/lib/actions/admin/logs')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-user-id', role: 'admin' })
    mockPrisma.adminLog.findMany.mockResolvedValue([])
    mockPrisma.adminLog.count.mockResolvedValue(0)
  })

  describe('authentication and authorization', () => {
    it('returns error when unauthenticated', async () => {
      mockAuth.mockResolvedValue(null)
      const result = await getAdminLogs()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('returns error when user is not admin', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const result = await getAdminLogs()
      expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
    })
  })

  describe('happy path', () => {
    it('returns logs and total when called with no options', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'suspend_user',
          targetType: 'user',
          targetId: 'user-1',
          details: '{}',
          createdAt: new Date(),
          admin: { user: { id: 'admin-user-id', nickname: 'Admin' } },
        },
      ]
      mockPrisma.adminLog.findMany.mockResolvedValue(mockLogs)
      mockPrisma.adminLog.count.mockResolvedValue(1)

      const result = await getAdminLogs()
      expect(result).toHaveProperty('logs')
      expect(result).toHaveProperty('total')
      if ('logs' in result) {
        expect(result.logs).toEqual(mockLogs)
        expect(result.total).toBe(1)
      }
    })

    it('returns empty logs when no records exist', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      const result = await getAdminLogs()
      if ('logs' in result) {
        expect(result.logs).toEqual([])
        expect(result.total).toBe(0)
      }
    })

    it('passes action filter to prisma when action option is provided', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      await getAdminLogs({ action: 'suspend_user' })

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: 'suspend_user' },
        })
      )
      expect(mockPrisma.adminLog.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: 'suspend_user' },
        })
      )
    })

    it('passes no where clause when action is not provided', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      await getAdminLogs()

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
        })
      )
    })
  })

  describe('pagination', () => {
    it('uses default limit (ADMIN_LOGS_PAGE_LIMIT = 50) and no cursor when not specified', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      await getAdminLogs()

      const call = mockPrisma.adminLog.findMany.mock.calls[0][0]
      expect(call.take).toBe(50)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })

    it('respects custom limit and cursor', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      await getAdminLogs({ limit: 10, cursor: 'log-cursor' })

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'log-cursor' },
          skip: 1,
        })
      )
    })

    it('orders by createdAt desc with id as secondary key (stable cursor)', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      await getAdminLogs()

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      )
    })
  })

  describe('includes', () => {
    it('includes admin with nested user select', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      await getAdminLogs()

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            admin: {
              include: {
                user: {
                  select: { id: true, nickname: true },
                },
              },
            },
          },
        })
      )
    })
  })

  describe('multiple log types', () => {
    it('can filter by delete_post action', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      await getAdminLogs({ action: 'delete_post' })

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: 'delete_post' },
        })
      )
    })

    it('can filter by activate_user action', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      await getAdminLogs({ action: 'activate_user' })

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: 'activate_user' },
        })
      )
    })
  })

  describe('database errors', () => {
    it('returns error on database failure', async () => {
      mockPrisma.adminLog.findMany.mockRejectedValue(new Error('Database connection failed'))

      const result = await getAdminLogs()
      expect(result).toMatchObject({ success: false })
    })
  })
})
