// @vitest-environment node
/**
 * lib/services/explore-posts-service のユニットテスト
 *
 * fetchPostsByHashtag / fetchPostsByGenre の正常系・ゲスト挙動・ブロック/ミュート除外・
 * カーソルページネーション・isLiked/isBookmarked 付与を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- Prisma モック ---
const mockPostFindMany = vi.fn()
const mockLikeFindMany = vi.fn()
const mockBookmarkFindMany = vi.fn()
const mockBlockFindMany = vi.fn()
const mockMuteFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    post: { findMany: (...args: unknown[]) => mockPostFindMany(...args) },
    like: { findMany: (...args: unknown[]) => mockLikeFindMany(...args) },
    bookmark: { findMany: (...args: unknown[]) => mockBookmarkFindMany(...args) },
    block: { findMany: (...args: unknown[]) => mockBlockFindMany(...args) },
    mute: { findMany: (...args: unknown[]) => mockMuteFindMany(...args) },
  },
}))

// --- post-include モック ---
vi.mock('@/lib/actions/post-include', () => ({
  POST_LIST_INCLUDE: {
    user: { select: { id: true, nickname: true, avatarUrl: true } },
    media: { orderBy: { sortOrder: 'asc' } },
    genres: { include: { genre: { select: { id: true, name: true, category: true } } } },
    _count: { select: { likes: true, comments: true, repostedBy: true } },
  },
  formatPostForClient: (
    post: Record<string, unknown>,
    likedSet: Set<string>,
    bookmarkedSet: Set<string>,
  ) => ({
    ...post,
    likeCount: (post._count as { likes: number }).likes,
    commentCount: (post._count as { comments: number }).comments,
    repostCount: 0,
    genres: ((post.genres as { genre: unknown }[]) ?? []).map((pg) => pg.genre),
    isLiked: likedSet.has(post.id as string),
    isBookmarked: bookmarkedSet.has(post.id as string),
    isReposted: false,
  }),
}))

// --- post-visibility モック ---
vi.mock('@/lib/services/post-visibility', () => ({
  visibleAuthorFilter: (viewerId?: string) => ({
    isSuspended: false,
    OR: [
      { isPublic: true },
      ...(viewerId ? [{ id: viewerId }] : []),
    ],
  }),
}))

// --- filter-helper モック ---
const mockGetExcludedUserIds = vi.fn()
vi.mock('@/lib/actions/filter-helper', () => ({
  getExcludedUserIds: (...args: unknown[]) => mockGetExcludedUserIds(...args),
}))

// --- pagination モック ---
vi.mock('@/lib/actions/pagination', () => ({
  normalizeCursorPagination: ({ cursor, limit }: { cursor?: string; limit?: number }) => ({
    cursor: cursor ?? null,
    limit: Math.min(Math.max(limit ?? 20, 1), 100),
  }),
}))

// --- getPostInteractionSets モック ---
const mockGetPostInteractionSets = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  getPostInteractionSets: (...args: unknown[]) => mockGetPostInteractionSets(...args),
}))

// --- server-only モック ---
vi.mock('server-only', () => ({}))

// ──────────────────────────────────────────────────
// テスト用モックデータ
// ──────────────────────────────────────────────────
const VIEWER_ID = 'viewer-user-1'

function makeMockPost(id: string, extraContent = '') {
  return {
    id,
    content: `テスト投稿 ${id}${extraContent}`,
    userId: 'author-1',
    isHidden: false,
    createdAt: new Date(),
    _count: { likes: 0, comments: 0, repostedBy: 0 },
    user: { id: 'author-1', nickname: 'Author', avatarUrl: null },
    media: [],
    genres: [],
  }
}

// ===================================================================
// fetchPostsByHashtag
// ===================================================================
describe('fetchPostsByHashtag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetExcludedUserIds.mockResolvedValue([])
    mockGetPostInteractionSets.mockResolvedValue({
      likedSet: new Set<string>(),
      bookmarkedSet: new Set<string>(),
    })
  })

  it('正常系: 投稿一覧を返す', async () => {
    const mockPosts = [makeMockPost('post-1', ' #松'), makeMockPost('post-2', ' #松')]
    mockPostFindMany.mockResolvedValue(mockPosts)

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByHashtag('松', VIEWER_ID)

    expect(result.posts).toHaveLength(2)
    expect(result.nextCursor).toBeUndefined()
  })

  it('ゲスト（viewerId = undefined）でも投稿を返す', async () => {
    const mockPosts = [makeMockPost('post-1')]
    mockPostFindMany.mockResolvedValue(mockPosts)

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByHashtag('松', undefined)

    expect(result.posts).toHaveLength(1)
    // ゲストでは getExcludedUserIds を呼ばない
    expect(mockGetExcludedUserIds).not.toHaveBeenCalled()
    // ゲストでは getPostInteractionSets を呼ばない
    expect(mockGetPostInteractionSets).not.toHaveBeenCalled()
  })

  it('ゲストの場合 isLiked/isBookmarked が false', async () => {
    const mockPosts = [makeMockPost('post-1')]
    mockPostFindMany.mockResolvedValue(mockPosts)

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByHashtag('松', undefined)

    expect(result.posts[0]).toMatchObject({ isLiked: false, isBookmarked: false })
  })

  it('ログイン済みユーザーの場合 isLiked/isBookmarked が付与される', async () => {
    const mockPosts = [makeMockPost('post-1')]
    mockPostFindMany.mockResolvedValue(mockPosts)
    mockGetPostInteractionSets.mockResolvedValue({
      likedSet: new Set(['post-1']),
      bookmarkedSet: new Set<string>(),
    })

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByHashtag('松', VIEWER_ID)

    expect(result.posts[0]).toMatchObject({ isLiked: true, isBookmarked: false })
  })

  it('ブロック/ミュートユーザーの除外 ID が prisma.post.findMany に渡される', async () => {
    const excludedIds = ['blocked-user', 'muted-user']
    mockGetExcludedUserIds.mockResolvedValue(excludedIds)
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    await fetchPostsByHashtag('松', VIEWER_ID)

    const callArg = mockPostFindMany.mock.calls[0]?.[0] as { where: { userId?: { notIn: string[] } } }
    expect(callArg.where.userId).toMatchObject({ notIn: excludedIds })
  })

  it('除外ユーザーが空の場合 userId.notIn が where に含まれない', async () => {
    mockGetExcludedUserIds.mockResolvedValue([])
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    await fetchPostsByHashtag('松', VIEWER_ID)

    const callArg = mockPostFindMany.mock.calls[0]?.[0] as { where: { userId?: unknown } }
    expect(callArg.where.userId).toBeUndefined()
  })

  it('件数が limit と等しいとき nextCursor が設定される', async () => {
    const mockPosts = Array.from({ length: 20 }, (_, i) => makeMockPost(`post-${i}`))
    mockPostFindMany.mockResolvedValue(mockPosts)

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByHashtag('松', VIEWER_ID, undefined, 20)

    expect(result.nextCursor).toBe('post-19')
  })

  it('件数が limit 未満のとき nextCursor が undefined', async () => {
    const mockPosts = [makeMockPost('post-1'), makeMockPost('post-2')]
    mockPostFindMany.mockResolvedValue(mockPosts)

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByHashtag('松', VIEWER_ID, undefined, 20)

    expect(result.nextCursor).toBeUndefined()
  })

  it('cursor が指定されると findMany に cursor/skip が渡される', async () => {
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    await fetchPostsByHashtag('松', VIEWER_ID, 'cursor-abc')

    const callArg = mockPostFindMany.mock.calls[0]?.[0] as { cursor?: { id: string }; skip?: number }
    expect(callArg.cursor).toEqual({ id: 'cursor-abc' })
    expect(callArg.skip).toBe(1)
  })

  it('空のハッシュタグ結果で posts: [] nextCursor: undefined を返す', async () => {
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByHashtag('存在しないタグ', VIEWER_ID)

    expect(result.posts).toHaveLength(0)
    expect(result.nextCursor).toBeUndefined()
  })

  it('findMany の where に PostHashtag JOIN 形式の hashtags 条件が含まれ content.contains は使わない', async () => {
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByHashtag } = await import('@/lib/services/explore-posts-service')
    await fetchPostsByHashtag('黒松', VIEWER_ID)

    const callArg = mockPostFindMany.mock.calls[0]?.[0] as {
      where: { hashtags?: { some: { hashtag: { name: string } } }; content?: unknown }
    }
    expect(callArg.where.hashtags).toMatchObject({
      some: { hashtag: { name: '黒松' } },
    })
    // content ILIKE 検索は廃止されているため WHERE に含まれないこと
    expect(callArg.where.content).toBeUndefined()
  })
})

// ===================================================================
// fetchPostsByGenre
// ===================================================================
describe('fetchPostsByGenre', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetExcludedUserIds.mockResolvedValue([])
    mockGetPostInteractionSets.mockResolvedValue({
      likedSet: new Set<string>(),
      bookmarkedSet: new Set<string>(),
    })
  })

  it('正常系: ジャンル別投稿一覧を返す', async () => {
    const mockPosts = [makeMockPost('post-1'), makeMockPost('post-2')]
    mockPostFindMany.mockResolvedValue(mockPosts)

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByGenre('genre-松柏類', VIEWER_ID)

    expect(result.posts).toHaveLength(2)
    expect(result.nextCursor).toBeUndefined()
  })

  it('ゲスト（viewerId = undefined）でも投稿を返す', async () => {
    const mockPosts = [makeMockPost('post-1')]
    mockPostFindMany.mockResolvedValue(mockPosts)

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByGenre('genre-1', undefined)

    expect(result.posts).toHaveLength(1)
    expect(mockGetExcludedUserIds).not.toHaveBeenCalled()
    expect(mockGetPostInteractionSets).not.toHaveBeenCalled()
  })

  it('ゲストの場合 isLiked/isBookmarked が false', async () => {
    mockPostFindMany.mockResolvedValue([makeMockPost('post-1')])

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByGenre('genre-1', undefined)

    expect(result.posts[0]).toMatchObject({ isLiked: false, isBookmarked: false })
  })

  it('ログイン済みユーザーの場合 isBookmarked が付与される', async () => {
    mockPostFindMany.mockResolvedValue([makeMockPost('post-1')])
    mockGetPostInteractionSets.mockResolvedValue({
      likedSet: new Set<string>(),
      bookmarkedSet: new Set(['post-1']),
    })

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByGenre('genre-1', VIEWER_ID)

    expect(result.posts[0]).toMatchObject({ isLiked: false, isBookmarked: true })
  })

  it('findMany の where に genres.some.genreId 条件が含まれる', async () => {
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    await fetchPostsByGenre('genre-abc', VIEWER_ID)

    const callArg = mockPostFindMany.mock.calls[0]?.[0] as {
      where: { genres: { some: { genreId: string } } }
    }
    expect(callArg.where.genres).toMatchObject({ some: { genreId: 'genre-abc' } })
  })

  it('ブロック/ミュートユーザーの除外 ID が findMany に渡される', async () => {
    mockGetExcludedUserIds.mockResolvedValue(['blocked-1', 'muted-1'])
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    await fetchPostsByGenre('genre-1', VIEWER_ID)

    const callArg = mockPostFindMany.mock.calls[0]?.[0] as { where: { userId?: { notIn: string[] } } }
    expect(callArg.where.userId).toMatchObject({ notIn: ['blocked-1', 'muted-1'] })
  })

  it('件数が limit と等しいとき nextCursor が設定される', async () => {
    const mockPosts = Array.from({ length: 10 }, (_, i) => makeMockPost(`post-${i}`))
    mockPostFindMany.mockResolvedValue(mockPosts)

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByGenre('genre-1', VIEWER_ID, undefined, 10)

    expect(result.nextCursor).toBe('post-9')
  })

  it('件数が limit 未満のとき nextCursor が undefined', async () => {
    mockPostFindMany.mockResolvedValue([makeMockPost('post-1')])

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByGenre('genre-1', VIEWER_ID, undefined, 10)

    expect(result.nextCursor).toBeUndefined()
  })

  it('cursor が指定されると findMany に cursor/skip が渡される', async () => {
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    await fetchPostsByGenre('genre-1', VIEWER_ID, 'cur-xyz')

    const callArg = mockPostFindMany.mock.calls[0]?.[0] as { cursor?: { id: string }; skip?: number }
    expect(callArg.cursor).toEqual({ id: 'cur-xyz' })
    expect(callArg.skip).toBe(1)
  })

  it('空のジャンル結果で posts: [] nextCursor: undefined を返す', async () => {
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    const result = await fetchPostsByGenre('genre-nonexistent', VIEWER_ID)

    expect(result.posts).toHaveLength(0)
    expect(result.nextCursor).toBeUndefined()
  })

  it('isHidden: false が where に含まれる', async () => {
    mockPostFindMany.mockResolvedValue([])

    const { fetchPostsByGenre } = await import('@/lib/services/explore-posts-service')
    await fetchPostsByGenre('genre-1', VIEWER_ID)

    const callArg = mockPostFindMany.mock.calls[0]?.[0] as { where: { isHidden: boolean } }
    expect(callArg.where.isHidden).toBe(false)
  })
})
