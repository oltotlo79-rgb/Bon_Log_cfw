import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma: Record<string, any> = {
  adminUser: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  adminLog: { create: vi.fn() },
  payment: { aggregate: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))
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
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }),
}))

const mockAuth = vi.fn()

describe('grantPremium', async () => {
  const { grantPremium } = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await grantPremium('user-1')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await grantPremium('user-1')
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns error when target user not found', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const result = await grantPremium('nonexistent')
    expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
  })

  it('grants premium with default 30 days', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', nickname: 'TestUser' })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', isPremium: true })
    mockPrisma.adminLog.create.mockResolvedValue({})

    const result = await grantPremium('user-1')
    expect(result).toMatchObject({ success: true, data: { expiresAt: expect.any(Date) } })

    const expiresAt = (result.success && result.data ? result.data.expiresAt : new Date(0))
    const now = new Date()
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    // Approximate check: expiresAt is roughly 30 days from now
    expect(expiresAt.getTime()).toBeGreaterThan(now.getTime())
    expect(expiresAt.getTime()).toBeLessThanOrEqual(thirtyDaysFromNow.getTime() + 1000)
  })

  it('grants premium with custom duration', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', nickname: 'TestUser' })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', isPremium: true })
    mockPrisma.adminLog.create.mockResolvedValue({})

    const result = await grantPremium('user-1', 365)
    expect(result).toMatchObject({ success: true, data: { expiresAt: expect.any(Date) } })

    const expiresAt = (result.success && result.data ? result.data.expiresAt : new Date(0))
    const expectedExpiry = new Date()
    expectedExpiry.setDate(expectedExpiry.getDate() + 365)
    // Should be roughly 365 days from now (within a few seconds tolerance)
    expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(5000)
  })

  it('calls user.update with isPremium true', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', nickname: 'TestUser' })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', isPremium: true })
    mockPrisma.adminLog.create.mockResolvedValue({})

    await grantPremium('user-1', 30)
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ isPremium: true }),
      })
    )
  })

  it('creates admin log entry', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', nickname: 'TestUser' })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', isPremium: true })
    mockPrisma.adminLog.create.mockResolvedValue({})

    await grantPremium('user-1', 30)
    expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'grant_premium',
          targetType: 'user',
          targetId: 'user-1',
        }),
      })
    )
  })
})

describe('revokePremium', async () => {
  const { revokePremium } = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await revokePremium('user-1')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await revokePremium('user-1')
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns error when user not found', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const result = await revokePremium('nonexistent')
    expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
  })

  it('returns error when user is not premium', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: false })
    const result = await revokePremium('user-1')
    expect(result).toMatchObject({ error: 'このユーザーは有料会員ではありません' })
  })

  it('revokes premium successfully', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: true })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', isPremium: false })
    mockPrisma.adminLog.create.mockResolvedValue({})

    const result = await revokePremium('user-1')
    expect(result).toMatchObject({ success: true })
  })

  it('sets isPremium false and premiumExpiresAt null', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: true })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', isPremium: false })
    mockPrisma.adminLog.create.mockResolvedValue({})

    await revokePremium('user-1')
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isPremium: false, premiumExpiresAt: null }),
      })
    )
  })

  it('creates admin log with revoke_premium action', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: true })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1', isPremium: false })
    mockPrisma.adminLog.create.mockResolvedValue({})

    await revokePremium('user-1')
    expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'revoke_premium' }),
      })
    )
  })
})

describe('extendPremium', async () => {
  const { extendPremium } = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await extendPremium('user-1', 30)
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await extendPremium('user-1', 30)
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns error when user not found', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const result = await extendPremium('nonexistent', 30)
    expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
  })

  it('extends from current expiry when not expired', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 10)
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: true, premiumExpiresAt: futureDate })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1' })
    mockPrisma.adminLog.create.mockResolvedValue({})

    const result = await extendPremium('user-1', 30)
    expect(result).toMatchObject({ success: true, data: { newExpiresAt: expect.any(Date) } })

    const newExpiresAt = (result.success && result.data ? result.data.newExpiresAt : new Date(0))
    // Should be futureDate + 30 days
    const expected = new Date(futureDate)
    expected.setDate(expected.getDate() + 30)
    expect(Math.abs(newExpiresAt.getTime() - expected.getTime())).toBeLessThan(1000)
  })

  it('extends from now when premium is expired', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 5) // expired 5 days ago
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: false, premiumExpiresAt: pastDate })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1' })
    mockPrisma.adminLog.create.mockResolvedValue({})

    const before = new Date()
    const result = await extendPremium('user-1', 30)
    const after = new Date()

    expect(result).toMatchObject({ success: true, data: { newExpiresAt: expect.any(Date) } })
    const newExpiresAt = (result.success && result.data ? result.data.newExpiresAt : new Date(0))
    const expectedMin = new Date(before)
    expectedMin.setDate(expectedMin.getDate() + 30)
    const expectedMax = new Date(after)
    expectedMax.setDate(expectedMax.getDate() + 30)
    expect(newExpiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin.getTime() - 1000)
    expect(newExpiresAt.getTime()).toBeLessThanOrEqual(expectedMax.getTime() + 1000)
  })

  it('extends from now when premiumExpiresAt is null', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: false, premiumExpiresAt: null })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1' })
    mockPrisma.adminLog.create.mockResolvedValue({})

    const result = await extendPremium('user-1', 7)
    expect(result).toMatchObject({ success: true })
  })

  it('creates admin log with extend_premium action', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: true, premiumExpiresAt: null })
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1' })
    mockPrisma.adminLog.create.mockResolvedValue({})

    await extendPremium('user-1', 30)
    expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'extend_premium' }),
      })
    )
  })
})

describe('getPremiumUsers', async () => {
  const { getPremiumUsers } = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getPremiumUsers()
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await getPremiumUsers()
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns premium users list when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    const premiumUsers = [
      {
        id: 'user-1',
        email: 'user1@example.com',
        nickname: 'User1',
        avatarUrl: null,
        isPremium: true,
        premiumExpiresAt: new Date(),
        stripeSubscriptionId: null,
        createdAt: new Date(),
      },
    ]
    mockPrisma.user.findMany.mockResolvedValue(premiumUsers)
    mockPrisma.user.count.mockResolvedValue(1)

    const result = await getPremiumUsers()
    expect(result).toEqual({ users: premiumUsers, total: 1 })
  })

  it('returns empty list when no premium users', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.count.mockResolvedValue(0)

    const result = await getPremiumUsers()
    expect(result).toEqual({ users: [], total: 0 })
  })

  it('filters by search query', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.count.mockResolvedValue(0)

    await getPremiumUsers({ search: 'testuser' })
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isPremium: true,
          OR: expect.arrayContaining([
            expect.objectContaining({ email: expect.objectContaining({ contains: 'testuser' }) }),
          ]),
        }),
      })
    )
  })

  it('supports cursor pagination', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.user.count.mockResolvedValue(50)

    await getPremiumUsers({ limit: 10, cursor: 'premium-cursor' })
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, cursor: { id: 'premium-cursor' }, skip: 1 })
    )
  })
})

describe('getPremiumStats', async () => {
  const { getPremiumStats } = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getPremiumStats()
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await getPremiumStats()
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns premium stats when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.count
      .mockResolvedValueOnce(100) // totalPremiumUsers
      .mockResolvedValueOnce(5)   // expiringIn7Days
      .mockResolvedValueOnce(15)  // newThisMonth
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: 35000 } })

    const result = await getPremiumStats()
    expect(result).toEqual({
      totalPremiumUsers: 100,
      newThisMonth: 15,
      expiringIn7Days: 5,
      totalRevenue: 35000,
    })
  })

  it('returns 0 for totalRevenue when no payments', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.count.mockResolvedValue(0)
    mockPrisma.payment.aggregate.mockResolvedValue({ _sum: { amount: null } })

    const result = await getPremiumStats()
    expect((result as any).totalRevenue).toBe(0)
  })
})

describe('searchUserForPremium', async () => {
  const { searchUserForPremium } = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await searchUserForPremium('test')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await searchUserForPremium('test')
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns empty users for query shorter than min length', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    // MIN_ADMIN_SEARCH_QUERY_LENGTH = 2, so query of 1 char returns empty
    const result = await searchUserForPremium('a')
    expect(result).toEqual({ users: [] })
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it('returns empty users for empty query', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    const result = await searchUserForPremium('')
    expect(result).toEqual({ users: [] })
  })

  it('searches users by email and nickname for valid query', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    const users = [
      {
        id: 'user-1',
        email: 'test@example.com',
        nickname: 'TestUser',
        avatarUrl: null,
        isPremium: false,
        premiumExpiresAt: null,
      },
    ]
    mockPrisma.user.findMany.mockResolvedValue(users)

    const result = await searchUserForPremium('test')
    expect(result).toEqual({ users })
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { email: { contains: 'test', mode: 'insensitive' } },
            { nickname: { contains: 'test', mode: 'insensitive' } },
          ],
        },
      })
    )
  })

  it('returns empty array when no matching users', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findMany.mockResolvedValue([])

    const result = await searchUserForPremium('zzznomatch')
    expect(result).toEqual({ users: [] })
  })
})

// ============================================================
// toggleAdminPremium / getAdminPremiumStatus（管理者自身用）
// ============================================================

describe('toggleAdminPremium', async () => {
  const { toggleAdminPremium } = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await toggleAdminPremium()
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when admin user record not found', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const result = await toggleAdminPremium()
    expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
  })

  it('OFF → ON: isPremium=false の管理者を ON に切替え grant_premium ログを残す', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-user-id', isPremium: false })
    mockPrisma.user.update.mockResolvedValue({})
    mockPrisma.adminLog.create.mockResolvedValue({})

    const result = await toggleAdminPremium()
    expect(result).toMatchObject({ success: true, data: { isPremium: true } })

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'admin-user-id' },
      data: { isPremium: true, premiumExpiresAt: null },
    })
    expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'grant_premium',
        details: { selfToggle: true, newState: true },
      }),
    })
  })

  it('ON → OFF: isPremium=true の管理者を OFF に切替え revoke_premium ログを残す', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'admin-user-id', isPremium: true })
    mockPrisma.user.update.mockResolvedValue({})
    mockPrisma.adminLog.create.mockResolvedValue({})

    const result = await toggleAdminPremium()
    expect(result).toMatchObject({ success: true, data: { isPremium: false } })

    expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'revoke_premium',
        details: { selfToggle: true, newState: false },
      }),
    })
  })

  it('Prisma 例外時は ERR_OPERATION_FAILED を返す', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ isSuspended: false }) // requireAdmin suspension チェック
      .mockRejectedValueOnce(new Error('DB down')) // toggleAdminPremium 本体の user 取得が throw
    const result = await toggleAdminPremium()
    expect(result).toMatchObject({ error: expect.any(String) })
    expect(result.success).toBe(false)
  })
})

describe('getAdminPremiumStatus', async () => {
  const { getAdminPremiumStatus } = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('未認証 / 非管理者ならエラーを返す', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await getAdminPremiumStatus()
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('管理者ユーザーが存在しないなら ERR_USER_NOT_FOUND', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const result = await getAdminPremiumStatus()
    expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
  })

  it('管理者の isPremium / premiumExpiresAt を返す', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    const expiresAt = new Date('2026-12-31')
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: true, premiumExpiresAt: expiresAt })
    const result = await getAdminPremiumStatus()
    expect(result).toEqual({ isPremium: true, premiumExpiresAt: expiresAt })
  })

  it('Prisma 例外時はデフォルト値（isPremium=false, premiumExpiresAt=null）を返す', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ isSuspended: false }) // requireAdmin suspension チェック
      .mockRejectedValueOnce(new Error('DB error')) // 本体の user 取得が throw
    const result = await getAdminPremiumStatus()
    expect(result).toEqual({ isPremium: false, premiumExpiresAt: null })
  })
})

// ============================================================
// catch ブランチ（既存関数のエラー経路）
// ============================================================

describe('admin/premium - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/premium')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
  })

  it('grantPremium: prisma.user.update が throw すると ERR_OPERATION_FAILED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1' })
    mockPrisma.user.update.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.grantPremium('u1')
    expect(result.success).toBe(false)
  })

  it('revokePremium: prisma.user.update が throw すると ERR_OPERATION_FAILED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: true })
    mockPrisma.user.update.mockRejectedValueOnce(new Error('x'))
    const result = await mod.revokePremium('u1')
    expect(result.success).toBe(false)
  })

  it('extendPremium: prisma.user.update が throw すると ERR_OPERATION_FAILED', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ isPremium: true, premiumExpiresAt: new Date(Date.now() + 86400000) })
    mockPrisma.user.update.mockRejectedValueOnce(new Error('x'))
    const result = await mod.extendPremium('u1', 30)
    expect(result.success).toBe(false)
  })

  it('getPremiumUsers: Promise.all が throw するとデフォルト値（空配列+0）', async () => {
    mockPrisma.user.findMany.mockRejectedValueOnce(new Error('x'))
    mockPrisma.user.count.mockResolvedValue(0)
    const result = await mod.getPremiumUsers()
    expect(result).toMatchObject({ users: [], total: 0 })
  })

  it('getPremiumStats: prisma.user.count が throw するとデフォルト統計', async () => {
    mockPrisma.user.count.mockRejectedValueOnce(new Error('x'))
    const result = await mod.getPremiumStats()
    expect(result).toMatchObject({ totalPremiumUsers: 0, newThisMonth: 0, expiringIn7Days: 0, totalRevenue: 0 })
  })

  it('searchUserForPremium: prisma.user.findMany が throw すると空配列', async () => {
    mockPrisma.user.findMany.mockRejectedValueOnce(new Error('x'))
    const result = await mod.searchUserForPremium('valid-search')
    expect(result).toEqual({ users: [] })
  })
})
