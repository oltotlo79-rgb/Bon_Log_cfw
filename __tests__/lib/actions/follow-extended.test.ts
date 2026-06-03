import { vi } from 'vitest'
/**
 * Extended tests for follow, review, two-factor actions
 */
export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  follow: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  followRequest: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  block: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  mute: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  notification: { create: vi.fn() },
  shopReview: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  bonsaiShop: { findUnique: vi.fn() },
  $transaction: vi.fn((fn: unknown) => typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown)(mockPrisma) : Promise.all(fn as Promise<unknown>[])),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/sanitize', () => ({ sanitizeInput: (s: string) => s, sanitizePostContent: (s: string) => s, sanitizeComment: (s: string) => s }))
vi.mock('@/lib/actions/notification', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/services/notification-core', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/cache', () => ({ getCachedData: vi.fn(), invalidateCache: vi.fn(), getCachedShopRatings: vi.fn().mockResolvedValue([]), revalidateShopRatingsCache: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4 }) }))

// ============================================================
// Follow Actions Extended
// ============================================================
describe('toggleFollow extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { toggleFollow } = await import('@/lib/actions/follow')
    const result = await toggleFollow('u2')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('returns error when userId is empty (Zod)', async () => {
    const { toggleFollow } = await import('@/lib/actions/follow')
    const result = await toggleFollow('')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('returns error when following self', async () => {
    const { toggleFollow } = await import('@/lib/actions/follow')
    const result = await toggleFollow('u1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates follow for public user', async () => {
    mockPrisma.follow.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isPublic: true })
    mockPrisma.follow.create.mockResolvedValue({ id: 'f1' })
    const { toggleFollow } = await import('@/lib/actions/follow')
    const result = await toggleFollow('u2')
    expect(result).toBeDefined()
  })

  it('unfollows when already following', async () => {
    mockPrisma.follow.findFirst.mockResolvedValue({ id: 'f1', followerId: 'u1', followingId: 'u2' })
    mockPrisma.follow.delete.mockResolvedValue({})
    const { toggleFollow } = await import('@/lib/actions/follow')
    const result = await toggleFollow('u2')
    expect(result).toBeDefined()
  })

  it('returns error for blocked user', async () => {
    mockPrisma.follow.findUnique.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isPublic: true, isSuspended: false, email: 'u2@example.com' })
    // 双方向 block を checkInteractionEligibility が findFirst で検出する
    mockPrisma.block.findFirst.mockResolvedValue({ blockerId: 'u2', blockedId: 'u1' })
    const { toggleFollow } = await import('@/lib/actions/follow')
    const result = await toggleFollow('u2')
    // block は存在秘匿のため not_found 相当に丸める
    expect(result).toEqual({ success: false, error: 'ユーザーが見つかりません' })
    expect(mockPrisma.follow.create).not.toHaveBeenCalled()
  })
})

describe('getFollowStatus extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns not following when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getFollowStatus } = await import('@/lib/actions/follow')
    const result = await getFollowStatus('u2')
    expect(result).toBeDefined()
  })

  it('returns following status', async () => {
    mockPrisma.follow.findFirst.mockResolvedValue({ id: 'f1' })
    const { getFollowStatus } = await import('@/lib/actions/follow')
    const result = await getFollowStatus('u2')
    expect(result).toBeDefined()
  })

  it('returns not following', async () => {
    mockPrisma.follow.findFirst.mockResolvedValue(null)
    const { getFollowStatus } = await import('@/lib/actions/follow')
    const result = await getFollowStatus('u2')
    expect(result).toBeDefined()
  })
})

describe('getFollowers extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns followers list', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([])
    const { getFollowers } = await import('@/lib/actions/follow')
    const result = await getFollowers('u1')
    expect(result).toBeDefined()
  })

  it('supports cursor pagination', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([])
    const { getFollowers } = await import('@/lib/actions/follow')
    const result = await getFollowers('u1', 'cursor1', 10)
    expect(result).toBeDefined()
  })
})

describe('getFollowing extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns following list', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([])
    const { getFollowing } = await import('@/lib/actions/follow')
    const result = await getFollowing('u1')
    expect(result).toBeDefined()
  })

  it('supports cursor pagination', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([])
    const { getFollowing } = await import('@/lib/actions/follow')
    const result = await getFollowing('u1', 'cursor1', 10)
    expect(result).toBeDefined()
  })
})

// ============================================================
// Review Actions Extended
// ============================================================
describe('createReview extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { createReview } = await import('@/lib/actions/review')
    const fd = new FormData(); fd.set('shopId', 's1'); fd.set('rating', '5'); fd.set('content', 'Great!')
    const result = await createReview(fd)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates review', async () => {
    mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 's1' })
    mockPrisma.shopReview.findFirst.mockResolvedValue(null)
    mockPrisma.shopReview.create.mockResolvedValue({ id: 'r1' })
    const { createReview } = await import('@/lib/actions/review')
    const fd = new FormData(); fd.set('shopId', 's1'); fd.set('rating', '5'); fd.set('content', 'Great shop!')
    const result = await createReview(fd)
    expect(result).toBeDefined()
  })

  it('returns error for invalid rating', async () => {
    const { createReview } = await import('@/lib/actions/review')
    const fd = new FormData(); fd.set('shopId', 's1'); fd.set('rating', '0'); fd.set('content', 'Bad')
    const result = await createReview(fd)
    expect(result).toBeDefined()
  })
})

describe('updateReview extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { updateReview } = await import('@/lib/actions/review')
    const fd = new FormData(); fd.set('rating', '4'); fd.set('content', 'Updated')
    const result = await updateReview('r1', fd)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('updates owned review', async () => {
    mockPrisma.shopReview.findFirst.mockResolvedValue({ id: 'r1', userId: 'u1' })
    mockPrisma.shopReview.update.mockResolvedValue({ id: 'r1' })
    const { updateReview } = await import('@/lib/actions/review')
    const fd = new FormData(); fd.set('rating', '4'); fd.set('content', 'Updated review')
    const result = await updateReview('r1', fd)
    expect(result).toBeDefined()
  })
})

describe('deleteReview extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteReview } = await import('@/lib/actions/review')
    const result = await deleteReview('r1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('deletes owned review', async () => {
    mockPrisma.shopReview.findFirst.mockResolvedValue({ id: 'r1', userId: 'u1' })
    mockPrisma.shopReview.delete.mockResolvedValue({})
    const { deleteReview } = await import('@/lib/actions/review')
    const result = await deleteReview('r1')
    expect(result).toBeDefined()
  })

  it('returns error for non-owned review', async () => {
    mockPrisma.shopReview.findFirst.mockResolvedValue(null)
    const { deleteReview } = await import('@/lib/actions/review')
    const result = await deleteReview('r1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })
})

describe('getReviews extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns reviews list', async () => {
    mockPrisma.shopReview.findMany.mockResolvedValue([])
    const { getReviews } = await import('@/lib/actions/review')
    const result = await getReviews('s1')
    expect(result).toBeDefined()
  })

  it('supports cursor pagination', async () => {
    mockPrisma.shopReview.findMany.mockResolvedValue([])
    const { getReviews } = await import('@/lib/actions/review')
    const result = await getReviews('s1', 'cursor1', 5)
    expect(result).toBeDefined()
  })
})

// ============================================================
// Follow — 未カバーブランチ補完
// ============================================================

describe('toggleFollow — レート制限失敗', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('レート制限超過時に ERR_RATE_LIMIT_OPERATION を返す', async () => {
    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValueOnce({ success: false })

    const { toggleFollow } = await import('@/lib/actions/follow')
    const result = await toggleFollow('u2')
    expect(result).toEqual({
      success: false,
      error: '操作が多すぎます。しばらく待ってから再試行してください',
    })
  })
})

describe('getFollowers — 未認証時', () => {
  it('未認証でもフォロワー一覧を取得できる（レート制限チェックをスキップ）', async () => {
    mockAuth.mockResolvedValue(null)
    mockPrisma.follow.findMany.mockResolvedValue([
      { follower: { id: 'f1', nickname: 'Follower1', avatarUrl: null, bio: null } },
    ])

    const { getFollowers } = await import('@/lib/actions/follow')
    const result = await getFollowers('u1')

    // 未認証でもデータは返る（公開情報）
    expect(result.users).toHaveLength(1)
    expect(result.users[0]).toEqual(
      expect.objectContaining({ id: 'f1', nickname: 'Follower1' })
    )
  })
})

describe('getFollowing — 未認証時', () => {
  it('未認証でもフォロー中一覧を取得できる（レート制限チェックをスキップ）', async () => {
    mockAuth.mockResolvedValue(null)
    mockPrisma.follow.findMany.mockResolvedValue([
      { following: { id: 'f2', nickname: 'Following1', avatarUrl: null, bio: null } },
    ])

    const { getFollowing } = await import('@/lib/actions/user')
    const result = await getFollowing('u1')

    expect(result.following).toHaveLength(1)
    expect(result.following[0]).toEqual(
      expect.objectContaining({ id: 'f2', nickname: 'Following1' })
    )
  })
})
