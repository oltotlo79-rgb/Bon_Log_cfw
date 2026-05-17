// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrismaClient, mockPost, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/auth', () => ({ auth: () => mockAuthFn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ allowed: true, count: 0, limit: 50 }),
}))
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: vi.fn().mockResolvedValue({ maxPostLength: 500, maxImages: 4, maxVideos: 1, maxDailyPosts: 20 }),
}))
vi.mock('@/lib/sanitize', () => ({ sanitizePostContent: (c: string) => c }))
vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: vi.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/actions/mention', () => ({ notifyMentionedUsers: vi.fn().mockResolvedValue(undefined) }))

const mockAuthFn = vi.fn()

describe('getPosts pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthFn.mockResolvedValue(null)
  })

  it('returns empty posts array when no posts exist', async () => {
    const { getPosts } = await import('@/lib/actions/post')
    mockPrisma.post.findMany.mockResolvedValue([])
    const result = await getPosts()
    expect(result.posts).toEqual([])
  })

  it('returns posts without cursor (first page)', async () => {
    const { getPosts } = await import('@/lib/actions/post')
    const mockPostData = {
      ...mockPost,
      user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
      media: [],
      genres: [],
      _count: { likes: 0, comments: 0 },
      quotePost: null,
      repostPost: null,
      poll: null,
    }
    mockPrisma.post.findMany.mockResolvedValue([mockPostData])

    const result = await getPosts()
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0].id).toBe(mockPost.id)
  })

  it('returns posts with cursor (subsequent pages)', async () => {
    const { getPosts } = await import('@/lib/actions/post')
    const mockPostData = {
      ...mockPost,
      user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
      media: [],
      genres: [],
      _count: { likes: 0, comments: 0 },
      quotePost: null,
      repostPost: null,
      poll: null,
    }
    mockPrisma.post.findMany.mockResolvedValue([mockPostData])

    const result = await getPosts('cursor-id', 20)
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'cursor-id' },
        skip: 1,
      })
    )
    expect(result.posts).toHaveLength(1)
  })

  it('passes limit to findMany', async () => {
    const { getPosts } = await import('@/lib/actions/post')
    mockPrisma.post.findMany.mockResolvedValue([])

    await getPosts(undefined, 5)
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    )
  })

  it('returns posts with isLiked and isBookmarked flags', async () => {
    const { getPosts } = await import('@/lib/actions/post')
    mockAuthFn.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.follow.findMany.mockResolvedValue([])
    mockPrisma.block.findMany.mockResolvedValue([])
    mockPrisma.mute.findMany.mockResolvedValue([])
    mockPrisma.userHiddenPost.findMany.mockResolvedValue([])

    const mockPostData = {
      ...mockPost,
      user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
      media: [],
      genres: [],
      _count: { likes: 1, comments: 0 },
      quotePost: null,
      repostPost: null,
      poll: null,
    }
    mockPrisma.post.findMany.mockResolvedValue([mockPostData])
    mockPrisma.like.findMany.mockResolvedValue([{ postId: mockPost.id }])
    mockPrisma.bookmark.findMany.mockResolvedValue([])

    const result = await getPosts()
    expect(result.posts[0].isLiked).toBe(true)
    expect(result.posts[0].isBookmarked).toBe(false)
  })
})
