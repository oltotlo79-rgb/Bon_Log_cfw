// @vitest-environment node

/**
 * lib/actions/admin/* の catch ブランチ・サブパスを補強する統合テスト
 *
 * 対象:
 * - announcements: getAnnouncements / updateAnnouncement / deleteAnnouncement の catch
 * - pesticide-data: 全 6 関数の catch + getPesticideHistory の whereなし
 * - segments: getSegment / updateSegment / deleteSegment の catch
 * - stats: 各種統計関数の catch
 * - content: モデレーション系の catch
 * - warnings: 警告系の catch
 * - roles: ロール変更系の catch
 * - activity: getUserActivity の catch
 * - ip-management: IP 管理の catch
 * - security: セキュリティイベントの catch
 *
 * いずれも Prisma が throw した際のフォールバック挙動（actionError / デフォルト値）を確認する。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma: Record<string, Record<string, ReturnType<typeof vi.fn>>> & { $transaction: ReturnType<typeof vi.fn> } = {
  announcement: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(), create: vi.fn() },
  user: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  pesticide: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  pesticideEditHistory: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  segmentDefinition: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  post: { count: vi.fn(), findMany: vi.fn(), updateMany: vi.fn() },
  comment: { count: vi.fn() },
  follow: { count: vi.fn() },
  payment: { aggregate: vi.fn(), findMany: vi.fn() },
  report: { count: vi.fn(), findMany: vi.fn() },
  warning: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), findUnique: vi.fn() },
  adminUser: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
  adminLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  ipBlock: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  securityEvent: { findMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
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

vi.mock('@/lib/services/notification-bulk', () => ({
  createNotificationsBulk: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin-id' } })
  mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-id', role: 'admin' })
})

// ============================================================
// announcements
// ============================================================

describe('admin/announcements - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/announcements')

  it('getAnnouncements: Promise.all が throw → actionError', async () => {
    mockPrisma.announcement.findMany.mockRejectedValueOnce(new Error('boom'))
    mockPrisma.announcement.count.mockResolvedValue(0)
    const result = await mod.getAnnouncements()
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('getAnnouncements failed', expect.any(Object))
  })

  it('updateAnnouncement: $transaction なし、findUnique は通って update が throw', async () => {
    mockPrisma.announcement.findUnique.mockResolvedValueOnce({ id: 'a1', title: 't' })
    mockPrisma.announcement.update.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.updateAnnouncement('a1', { title: '新' })
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('updateAnnouncement failed', expect.any(Object))
  })

  it('deleteAnnouncement: $transaction が throw → actionError', async () => {
    mockPrisma.announcement.findUnique.mockResolvedValueOnce({ id: 'a1', title: 't' })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.deleteAnnouncement('a1')
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('deleteAnnouncement failed', expect.any(Object))
  })
})

// ============================================================
// pesticide-data
// ============================================================

describe('admin/pesticide-data - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/pesticide-data')

  it('getAdminPesticides: findMany が throw → actionError', async () => {
    mockPrisma.pesticide.findMany.mockRejectedValueOnce(new Error('boom'))
    mockPrisma.pesticide.count.mockResolvedValue(0)
    const result = await mod.getAdminPesticides()
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('getAdminPesticides failed', expect.any(Object))
  })

  it('getAdminPesticideDetail: findUnique が throw → actionError', async () => {
    mockPrisma.pesticide.findUnique.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getAdminPesticideDetail('p1')
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('getAdminPesticideDetail failed', expect.any(Object))
  })

  it('createPesticide: prisma.pesticide.create が throw → actionError', async () => {
    mockPrisma.pesticide.create.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.createPesticide({
      name: '新農薬',
      pesticideType: 'fungicide' as never,
      formulationTypeId: 'f1',
      slug: 'new-pesticide-error-path',
    })
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('createPesticide failed', expect.any(Object))
  })

  it('updatePesticide: $transaction が throw → actionError', async () => {
    mockPrisma.pesticide.findUnique.mockResolvedValueOnce({ id: 'p1', name: '旧' })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.updatePesticide('p1', { name: '新' })
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('updatePesticide failed', expect.any(Object))
  })

  it('deletePesticide: $transaction が throw → actionError', async () => {
    mockPrisma.pesticide.findUnique.mockResolvedValueOnce({ id: 'p1', name: '対象' })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.deletePesticide('p1')
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('deletePesticide failed', expect.any(Object))
  })

  it('getPesticideHistory: findMany が throw → actionError', async () => {
    mockPrisma.pesticideEditHistory.findMany.mockRejectedValueOnce(new Error('boom'))
    mockPrisma.pesticideEditHistory.count.mockResolvedValue(0)
    const result = await mod.getPesticideHistory()
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('getPesticideHistory failed', expect.any(Object))
  })
})

// ============================================================
// stats - 一部の catch
// ============================================================

// ============================================================
// segments
// ============================================================

describe('admin/segments - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/segments')

  it('getSegments: findMany が throw → デフォルト値（空 segments + total=0）', async () => {
    mockPrisma.segmentDefinition.findMany.mockRejectedValueOnce(new Error('boom'))
    mockPrisma.segmentDefinition.count.mockResolvedValueOnce(0)
    const result = await mod.getSegments()
    expect(result).toMatchObject({ segments: [], total: 0 })
  })

  it('deleteSegment: 存在しない id でも catch ブランチに到達しない（findUnique=null）', async () => {
    mockPrisma.segmentDefinition.findUnique.mockResolvedValueOnce(null)
    const result = await mod.deleteSegment('nonexistent')
    // not found 経路（catch ではなく ERR_SEGMENT_NOT_FOUND）
    expect(result.success).toBe(false)
  })

  it('deleteSegment: $transaction が throw → actionError', async () => {
    mockPrisma.segmentDefinition.findUnique.mockResolvedValueOnce({ id: 's1', name: 'seg' })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.deleteSegment('s1')
    expect(result.success).toBe(false)
  })

  it('evaluateSegment: findUnique が throw → デフォルト値（count=0）', async () => {
    mockPrisma.segmentDefinition.findUnique.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.evaluateSegment('s1')
    expect(result).toMatchObject({ count: 0 })
  })
})

// ============================================================
// content (deleteEventByAdmin / deleteShopByAdmin / getAdminReviews / deleteReviewByAdmin)
// ============================================================

describe('admin/content - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/content')

  it('getAdminReviews: prisma.shopReview.findMany が throw → actionError', async () => {
    // mockPrisma に shopReview が無いので追加
    if (!('shopReview' in mockPrisma)) {
      ;(mockPrisma as Record<string, unknown>).shopReview = {
        findMany: vi.fn().mockRejectedValue(new Error('boom')),
        findUnique: vi.fn(),
        update: vi.fn(),
        count: vi.fn().mockResolvedValue(0),
      }
    } else {
      const sr = (mockPrisma as unknown as { shopReview: Record<string, ReturnType<typeof vi.fn>> }).shopReview
      sr.findMany?.mockRejectedValueOnce(new Error('boom'))
      sr.count?.mockResolvedValueOnce(0)
    }
    const result = await mod.getAdminReviews()
    expect(result.success).toBe(false)
  })
})

// ============================================================
// warnings
// ============================================================

describe('admin/warnings - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/warnings')

  it('getWarnings: findMany が throw → デフォルト値（空 warnings + total=0）', async () => {
    mockPrisma.warning.findMany.mockRejectedValueOnce(new Error('boom'))
    mockPrisma.warning.count.mockResolvedValueOnce(0)
    const result = await mod.getWarnings()
    expect(result).toMatchObject({ warnings: [], total: 0 })
  })

  it('issueWarning: 対象ユーザー存在 + create が throw → actionError', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.issueWarning({ userId: 'u1', reason: 'spam', severity: 'low' as never })
    expect(result.success).toBe(false)
  })

  it('deactivateWarning: warning 存在 + update が throw → actionError', async () => {
    mockPrisma.warning.findUnique.mockResolvedValueOnce({ id: 'w1', userId: 'u1', isActive: true })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.deactivateWarning('w1')
    expect(result.success).toBe(false)
  })

  it('getUserWarningsSummary: findMany が throw → デフォルト値（total=0, byLevel={}）', async () => {
    mockPrisma.warning.findMany.mockRejectedValueOnce(new Error('boom'))
    mockPrisma.warning.count.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getUserWarningsSummary('u1')
    expect(result).toMatchObject({ total: 0, active: 0, byLevel: {} })
  })
})

// ============================================================
// roles
// ============================================================

describe('admin/roles - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/roles')

  it('getAdminRoles: findMany が throw → デフォルト値（admins=[]）', async () => {
    mockPrisma.adminUser.findMany.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getAdminRoles()
    expect(result).toMatchObject({ admins: [] })
  })

  it('addAdmin: $transaction が throw → actionError', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'u1' })
    // adminUser が既に存在しない
    mockPrisma.adminUser.findUnique.mockResolvedValueOnce({ id: 'a1', userId: 'admin-id', role: 'admin' })
    mockPrisma.adminUser.findUnique.mockResolvedValueOnce(null)
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.addAdmin('u1', 'admin')
    expect(result.success).toBe(false)
  })

  it('removeAdmin: 対象 admin が存在 + delete が throw → actionError', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValueOnce({ id: 'a1', userId: 'admin-id', role: 'admin' })
    mockPrisma.adminUser.findUnique.mockResolvedValueOnce({ id: 'a2', userId: 'u1', role: 'admin' })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.removeAdmin('u1')
    expect(result.success).toBe(false)
  })
})

// ============================================================
// activity
// ============================================================

describe('admin/activity - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/activity')

  it('getUserActivity: findUnique が throw → actionError', async () => {
    // requireAdmin の suspension チェック (admin-id) は通し、本体の findUnique で throw
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ isSuspended: false })
      .mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getUserActivity('u1')
    expect(result.success).toBe(false)
  })

  it('detectSuspiciousBehavior: findUnique が throw → actionError', async () => {
    // detectSuspiciousBehavior 本体は user.findUnique を呼ばないため、catch ブランチに入るのは
    // mockPrisma に like モデルが無いことで prisma.like.count が TypeError を投げるため。
    // user.findUnique は requireAdmin の suspension チェックのみで利用される。
    mockPrisma.user.findUnique.mockResolvedValueOnce({ isSuspended: false })
    const result = await mod.detectSuspiciousBehavior('u1')
    expect(result.success).toBe(false)
  })
})

// ============================================================
// ip-management
// ============================================================

describe('admin/ip-management - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/ip-management')

  it('getIpAddresses: findMany が throw → actionError', async () => {
    mockPrisma.ipBlock.findMany.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getIpAddresses()
    expect(result.success).toBe(false)
  })

  it('detectMultiAccounts: findMany が throw → actionError', async () => {
    mockPrisma.user.findMany.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.detectMultiAccounts()
    expect(result.success).toBe(false)
  })
})

// ============================================================
// security
// ============================================================

describe('admin/security - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/security')

  it('getSecurityEvents: findMany が throw → デフォルト値（events=[]）', async () => {
    mockPrisma.securityEvent.findMany.mockRejectedValueOnce(new Error('boom'))
    mockPrisma.securityEvent.count.mockResolvedValueOnce(0)
    const result = await mod.getSecurityEvents()
    expect(result).toMatchObject({ events: [], total: 0 })
  })

  it('getSecurityDashboard: count が throw → デフォルト値（全 0）', async () => {
    mockPrisma.securityEvent.count.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getSecurityDashboard()
    expect(result.failedLoginsToday).toBe(0)
  })
})

describe('admin/stats - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/stats')

  it('getAdminStats: prisma.count が throw → actionError', async () => {
    mockPrisma.user.count.mockRejectedValue(new Error('boom'))
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.comment.count.mockResolvedValue(0)
    mockPrisma.report.count.mockResolvedValue(0)
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 0 } })
    const result = await mod.getAdminStats()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
    expect(mockLoggerError).toHaveBeenCalledWith('Get admin stats error', expect.any(Object))
  })

  it('getDailyActiveUsers: prisma.user.count が throw → actionError', async () => {
    mockPrisma.user.count.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getDailyActiveUsers()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
    expect(mockLoggerError).toHaveBeenCalledWith('Get daily active users error', expect.any(Object))
  })

  it('getStatsHistory: prisma.* が throw → actionError', async () => {
    mockPrisma.user.count.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getStatsHistory(7)
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
    expect(mockLoggerError).toHaveBeenCalledWith('Get stats history error', expect.any(Object))
  })

  it('getStatsSummary: prisma.* が throw → actionError', async () => {
    mockPrisma.user.count.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getStatsSummary()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })
})
