// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue('127.0.0.1') }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}))

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

const mockFulltextSearchPosts = vi.fn().mockResolvedValue([])
const mockFulltextSearchUsers = vi.fn().mockResolvedValue([])
const mockGetSearchMode = vi.fn().mockReturnValue('like')
vi.mock('@/lib/search/fulltext', () => ({
  fulltextSearchPosts: mockFulltextSearchPosts,
  fulltextSearchUsers: mockFulltextSearchUsers,
  getSearchMode: mockGetSearchMode,
}))

vi.mock('@/lib/actions/filter-helper', () => ({
  getExcludedUserIds: vi.fn().mockResolvedValue([]),
}))

const mockGetCachedGenres = vi.fn().mockResolvedValue({ genres: {} })
const mockGetCachedPopularTags = vi.fn().mockResolvedValue({ tags: [{ tag: '盆栽', count: 10 }] })
vi.mock('@/lib/cache', () => ({
  getCachedGenres: mockGetCachedGenres,
  getCachedPopularTags: mockGetCachedPopularTags,
}))

vi.mock('@/lib/actions/post-include', () => ({
  POST_LIST_INCLUDE: {},
  formatPostForClient: vi.fn((post: unknown) => post),
}))

vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual('@/lib/actions/utils')
  return {
    ...actual,
    getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
    getPostInteractionSets: vi.fn().mockResolvedValue({ likedSet: new Set(), bookmarkedSet: new Set() }),
    getGuestUserId: vi.fn().mockResolvedValue(null),
  }
})

vi.mock('@/lib/actions/search-entities', () => ({
  searchShops: vi.fn().mockResolvedValue({ shops: [], nextCursor: undefined }),
  searchEvents: vi.fn().mockResolvedValue({ events: [], nextCursor: undefined }),
  searchBonsais: vi.fn().mockResolvedValue({ bonsais: [], nextCursor: undefined }),
  searchGlobal: vi.fn().mockResolvedValue({ posts: [], users: [], shops: [], events: [], bonsais: [] }),
}))

/**
 * `ActionResult<T>` を旧フラット形状に展開する互換ヘルパー（search 移行用）。
 * 成功時は `data` を展開、失敗時は `{ error, posts: [], nextCursor: undefined }` を返す。
 */
function unwrap<T>(result: import('@/types/action-result').ActionResult<T>): (T extends object ? T : Record<string, never>) & { error?: string; posts?: unknown[]; nextCursor?: string } {
  if (result.success) {
    return ((result.data ?? {}) as unknown) as (T extends object ? T : Record<string, never>) & { error?: string; posts?: unknown[]; nextCursor?: string }
  }
  return { error: result.error, posts: [], nextCursor: undefined } as unknown as (T extends object ? T : Record<string, never>) & { error?: string; posts?: unknown[]; nextCursor?: string }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'test-user-id' } })
  mockRateLimit.mockResolvedValue({ success: true })
  mockGetSearchMode.mockReturnValue('like')
  mockGetCachedGenres.mockResolvedValue({ genres: {} })
  mockGetCachedPopularTags.mockResolvedValue({ tags: [{ tag: '盆栽', count: 10 }] })
})

// ============================================================
// searchPosts
// ============================================================

describe('searchPosts', () => {
  it('クエリが長すぎる場合エラーを返す', async () => {
    const { searchPosts } = await import('@/lib/actions/search')
    const longQuery = 'あ'.repeat(101)
    const result = unwrap(await searchPosts(longQuery))
    expect(result.error).toBe('検索クエリが長すぎます')
    expect(result.posts).toEqual([])
  })

  it('レート制限超過時にエラーを返す', async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false })
    const { searchPosts } = await import('@/lib/actions/search')
    const result = unwrap(await searchPosts('盆栽'))
    expect(result.error).toBe('検索リクエストが多すぎます。しばらく待ってから再試行してください')
    expect(result.posts).toEqual([])
  })

  it('空クエリで全投稿を返す', async () => {
    const mockPosts = [
      { id: 'post-1', content: 'test', _count: { likes: 0, comments: 0 }, genres: [] },
      { id: 'post-2', content: 'test2', _count: { likes: 1, comments: 2 }, genres: [] },
    ]
    mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
    const { searchPosts } = await import('@/lib/actions/search')
    const result = unwrap(await searchPosts(''))
    expect(result.posts).toHaveLength(2)
    expect(result.error).toBeUndefined()
  })

  it('LIKE検索で結果とページネーションを返す', async () => {
    const mockPosts = Array.from({ length: 20 }, (_, i) => ({
      id: `post-${i}`,
      content: '盆栽',
      _count: { likes: 0, comments: 0 },
      genres: [],
    }))
    mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
    const { searchPosts } = await import('@/lib/actions/search')
    const result = unwrap(await searchPosts('盆栽'))
    expect(result.posts).toHaveLength(20)
    expect(result.nextCursor).toBe('post-19')
  })

  it('DBエラー時に空配列を返す', async () => {
    mockPrisma.post.findMany.mockRejectedValueOnce(new Error('DB error'))
    const { searchPosts } = await import('@/lib/actions/search')
    const result = unwrap(await searchPosts('盆栽'))
    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('genreIdsフィルタ付きで検索する', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    const { searchPosts } = await import('@/lib/actions/search')
    await searchPosts('盆栽', ['genre-1', 'genre-2'])
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              genres: { some: { genreId: { in: ['genre-1', 'genre-2'] } } },
            }),
          ]),
        }),
      }),
    )
  })

  it('日付フィルタ付きで検索する', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    const { searchPosts } = await import('@/lib/actions/search')
    await searchPosts('盆栽', undefined, undefined, undefined, {
      dateFrom: '2025-01-01',
      dateTo: '2025-12-31',
    })
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ createdAt: { gte: expect.any(Date) } }),
            expect.objectContaining({ createdAt: { lte: expect.any(Date) } }),
          ]),
        }),
      }),
    )
  })

  it('過大な limit は MAX_PAGE_LIMIT に clamp する', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    const { searchPosts } = await import('@/lib/actions/search')
    await searchPosts('盆栽', undefined, undefined, 1_000_000)
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    )
  })
})

// ============================================================
// searchUsers
// ============================================================

describe('searchUsers', () => {
  it('クエリが長すぎる場合エラーを返す', async () => {
    const { searchUsers } = await import('@/lib/actions/search')
    const longQuery = 'あ'.repeat(101)
    const result = await searchUsers(longQuery)
    expect(result).toMatchObject({ success: false, error: '検索クエリが長すぎます' })
  })

  it('レート制限超過時にエラーを返す', async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false })
    const { searchUsers } = await import('@/lib/actions/search')
    const result = await searchUsers('ユーザー')
    expect(result).toMatchObject({
      success: false,
      error: '検索リクエストが多すぎます。しばらく待ってから再試行してください',
    })
  })

  it('ユーザーを正しいフォーマットで返す', async () => {
    const mockUsers = [
      { id: 'user-1', nickname: 'テスト', avatarUrl: null, bio: 'bio', _count: { followers: 5, following: 3 } },
    ]
    mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)
    const { searchUsers } = await import('@/lib/actions/search')
    const result = await searchUsers('テスト')
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data?.users).toHaveLength(1)
    expect(result.data?.users[0]).toMatchObject({
      id: 'user-1',
      followersCount: 5,
      followingCount: 3,
    })
  })

  it('DBエラー時は actionError を返す', async () => {
    mockPrisma.user.findMany.mockRejectedValueOnce(new Error('DB error'))
    const { searchUsers } = await import('@/lib/actions/search')
    const result = await searchUsers('テスト')
    expect(result).toMatchObject({ success: false })
  })

  it('停止・非公開ユーザーを除外する閲覧可否フィルタを where に含める', async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([])
    const { searchUsers } = await import('@/lib/actions/search')
    await searchUsers('テスト')
    const callArg = mockPrisma.user.findMany.mock.calls[0][0]
    expect(callArg.where).toMatchObject({
      isSuspended: false,
      OR: expect.arrayContaining([
        { isPublic: true },
        { id: 'test-user-id' },
        { followers: { some: { followerId: 'test-user-id' } } },
      ]),
    })
  })

  it('DBエラーが Error 以外の値でも actionError を返す（lib/actions/search-users 直接呼び出し）', async () => {
    mockPrisma.user.findMany.mockRejectedValueOnce('connection reset')
    const { searchUsers } = await import('@/lib/actions/search-users')
    const result = await searchUsers('テスト')
    expect(result).toMatchObject({ success: false, error: '操作に失敗しました' })
  })

  it('limit を省略すると search-users.ts 自身の既定値 (DEFAULT_PAGE_LIMIT) が使われる', async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([])
    // search.ts のバレル経由だと wrapper 側の default が先に解決されてしまうため、
    // search-users.ts の default-arg 分岐を検証するには直接 import する必要がある。
    const { searchUsers } = await import('@/lib/actions/search-users')
    const result = await searchUsers('テスト', undefined)
    expect(result.success).toBe(true)
  })
})

// ============================================================
// searchByTag
// ============================================================

describe('searchByTag', () => {
  it('タグが長すぎる場合エラーを返す', async () => {
    const { searchByTag } = await import('@/lib/actions/search')
    const longTag = 'あ'.repeat(101)
    const result = unwrap(await searchByTag(longTag))
    expect(result.error).toBe('検索クエリが長すぎます')
    expect(result.posts).toEqual([])
  })

  it('レート制限超過時にエラーを返す', async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false })
    const { searchByTag } = await import('@/lib/actions/search')
    const result = unwrap(await searchByTag('盆栽'))
    expect(result.error).toBe('検索リクエストが多すぎます。しばらく待ってから再試行してください')
    expect(result.posts).toEqual([])
  })

  it('タグに一致する投稿を返す', async () => {
    const mockPosts = [
      {
        id: 'post-1',
        content: '#盆栽 最高',
        _count: { likes: 3, comments: 1 },
        genres: [{ genre: { id: 'g1', name: '松柏類', category: 'TREE' } }],
      },
    ]
    mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
    const { searchByTag } = await import('@/lib/actions/search')
    const result = unwrap(await searchByTag('盆栽'))
    expect(result.posts).toHaveLength(1)
    expect(result.posts[0]).toMatchObject({
      id: 'post-1',
      likeCount: 3,
      commentCount: 1,
    })
  })

  it('結果が空の場合空配列を返す', async () => {
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    const { searchByTag } = await import('@/lib/actions/search')
    const result = unwrap(await searchByTag('存在しないタグ'))
    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })
})

// ============================================================
// getPopularTags
// ============================================================

describe('getPopularTags', () => {
  it('キャッシュされたタグを返す', async () => {
    const { getPopularTags } = await import('@/lib/actions/search')
    const result = await getPopularTags()
    expect(result).toEqual({ tags: [{ tag: '盆栽', count: 10 }] })
  })

  it('エラー時に空配列を返す', async () => {
    mockGetCachedPopularTags.mockRejectedValueOnce(new Error('cache error'))
    const { getPopularTags } = await import('@/lib/actions/search')
    const result = await getPopularTags()
    expect(result).toEqual({ tags: [] })
  })
})

// ============================================================
// getAllGenres
// ============================================================

describe('getAllGenres', () => {
  it('キャッシュされたジャンルを返す', async () => {
    mockGetCachedGenres.mockResolvedValueOnce({ genres: { TREE: [{ id: 'g1', name: '松柏類' }] } })
    const { getAllGenres } = await import('@/lib/actions/search')
    const result = await getAllGenres()
    expect(result.genres).toEqual({ TREE: [{ id: 'g1', name: '松柏類' }] })
  })

  it('エラー時に空オブジェクトを返す', async () => {
    mockGetCachedGenres.mockRejectedValueOnce(new Error('cache error'))
    const { getAllGenres } = await import('@/lib/actions/search')
    const result = await getAllGenres()
    expect(result.genres).toEqual({})
  })
})

// ============================================================
// getSearchModeInfo
// ============================================================

describe('getSearchModeInfo', () => {
  it('現在の検索モードを返す', async () => {
    mockGetSearchMode.mockReturnValue('like')
    const { getSearchModeInfo } = await import('@/lib/actions/search')
    const result = await getSearchModeInfo()
    expect(result).toEqual({ mode: 'like' })
  })
})
