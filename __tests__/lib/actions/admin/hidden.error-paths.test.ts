// @vitest-environment node

/**
 * lib/actions/admin/hidden.ts の未カバー catch ブランチを補強する。
 *
 * 既存テストは正常系を網羅するが、Prisma 例外時の ERR_OPERATION_FAILED 経路
 * が抜けていたため、ここで全 6 関数の catch を直撃する。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = {
  user: { findUnique: vi.fn() },
  post: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  comment: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  event: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  bonsaiShop: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  shopReview: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
  report: { groupBy: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  adminNotification: { findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  adminLog: { create: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: mockLoggerError, debug: vi.fn() },
  logger: { log: vi.fn(), warn: vi.fn(), error: mockLoggerError, debug: vi.fn() },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}))

vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin-id' } })
  mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-id', role: 'admin' })
})

describe('admin/hidden - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/hidden')

  it('getHiddenContent: Promise.all が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.post.findMany.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getHiddenContent()
    expect((result as { success: boolean }).success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('getHiddenContent failed', expect.any(Object))
  })

  it('restoreContent: prisma.post.update が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.post.update.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.restoreContent('post', 'p1')
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('restoreContent failed', expect.any(Object))
  })

  it('deleteHiddenContent: prisma.comment.delete が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.comment.delete.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.deleteHiddenContent('comment', 'c1')
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('deleteHiddenContent failed', expect.any(Object))
  })

  it('getAdminNotifications: findMany が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.adminNotification.findMany.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getAdminNotifications()
    expect((result as { success: boolean }).success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('getAdminNotifications failed', expect.any(Object))
  })

  it('markAdminNotificationAsRead: update が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.adminNotification.update.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.markAdminNotificationAsRead('n1')
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('markAdminNotificationAsRead failed', expect.any(Object))
  })

  it('markAllAdminNotificationsAsRead: updateMany が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.adminNotification.updateMany.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.markAllAdminNotificationsAsRead()
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('markAllAdminNotificationsAsRead failed', expect.any(Object))
  })

  it('restoreContent: review type の switch 経路', async () => {
    mockPrisma.shopReview.update.mockResolvedValueOnce({ id: 'r1' })
    mockPrisma.report.updateMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.adminNotification.updateMany.mockResolvedValueOnce({ count: 0 })
    mockPrisma.adminLog.create.mockResolvedValueOnce({})
    const result = await mod.restoreContent('review', 'r1')
    expect(result.success).toBe(true)
    expect(mockPrisma.shopReview.update).toHaveBeenCalled()
  })

  it('deleteHiddenContent: shop type の switch 経路', async () => {
    mockPrisma.bonsaiShop.delete.mockResolvedValueOnce({ id: 's1' })
    mockPrisma.report.deleteMany.mockResolvedValueOnce({ count: 1 })
    mockPrisma.adminNotification.updateMany.mockResolvedValueOnce({ count: 0 })
    mockPrisma.adminLog.create.mockResolvedValueOnce({})
    const result = await mod.deleteHiddenContent('shop', 's1')
    expect(result.success).toBe(true)
    expect(mockPrisma.bonsaiShop.delete).toHaveBeenCalled()
  })
})
