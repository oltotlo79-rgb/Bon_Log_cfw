// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/bookmark')

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

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  mockCheckUserRateLimit.mockResolvedValue({ success: true })
})

// ============================================================
// toggleBookmark
// ============================================================
describe('toggleBookmark', () => {
  const importModule = () => import('@/lib/actions/bookmark')

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { toggleBookmark } = await importModule()
    const result = await toggleBookmark('p1')
    expect(result).toHaveProperty('error')
  })

  it('returns error when rate limit exceeded', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })
    const { toggleBookmark } = await importModule()
    const result = await toggleBookmark('p1')
    expect(result).toHaveProperty('error')
  })

  it('bookmarks a post when not yet bookmarked', async () => {
    mockPrisma.bookmark.findUnique.mockResolvedValue(null)
    mockPrisma.bookmark.create.mockResolvedValue({ id: 'b1', postId: 'p1', userId: 'u1' })

    const { toggleBookmark } = await importModule()
    const result = await toggleBookmark('p1')

    expect(result).toEqual({ success: true, data: { bookmarked: true } })
    expect(mockPrisma.bookmark.create).toHaveBeenCalledWith({
      data: { postId: 'p1', userId: 'u1' },
    })
  })

  it('unbookmarks a post when already bookmarked', async () => {
    mockPrisma.bookmark.findUnique.mockResolvedValue({ id: 'b1', postId: 'p1', userId: 'u1' })
    mockPrisma.bookmark.delete.mockResolvedValue({})

    const { toggleBookmark } = await importModule()
    const result = await toggleBookmark('p1')

    expect(result).toEqual({ success: true, data: { bookmarked: false } })
    expect(mockPrisma.bookmark.delete).toHaveBeenCalledWith({ where: { id: 'b1' } })
  })

  it('handles db error', async () => {
    mockPrisma.bookmark.findUnique.mockRejectedValue(new Error('DB error'))

    const { toggleBookmark } = await importModule()
    const result = await toggleBookmark('p1')
    expect(result).toHaveProperty('error')
  })
})

// ============================================================
// getBookmarkStatus
// ============================================================
describe('getBookmarkStatus', () => {
  const importModule = () => import('@/lib/actions/bookmark')

  it('returns bookmarked true when bookmark exists', async () => {
    mockPrisma.bookmark.findUnique.mockResolvedValue({ id: 'b1', postId: 'p1', userId: 'u1' })

    const { getBookmarkStatus } = await importModule()
    const result = await getBookmarkStatus('p1')

    expect(result).toEqual({ bookmarked: true })
  })

  it('returns bookmarked false when no bookmark', async () => {
    mockPrisma.bookmark.findUnique.mockResolvedValue(null)

    const { getBookmarkStatus } = await importModule()
    const result = await getBookmarkStatus('p1')

    expect(result).toEqual({ bookmarked: false })
  })

  it('returns false when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const { getBookmarkStatus } = await importModule()
    const result = await getBookmarkStatus('p1')

    expect(result).toEqual({ bookmarked: false })
  })
})

// ============================================================
// getBookmarkedPosts
// ============================================================
describe('getBookmarkedPosts', () => {
  const importModule = () => import('@/lib/actions/bookmark')

  it('returns empty list when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getBookmarkedPosts } = await importModule()
    const result = await getBookmarkedPosts()
    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('returns bookmarked posts', async () => {
    const mockBookmarks = [{
      id: 'b1',
      postId: 'p1',
      createdAt: new Date(),
      post: {
        id: 'p1',
        userId: 'u2',
        content: 'Hello',
        user: { id: 'u2', nickname: 'User2', avatarUrl: null },
        media: [],
        genres: [{ genre: { id: 'g1', name: 'Pine' } }],
        _count: { likes: 3, comments: 1 },
      },
    }]
    mockPrisma.bookmark.findMany.mockResolvedValue(mockBookmarks)
    mockPrisma.like.findMany.mockResolvedValue([{ postId: 'p1' }])

    const { getBookmarkedPosts } = await importModule()
    const result = await getBookmarkedPosts()

    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]).toHaveProperty('likeCount', 3)
    expect(result.posts[0]).toHaveProperty('isBookmarked', true)
    expect(result.posts[0]).toHaveProperty('isLiked', true)
  })

  it('supports cursor pagination', async () => {
    const mockBookmarks = Array.from({ length: 20 }, (_, i) => ({
      id: `b${i}`,
      postId: `p${i}`,
      createdAt: new Date(),
      post: {
        id: `p${i}`,
        userId: 'u2',
        content: `Post ${i}`,
        user: { id: 'u2', nickname: 'User2', avatarUrl: null },
        media: [],
        genres: [],
        _count: { likes: 0, comments: 0 },
      },
    }))
    mockPrisma.bookmark.findMany.mockResolvedValue(mockBookmarks)
    mockPrisma.like.findMany.mockResolvedValue([])

    const { getBookmarkedPosts } = await importModule()
    const result = await getBookmarkedPosts('cursor1', 20)

    expect(result.nextCursor).toBe('b19')
    expect(mockPrisma.bookmark.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'cursor1' }, skip: 1 })
    )
  })

  it('returns empty when no bookmarks', async () => {
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const { getBookmarkedPosts } = await importModule()
    const result = await getBookmarkedPosts()

    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('handles db error gracefully', async () => {
    mockPrisma.bookmark.findMany.mockRejectedValue(new Error('DB error'))

    const { getBookmarkedPosts } = await importModule()
    const result = await getBookmarkedPosts()
    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('filters out bookmarks with null post', async () => {
    mockPrisma.bookmark.findMany.mockResolvedValue([
      { id: 'b1', postId: 'p1', createdAt: new Date(), post: null },
    ])

    const { getBookmarkedPosts } = await importModule()
    const result = await getBookmarkedPosts()

    expect(result.posts).toEqual([])
  })

  it('all posts have isBookmarked true', async () => {
    mockPrisma.bookmark.findMany.mockResolvedValue([{
      id: 'b1',
      postId: 'p1',
      createdAt: new Date(),
      post: {
        id: 'p1',
        userId: 'u2',
        content: 'Test',
        user: { id: 'u2', nickname: 'User2', avatarUrl: null },
        media: [],
        genres: [],
        _count: { likes: 0, comments: 0 },
      },
    }])
    mockPrisma.like.findMany.mockResolvedValue([])

    const { getBookmarkedPosts } = await importModule()
    const result = await getBookmarkedPosts()

    expect(result.posts[0]).toHaveProperty('isBookmarked', true)
  })

  it('skips like fetch when no valid posts', async () => {
    mockPrisma.bookmark.findMany.mockResolvedValue([
      { id: 'b1', postId: 'p1', createdAt: new Date(), post: null },
    ])

    const { getBookmarkedPosts } = await importModule()
    await getBookmarkedPosts()

    expect(mockPrisma.like.findMany).not.toHaveBeenCalled()
  })
})
