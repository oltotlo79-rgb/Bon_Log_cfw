// @vitest-environment node

/**
 * utils.ts - remaining uncovered branches:
 *
 * - Line 239: fetchUserRelationSetsFromDb mapping (followingUserIds, blockedUserIds, mutedUserIds)
 *   This is already partially covered but may need unique cache keys to bypass React.cache memoization.
 *
 * - Lines 257-260: getUserRelationSets typeof cached === 'string' vs object branch
 *   Already tested in utils-branches but may need unique userId to bypass cache().
 *
 * - getGuestUserId: the unstable_cache wrapped function (lines 296-306)
 *   The null-coalescing fallback (guest?.id ?? null) needs both branches tested.
 */

import { vi } from 'vitest'

export {}

const mockPrisma: Record<string, Record<string, any>> = {
  user: { findUnique: vi.fn() },
  follow: { findMany: vi.fn() },
  block: { findMany: vi.fn() },
  mute: { findMany: vi.fn() },
  userHiddenPost: { findMany: vi.fn() },
  like: { findMany: vi.fn() },
  bookmark: { findMany: vi.fn() },
  post: { count: vi.fn() },
  adminUser: { findUnique: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockHeadersGet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockHeadersGet(...args),
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { post: {}, comment: {} },
}))

const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}
vi.mock('@/lib/redis', () => ({
  getRedisClient: () => mockRedis,
}))

vi.mock('@/lib/premium', () => ({
  getMembershipLimits: vi.fn().mockResolvedValue({ maxDailyPosts: 20 }),
}))

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

describe('getGuestUserId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns guest user ID when guest exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'guest-id-123' })
    const { getGuestUserId } = await import('@/lib/actions/utils')
    const result = await getGuestUserId()
    expect(result).toBe('guest-id-123')
  })

  it('returns null when guest user does not exist', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { getGuestUserId } = await import('@/lib/actions/utils')
    const result = await getGuestUserId()
    expect(result).toBeNull()
  })
})

describe('getUserRelationSets - unique keys to ensure DB fetch path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches from DB when Redis returns null and maps all three relation types', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockPrisma.follow.findMany.mockResolvedValue([
      { followingId: 'f1' },
      { followingId: 'f2' },
    ])
    mockPrisma.block.findMany.mockResolvedValue([
      { blockedId: 'b1' },
    ])
    mockPrisma.mute.findMany.mockResolvedValue([
      { mutedId: 'm1' },
      { mutedId: 'm2' },
      { mutedId: 'm3' },
    ])
    mockPrisma.userHiddenPost.findMany.mockResolvedValue([
      { postId: 'hp1' },
    ])

    const { getUserRelationSets } = await import('@/lib/actions/utils')
    // Use a unique userId to avoid React.cache memoization from other tests
    const result = await getUserRelationSets('unique-db-fetch-user')

    expect(result.followingUserIds).toEqual(['f1', 'f2'])
    expect(result.blockedUserIds).toEqual(['b1'])
    expect(result.mutedUserIds).toEqual(['m1', 'm2', 'm3'])
    expect(result.hiddenPostIds).toEqual(['hp1'])

    // Verify Redis was checked first
    expect(mockRedis.get).toHaveBeenCalledWith('relations:unique-db-fetch-user')
    // Verify result was cached back to Redis
    expect(mockRedis.set).toHaveBeenCalledWith(
      'relations:unique-db-fetch-user',
      JSON.stringify(result),
      expect.objectContaining({ ex: expect.any(Number) })
    )
  })

  it('returns empty arrays when user has no relations', async () => {
    mockRedis.get.mockResolvedValue(null)
    mockPrisma.follow.findMany.mockResolvedValue([])
    mockPrisma.block.findMany.mockResolvedValue([])
    mockPrisma.mute.findMany.mockResolvedValue([])
    mockPrisma.userHiddenPost.findMany.mockResolvedValue([])

    const { getUserRelationSets } = await import('@/lib/actions/utils')
    const result = await getUserRelationSets('unique-empty-user')

    expect(result.followingUserIds).toEqual([])
    expect(result.blockedUserIds).toEqual([])
    expect(result.mutedUserIds).toEqual([])
    expect(result.hiddenPostIds).toEqual([])
  })
})

describe('getPostInteractionSets - null postId filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters out null postIds from liked posts', async () => {
    mockPrisma.like.findMany.mockResolvedValue([
      { postId: 'p1' },
      { postId: null },
      { postId: 'p2' },
    ])
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const { getPostInteractionSets } = await import('@/lib/actions/utils')
    const result = await getPostInteractionSets('user-x', ['p1', 'p2'])

    expect(result.likedSet.size).toBe(2)
    expect(result.likedSet.has('p1')).toBe(true)
    expect(result.likedSet.has('p2')).toBe(true)
  })
})
