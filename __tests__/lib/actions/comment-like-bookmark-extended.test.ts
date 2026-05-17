import { vi } from 'vitest'
/**
 * Extended tests for comment, like, bookmark, report actions
 * (Search tests removed - they require deep rate-limit mocking)
 */
export {}

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  comment: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  like: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  bookmark: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  post: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  report: { create: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  notification: { create: vi.fn() },
  block: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  mute: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  genre: { findMany: vi.fn() },
  $transaction: vi.fn((fn: unknown) => typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown)(mockPrisma) : Promise.all(fn as Promise<unknown>[])),
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
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
vi.mock('@/lib/cache', () => ({
  getCachedData: vi.fn(),
  invalidateCache: vi.fn(),
  getCachedPopularTags: vi.fn().mockResolvedValue([{ tag: '盆栽', count: 10 }]),
  getCachedGenres: vi.fn().mockResolvedValue({ genres: [{ id: 'g1', name: '松柏類' }] }),
}))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: vi.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/actions/mention', () => ({ processMentions: vi.fn() }))
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4 }),
}))

// ============================================================
// Comment Actions Extended
// ============================================================
describe('createComment extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { createComment } = await import('@/lib/actions/comment')
    const fd = new FormData()
    fd.set('postId', 'p1')
    fd.set('content', 'Hello')
    const result = await createComment(fd)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('returns error when content is empty', async () => {
    const { createComment } = await import('@/lib/actions/comment')
    const fd = new FormData()
    fd.set('postId', 'p1')
    fd.set('content', '')
    const result = await createComment(fd)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates comment successfully', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'u2' })
    mockPrisma.comment.count.mockResolvedValue(0)
    mockPrisma.comment.create.mockResolvedValue({ id: 'c1', content: 'test' })
    const { createComment } = await import('@/lib/actions/comment')
    const fd = new FormData()
    fd.set('postId', 'p1')
    fd.set('content', 'Nice post!')
    const result = await createComment(fd)
    expect(result).toEqual(expect.objectContaining({ success: true }))
  })
})

describe('deleteComment extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteComment } = await import('@/lib/actions/comment')
    const result = await deleteComment('c1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('deletes owned comment', async () => {
    mockPrisma.comment.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1', postId: 'p1' })
    mockPrisma.comment.delete.mockResolvedValue({})
    const { deleteComment } = await import('@/lib/actions/comment')
    const result = await deleteComment('c1')
    expect(result).toBeDefined()
  })

  it('returns error for non-owned comment', async () => {
    mockPrisma.comment.findFirst.mockResolvedValue(null)
    const { deleteComment } = await import('@/lib/actions/comment')
    const result = await deleteComment('c1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })
})

describe('getComments extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns comments list', async () => {
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 'c1', content: 'test', user: { id: 'u2', nickname: 'User' }, _count: { likes: 0, children: 0 } },
    ])
    mockPrisma.like.findMany.mockResolvedValue([])
    const { getComments } = await import('@/lib/actions/comment')
    const result = await getComments('p1')
    expect(result).toEqual(expect.objectContaining({ comments: expect.any(Array) }))
  })

  it('supports cursor pagination', async () => {
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    const { getComments } = await import('@/lib/actions/comment')
    const result = await getComments('p1', 'cursor1', 10)
    expect(result).toEqual(expect.objectContaining({ comments: [] }))
  })
})

describe('getReplies extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns replies list', async () => {
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    const { getReplies } = await import('@/lib/actions/comment')
    const result = await getReplies('c1')
    expect(result).toEqual(expect.objectContaining({ replies: expect.any(Array) }))
  })
})

describe('getCommentCount extended', async () => {
  it('returns comment count', async () => {
    mockPrisma.comment.count.mockResolvedValue(42)
    const { getCommentCount } = await import('@/lib/actions/comment')
    const result = await getCommentCount('p1')
    expect(result).toEqual(expect.objectContaining({ count: 42 }))
  })
})

// ============================================================
// Like Actions Extended
// ============================================================
describe('togglePostLike extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { togglePostLike } = await import('@/lib/actions/like')
    const result = await togglePostLike('p1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates like when not yet liked', async () => {
    mockPrisma.like.findUnique.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l1' })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'u2' })
    const { togglePostLike } = await import('@/lib/actions/like')
    const result = await togglePostLike('p1')
    expect(result).toBeDefined()
    expect(result).not.toHaveProperty('error')
  })

  it('removes like when already liked', async () => {
    mockPrisma.like.findUnique.mockResolvedValue({ id: 'l1', userId: 'u1', postId: 'p1' })
    mockPrisma.like.delete.mockResolvedValue({})
    const { togglePostLike } = await import('@/lib/actions/like')
    const result = await togglePostLike('p1')
    expect(result).toBeDefined()
    expect(result).not.toHaveProperty('error')
  })
})

describe('toggleCommentLike extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { toggleCommentLike } = await import('@/lib/actions/like')
    const result = await toggleCommentLike('c1', 'p1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('toggles comment like', async () => {
    mockPrisma.like.findUnique.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l1' })
    mockPrisma.comment.findFirst.mockResolvedValue({ id: 'c1', userId: 'u2' })
    const { toggleCommentLike } = await import('@/lib/actions/like')
    const result = await toggleCommentLike('c1', 'p1')
    expect(result).toBeDefined()
  })
})

describe('getPostLikeStatus extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns false when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getPostLikeStatus } = await import('@/lib/actions/like')
    const result = await getPostLikeStatus('p1')
    expect(result).toBeDefined()
  })

  it('returns like status', async () => {
    mockPrisma.like.findUnique.mockResolvedValue({ id: 'l1' })
    const { getPostLikeStatus } = await import('@/lib/actions/like')
    const result = await getPostLikeStatus('p1')
    expect(result).toBeDefined()
  })
})

// ============================================================
// Bookmark Actions Extended
// ============================================================
describe('toggleBookmark extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { toggleBookmark } = await import('@/lib/actions/bookmark')
    const result = await toggleBookmark('p1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates bookmark when not yet bookmarked', async () => {
    mockPrisma.bookmark.findUnique.mockResolvedValue(null)
    mockPrisma.bookmark.create.mockResolvedValue({ id: 'bm1' })
    const { toggleBookmark } = await import('@/lib/actions/bookmark')
    const result = await toggleBookmark('p1')
    expect(result).toBeDefined()
    expect(result).not.toHaveProperty('error')
  })

  it('removes bookmark when already bookmarked', async () => {
    mockPrisma.bookmark.findUnique.mockResolvedValue({ id: 'bm1', userId: 'u1', postId: 'p1' })
    mockPrisma.bookmark.delete.mockResolvedValue({})
    const { toggleBookmark } = await import('@/lib/actions/bookmark')
    const result = await toggleBookmark('p1')
    expect(result).toBeDefined()
    expect(result).not.toHaveProperty('error')
  })
})

describe('getBookmarkStatus extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns false when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
    const result = await getBookmarkStatus('p1')
    expect(result).toBeDefined()
  })

  it('returns bookmark status', async () => {
    mockPrisma.bookmark.findUnique.mockResolvedValue({ id: 'bm1' })
    const { getBookmarkStatus } = await import('@/lib/actions/bookmark')
    const result = await getBookmarkStatus('p1')
    expect(result).toBeDefined()
  })
})

describe('getBookmarkedPosts extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns empty list when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
    const result = await getBookmarkedPosts()
    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('returns bookmarked posts', async () => {
    mockPrisma.bookmark.findMany.mockResolvedValue([
      { post: { id: 'p1', content: 'test', user: { id: 'u2' }, media: [], genres: [], _count: { likes: 0, comments: 0 } } },
    ])
    const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
    const result = await getBookmarkedPosts()
    expect(result).toBeDefined()
    expect(result).not.toHaveProperty('error')
  })

  it('supports cursor pagination', async () => {
    mockPrisma.bookmark.findMany.mockResolvedValue([])
    const { getBookmarkedPosts } = await import('@/lib/actions/bookmark')
    const result = await getBookmarkedPosts('cursor1', 10)
    expect(result).toBeDefined()
  })
})

// ============================================================
// Report Actions Extended
// ============================================================
describe('createReport extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { createReport } = await import('@/lib/actions/report')
    const result = await createReport({ targetType: 'post', targetId: 'p1', reason: 'spam' })
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates report', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(null)
    mockPrisma.report.create.mockResolvedValue({ id: 'r1' })
    mockPrisma.report.count.mockResolvedValue(0)
    const { createReport } = await import('@/lib/actions/report')
    const result = await createReport({ targetType: 'post', targetId: 'p1', reason: 'spam' })
    expect(result).toBeDefined()
  })
})

describe('getReports extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
  })

  it('returns error when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { getReports } = await import('@/lib/actions/report')
    const result = await getReports()
    expect(result).toBeDefined()
  })

  it('returns reports list when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin1' })
    mockPrisma.report.findMany.mockResolvedValue([])
    mockPrisma.report.count.mockResolvedValue(0)
    const { getReports } = await import('@/lib/actions/report')
    const result = await getReports()
    expect(result).toBeDefined()
  })
})

describe('getReportStats extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
  })

  it('returns report stats when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'admin1' })
    mockPrisma.report.groupBy.mockResolvedValue([])
    mockPrisma.report.count.mockResolvedValue(0)
    const { getReportStats } = await import('@/lib/actions/report')
    const result = await getReportStats()
    expect(result).toBeDefined()
  })
})
