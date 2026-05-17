// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/feed')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))

vi.mock('@/lib/actions/filter-helper', () => ({
  getExcludedUserIds: vi.fn().mockResolvedValue([]),
}))

const mockGetUserRelationSets = vi.fn().mockResolvedValue({
  followingUserIds: [],
  blockedUserIds: [],
  mutedUserIds: [],
  hiddenPostIds: [],
})
const mockGetGuestUserId = vi.fn().mockResolvedValue('guest-id')
vi.mock('@/lib/actions/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/actions/utils')>()
  return {
    ...actual,
    getUserRelationSets: (...args: unknown[]) => mockGetUserRelationSets(...args),
    getGuestUserId: (...args: unknown[]) => mockGetGuestUserId(...args),
  }
})

const mockGetCachedTrendingGenres = vi.fn()
vi.mock('@/lib/cache', () => ({
  getCachedTrendingGenres: (...args: unknown[]) => mockGetCachedTrendingGenres(...args),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))


/**
 * `ActionResult<T>` を旧フラット形状に展開する互換ヘルパー（feed 移行用）。
 * 成功時は data を展開し、失敗時は { error, posts: [], nextCursor: undefined, isGuest: false } を返す。
 * 旧テストの `result.posts` / `result.error` のいずれのスタイルも書き換えずに動作する。
 */
type FeedLegacyShape = {
  success?: boolean
  error?: string
  posts?: unknown[]
  nextCursor?: string
  isGuest?: boolean
}
function unwrap<T>(result: import('@/types/action-result').ActionResult<T>): (T extends object ? T : Record<string, never>) & FeedLegacyShape {
  if (result.success) {
    return { success: true, ...(result.data ?? {}) } as (T extends object ? T : Record<string, never>) & FeedLegacyShape
  }
  return {
    success: false,
    error: result.error,
    posts: [],
    nextCursor: undefined,
    isGuest: false,
  } as (T extends object ? T : Record<string, never>) & FeedLegacyShape
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  mockCheckUserRateLimit.mockResolvedValue({ success: true })
})

// ============================================================
// getTimeline
// ============================================================
describe('getTimeline', () => {
  const importModule = () => import('@/lib/actions/feed')

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getTimeline } = await importModule()
    const result = unwrap(await getTimeline())
    expect(result).toHaveProperty('error')
    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('returns posts for authenticated user', async () => {
    mockGetUserRelationSets.mockResolvedValue({ followingUserIds: ['u2'], blockedUserIds: [], mutedUserIds: [], hiddenPostIds: [] })
    const mockPost = {
      id: 'p1',
      userId: 'u2',
      content: 'Hello',
      createdAt: new Date(),
      user: { id: 'u2', nickname: 'User2', avatarUrl: null },
      media: [],
      genres: [{ genre: { id: 'g1', name: 'Pine' } }],
      _count: { likes: 3, comments: 1 },
      quotePost: null,
      repostPost: null,
    }
    mockPrisma.post.findMany.mockResolvedValue([mockPost])
    mockPrisma.like.findMany.mockResolvedValue([{ postId: 'p1' }])
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const { getTimeline } = await importModule()
    const result = unwrap(await getTimeline())

    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]).toHaveProperty('likeCount', 3)
    expect(result.posts[0]).toHaveProperty('commentCount', 1)
    expect(result.posts[0]).toHaveProperty('isLiked', true)
    expect(result.posts[0]).toHaveProperty('isBookmarked', false)
  })

  it('returns empty posts when no following', async () => {
    mockGetUserRelationSets.mockResolvedValue({ followingUserIds: [], blockedUserIds: [], mutedUserIds: [], hiddenPostIds: [] })
    mockPrisma.post.findMany.mockResolvedValue([])

    const { getTimeline } = await importModule()
    const result = unwrap(await getTimeline())

    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('supports cursor pagination', async () => {
    mockGetUserRelationSets.mockResolvedValue({ followingUserIds: ['u2'], blockedUserIds: [], mutedUserIds: [], hiddenPostIds: [] })
    const posts = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      userId: 'u2',
      content: `Post ${i}`,
      createdAt: new Date(),
      user: { id: 'u2', nickname: 'User2', avatarUrl: null },
      media: [],
      genres: [],
      _count: { likes: 0, comments: 0 },
      quotePost: null,
      repostPost: null,
    }))
    mockPrisma.post.findMany.mockResolvedValue(posts)
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const { getTimeline } = await importModule()
    const result = unwrap(await getTimeline('cursor1', 20))

    expect(result.nextCursor).toBe('p19')
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'cursor1' }, skip: 1 })
    )
  })

  it('handles db error', async () => {
    mockGetUserRelationSets.mockRejectedValue(new Error('DB error'))

    const { getTimeline } = await importModule()
    await expect(getTimeline()).rejects.toThrow()
  })

  it('returns nextCursor undefined when fewer posts than limit', async () => {
    mockGetUserRelationSets.mockResolvedValue({ followingUserIds: ['u2'], blockedUserIds: [], mutedUserIds: [], hiddenPostIds: [] })
    mockPrisma.post.findMany.mockResolvedValue([{
      id: 'p1',
      userId: 'u2',
      content: 'Hello',
      createdAt: new Date(),
      user: { id: 'u2', nickname: 'User2', avatarUrl: null },
      media: [],
      genres: [],
      _count: { likes: 0, comments: 0 },
      quotePost: null,
      repostPost: null,
    }])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const { getTimeline } = await importModule()
    const result = unwrap(await getTimeline(undefined, 20))

    expect(result.nextCursor).toBeUndefined()
  })

  it('includes bookmark status in formatted posts', async () => {
    mockGetUserRelationSets.mockResolvedValue({ followingUserIds: ['u2'], blockedUserIds: [], mutedUserIds: [], hiddenPostIds: [] })
    mockPrisma.post.findMany.mockResolvedValue([{
      id: 'p1',
      userId: 'u2',
      content: 'Test',
      createdAt: new Date(),
      user: { id: 'u2', nickname: 'User2', avatarUrl: null },
      media: [],
      genres: [],
      _count: { likes: 0, comments: 0 },
      quotePost: null,
      repostPost: null,
    }])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.bookmark.findMany.mockResolvedValue([{ postId: 'p1' }])

    const { getTimeline } = await importModule()
    const result = unwrap(await getTimeline())

    expect(result.posts[0]).toHaveProperty('isBookmarked', true)
  })

  it('expands genres from PostGenre relation', async () => {
    mockGetUserRelationSets.mockResolvedValue({ followingUserIds: ['u2'], blockedUserIds: [], mutedUserIds: [], hiddenPostIds: [] })
    mockPrisma.post.findMany.mockResolvedValue([{
      id: 'p1',
      userId: 'u2',
      content: 'Test',
      createdAt: new Date(),
      user: { id: 'u2', nickname: 'User2', avatarUrl: null },
      media: [],
      genres: [
        { genre: { id: 'g1', name: 'Pine' } },
        { genre: { id: 'g2', name: 'Maple' } },
      ],
      _count: { likes: 0, comments: 0 },
      quotePost: null,
      repostPost: null,
    }])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const { getTimeline } = await importModule()
    const result = unwrap(await getTimeline())

    expect(result.posts[0].genres).toEqual([
      { id: 'g1', name: 'Pine' },
      { id: 'g2', name: 'Maple' },
    ])
  })

  it('skips like/bookmark fetch when no posts returned', async () => {
    mockGetUserRelationSets.mockResolvedValue({ followingUserIds: ['u2'], blockedUserIds: [], mutedUserIds: [], hiddenPostIds: [] })
    mockPrisma.post.findMany.mockResolvedValue([])

    const { getTimeline } = await importModule()
    await getTimeline()

    expect(mockPrisma.like.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.bookmark.findMany).not.toHaveBeenCalled()
  })
})

// ============================================================
// getRecommendedUsers
// ============================================================
describe('getRecommendedUsers', () => {
  const importModule = () => import('@/lib/actions/feed')

  it('returns empty when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getRecommendedUsers } = await importModule()
    const result = await getRecommendedUsers()
    expect(result.users).toEqual([])
  })

  it('returns recommended users', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([{ followingId: 'u2' }])
    mockPrisma.block.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u3', nickname: 'User3', avatarUrl: null, bio: 'Bio', _count: { followers: 10 } },
      { id: 'u4', nickname: 'User4', avatarUrl: null, bio: null, _count: { followers: 5 } },
    ])

    const { getRecommendedUsers } = await importModule()
    const result = await getRecommendedUsers()

    expect(result.users).toHaveLength(2)
    expect(result.users[0]).toHaveProperty('followersCount', 10)
    expect(result.users[1]).toHaveProperty('followersCount', 5)
  })

  it('handles db error', async () => {
    mockPrisma.follow.findMany.mockRejectedValue(new Error('DB error'))

    const { getRecommendedUsers } = await importModule()
    await expect(getRecommendedUsers()).rejects.toThrow()
  })

  it('returns empty when no users found', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])

    const { getRecommendedUsers } = await importModule()
    const result = await getRecommendedUsers()

    expect(result.users).toEqual([])
  })

  it('respects limit parameter', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])

    const { getRecommendedUsers } = await importModule()
    await getRecommendedUsers(3)

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 })
    )
  })

  it('excludes current user and following from recommendations', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([{ followingId: 'u2' }])
    mockPrisma.user.findMany.mockResolvedValue([])

    const { getRecommendedUsers } = await importModule()
    await getRecommendedUsers()

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: expect.objectContaining({
            notIn: expect.arrayContaining(['u1', 'u2']),
          }),
          isPublic: true,
        }),
      })
    )
  })
})

// ============================================================
// getTrendingGenres
// ============================================================
describe('getTrendingGenres', () => {
  const importModule = () => import('@/lib/actions/feed')

  it('returns genres from cache', async () => {
    const genres = [
      { id: 'g1', name: 'Pine', _count: { posts: 50 } },
      { id: 'g2', name: 'Maple', _count: { posts: 30 } },
    ]
    mockGetCachedTrendingGenres.mockResolvedValue(genres)

    const { getTrendingGenres } = await importModule()
    const result = await getTrendingGenres()

    expect(result).toEqual(genres)
    expect(mockGetCachedTrendingGenres).toHaveBeenCalledWith(5)
  })

  it('handles empty result', async () => {
    mockGetCachedTrendingGenres.mockResolvedValue([])

    const { getTrendingGenres } = await importModule()
    const result = await getTrendingGenres()

    expect(result).toEqual([])
  })

  it('passes limit parameter', async () => {
    mockGetCachedTrendingGenres.mockResolvedValue([])

    const { getTrendingGenres } = await importModule()
    await getTrendingGenres(10)

    expect(mockGetCachedTrendingGenres).toHaveBeenCalledWith(10)
  })
})
