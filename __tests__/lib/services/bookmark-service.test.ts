// @vitest-environment node
/**
 * lib/services/bookmark-service のユニットテスト
 *
 * addBookmark / removeBookmark / fetchBookmarkedPosts の
 * 正常系・冪等性・不存在投稿・可視性フィルタ・N+1 防止を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- Prisma モック ---
const mockPrisma = {
  bookmark: {
    upsert: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
  },
  post: {
    findMany: vi.fn(),
  },
  like: {
    findMany: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

// --- post-visibility モック ---
const mockAssertCanViewPost = vi.fn()
vi.mock('@/lib/services/post-visibility', () => ({
  assertCanViewPost: (...args: unknown[]) => mockAssertCanViewPost(...args),
  visiblePostWhere: vi.fn().mockReturnValue({ isHidden: false }),
}))

// --- post-include モック ---
const mockFormatPostForClient = vi.fn()
vi.mock('@/lib/actions/post-include', () => ({
  POST_LIST_INCLUDE: {},
  formatPostForClient: (...args: unknown[]) => mockFormatPostForClient(...args),
}))

// --- pagination モック ---
vi.mock('@/lib/actions/pagination', () => ({
  normalizeCursorPagination: (opts: { cursor?: string; limit?: number }) => ({
    cursor: opts.cursor ?? null,
    limit: opts.limit ?? 20,
  }),
}))

// --- logger モック ---
vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// --- server-only モック ---
vi.mock('server-only', () => ({}))

// ===================================================================
// addBookmark
// ===================================================================
describe('addBookmark', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssertCanViewPost.mockResolvedValue(true)
    mockPrisma.bookmark.upsert.mockResolvedValue({ id: 'bookmark-1', userId: 'user-1', postId: 'post-1' })
  })

  it('正常系: found: true, bookmarked: true を返す', async () => {
    const { addBookmark } = await import('@/lib/services/bookmark-service')
    const result = await addBookmark('post-1', 'user-1')

    expect(result).toEqual({ found: true, bookmarked: true })
  })

  it('assertCanViewPost に postId と userId が渡される', async () => {
    const { addBookmark } = await import('@/lib/services/bookmark-service')
    await addBookmark('post-xyz', 'user-abc')

    expect(mockAssertCanViewPost).toHaveBeenCalledWith('user-abc', 'post-xyz')
  })

  it('冪等性: 既にブックマーク済みでも upsert を呼んで found: true, bookmarked: true を返す（重複行なし）', async () => {
    const { addBookmark } = await import('@/lib/services/bookmark-service')
    const result = await addBookmark('post-1', 'user-1')

    expect(result).toEqual({ found: true, bookmarked: true })
    // upsert の update フィールドが空オブジェクト（= no-op）であることを確認
    expect(mockPrisma.bookmark.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {},
      }),
    )
  })

  it('不存在・不可視投稿は found: false を返す', async () => {
    mockAssertCanViewPost.mockResolvedValueOnce(false)
    const { addBookmark } = await import('@/lib/services/bookmark-service')
    const result = await addBookmark('post-ghost', 'user-1')

    expect(result).toEqual({ found: false })
    expect(mockPrisma.bookmark.upsert).not.toHaveBeenCalled()
  })

  it('assertCanViewPost が false のとき upsert を呼ばない', async () => {
    mockAssertCanViewPost.mockResolvedValueOnce(false)
    const { addBookmark } = await import('@/lib/services/bookmark-service')
    await addBookmark('post-private', 'user-1')

    expect(mockPrisma.bookmark.upsert).not.toHaveBeenCalled()
  })

  it('prisma.bookmark.upsert の where に userId_postId 複合キーが渡される', async () => {
    const { addBookmark } = await import('@/lib/services/bookmark-service')
    await addBookmark('post-1', 'user-1')

    expect(mockPrisma.bookmark.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_postId: { userId: 'user-1', postId: 'post-1' } },
        create: { postId: 'post-1', userId: 'user-1' },
      }),
    )
  })

  it('upsert でエラーが発生した場合に throw する', async () => {
    mockPrisma.bookmark.upsert.mockRejectedValueOnce(new Error('DB error'))
    const { addBookmark } = await import('@/lib/services/bookmark-service')

    await expect(addBookmark('post-1', 'user-1')).rejects.toThrow('DB error')
  })

  it('upsert が Error以外の値を reject した場合も安全にログして rethrow する', async () => {
    mockPrisma.bookmark.upsert.mockRejectedValueOnce('raw string rejection')
    const { addBookmark } = await import('@/lib/services/bookmark-service')

    await expect(addBookmark('post-1', 'user-1')).rejects.toBe('raw string rejection')
  })
})

// ===================================================================
// removeBookmark
// ===================================================================
describe('removeBookmark', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAssertCanViewPost.mockResolvedValue(true)
    mockPrisma.bookmark.deleteMany.mockResolvedValue({ count: 1 })
  })

  it('正常系: found: true, bookmarked: false を返す', async () => {
    const { removeBookmark } = await import('@/lib/services/bookmark-service')
    const result = await removeBookmark('post-1', 'user-1')

    expect(result).toEqual({ found: true, bookmarked: false })
  })

  it('assertCanViewPost に postId と userId が渡される', async () => {
    const { removeBookmark } = await import('@/lib/services/bookmark-service')
    await removeBookmark('post-xyz', 'user-abc')

    expect(mockAssertCanViewPost).toHaveBeenCalledWith('user-abc', 'post-xyz')
  })

  it('冪等性: ブックマークしていなくても deleteMany を呼んで found: true, bookmarked: false を返す', async () => {
    mockPrisma.bookmark.deleteMany.mockResolvedValueOnce({ count: 0 })
    const { removeBookmark } = await import('@/lib/services/bookmark-service')
    const result = await removeBookmark('post-1', 'user-1')

    expect(result).toEqual({ found: true, bookmarked: false })
    expect(mockPrisma.bookmark.deleteMany).toHaveBeenCalled()
  })

  it('不存在・不可視投稿は found: false を返す', async () => {
    mockAssertCanViewPost.mockResolvedValueOnce(false)
    const { removeBookmark } = await import('@/lib/services/bookmark-service')
    const result = await removeBookmark('post-ghost', 'user-1')

    expect(result).toEqual({ found: false })
    expect(mockPrisma.bookmark.deleteMany).not.toHaveBeenCalled()
  })

  it('prisma.bookmark.deleteMany の where に userId と postId が渡される', async () => {
    const { removeBookmark } = await import('@/lib/services/bookmark-service')
    await removeBookmark('post-1', 'user-1')

    expect(mockPrisma.bookmark.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', postId: 'post-1' },
    })
  })

  it('deleteMany でエラーが発生した場合に throw する', async () => {
    mockPrisma.bookmark.deleteMany.mockRejectedValueOnce(new Error('DB error'))
    const { removeBookmark } = await import('@/lib/services/bookmark-service')

    await expect(removeBookmark('post-1', 'user-1')).rejects.toThrow('DB error')
  })

  it('deleteMany が Error以外の値を reject した場合も安全にログして rethrow する', async () => {
    mockPrisma.bookmark.deleteMany.mockRejectedValueOnce({ code: 'P2010' })
    const { removeBookmark } = await import('@/lib/services/bookmark-service')

    await expect(removeBookmark('post-1', 'user-1')).rejects.toEqual({ code: 'P2010' })
  })
})

// ===================================================================
// fetchBookmarkedPosts
// ===================================================================
describe('fetchBookmarkedPosts', () => {
  const makeBookmarkRow = (n: number) => ({ id: `bookmark-${n}`, postId: `post-${n}` })
  const makePost = (n: number) => ({
    id: `post-${n}`,
    content: `投稿 ${n}`,
    user: { id: 'author-1', nickname: 'テスト', avatarUrl: null },
    media: [],
    genres: [],
    _count: { likes: 0, comments: 0, repostedBy: 0 },
  })

  beforeEach(() => {
    vi.clearAllMocks()
    const rows = [makeBookmarkRow(1), makeBookmarkRow(2)]
    mockPrisma.bookmark.findMany.mockResolvedValue(rows)
    mockPrisma.post.findMany.mockResolvedValue([makePost(1), makePost(2)])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockFormatPostForClient.mockImplementation((post: { id: string }) => ({
      id: post.id,
      isBookmarked: true,
      isLiked: false,
    }))
  })

  it('正常系: items と nextCursor を返す', async () => {
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    const result = await fetchBookmarkedPosts('user-1')

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('全アイテムの isBookmarked が true', async () => {
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    const result = await fetchBookmarkedPosts('user-1')

    for (const item of result.items) {
      expect(item.isBookmarked).toBe(true)
    }
  })

  it('ブックマークがない場合は空配列と nextCursor: null', async () => {
    mockPrisma.bookmark.findMany.mockResolvedValueOnce([])
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    const result = await fetchBookmarkedPosts('user-1')

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('N+1 防止: bookmark.findMany と post.findMany は各 1 回のみ呼ばれる', async () => {
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    await fetchBookmarkedPosts('user-1')

    expect(mockPrisma.bookmark.findMany).toHaveBeenCalledTimes(1)
    expect(mockPrisma.post.findMany).toHaveBeenCalledTimes(1)
  })

  it('N+1 防止: like.findMany は post 取得後に 1 回のみ呼ばれる', async () => {
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    await fetchBookmarkedPosts('user-1')

    expect(mockPrisma.like.findMany).toHaveBeenCalledTimes(1)
  })

  it('limit 件ちょうど取得したとき nextCursor が設定される', async () => {
    const rows = [makeBookmarkRow(1), makeBookmarkRow(2)]
    mockPrisma.bookmark.findMany.mockResolvedValueOnce(rows)
    mockPrisma.post.findMany.mockResolvedValueOnce([makePost(1), makePost(2)])
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    const result = await fetchBookmarkedPosts('user-1', undefined, 2)

    expect(result.nextCursor).toBe('bookmark-2')
  })

  it('limit より少ない件数のとき nextCursor は null', async () => {
    const rows = [makeBookmarkRow(1)]
    mockPrisma.bookmark.findMany.mockResolvedValueOnce(rows)
    mockPrisma.post.findMany.mockResolvedValueOnce([makePost(1)])
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    const result = await fetchBookmarkedPosts('user-1', undefined, 5)

    expect(result.nextCursor).toBeNull()
  })

  it('cursor が渡されるとき bookmark.findMany に cursor が渡される', async () => {
    mockPrisma.bookmark.findMany.mockResolvedValueOnce([makeBookmarkRow(2)])
    mockPrisma.post.findMany.mockResolvedValueOnce([makePost(2)])
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    await fetchBookmarkedPosts('user-1', 'bookmark-1')

    const call = mockPrisma.bookmark.findMany.mock.calls[0]?.[0]
    expect(call).toBeDefined()
    // cursor が設定されていること（skip: 1 + cursor: { id: 'bookmark-1' }）
    expect(call).toMatchObject({ cursor: { id: 'bookmark-1' }, skip: 1 })
  })

  it('可視性フィルタ: bookmark.findMany に visiblePostWhere 由来の条件が含まれる', async () => {
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    await fetchBookmarkedPosts('user-1')

    const call = mockPrisma.bookmark.findMany.mock.calls[0]?.[0]
    expect(call).toBeDefined()
    // where には { userId, post: <visiblePostWhere 戻り値> } が含まれる
    expect(call?.where).toMatchObject({ userId: 'user-1', post: expect.objectContaining({ isHidden: false }) })
  })

  it('いいね済みの postId が formatPostForClient に likedSet として反映される', async () => {
    mockPrisma.like.findMany.mockResolvedValueOnce([{ postId: 'post-1' }])
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    await fetchBookmarkedPosts('user-1')

    // formatPostForClient の第 2 引数に likedSet が渡されていること
    const call = mockFormatPostForClient.mock.calls[0]
    expect(call).toBeDefined()
    const likedSet: Set<string> = call?.[1]
    expect(likedSet instanceof Set).toBe(true)
    expect(likedSet.has('post-1')).toBe(true)
  })

  it('formatPostForClient の第 3 引数に bookmarkedSet が渡され全 postId を含む', async () => {
    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    await fetchBookmarkedPosts('user-1')

    const call = mockFormatPostForClient.mock.calls[0]
    const bookmarkedSet: Set<string> = call?.[2]
    expect(bookmarkedSet instanceof Set).toBe(true)
    expect(bookmarkedSet.has('post-1')).toBe(true)
    expect(bookmarkedSet.has('post-2')).toBe(true)
  })

  it('ブックマーク順（bookmark 順）が保持される（bookmarkRows の順に orderedPosts が並ぶ）', async () => {
    // bookmark は post-2, post-1 の順
    mockPrisma.bookmark.findMany.mockResolvedValueOnce([makeBookmarkRow(2), makeBookmarkRow(1)])
    // post.findMany は順不同で返す（実際の DB と同様）
    mockPrisma.post.findMany.mockResolvedValueOnce([makePost(1), makePost(2)])
    mockFormatPostForClient.mockImplementation((post: { id: string }) => ({ id: post.id, isBookmarked: true, isLiked: false }))

    const { fetchBookmarkedPosts } = await import('@/lib/services/bookmark-service')
    const result = await fetchBookmarkedPosts('user-1')

    expect(result.items[0]?.id).toBe('post-2')
    expect(result.items[1]?.id).toBe('post-1')
  })
})
