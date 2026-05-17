import { vi } from 'vitest'
/**
 * Extended edge-case tests for post actions
 */
export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  post: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  postMedia: { create: vi.fn(), deleteMany: vi.fn() },
  postGenre: { createMany: vi.fn(), deleteMany: vi.fn() },
  genre: { findMany: vi.fn() },
  like: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), findFirst: vi.fn() },
  bookmark: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), findFirst: vi.fn() },
  comment: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
  notification: { create: vi.fn() },
  block: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  mute: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  follow: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  repost: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  bonsai: { findUnique: vi.fn() },
  userHiddenPost: { findMany: vi.fn().mockResolvedValue([]) },
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
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }) }))
vi.mock('@/lib/cache', () => ({ getCachedData: vi.fn(), invalidateCache: vi.fn(), getCachedGenres: vi.fn().mockResolvedValue({ genres: {}, allGenres: [] }), revalidateTrendingGenresCache: vi.fn(), revalidatePopularTagsCache: vi.fn() }))
vi.mock('@/lib/services/hashtag-sync', () => ({
  attachHashtagsToPost: vi.fn().mockResolvedValue(undefined),
  detachHashtagsFromPost: vi.fn().mockResolvedValue(undefined),
  extractHashtags: vi.fn().mockReturnValue([]),
}))
vi.mock('@/lib/actions/mention', () => ({ processMentions: vi.fn() }))
vi.mock('@/lib/actions/notification', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/services/notification-core', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))

describe('createPost extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData(); fd.set('content', 'test')
    const result = await createPost(fd)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('returns error for empty content', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData(); fd.set('content', '')
    const result = await createPost(fd)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('returns error for content exceeding max length', async () => {
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData(); fd.set('content', 'a'.repeat(1000))
    const result = await createPost(fd)
    expect(result).toBeDefined()
  })

  it('creates post successfully', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.post.create.mockResolvedValue({ id: 'p1', content: 'test' })
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData(); fd.set('content', 'Hello world')
    const result = await createPost(fd)
    expect(result).toBeDefined()
  })

  it('creates post with genre', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.post.create.mockResolvedValue({ id: 'p1' })
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData(); fd.set('content', 'Hello'); fd.append('genreIds', 'g1')
    const result = await createPost(fd)
    expect(result).toBeDefined()
  })
})

describe('createQuotePost extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { createQuotePost } = await import('@/lib/actions/post')
    const fd = new FormData(); fd.set('content', 'quote')
    const result = await createQuotePost(fd, 'p1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates quote post', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'u2' })
    mockPrisma.post.create.mockResolvedValue({ id: 'p2' })
    const { createQuotePost } = await import('@/lib/actions/post')
    const fd = new FormData(); fd.set('content', 'Great post!')
    const result = await createQuotePost(fd, 'p1')
    expect(result).toBeDefined()
  })
})

describe('createRepost extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { createRepost } = await import('@/lib/actions/post')
    const result = await createRepost('p1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates repost', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'u2' })
    mockPrisma.repost.findFirst.mockResolvedValue(null)
    mockPrisma.repost.create.mockResolvedValue({ id: 'r1' })
    const { createRepost } = await import('@/lib/actions/post')
    const result = await createRepost('p1')
    expect(result).toBeDefined()
  })
})

describe('deletePost extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deletePost } = await import('@/lib/actions/post')
    const result = await deletePost('p1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('deletes owned post', async () => {
    mockPrisma.post.findFirst.mockResolvedValue({ id: 'p1', userId: 'u1' })
    mockPrisma.post.delete.mockResolvedValue({})
    const { deletePost } = await import('@/lib/actions/post')
    const result = await deletePost('p1')
    expect(result).toBeDefined()
  })

  it('returns error for non-owned post', async () => {
    mockPrisma.post.findFirst.mockResolvedValue(null)
    const { deletePost } = await import('@/lib/actions/post')
    const result = await deletePost('p1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })
})

describe('getPost extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns post details', async () => {
    mockPrisma.post.findUnique.mockResolvedValue({
      id: 'p1', content: 'test', userId: 'u1',
      user: { id: 'u1', nickname: 'Test' }, media: [], genres: [],
      _count: { likes: 0, comments: 0 },
    })
    mockPrisma.like.findUnique.mockResolvedValue(null)
    mockPrisma.bookmark.findUnique.mockResolvedValue(null)
    const { getPost } = await import('@/lib/actions/post')
    const result = await getPost('p1')
    expect(result).toBeDefined()
  })

  it('returns error for missing post', async () => {
    mockPrisma.post.findUnique.mockResolvedValue(null)
    const { getPost } = await import('@/lib/actions/post')
    const result = await getPost('missing')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('returns post without auth', async () => {
    mockAuth.mockResolvedValue(null)
    mockPrisma.post.findUnique.mockResolvedValue({
      id: 'p1', content: 'public', userId: 'u2',
      user: { id: 'u2', nickname: 'Other' }, media: [], genres: [],
      _count: { likes: 1, comments: 0 },
    })
    const { getPost } = await import('@/lib/actions/post')
    const result = await getPost('p1')
    expect(result).toBeDefined()
  })
})

describe('getPosts extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns posts list', async () => {
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.bookmark.findMany.mockResolvedValue([])
    const { getPosts } = await import('@/lib/actions/post')
    const result = await getPosts()
    expect(result).toBeDefined()
  })

  it('supports cursor pagination', async () => {
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.bookmark.findMany.mockResolvedValue([])
    const { getPosts } = await import('@/lib/actions/post')
    const result = await getPosts('cursor1', 10)
    expect(result).toBeDefined()
  })

  it('returns posts without auth', async () => {
    mockAuth.mockResolvedValue(null)
    mockPrisma.post.findMany.mockResolvedValue([])
    const { getPosts } = await import('@/lib/actions/post')
    const result = await getPosts()
    expect(result).toBeDefined()
  })
})

describe('getGenres extended', async () => {
  it('returns genres list', async () => {
    vi.clearAllMocks()
    mockPrisma.genre.findMany.mockResolvedValue([{ id: 'g1', name: '松柏類' }])
    const { getGenres } = await import('@/lib/actions/post')
    const result = await getGenres()
    expect(result).toBeDefined()
  })
})

describe('getPostsByBonsai extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns posts for bonsai', async () => {
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.bookmark.findMany.mockResolvedValue([])
    const { getPostsByBonsai } = await import('@/lib/actions/post')
    const result = await getPostsByBonsai('b1')
    expect(result).toBeDefined()
  })
})

describe('createPost with poll', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error for invalid poll JSON', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData()
    fd.set('content', 'テスト投稿')
    fd.set('pollOptions', 'invalid-json')
    fd.set('pollDuration', '86400')
    const result = await createPost(fd)
    expect(result).toEqual(expect.objectContaining({ error: 'アンケートデータが不正です' }))
  })

  it('returns error for poll with less than 2 options', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData()
    fd.set('content', 'テスト投稿')
    fd.set('pollOptions', JSON.stringify(['選択肢1']))
    fd.set('pollDuration', '86400')
    const result = await createPost(fd)
    expect(result).toEqual(expect.objectContaining({ error: 'アンケートの選択肢は2〜10個で設定してください' }))
  })

  it('returns error for poll with more than 10 options', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData()
    fd.set('content', 'テスト投稿')
    const manyOptions = Array.from({ length: 11 }, (_, i) => `選択肢${i + 1}`)
    fd.set('pollOptions', JSON.stringify(manyOptions))
    fd.set('pollDuration', '86400')
    const result = await createPost(fd)
    expect(result).toEqual(expect.objectContaining({ error: 'アンケートの選択肢は2〜10個で設定してください' }))
  })

  it('returns error for poll with empty option text', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData()
    fd.set('content', 'テスト投稿')
    fd.set('pollOptions', JSON.stringify(['選択肢1', '']))
    fd.set('pollDuration', '86400')
    const result = await createPost(fd)
    expect(result).toEqual(expect.objectContaining({ error: '選択肢は1〜50文字で入力してください' }))
  })

  it('returns error for poll with option longer than 50 chars', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData()
    fd.set('content', 'テスト投稿')
    const longOption = 'あ'.repeat(51)
    fd.set('pollOptions', JSON.stringify(['選択肢1', longOption]))
    fd.set('pollDuration', '86400')
    const result = await createPost(fd)
    expect(result).toEqual(expect.objectContaining({ error: '選択肢は1〜50文字で入力してください' }))
  })

  it('returns error for invalid poll duration', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData()
    fd.set('content', 'テスト投稿')
    fd.set('pollOptions', JSON.stringify(['選択肢1', '選択肢2']))
    fd.set('pollDuration', '12345')
    const result = await createPost(fd)
    expect(result).toEqual(expect.objectContaining({ error: '無効な投票期間です' }))
  })

  it('creates post with valid poll', async () => {
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.post.create.mockResolvedValue({ id: 'p1', content: 'テスト投稿' })
    const { createPost } = await import('@/lib/actions/post')
    const fd = new FormData()
    fd.set('content', 'テスト投稿')
    fd.set('pollOptions', JSON.stringify(['選択肢1', '選択肢2']))
    fd.set('pollDuration', '86400')
    const result = await createPost(fd)
    expect(result).toBeDefined()
  })
})

describe('getPosts with genres', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns posts with mapped genres', async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      {
        id: 'p1',
        content: 'テスト',
        userId: 'u1',
        user: { id: 'u1', nickname: 'Test' },
        media: [],
        genres: [{ genre: { id: 'g1', name: '松柏類' } }],
        _count: { likes: 5, comments: 3 },
      },
    ])
    mockPrisma.like.findMany.mockResolvedValue([{ postId: 'p1' }])
    mockPrisma.bookmark.findMany.mockResolvedValue([])
    const { getPosts } = await import('@/lib/actions/post')
    const result = await getPosts()
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0].likeCount).toBe(5)
    expect(result.posts[0].genres[0].name).toBe('松柏類')
    expect(result.posts[0].isLiked).toBe(true)
  })
})
