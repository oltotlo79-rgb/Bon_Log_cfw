import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma: Record<string, any> = {
  adminUser: { findUnique: vi.fn() },
  user: { count: vi.fn(), findUnique: vi.fn() },
  post: { count: vi.fn() },
  comment: { count: vi.fn() },
  report: { count: vi.fn() },
  event: { count: vi.fn() },
  bonsaiShop: { count: vi.fn() },
  $queryRaw: vi.fn(),
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

describe('getAdminStats', async () => {
  const { getAdminStats } = await import('@/lib/actions/admin/stats')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getAdminStats()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await getAdminStats()
    expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
  })

  it('returns all stats when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    // user.count called multiple times: totalUsers, todayUsers, activeUsersWeek
    mockPrisma.user.count
      .mockResolvedValueOnce(1000) // totalUsers
      .mockResolvedValueOnce(10)   // todayUsers
      .mockResolvedValueOnce(200)  // activeUsersWeek
    mockPrisma.post.count
      .mockResolvedValueOnce(5000) // totalPosts
      .mockResolvedValueOnce(50)   // todayPosts
    mockPrisma.report.count.mockResolvedValue(5)
    mockPrisma.event.count.mockResolvedValue(80)
    mockPrisma.bonsaiShop.count.mockResolvedValue(30)

    const result = await getAdminStats()
    expect(result).toEqual({
      success: true,
      data: {
        totalUsers: 1000,
        todayUsers: 10,
        totalPosts: 5000,
        todayPosts: 50,
        pendingReports: 5,
        totalEvents: 80,
        totalShops: 30,
        activeUsersWeek: 200,
      },
    })
  })

  it('returns zeros when counts are all 0', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.count.mockResolvedValue(0)
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.report.count.mockResolvedValue(0)
    mockPrisma.event.count.mockResolvedValue(0)
    mockPrisma.bonsaiShop.count.mockResolvedValue(0)

    const result = await getAdminStats()
    expect(result).toEqual({
      success: true,
      data: {
        totalUsers: 0,
        todayUsers: 0,
        totalPosts: 0,
        todayPosts: 0,
        pendingReports: 0,
        totalEvents: 0,
        totalShops: 0,
        activeUsersWeek: 0,
      },
    })
  })
})

describe('getDailyActiveUsers', async () => {
  const { getDailyActiveUsers } = await import('@/lib/actions/admin/stats')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getDailyActiveUsers()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await getDailyActiveUsers()
    expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
  })

  it('returns active user count when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.count.mockResolvedValue(42)

    const result = await getDailyActiveUsers()
    expect(result).toEqual({ success: true, data: 42 })
  })

  it('returns 0 when no active users', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.count.mockResolvedValue(0)

    const result = await getDailyActiveUsers()
    expect(result).toEqual({ success: true, data: 0 })
  })
})

describe('getStatsHistory', async () => {
  const { getStatsHistory } = await import('@/lib/actions/admin/stats')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getStatsHistory()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await getStatsHistory()
    expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
  })

  it('returns history data when admin with default days', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    // $queryRaw called 3 times: dailyPosts, dailyComments, dailyNewUsers
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([]) // dailyPosts
      .mockResolvedValueOnce([]) // dailyComments
      .mockResolvedValueOnce([]) // dailyNewUsers
    mockPrisma.user.count.mockResolvedValue(100) // totalUsersBeforeStart

    const result = await getStatsHistory()
    if (!result.success || !result.data) throw new Error('expected data')
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data.length).toBe(30) // DEFAULT_ANALYTICS_DAYS
    const first = result.data[0]
    expect(first).toHaveProperty('date')
    expect(first).toHaveProperty('users')
    expect(first).toHaveProperty('posts')
    expect(first).toHaveProperty('comments')
  })

  it('returns history data for custom days', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.$queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    mockPrisma.user.count.mockResolvedValue(50)

    const result = await getStatsHistory(7)
    if (!result.success || !result.data) throw new Error('expected data')
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data.length).toBe(7)
  })

  it('accumulates new users in cumulative count', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayKey = today.toISOString().split('T')[0]

    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ date: today, count: BigInt(5) }]) // dailyPosts for today
      .mockResolvedValueOnce([]) // dailyComments
      .mockResolvedValueOnce([{ date: today, count: BigInt(3) }]) // dailyNewUsers for today
    mockPrisma.user.count.mockResolvedValue(100) // baseline before period

    const result = await getStatsHistory(1)
    if (!result.success || !result.data) throw new Error('expected data')
    expect(Array.isArray(result.data)).toBe(true)
    const entry = result.data[0]
    expect(entry?.date).toBe(todayKey)
    expect(entry?.posts).toBe(5)
    expect(entry?.users).toBe(103) // 100 baseline + 3 new
  })
})

describe('getDailyVisitorsHistory', async () => {
  const { getDailyVisitorsHistory } = await import('@/lib/actions/admin/stats')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getDailyVisitorsHistory()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await getDailyVisitorsHistory()
    expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
  })

  it('returns 30-day array with zeros when no visitors', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.$queryRaw.mockResolvedValueOnce([])

    const result = await getDailyVisitorsHistory()
    if (!result.success || !result.data) throw new Error('expected data')
    expect(Array.isArray(result.data)).toBe(true)
    expect(result.data.length).toBe(30)
    expect(result.data.every((r) => r.visitors === 0)).toBe(true)
    expect(result.data.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))).toBe(true)
  })

  it('returns custom-day array with mapped visitor rows', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })

    // ループは UTC 起点なので、UTC 当日キーでマッチさせる
    const now = new Date()
    const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
    const todayKey = todayUtc.toISOString().split('T')[0]

    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { date: todayUtc, visitors: BigInt(7) },
    ])

    const result = await getDailyVisitorsHistory(3)
    if (!result.success || !result.data) throw new Error('expected data')
    expect(result.data.length).toBe(3)
    const todayEntry = result.data.find((r) => r.date === todayKey)
    expect(todayEntry).toBeDefined()
    expect(todayEntry?.visitors).toBe(7)
    // 他の 2 日は 0 のまま
    expect(result.data.filter((r) => r.visitors === 0).length).toBe(2)
  })

  it('returns actionError when query throws', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('DB error'))

    const result = await getDailyVisitorsHistory()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })
})

describe('getStatsSummary', async () => {
  const { getStatsSummary } = await import('@/lib/actions/admin/stats')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getStatsSummary()
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await getStatsSummary()
    expect(result).toMatchObject({ success: false, error: '管理者権限が必要です' })
  })

  it('returns summary with correct structure when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    // 12 count calls: user (4) + post (4) + comment (4)
    mockPrisma.user.count
      .mockResolvedValueOnce(1000) // total
      .mockResolvedValueOnce(10)   // today
      .mockResolvedValueOnce(70)   // week
      .mockResolvedValueOnce(300)  // month
    mockPrisma.post.count
      .mockResolvedValueOnce(5000) // total
      .mockResolvedValueOnce(50)   // today
      .mockResolvedValueOnce(350)  // week
      .mockResolvedValueOnce(1500) // month
    mockPrisma.comment.count
      .mockResolvedValueOnce(15000) // total
      .mockResolvedValueOnce(150)   // today
      .mockResolvedValueOnce(1000)  // week
      .mockResolvedValueOnce(4000)  // month

    const result = await getStatsSummary()
    expect(result).toEqual({
      success: true,
      data: {
        users: { total: 1000, today: 10, week: 70, month: 300 },
        posts: { total: 5000, today: 50, week: 350, month: 1500 },
        comments: { total: 15000, today: 150, week: 1000, month: 4000 },
      },
    })
  })

  it('returns zeros for all fields when no data', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.user.count.mockResolvedValue(0)
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.comment.count.mockResolvedValue(0)

    const result = await getStatsSummary()
    expect(result).toEqual({
      success: true,
      data: {
        users: { total: 0, today: 0, week: 0, month: 0 },
        posts: { total: 0, today: 0, week: 0, month: 0 },
        comments: { total: 0, today: 0, week: 0, month: 0 },
      },
    })
  })
})
