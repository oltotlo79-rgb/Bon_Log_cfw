import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma: Record<string, any> = {
  user: { findUnique: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  event: { findUnique: vi.fn(), delete: vi.fn() },
  bonsaiShop: { findUnique: vi.fn(), delete: vi.fn() },
  shopReview: { findUnique: vi.fn(), delete: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  report: { findMany: vi.fn(), groupBy: vi.fn() },
  adminLog: { create: vi.fn() },
  $transaction: vi.fn((ops: unknown) =>
    typeof ops === 'function'
      ? (ops as (...args: unknown[]) => unknown)(mockPrisma)
      : Promise.all(ops as Promise<unknown>[])
  ),
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

describe('deleteEventByAdmin', async () => {
  const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await deleteEventByAdmin('event-1', 'violation')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await deleteEventByAdmin('event-1', 'violation')
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns error when event not found', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.event.findUnique.mockResolvedValue(null)
    const result = await deleteEventByAdmin('nonexistent', 'violation')
    expect(result).toMatchObject({ error: 'イベントが見つかりません' })
  })

  it('deletes event and logs when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', title: 'Test Event' })
    mockPrisma.$transaction.mockResolvedValue([{}, {}])

    const result = await deleteEventByAdmin('event-1', 'spam')
    expect(result).toMatchObject({ success: true })
  })

  it('passes reason to transaction', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', title: 'Test Event' })
    mockPrisma.$transaction.mockResolvedValue([{}, {}])

    await deleteEventByAdmin('event-1', 'test reason')
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })
})

describe('deleteShopByAdmin', async () => {
  const { deleteShopByAdmin } = await import('@/lib/actions/admin/content')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await deleteShopByAdmin('shop-1', 'violation')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await deleteShopByAdmin('shop-1', 'violation')
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns error when shop not found', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)
    const result = await deleteShopByAdmin('nonexistent', 'violation')
    expect(result).toMatchObject({ error: '盆栽園が見つかりません' })
  })

  it('deletes shop and logs when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-1', name: 'Test Shop' })
    mockPrisma.$transaction.mockResolvedValue([{}, {}])

    const result = await deleteShopByAdmin('shop-1', 'fake listing')
    expect(result).toMatchObject({ success: true })
  })
})

describe('getAdminReviews', async () => {
  const { getAdminReviews } = await import('@/lib/actions/admin/content')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await getAdminReviews()
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await getAdminReviews()
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns empty reviews list when admin and no reviews', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.shopReview.findMany.mockResolvedValue([])
    mockPrisma.shopReview.count.mockResolvedValue(0)
    mockPrisma.report.groupBy.mockResolvedValue([])

    const result = await getAdminReviews()
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data).toEqual({ reviews: [], total: 0, nextCursor: undefined })
  })

  it('returns reviews with report counts', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    const mockReviews = [
      {
        id: 'rev-1',
        content: 'Great shop',
        rating: 5,
        isHidden: false,
        createdAt: new Date(),
        user: { id: 'u1', nickname: 'User1', avatarUrl: null },
        shop: { id: 's1', name: 'Shop1' },
      },
    ]
    mockPrisma.shopReview.findMany.mockResolvedValue(mockReviews)
    mockPrisma.shopReview.count.mockResolvedValue(1)
    mockPrisma.report.groupBy.mockResolvedValue([
      { targetId: 'rev-1', _count: { targetId: 3 } },
    ])

    const result = await getAdminReviews()
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data!.total).toBe(1)
    expect(result.data!.reviews[0]!.reportCount).toBe(3)
  })

  it('filters reviews by search term', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.shopReview.findMany.mockResolvedValue([])
    mockPrisma.shopReview.count.mockResolvedValue(0)
    mockPrisma.report.groupBy.mockResolvedValue([])

    await getAdminReviews({ search: 'great' })
    expect(mockPrisma.shopReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ content: { contains: 'great' } }),
      })
    )
  })

  it('fetches reported review IDs when hasReports is true', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.report.findMany.mockResolvedValue([
      { targetId: 'rev-1' },
      { targetId: 'rev-2' },
    ])
    mockPrisma.shopReview.findMany.mockResolvedValue([])
    mockPrisma.shopReview.count.mockResolvedValue(0)
    mockPrisma.report.groupBy.mockResolvedValue([])

    await getAdminReviews({ hasReports: true })
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { targetType: 'review' } })
    )
  })

  it('supports sortBy rating with id as secondary tiebreaker', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.shopReview.findMany.mockResolvedValue([])
    mockPrisma.shopReview.count.mockResolvedValue(0)
    mockPrisma.report.groupBy.mockResolvedValue([])

    await getAdminReviews({ sortBy: 'rating', sortOrder: 'asc' })
    expect(mockPrisma.shopReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ rating: 'asc' }, { id: 'asc' }],
      })
    )
  })

  it('supports cursor pagination', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.shopReview.findMany.mockResolvedValue([])
    mockPrisma.shopReview.count.mockResolvedValue(100)
    mockPrisma.report.groupBy.mockResolvedValue([])

    await getAdminReviews({ limit: 10, cursor: 'rev-cursor' })
    expect(mockPrisma.shopReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, cursor: { id: 'rev-cursor' }, skip: 1 })
    )
  })

  it('returns 0 report count for reviews with no reports', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    const mockReviews = [
      {
        id: 'rev-no-reports',
        content: 'Nice',
        rating: 4,
        isHidden: false,
        createdAt: new Date(),
        user: { id: 'u1', nickname: 'User1', avatarUrl: null },
        shop: { id: 's1', name: 'Shop1' },
      },
    ]
    mockPrisma.shopReview.findMany.mockResolvedValue(mockReviews)
    mockPrisma.shopReview.count.mockResolvedValue(1)
    mockPrisma.report.groupBy.mockResolvedValue([]) // no reports

    const result = await getAdminReviews()
    expect(result.success).toBe(true)
    if (!result.success) throw new Error('expected success')
    expect(result.data!.reviews[0]!.reportCount).toBe(0)
  })
})

describe('deleteReviewByAdmin', async () => {
  const { deleteReviewByAdmin } = await import('@/lib/actions/admin/content')

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-user-id' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const result = await deleteReviewByAdmin('rev-1', 'violation')
    expect(result).toMatchObject({ error: expect.any(String) })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const result = await deleteReviewByAdmin('rev-1', 'violation')
    expect(result).toMatchObject({ error: '管理者権限が必要です' })
  })

  it('returns error when review not found', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.shopReview.findUnique.mockResolvedValue(null)
    const result = await deleteReviewByAdmin('nonexistent', 'violation')
    expect(result).toMatchObject({ error: 'レビューが見つかりません' })
  })

  it('deletes review and logs when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin-user-id', role: 'admin' })
    mockPrisma.shopReview.findUnique.mockResolvedValue({ id: 'rev-1', content: 'Bad review' })
    mockPrisma.$transaction.mockResolvedValue([{}, {}])

    const result = await deleteReviewByAdmin('rev-1', 'inappropriate content')
    expect(result).toMatchObject({ success: true })
  })
})
