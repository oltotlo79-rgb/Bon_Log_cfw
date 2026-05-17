// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/like')

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

vi.mock('@/lib/actions/analytics', () => ({
  recordLikeReceived: vi.fn().mockResolvedValue(undefined),
}))

const mockCreateNotification = vi.fn().mockResolvedValue({ success: true })
const mockDeleteNotification = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/actions/notification', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotification(...args),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotification(...args),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  mockCheckUserRateLimit.mockResolvedValue({ success: true })
})

// ============================================================
// togglePostLike
// ============================================================
describe('togglePostLike', () => {
  const importModule = () => import('@/lib/actions/like')

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')
    expect(result).toHaveProperty('error')
  })

  it('returns error when rate limit exceeded', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })
    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')
    expect(result).toHaveProperty('error')
  })

  it('likes a post when not yet liked', async () => {
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l1', postId: 'p1', userId: 'u1' })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'u2' })

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')

    expect(result).toEqual({ success: true, data: { liked: true } })
    expect(mockCreateNotification).toHaveBeenCalled()
  })

  it('unlikes a post when already liked', async () => {
    mockPrisma.like.findFirst.mockResolvedValue({ id: 'l1', postId: 'p1', userId: 'u1' })
    mockPrisma.like.delete.mockResolvedValue({})
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'u2' })

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')

    expect(result).toEqual({ success: true, data: { liked: false } })
  })

  it('does not send notification when liking own post', async () => {
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l1' })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'u1' })

    const { togglePostLike } = await importModule()
    await togglePostLike('p1')

    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('handles db error', async () => {
    mockPrisma.like.findFirst.mockRejectedValue(new Error('DB error'))

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')

    expect(result).toHaveProperty('error')
  })

  it('does not send notification when post not found', async () => {
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l1' })
    mockPrisma.post.findUnique.mockResolvedValue(null)

    const { togglePostLike } = await importModule()
    await togglePostLike('p1')

    expect(mockCreateNotification).not.toHaveBeenCalled()
  })
})

// ============================================================
// toggleCommentLike
// ============================================================
describe('toggleCommentLike', () => {
  const importModule = () => import('@/lib/actions/like')

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')
    expect(result).toHaveProperty('error')
  })

  it('returns error when rate limit exceeded', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })
    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')
    expect(result).toHaveProperty('error')
  })

  it('likes a comment when not yet liked', async () => {
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l1', commentId: 'c1', userId: 'u1' })
    mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', userId: 'u2' })

    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')

    expect(result).toEqual({ success: true, data: { liked: true } })
    expect(mockPrisma.like.create).toHaveBeenCalled()
  })

  it('unlikes a comment when already liked', async () => {
    mockPrisma.like.findFirst.mockResolvedValue({ id: 'l1', commentId: 'c1', userId: 'u1' })
    mockPrisma.like.delete.mockResolvedValue({})
    mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', userId: 'u2' })

    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')

    expect(result).toEqual({ success: true, data: { liked: false } })
    expect(mockPrisma.like.delete).toHaveBeenCalledWith({ where: { id: 'l1' } })
  })

  it('handles db error', async () => {
    mockPrisma.like.findFirst.mockRejectedValue(new Error('DB error'))

    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', 'p1')

    expect(result).toHaveProperty('error')
  })

  it('does not send notification when liking own comment', async () => {
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l1' })
    mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', userId: 'u1' })

    const { toggleCommentLike } = await importModule()
    await toggleCommentLike('c1', 'p1')

    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('sends comment_like notification to comment author', async () => {
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l1' })
    mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', userId: 'u2' })

    const { toggleCommentLike } = await importModule()
    await toggleCommentLike('c1', 'p1')

    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'comment_like',
        userId: 'u2',
        actorId: 'u1',
        postId: 'p1',
        commentId: 'c1',
      })
    )
  })
})

// ============================================================
// getPostLikeStatus
// ============================================================
describe('getPostLikeStatus', () => {
  const importModule = () => import('@/lib/actions/like')

  it('returns liked true when like exists', async () => {
    mockPrisma.like.findFirst.mockResolvedValue({ id: 'l1', postId: 'p1', userId: 'u1' })

    const { getPostLikeStatus } = await importModule()
    const result = await getPostLikeStatus('p1')

    expect(result).toEqual({ liked: true })
  })

  it('returns liked false when no like', async () => {
    mockPrisma.like.findFirst.mockResolvedValue(null)

    const { getPostLikeStatus } = await importModule()
    const result = await getPostLikeStatus('p1')

    expect(result).toEqual({ liked: false })
  })

  it('returns liked false when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)

    const { getPostLikeStatus } = await importModule()
    const result = await getPostLikeStatus('p1')

    expect(result).toEqual({ liked: false })
  })

  it('returns liked false on db error', async () => {
    mockPrisma.like.findFirst.mockRejectedValue(new Error('DB error'))

    const { getPostLikeStatus } = await importModule()
    const result = await getPostLikeStatus('p1')

    expect(result).toEqual({ liked: false })
  })
})

// ============================================================
// getLikedPosts
// ============================================================
describe('getLikedPosts', () => {
  const importModule = () => import('@/lib/actions/like')

  it('returns liked posts', async () => {
    const mockLikes = [{
      id: 'l1',
      postId: 'p1',
      createdAt: new Date(),
      post: {
        id: 'p1',
        userId: 'u2',
        content: 'Hello',
        user: { id: 'u2', nickname: 'User2', avatarUrl: null },
        media: [],
        genres: [{ genre: { id: 'g1', name: 'Pine' } }],
        _count: { likes: 5, comments: 2 },
      },
    }]
    mockPrisma.like.findMany.mockResolvedValueOnce(mockLikes)
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const { getLikedPosts } = await importModule()
    const result = await getLikedPosts('u2')

    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]).toHaveProperty('likeCount', 5)
    expect(result.posts[0]).toHaveProperty('isLiked', true)
  })

  it('supports cursor pagination', async () => {
    const mockLikes = Array.from({ length: 20 }, (_, i) => ({
      id: `l${i}`,
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
    mockPrisma.like.findMany.mockResolvedValueOnce(mockLikes)
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const { getLikedPosts } = await importModule()
    const result = await getLikedPosts('u2', 'cursor1', 20)

    expect(result.nextCursor).toBe('l19')
    expect(mockPrisma.like.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'cursor1' }, skip: 1 })
    )
  })

  it('returns empty when no likes', async () => {
    mockPrisma.like.findMany.mockResolvedValue([])

    const { getLikedPosts } = await importModule()
    const result = await getLikedPosts('u2')

    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('handles db error', async () => {
    mockPrisma.like.findMany.mockRejectedValue(new Error('DB error'))

    const { getLikedPosts } = await importModule()
    const result = await getLikedPosts('u2')

    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('filters out likes with null post', async () => {
    mockPrisma.like.findMany.mockResolvedValue([
      { id: 'l1', postId: 'p1', createdAt: new Date(), post: null },
    ])

    const { getLikedPosts } = await importModule()
    const result = await getLikedPosts('u2')

    expect(result.posts).toEqual([])
  })
})
