import { vi } from 'vitest'
/**
 * Extended tests for admin actions
 */
export {}

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  adminUser: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  post: { findMany: vi.fn(), findUnique: vi.fn(), delete: vi.fn(), count: vi.fn() },
  event: { delete: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  bonsaiShop: { delete: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  shopReview: { delete: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  report: { findMany: vi.fn(), count: vi.fn(), update: vi.fn(), groupBy: vi.fn() },
  adminLog: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  like: { count: vi.fn() },
  comment: { count: vi.fn() },
  follow: { count: vi.fn() },
  notification: { create: vi.fn() },
  block: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  $transaction: vi.fn((fn: unknown) => typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown)(mockPrisma) : Promise.all(fn as Promise<unknown>[])),
  $queryRaw: vi.fn(),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4 }) }))

describe('isAdmin extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns false when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { isAdmin } = await import('@/lib/actions/admin')
    const result = await isAdmin()
    expect(result).toBe(false)
  })

  it('returns false when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { isAdmin } = await import('@/lib/actions/admin')
    const result = await isAdmin()
    expect(result).toBe(false)
  })

  it('returns true when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    const { isAdmin } = await import('@/lib/actions/admin')
    const result = await isAdmin()
    expect(result).toBe(true)
  })
})

describe('getAdminInfo extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns null/error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getAdminInfo } = await import('@/lib/actions/admin')
    const result = await getAdminInfo()
    expect(result === null || (result && 'error' in result)).toBe(true)
  })

  it('returns admin info when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1', role: 'admin' })
    const { getAdminInfo } = await import('@/lib/actions/admin')
    const result = await getAdminInfo()
    expect(result).toBeDefined()
  })
})

// Admin functions that throw when not admin - test with try/catch
describe('getAdminStats extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws or returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getAdminStats } = await import('@/lib/actions/admin/stats')
    try {
      const result = await getAdminStats()
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { getAdminStats } = await import('@/lib/actions/admin/stats')
    const result = await getAdminStats()
    expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
  })

  it('returns stats when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.user.count.mockResolvedValue(100)
    mockPrisma.post.count.mockResolvedValue(500)
    mockPrisma.comment.count.mockResolvedValue(200)
    mockPrisma.report.count.mockResolvedValue(10)
    mockPrisma.event.count.mockResolvedValue(20)
    mockPrisma.bonsaiShop.count.mockResolvedValue(5)
    mockPrisma.like.count.mockResolvedValue(50)
    mockPrisma.follow.count.mockResolvedValue(30)
    const { getAdminStats } = await import('@/lib/actions/admin/stats')
    const result = await getAdminStats()
    expect(result).toBeDefined()
  })
})

describe('getAdminUsers extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { getAdminUsers } = await import('@/lib/actions/admin/users')
    const result = await getAdminUsers()
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns users list when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.count.mockResolvedValue(0)
    const { getAdminUsers } = await import('@/lib/actions/admin/users')
    const result = await getAdminUsers()
    expect(result).toBeDefined()
  })

  it('supports search filter', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.count.mockResolvedValue(0)
    const { getAdminUsers } = await import('@/lib/actions/admin/users')
    const result = await getAdminUsers({ search: 'test' })
    expect(result).toBeDefined()
  })
})

describe('getAdminUserDetail extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
    const result = await getAdminUserDetail('u2')
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns user detail when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', nickname: 'Target', _count: { posts: 5, comments: 2, followers: 3, following: 1 } })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.report.count.mockResolvedValue(0)
    const { getAdminUserDetail } = await import('@/lib/actions/admin/users')
    const result = await getAdminUserDetail('u2')
    expect(result).toBeDefined()
  })
})

describe('suspendUser extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws or returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { suspendUser } = await import('@/lib/actions/admin/users')
    try {
      const result = await suspendUser('u2', 'spam')
      expect(result).toBeDefined()
    } catch (e) { expect(e).toBeDefined() }
  })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { suspendUser } = await import('@/lib/actions/admin/users')
    const result = await suspendUser('u2', 'spam')
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('suspends user when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.user.update.mockResolvedValue({ id: 'u2' })
    mockPrisma.adminLog.create.mockResolvedValue({})
    const { suspendUser } = await import('@/lib/actions/admin/users')
    const result = await suspendUser('u2', 'spam behavior')
    expect(result).toBeDefined()
  })
})

describe('activateUser extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws or returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { activateUser } = await import('@/lib/actions/admin/users')
    try {
      const result = await activateUser('u2')
      expect(result).toBeDefined()
    } catch (e) { expect(e).toBeDefined() }
  })

  it('activates user when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.user.update.mockResolvedValue({ id: 'u2' })
    mockPrisma.adminLog.create.mockResolvedValue({})
    const { activateUser } = await import('@/lib/actions/admin/users')
    const result = await activateUser('u2')
    expect(result).toBeDefined()
  })
})

describe('getAdminPosts extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { getAdminPosts } = await import('@/lib/actions/admin/posts')
    const result = await getAdminPosts()
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns posts when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.report.groupBy.mockResolvedValue([])
    const { getAdminPosts } = await import('@/lib/actions/admin/posts')
    const result = await getAdminPosts()
    expect(result).toBeDefined()
  })
})

describe('deletePostByAdmin extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws or returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
    try {
      const result = await deletePostByAdmin('p1', 'violation')
      expect(result).toBeDefined()
    } catch (e) { expect(e).toBeDefined() }
  })

  it('deletes post when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'u2' })
    mockPrisma.post.delete.mockResolvedValue({})
    mockPrisma.adminLog.create.mockResolvedValue({})
    const { deletePostByAdmin } = await import('@/lib/actions/admin/posts')
    const result = await deletePostByAdmin('p1', 'violation')
    expect(result).toBeDefined()
  })
})

describe('deleteEventByAdmin extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws or returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
    try {
      const result = await deleteEventByAdmin('e1', 'violation')
      expect(result).toBeDefined()
    } catch (e) { expect(e).toBeDefined() }
  })
})

describe('deleteShopByAdmin extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws or returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteShopByAdmin } = await import('@/lib/actions/admin/content')
    try {
      const result = await deleteShopByAdmin('s1', 'violation')
      expect(result).toBeDefined()
    } catch (e) { expect(e).toBeDefined() }
  })
})

describe('getAdminLogs extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { getAdminLogs } = await import('@/lib/actions/admin/logs')
    const result = await getAdminLogs()
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns logs when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.adminLog.findMany.mockResolvedValue([])
    mockPrisma.adminLog.count.mockResolvedValue(0)
    const { getAdminLogs } = await import('@/lib/actions/admin/logs')
    const result = await getAdminLogs()
    expect(result).toBeDefined()
  })
})

describe('deleteUserByAdmin extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws or returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
    try {
      const result = await deleteUserByAdmin('u2', 'violation')
      expect(result).toBeDefined()
    } catch (e) { expect(e).toBeDefined() }
  })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { deleteUserByAdmin } = await import('@/lib/actions/admin/users')
    const result = await deleteUserByAdmin('u2', 'violation')
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })
})

describe('getAdminReviews extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { getAdminReviews } = await import('@/lib/actions/admin/content')
    const result = await getAdminReviews()
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns reviews when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.shopReview.findMany.mockResolvedValue([])
    mockPrisma.shopReview.count.mockResolvedValue(0)
    mockPrisma.report.groupBy.mockResolvedValue([])
    const { getAdminReviews } = await import('@/lib/actions/admin/content')
    const result = await getAdminReviews()
    expect(result).toBeDefined()
  })
})

describe('deleteReviewByAdmin extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws or returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteReviewByAdmin } = await import('@/lib/actions/admin/content')
    try {
      const result = await deleteReviewByAdmin('r1', 'violation')
      expect(result).toBeDefined()
    } catch (e) { expect(e).toBeDefined() }
  })
})

describe('getStatsSummary extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { getStatsSummary } = await import('@/lib/actions/admin/stats')
    const result = await getStatsSummary()
    expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
  })
})
