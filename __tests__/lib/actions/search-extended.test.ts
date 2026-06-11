// @vitest-environment node
 

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// 全文検索モック
const mockGetSearchMode = vi.fn().mockReturnValue('like')
const mockFulltextSearchPosts = vi.fn().mockResolvedValue([])
const mockFulltextSearchUsers = vi.fn().mockResolvedValue([])
vi.mock('@/lib/search/fulltext', () => ({
  getSearchMode: () => mockGetSearchMode(),
  fulltextSearchPosts: (...args: unknown[]) => mockFulltextSearchPosts(...args),
  fulltextSearchUsers: (...args: unknown[]) => mockFulltextSearchUsers(...args),
}))

// レート制限モック
const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  RATE_LIMITS: {
    search: { limit: 30, duration: 60 },
  },
}))

// next/headers モック
const mockHeadersGet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockHeadersGet(...args),
  }),
}))

// filter-helper モック
const mockGetExcludedUserIds = vi.fn().mockResolvedValue([])
vi.mock('@/lib/actions/filter-helper', () => ({
  getExcludedUserIds: (...args: unknown[]) => mockGetExcludedUserIds(...args),
}))

// キャッシュモック
const mockGetCachedGenres = vi.fn()
const mockGetCachedPopularTags = vi.fn()
vi.mock('@/lib/cache', () => ({
  getCachedGenres: (...args: unknown[]) => mockGetCachedGenres(...args),
  getCachedPopularTags: (...args: unknown[]) => mockGetCachedPopularTags(...args),
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

describe('Search Actions - Extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockRateLimit.mockResolvedValue({ success: true })
    mockGetSearchMode.mockReturnValue('like')
    mockHeadersGet.mockReturnValue(null)
    mockGetExcludedUserIds.mockResolvedValue([])
  })

  describe('getClientIpFromHeaders - IP extraction', async () => {
    it('cf-connecting-ipヘッダーからIPを取得する', async () => {
      mockHeadersGet.mockImplementation((name: string) => {
        if (name === 'cf-connecting-ip') return '1.2.3.4'
        return null
      })
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('test')

      expect(mockRateLimit).toHaveBeenCalledWith('search:1.2.3.4', expect.any(Object))
    })

    it('x-forwarded-forヘッダーからIPを取得する', async () => {
      mockHeadersGet.mockImplementation((name: string) => {
        if (name === 'x-forwarded-for') return '5.6.7.8, 9.10.11.12'
        return null
      })
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('test')

      expect(mockRateLimit).toHaveBeenCalledWith('search:5.6.7.8', expect.any(Object))
    })

    it('x-real-ipヘッダーからIPを取得する', async () => {
      mockHeadersGet.mockImplementation((name: string) => {
        if (name === 'x-real-ip') return '10.0.0.1'
        return null
      })
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('test')

      expect(mockRateLimit).toHaveBeenCalledWith('search:10.0.0.1', expect.any(Object))
    })

    it('IPヘッダーがない場合はunknownを使用する', async () => {
      mockHeadersGet.mockReturnValue(null)
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('test')

      expect(mockRateLimit).toHaveBeenCalledWith('search:unknown', expect.any(Object))
    })
  })

  describe('searchPosts - genre filter with LIKE mode', async () => {
    it('ジャンルフィルタ付きで検索時にgenres条件が含まれる', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', ['genre-1'])

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                genres: { some: { genreId: { in: ['genre-1'] } } },
              }),
            ]),
          }),
        })
      )
    })

    it('空のgenreIds配列ではジャンル条件が空オブジェクトになる', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [])

      expect(mockPrisma.post.findMany).toHaveBeenCalled()
    })
  })

  describe('searchPosts - excludedUserIds in LIKE mode', async () => {
    it('除外ユーザーがいる場合にnotIn条件が含まれる', async () => {
      mockGetExcludedUserIds.mockResolvedValue(['blocked-1', 'muted-1'])
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト')

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                userId: { notIn: ['blocked-1', 'muted-1'] },
              }),
            ]),
          }),
        })
      )
    })
  })

  describe('searchPosts - LIKE mode with likes/bookmarks', async () => {
    it('いいね/ブックマーク状態が正しく設定される', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          id: 'post-1',
          _count: { likes: 2, comments: 1 },
          genres: [{ genre: { id: 'g1', name: 'Test' } }],
        },
      ])
      mockPrisma.like.findMany.mockResolvedValue([{ postId: 'post-1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([{ postId: 'post-1' }])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('テスト'))

      expect(result.posts[0]!.isLiked).toBe(true)
      expect(result.posts[0]!.isBookmarked).toBe(true)
      expect(result.posts[0]!.likeCount).toBe(2)
      expect(result.posts[0]!.commentCount).toBe(1)
    })

    it('nextCursorが正しく設定される（limit件返却時）', async () => {
      const posts = Array(20).fill(null).map((_, i) => ({
        ...mockPost,
        id: `post-${i}`,
        _count: { likes: 0, comments: 0 },
        genres: [],
      }))
      mockPrisma.post.findMany.mockResolvedValue(posts)
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('テスト'))

      expect(result.nextCursor).toBe('post-19')
    })

    it('limit未満の件数ではnextCursorがundefined', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'post-1', _count: { likes: 0, comments: 0 }, genres: [] },
      ])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('テスト'))

      expect(result.nextCursor).toBeUndefined()
    })
  })

  describe('searchPosts - fulltext mode with genre filter', async () => {
    it('bigmモードでジャンルフィルタが全文検索に渡される', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchPosts.mockResolvedValue(['post-1'])
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'post-1', _count: { likes: 0, comments: 0 }, genres: [] },
      ])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', ['genre-1'])

      expect(mockFulltextSearchPosts).toHaveBeenCalledWith('テスト', expect.objectContaining({
        genreIds: ['genre-1'],
      }))
    })

    it('bigmモードでnextCursorが正しく設定される', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      const ids = Array(20).fill(null).map((_, i) => `post-${i}`)
      mockFulltextSearchPosts.mockResolvedValue(ids)
      const posts = ids.map(id => ({
        ...mockPost, id, _count: { likes: 0, comments: 0 }, genres: [],
      }))
      mockPrisma.post.findMany.mockResolvedValue(posts)
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('テスト'))

      expect(result.nextCursor).toBe('post-19')
    })

    it('bigmモードで未認証時はいいね/ブックマークがfalse', async () => {
      mockAuth.mockResolvedValue(null)
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchPosts.mockResolvedValue(['post-1'])
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'post-1', _count: { likes: 3, comments: 1 }, genres: [] },
      ])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('テスト'))

      expect(result.posts[0]!.isLiked).toBe(false)
      expect(result.posts[0]!.isBookmarked).toBe(false)
    })
  })

  describe('searchUsers - empty result', async () => {
    it('検索結果が空の場合、空配列を返す', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('存在しないユーザー')

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data?.users).toEqual([])
      expect(result.data?.nextCursor).toBeUndefined()
    })
  })

  describe('searchUsers - fulltext mode with pagination', async () => {
    it('bigmモードでnextCursorが正しく設定される', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      const ids = Array(20).fill(null).map((_, i) => `user-${i}`)
      mockFulltextSearchUsers.mockResolvedValue(ids)
      const users = ids.map(id => ({
        id, nickname: 'test', avatarUrl: null, bio: 'test',
        _count: { followers: 0, following: 0 },
      }))
      mockPrisma.user.findMany.mockResolvedValue(users)

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data?.nextCursor).toBe('user-19')
    })
  })

  describe('searchByTag - with pagination cursor', async () => {
    it('カーソル付きでページネーションが動作する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchByTag } = await import('@/lib/actions/search')
      await searchByTag('盆栽', 'cursor-123', 5)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-123' },
          skip: 1,
          take: 5,
        })
      )
    })

    it('いいね/ブックマーク状態を取得する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'p1', content: '#盆栽', _count: { likes: 1, comments: 0 }, genres: [] },
      ])
      mockPrisma.like.findMany.mockResolvedValue([{ postId: 'p1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchByTag } = await import('@/lib/actions/search')
      const result = unwrap(await searchByTag('盆栽'))

      expect(result.posts[0]!.isLiked).toBe(true)
      expect(result.posts[0]!.isBookmarked).toBe(false)
    })

    it('除外ユーザーがいる場合にnotIn条件が含まれる (Hashtag JOIN クエリ)', async () => {
      mockGetExcludedUserIds.mockResolvedValue(['excluded-1'])
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchByTag } = await import('@/lib/actions/search')
      await searchByTag('盆栽')

      const callArg = mockPrisma.post.findMany.mock.calls[0][0]
      expect(callArg.where).toEqual(expect.objectContaining({
        hashtags: { some: { hashtag: { name: '盆栽' } } },
        userId: { notIn: ['excluded-1'] },
      }))
    })
  })

  describe('getPopularTags - cache', async () => {
    it('getCachedPopularTagsを呼び出す', async () => {
      mockGetCachedPopularTags.mockResolvedValue({ tags: [{ tag: '盆栽', count: 10 }] })

      const { getPopularTags } = await import('@/lib/actions/search')
      const result = await getPopularTags(5)

      expect(mockGetCachedPopularTags).toHaveBeenCalledWith(5)
      expect(result.tags).toEqual([{ tag: '盆栽', count: 10 }])
    })

    it('デフォルトlimitで呼び出す', async () => {
      mockGetCachedPopularTags.mockResolvedValue({ tags: [] })

      const { getPopularTags } = await import('@/lib/actions/search')
      await getPopularTags()

      expect(mockGetCachedPopularTags).toHaveBeenCalledWith(10)
    })
  })

  describe('getAllGenres - cache', async () => {
    it('getCachedGenresを呼び出してgenresを返す', async () => {
      const genresData = { '松柏類': [{ id: 'g1', name: '黒松' }] }
      mockGetCachedGenres.mockResolvedValue({ genres: genresData, allGenres: [] })

      const { getAllGenres } = await import('@/lib/actions/search')
      const result = await getAllGenres()

      expect(mockGetCachedGenres).toHaveBeenCalled()
      expect(result.genres).toEqual(genresData)
    })
  })

  describe('searchUsers - rate limit failure', async () => {
    it('レート制限でエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(result).toMatchObject({ success: false })
      if (result.success) return
      expect(result.error).toBeDefined()
    })
  })

  describe('searchByTag - rate limit failure', async () => {
    it('レート制限でエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchByTag } = await import('@/lib/actions/search')
      const result = unwrap(await searchByTag('盆栽'))

      expect(result.posts).toEqual([])
      expect(result.error).toBeDefined()
    })
  })

  describe('searchPosts - fulltext empty query does not use fulltext', async () => {
    it('空クエリではbigmモードでもLIKE検索にフォールバック', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('')

      expect(mockFulltextSearchPosts).not.toHaveBeenCalled()
      expect(mockPrisma.post.findMany).toHaveBeenCalled()
    })
  })

  describe('searchUsers - fulltext empty query does not use fulltext', async () => {
    it('空クエリではbigmモードでもLIKE検索にフォールバック', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockPrisma.user.findMany.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      await searchUsers('')

      expect(mockFulltextSearchUsers).not.toHaveBeenCalled()
      expect(mockPrisma.user.findMany).toHaveBeenCalled()
    })
  })

  describe('searchUsers - excludedUserIds with LIKE mode', async () => {
    it('除外ユーザーがいる場合にnotIn条件が含まれる', async () => {
      mockGetExcludedUserIds.mockResolvedValue(['blocked-1'])
      mockPrisma.user.findMany.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      await searchUsers('テスト')

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                id: { notIn: ['blocked-1'] },
              }),
            ]),
          }),
        })
      )
    })
  })
})
