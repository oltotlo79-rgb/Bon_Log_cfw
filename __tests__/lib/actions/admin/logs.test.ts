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

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockAdminLog = {
  id: 'log-id-1',
  adminId: 'admin-record-id',
  action: 'suspend_user',
  targetType: 'user',
  targetId: 'target-user-id',
  details: JSON.stringify({ reason: 'スパム行為' }),
  createdAt: new Date('2024-01-10'),
  admin: {
    id: 'admin-record-id',
    user: { id: mockUser.id, nickname: 'テスト管理者' },
  },
}

describe('管理者操作ログアクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
  })

  // ============================================================
  // getAdminLogs
  // ============================================================

  describe('getAdminLogs', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      const result = await getAdminLogs()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      const result = await getAdminLogs()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('ログ一覧と総件数を正常に返す', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([mockAdminLog])
      mockPrisma.adminLog.count.mockResolvedValue(1)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      const result = await getAdminLogs()

      if ('error' in result) throw new Error('Expected logs, got error')
      expect(result.logs).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('ログが存在しない場合は空配列と0を返す', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      const result = await getAdminLogs()

      if ('error' in result) throw new Error('Expected logs, got error')
      expect(result.logs).toHaveLength(0)
      expect(result.total).toBe(0)
    })

    it('actionフィルターが指定された場合、whereにactionを含める', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([mockAdminLog])
      mockPrisma.adminLog.count.mockResolvedValue(1)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
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

    it('actionフィルターが未指定の場合、whereがundefinedになる', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      await getAdminLogs()

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
        })
      )
    })

    it('limitオプションを正しく渡す', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      await getAdminLogs({ limit: 50 })

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 })
      )
    })

    it('cursorオプションを指定するとcursor句が付き、skip:1 される', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([])
      mockPrisma.adminLog.count.mockResolvedValue(0)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      await getAdminLogs({ cursor: 'log-cursor-id' })

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'log-cursor-id' },
          skip: 1,
        })
      )
    })

    it('ログを新しい順で取得する（createdAt desc + id desc の複合キー）', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([mockAdminLog])
      mockPrisma.adminLog.count.mockResolvedValue(1)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      await getAdminLogs()

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      )
    })

    it('管理者ユーザー情報をincludeする', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([mockAdminLog])
      mockPrisma.adminLog.count.mockResolvedValue(1)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      await getAdminLogs()

      expect(mockPrisma.adminLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            admin: expect.any(Object),
          }),
        })
      )
    })

    it('各種アクションフィルターの組み合わせが正しく動作する', async () => {
      const multipleActionLogs = [
        { ...mockAdminLog, id: 'log-1', action: 'delete_post' },
        { ...mockAdminLog, id: 'log-2', action: 'delete_post' },
      ]
      mockPrisma.adminLog.findMany.mockResolvedValue(multipleActionLogs)
      mockPrisma.adminLog.count.mockResolvedValue(2)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      const result = await getAdminLogs({ action: 'delete_post', limit: 10 })

      if ('error' in result) throw new Error('Expected logs, got error')
      expect(result.logs).toHaveLength(2)
      expect(result.total).toBe(2)
    })

    it('取得件数 === limit の時は nextCursor に最後の id が入る', async () => {
      const logs = [
        { ...mockAdminLog, id: 'log-a' },
        { ...mockAdminLog, id: 'log-b' },
      ]
      mockPrisma.adminLog.findMany.mockResolvedValue(logs)
      mockPrisma.adminLog.count.mockResolvedValue(10)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      const result = await getAdminLogs({ limit: 2 })

      if ('error' in result) throw new Error('Expected logs, got error')
      expect(result.nextCursor).toBe('log-b')
    })

    it('取得件数 < limit の時は nextCursor が undefined（次ページなし）', async () => {
      mockPrisma.adminLog.findMany.mockResolvedValue([mockAdminLog])
      mockPrisma.adminLog.count.mockResolvedValue(1)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      const result = await getAdminLogs({ limit: 50 })

      if ('error' in result) throw new Error('Expected logs, got error')
      expect(result.nextCursor).toBeUndefined()
    })

    it('複数のアクションタイプのログを正しく返す', async () => {
      const diverseLogs = [
        { ...mockAdminLog, id: 'log-1', action: 'suspend_user' },
        { ...mockAdminLog, id: 'log-2', action: 'delete_post' },
        { ...mockAdminLog, id: 'log-3', action: 'restore_content' },
      ]
      mockPrisma.adminLog.findMany.mockResolvedValue(diverseLogs)
      mockPrisma.adminLog.count.mockResolvedValue(3)

      const { getAdminLogs } = await import('@/lib/actions/admin/logs')
      const result = await getAdminLogs()

      if ('error' in result) throw new Error('Expected logs, got error')
      expect(result.logs).toHaveLength(3)
      expect(result.total).toBe(3)
    })
  })
})
