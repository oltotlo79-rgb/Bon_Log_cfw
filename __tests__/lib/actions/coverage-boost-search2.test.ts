// @vitest-environment node

import { vi } from 'vitest'
/**
 * Search Actions coverage boost tests
 *
 * Targets uncovered branches in lib/actions/search.ts:
 * - trgm mode paths (all functions)
 * - searchPosts: fulltext empty result, cursor with LIKE, minLikes=0
 * - searchUsers: fulltext mode with trgm, empty result, cursor with LIKE, unauthenticated
 * - searchByTag: unauthenticated user path, nextCursor boundary
 * - searchShops: trgm mode, cursor with LIKE, null avgRating
 * - searchEvents: trgm mode, empty query with options, cursor with LIKE
 * - searchBonsais: trgm mode, cursor with LIKE, empty userId
 * - searchGlobal: unauthenticated, partial IDs
 * - getSearchModeInfo: trgm mode
 */

vi.unmock('@/lib/actions/search')

import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
mockPrisma.like.groupBy = vi.fn()
mockPrisma.shopReview = { aggregate: vi.fn(), groupBy: vi.fn() }

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
const mockFulltextSearchShops = vi.fn().mockResolvedValue([])
const mockFulltextSearchEvents = vi.fn().mockResolvedValue([])
const mockFulltextSearchBonsais = vi.fn().mockResolvedValue([])
const mockFulltextSearchGlobal = vi.fn().mockResolvedValue({
  postIds: [],
  userIds: [],
  shopIds: [],
  eventIds: [],
  bonsaiIds: [],
})
vi.mock('@/lib/search/fulltext', () => ({
  getSearchMode: () => mockGetSearchMode(),
  fulltextSearchPosts: (...args: unknown[]) => mockFulltextSearchPosts(...args),
  fulltextSearchUsers: (...args: unknown[]) => mockFulltextSearchUsers(...args),
  fulltextSearchShops: (...args: unknown[]) => mockFulltextSearchShops(...args),
  fulltextSearchEvents: (...args: unknown[]) => mockFulltextSearchEvents(...args),
  fulltextSearchBonsais: (...args: unknown[]) => mockFulltextSearchBonsais(...args),
  fulltextSearchGlobal: (...args: unknown[]) => mockFulltextSearchGlobal(...args),
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

describe('Search Actions - Coverage Boost 2', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockRateLimit.mockResolvedValue({ success: true })
    mockGetSearchMode.mockReturnValue('like')
    mockHeadersGet.mockReturnValue(null)
    mockGetExcludedUserIds.mockResolvedValue([])
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.bookmark.findMany.mockResolvedValue([])
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
    mockPrisma.event.findMany.mockResolvedValue([])
    mockPrisma.bonsai.findMany.mockResolvedValue([])
    mockPrisma.like.groupBy.mockResolvedValue([])
    mockPrisma.shopReview.groupBy.mockResolvedValue([])
  })

  // ============================================================
  // searchPosts - trgm mode
  // ============================================================

  describe('searchPosts - trgm mode', async () => {
    it('trgmモードで全文検索を実行する', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchPosts.mockResolvedValue(['post-1'])
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'post-1', _count: { likes: 2, comments: 1 }, genres: [{ genre: { id: 'g1', name: 'Test' } }] },
      ])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('テスト'))

      expect(mockFulltextSearchPosts).toHaveBeenCalled()
      expect(result.posts).toHaveLength(1)
      expect(result.posts[0]!.likeCount).toBe(2)
    })

    it('trgmモードで結果が0件の場合は空配列を返す', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchPosts.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('存在しない'))

      expect(result.posts).toEqual([])
      expect(result.nextCursor).toBeUndefined()
    })

    it('trgmモードでfiltersを渡す', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchPosts.mockResolvedValue(['post-1'])
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'post-1', _count: { likes: 0, comments: 0 }, genres: [] },
      ])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', ['genre-1'], 'cursor-1', 10, {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        mediaType: 'images',
      })

      expect(mockFulltextSearchPosts).toHaveBeenCalledWith('テスト', expect.objectContaining({
        genreIds: ['genre-1'],
        cursor: 'cursor-1',
        limit: 10,
        filters: expect.objectContaining({
          dateFrom: '2024-01-01',
        }),
      }))
    })
  })

  // ============================================================
  // searchPosts - LIKE mode with cursor
  // ============================================================

  describe('searchPosts - LIKE mode cursor pagination', async () => {
    it('カーソル付きでLIKE検索する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', undefined, 'cursor-abc', 10)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-abc' },
          skip: 1,
          take: 10,
        })
      )
    })
  })

  // ============================================================
  // searchPosts - minLikes=0 does not trigger groupBy
  // ============================================================

  describe('searchPosts - minLikes edge cases', async () => {
    it('minLikes=0ではgroupByが呼ばれない', async () => {
      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], undefined, 20, { minLikes: 0 })

      expect(mockPrisma.like.groupBy).not.toHaveBeenCalled()
    })

    it('minLikesで結果にnullのpostIdが含まれる場合はフィルタされる', async () => {
      mockPrisma.like.groupBy.mockResolvedValue([
        { postId: 'post-1', _count: { postId: 10 } },
        { postId: null, _count: { postId: 5 } },
      ])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], undefined, 20, { minLikes: 3 })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['post-1'] },
          }),
        })
      )
    })
  })

  // ============================================================
  // searchPosts - unauthenticated user
  // ============================================================

  describe('searchPosts - unauthenticated', async () => {
    it('未認証ユーザーはexcludedUserIdsが空でいいね/ブックマークもなし', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'post-1', _count: { likes: 5, comments: 2 }, genres: [{ genre: { id: 'g1', name: 'Gen' } }] },
      ])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('テスト'))

      expect(mockGetExcludedUserIds).not.toHaveBeenCalled()
      expect(result.posts[0]!.isLiked).toBe(false)
      expect(result.posts[0]!.isBookmarked).toBe(false)
    })
  })

  // ============================================================
  // searchPosts - fulltext mode with postIds that don't all match in DB
  // ============================================================

  describe('searchPosts - fulltext ID ordering', async () => {
    it('全文検索結果のIDのうちDBに存在しないものは除外される', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchPosts.mockResolvedValue(['post-1', 'post-missing', 'post-2'])
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'post-2', _count: { likes: 0, comments: 0 }, genres: [] },
        { ...mockPost, id: 'post-1', _count: { likes: 1, comments: 0 }, genres: [] },
      ])
      mockPrisma.like.findMany.mockResolvedValue([{ postId: 'post-1' }])
      mockPrisma.bookmark.findMany.mockResolvedValue([{ postId: 'post-2' }])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('テスト'))

      // 順序はfulltext結果の順序を維持: post-1, post-2 (post-missingは除外)
      expect(result.posts).toHaveLength(2)
      expect(result.posts[0]!.id).toBe('post-1')
      expect(result.posts[0]!.isLiked).toBe(true)
      expect(result.posts[1]!.id).toBe('post-2')
      expect(result.posts[1]!.isBookmarked).toBe(true)
    })
  })

  // ============================================================
  // searchPosts - empty query with genre filter (LIKE mode)
  // ============================================================

  describe('searchPosts - empty query with filters', async () => {
    it('空クエリでもジャンルフィルタが適用される', async () => {
      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('', ['genre-1'])

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {},
              expect.objectContaining({
                genres: { some: { genreId: { in: ['genre-1'] } } },
              }),
            ]),
          }),
        })
      )
    })
  })

  // ============================================================
  // searchUsers - trgm mode
  // ============================================================

  describe('searchUsers - trgm mode', async () => {
    it('trgmモードで全文検索を実行する', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchUsers.mockResolvedValue(['user-1'])
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', nickname: 'テスト', avatarUrl: null, bio: '自己紹介', _count: { followers: 5, following: 3 } },
      ])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(mockFulltextSearchUsers).toHaveBeenCalled()
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data?.users).toHaveLength(1)
      expect(result.data?.users[0]!.followersCount).toBe(5)
      expect(result.data?.users[0]!.followingCount).toBe(3)
    })

    it('trgmモードで結果が0件の場合は空配列を返す', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchUsers.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('存在しない')

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data?.users).toEqual([])
      expect(result.data?.nextCursor).toBeUndefined()
    })
  })

  // ============================================================
  // searchUsers - unauthenticated
  // ============================================================

  describe('searchUsers - unauthenticated', async () => {
    it('未認証ユーザーでも検索できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', nickname: 'テスト', avatarUrl: null, bio: null, _count: { followers: 0, following: 0 } },
      ])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(mockGetExcludedUserIds).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data?.users).toHaveLength(1)
    })
  })

  // ============================================================
  // searchUsers - LIKE mode with cursor
  // ============================================================

  describe('searchUsers - LIKE cursor', async () => {
    it('カーソル付きでLIKE検索する', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])

      const { searchUsers } = await import('@/lib/actions/search')
      await searchUsers('テスト', 'cursor-user', 5)

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-user' },
          skip: 1,
          take: 5,
        })
      )
    })

    it('LIKE検索でnextCursorが正しく設定される', async () => {
      const users = Array(20).fill(null).map((_, i) => ({
        id: `user-${i}`, nickname: 'test', avatarUrl: null, bio: null,
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

  // ============================================================
  // searchByTag - unauthenticated
  // ============================================================

  describe('searchByTag - unauthenticated', async () => {
    it('未認証ユーザーでもタグ検索できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.post.findMany.mockResolvedValue([
        { ...mockPost, id: 'p1', content: '#盆栽', _count: { likes: 0, comments: 0 }, genres: [] },
      ])

      const { searchByTag } = await import('@/lib/actions/search')
      const result = unwrap(await searchByTag('盆栽'))

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0]!.isLiked).toBe(false)
      expect(result.posts[0]!.isBookmarked).toBe(false)
    })
  })

  // ============================================================
  // searchByTag - nextCursor boundary
  // ============================================================

  describe('searchByTag - nextCursor', async () => {
    it('limit件返却時にnextCursorが設定される', async () => {
      const posts = Array(20).fill(null).map((_, i) => ({
        ...mockPost, id: `p-${i}`, content: '#盆栽', _count: { likes: 0, comments: 0 }, genres: [],
      }))
      mockPrisma.post.findMany.mockResolvedValue(posts)

      const { searchByTag } = await import('@/lib/actions/search')
      const result = unwrap(await searchByTag('盆栽'))

      expect(result.nextCursor).toBe('p-19')
    })
  })

  // ============================================================
  // searchShops - trgm mode
  // ============================================================

  describe('searchShops - trgm mode', async () => {
    it('trgmモードで全文検索を実行する', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchShops.mockResolvedValue(['shop-1'])
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          id: 'shop-1', name: 'テスト園', address: '東京都',
          genres: [{ genre: { id: 'g1', name: 'ジャンル' } }],
          _count: { reviews: 3 },
        },
      ])
      mockPrisma.shopReview.groupBy.mockResolvedValue([{ shopId: 'shop-1', _avg: { rating: 3.5 } }])

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('テスト')

      expect(mockFulltextSearchShops).toHaveBeenCalled()
      expect(result.shops).toHaveLength(1)
      expect(result.shops[0]!.avgRating).toBe(3.5)
      expect(result.shops[0]!.reviewCount).toBe(3)
    })

    it('trgmモードでnextCursorが設定される', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      const ids = Array(20).fill(null).map((_, i) => `shop-${i}`)
      mockFulltextSearchShops.mockResolvedValue(ids)
      const shops = ids.map(id => ({
        id, name: 'test', address: 'test',
        genres: [], _count: { reviews: 0 },
      }))
      mockPrisma.bonsaiShop.findMany.mockResolvedValue(shops)

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('テスト')

      expect(result.nextCursor).toBe('shop-19')
    })

    it('trgmモードでprefectureが渡される', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchShops.mockResolvedValue([])

      const { searchShops } = await import('@/lib/actions/search')
      await searchShops('テスト', undefined, 20, '東京都')

      expect(mockFulltextSearchShops).toHaveBeenCalledWith('テスト', expect.objectContaining({
        prefecture: '東京都',
      }))
    })
  })

  // ============================================================
  // searchShops - LIKE mode cursor
  // ============================================================

  describe('searchShops - LIKE cursor and avgRating', async () => {
    it('カーソル付きでLIKE検索する', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { searchShops } = await import('@/lib/actions/search')
      await searchShops('テスト', 'cursor-shop', 5)

      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-shop' },
          skip: 1,
          take: 5,
        })
      )
    })

    it('LIKE検索でnextCursorが正しく設定される', async () => {
      const shops = Array(20).fill(null).map((_, i) => ({
        id: `shop-${i}`, name: 'test', address: 'test',
        genres: [], _count: { reviews: 0 },
      }))
      mockPrisma.bonsaiShop.findMany.mockResolvedValue(shops)

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('テスト')

      expect(result.nextCursor).toBe('shop-19')
    })

    it('avgRatingがnullの場合は0になる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        { id: 'shop-1', name: 'テスト園', address: '東京都', genres: [], _count: { reviews: 0 } },
      ])
      mockPrisma.shopReview.groupBy.mockResolvedValue([])

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('テスト')

      expect(result.shops[0]!.avgRating).toBe(0)
    })
  })

  // ============================================================
  // searchEvents - trgm mode
  // ============================================================

  describe('searchEvents - trgm mode', async () => {
    it('trgmモードで全文検索を実行する', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchEvents.mockResolvedValue(['event-1'])
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-1', title: 'テストイベント', startDate: new Date(),
          creator: { id: 'user-1', nickname: 'テスト', avatarUrl: null },
        },
      ])

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('テスト')

      expect(mockFulltextSearchEvents).toHaveBeenCalled()
      expect(result.events).toHaveLength(1)
    })

    it('trgmモードで結果が0件の場合は空配列を返す', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchEvents.mockResolvedValue([])

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('存在しない')

      expect(result.events).toEqual([])
    })

    it('trgmモードでnextCursorが設定される', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      const ids = Array(20).fill(null).map((_, i) => `event-${i}`)
      mockFulltextSearchEvents.mockResolvedValue(ids)
      const events = ids.map(id => ({
        id, title: 'test', startDate: new Date(),
        creator: { id: 'u1', nickname: 'test', avatarUrl: null },
      }))
      mockPrisma.event.findMany.mockResolvedValue(events)

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('テスト')

      expect(result.nextCursor).toBe('event-19')
    })
  })

  // ============================================================
  // searchEvents - LIKE mode edge cases
  // ============================================================

  describe('searchEvents - LIKE mode edge cases', async () => {
    it('カーソル付きでLIKE検索する', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { searchEvents } = await import('@/lib/actions/search')
      await searchEvents('テスト', 'cursor-event', 5)

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-event' },
          skip: 1,
          take: 5,
        })
      )
    })

    it('LIKE検索でnextCursorが正しく設定される', async () => {
      const events = Array(20).fill(null).map((_, i) => ({
        id: `event-${i}`, title: 'test', startDate: new Date(),
        creator: { id: 'u1', nickname: 'test', avatarUrl: null },
      }))
      mockPrisma.event.findMany.mockResolvedValue(events)

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('テスト')

      expect(result.nextCursor).toBe('event-19')
    })

    it('optionsがundefinedの場合はデフォルト値が使われる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { searchEvents } = await import('@/lib/actions/search')
      await searchEvents('テスト', undefined, 20, undefined)

      // includeExpired defaults to false
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.any(Array),
              }),
            ]),
          }),
        })
      )
    })

    it('空のクエリでも検索できる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('')

      expect(result.events).toEqual([])
    })
  })

  // ============================================================
  // searchBonsais - trgm mode
  // ============================================================

  describe('searchBonsais - trgm mode', async () => {
    it('trgmモードで全文検索を実行する', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchBonsais.mockResolvedValue(['bonsai-1'])
      mockPrisma.bonsai.findMany.mockResolvedValue([
        {
          id: 'bonsai-1', name: 'テスト盆栽', species: '黒松',
          user: { id: 'u1', nickname: 'テスト', avatarUrl: null },
          _count: { records: 3, posts: 2 },
        },
      ])

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('テスト')

      expect(mockFulltextSearchBonsais).toHaveBeenCalled()
      expect(result.bonsais).toHaveLength(1)
      expect(result.bonsais[0]!.recordCount).toBe(3)
      expect(result.bonsais[0]!.postCount).toBe(2)
    })

    it('trgmモードで結果が0件の場合は空配列を返す', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchBonsais.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('存在しない')

      expect(result.bonsais).toEqual([])
    })

    it('trgmモードでnextCursorが設定される', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      const ids = Array(20).fill(null).map((_, i) => `bonsai-${i}`)
      mockFulltextSearchBonsais.mockResolvedValue(ids)
      const bonsais = ids.map(id => ({
        id, name: 'test', species: 'test',
        user: { id: 'u1', nickname: 'test', avatarUrl: null },
        _count: { records: 0, posts: 0 },
      }))
      mockPrisma.bonsai.findMany.mockResolvedValue(bonsais)

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('テスト')

      expect(result.nextCursor).toBe('bonsai-19')
    })

    it('trgmモードでは認証ユーザーの userId が渡される（引数 userId は無視）', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      mockFulltextSearchBonsais.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/search')
      await (searchBonsais as unknown as (q: string, c: undefined, l: number, u: string) => Promise<unknown>)('テスト', undefined, 20, 'user-1')

      expect(mockFulltextSearchBonsais).toHaveBeenCalledWith('テスト', expect.objectContaining({
        userId: mockUser.id,
      }))
    })
  })

  // ============================================================
  // searchBonsais - LIKE mode cursor
  // ============================================================

  describe('searchBonsais - LIKE cursor', async () => {
    it('カーソル付きでLIKE検索する', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/search')
      await searchBonsais('テスト', 'cursor-bonsai', 5)

      expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-bonsai' },
          skip: 1,
          take: 5,
        })
      )
    })

    it('LIKE検索でnextCursorが正しく設定される', async () => {
      const bonsais = Array(20).fill(null).map((_, i) => ({
        id: `bonsai-${i}`, name: 'test', species: 'test',
        user: { id: 'u1', nickname: 'test', avatarUrl: null },
        _count: { records: 0, posts: 0 },
      }))
      mockPrisma.bonsai.findMany.mockResolvedValue(bonsais)

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('テスト')

      expect(result.nextCursor).toBe('bonsai-19')
    })
  })

  // ============================================================
  // searchGlobal - unauthenticated
  // ============================================================

  describe('searchGlobal - unauthenticated', async () => {
    it('未認証ユーザーでもグローバル検索できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockFulltextSearchGlobal.mockResolvedValue({
        postIds: [], userIds: [], shopIds: [], eventIds: [], bonsaiIds: [],
      })

      const { searchGlobal } = await import('@/lib/actions/search')
      const result = await searchGlobal('テスト')

      expect(mockGetExcludedUserIds).not.toHaveBeenCalled()
      expect(result.posts).toEqual([])
    })
  })

  // ============================================================
  // searchGlobal - partial results
  // ============================================================

  describe('searchGlobal - partial results', async () => {
    it('一部のカテゴリのみ結果がある場合', async () => {
      mockFulltextSearchGlobal.mockResolvedValue({
        postIds: ['post-1'],
        userIds: [],
        shopIds: [],
        eventIds: ['event-1'],
        bonsaiIds: [],
      })
      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'post-1', content: 'テスト',
          user: { id: 'u1', nickname: 'テスト', avatarUrl: null },
          media: [],
          _count: { likes: 3, comments: 1 },
        },
      ])
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-1', title: 'イベント', startDate: new Date(),
          endDate: null, prefecture: '東京都', venue: '会場',
        },
      ])

      const { searchGlobal } = await import('@/lib/actions/search')
      const result = await searchGlobal('テスト')

      expect(result.posts).toHaveLength(1)
      expect(result.posts![0]!.likeCount).toBe(3)
      expect(result.users).toEqual([])
      expect(result.shops).toEqual([])
      expect(result.events).toHaveLength(1)
      expect(result.bonsais).toEqual([])
    })
  })

  // ============================================================
  // searchShops - fulltext mode with missing IDs
  // ============================================================

  describe('searchShops - fulltext ID ordering', async () => {
    it('全文検索結果のIDのうちDBに存在しないものは除外される', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchShops.mockResolvedValue(['shop-1', 'shop-missing', 'shop-2'])
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        { id: 'shop-2', name: '園2', address: '大阪', genres: [], _count: { reviews: 0 } },
        { id: 'shop-1', name: '園1', address: '東京', genres: [{ genre: { id: 'g1', name: 'G' } }], _count: { reviews: 1 } },
      ])
      mockPrisma.shopReview.groupBy.mockResolvedValue([
        { shopId: 'shop-1', _avg: { rating: 4.0 } },
        { shopId: 'shop-2', _avg: { rating: 0 } },
      ])

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('テスト')

      expect(result.shops).toHaveLength(2)
      expect(result.shops[0]!.id).toBe('shop-1')
      expect(result.shops[1]!.id).toBe('shop-2')
    })
  })

  // ============================================================
  // searchEvents - fulltext mode with missing IDs
  // ============================================================

  describe('searchEvents - fulltext ID ordering', async () => {
    it('全文検索結果のIDのうちDBに存在しないものは除外される', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchEvents.mockResolvedValue(['event-1', 'event-missing'])
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-1', title: 'イベント',
          creator: { id: 'u1', nickname: 'テスト', avatarUrl: null },
        },
      ])

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('テスト')

      expect(result.events).toHaveLength(1)
    })
  })

  // ============================================================
  // searchBonsais - fulltext mode with missing IDs
  // ============================================================

  describe('searchBonsais - fulltext ID ordering', async () => {
    it('全文検索結果のIDのうちDBに存在しないものは除外される', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchBonsais.mockResolvedValue(['bonsai-1', 'bonsai-missing'])
      mockPrisma.bonsai.findMany.mockResolvedValue([
        {
          id: 'bonsai-1', name: '盆栽',
          user: { id: 'u1', nickname: 'テスト', avatarUrl: null },
          _count: { records: 1, posts: 1 },
        },
      ])

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('テスト')

      expect(result.bonsais).toHaveLength(1)
      expect(result.bonsais[0]!.recordCount).toBe(1)
    })
  })

  // ============================================================
  // getSearchModeInfo - trgm
  // ============================================================

  describe('getSearchModeInfo - trgm', async () => {
    it('trgmモードを正しく返す', async () => {
      mockGetSearchMode.mockReturnValue('trgm')

      const { getSearchModeInfo } = await import('@/lib/actions/search')
      const result = await getSearchModeInfo()

      expect(result.mode).toBe('trgm')
    })
  })

  // ============================================================
  // searchUsers - fulltext mode with missing IDs
  // ============================================================

  describe('searchUsers - fulltext ID ordering', async () => {
    it('全文検索結果のIDのうちDBに存在しないものは除外される', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchUsers.mockResolvedValue(['user-1', 'user-missing'])
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', nickname: 'テスト', avatarUrl: null, bio: null, _count: { followers: 10, following: 5 } },
      ])

      const { searchUsers } = await import('@/lib/actions/search')
      const result = await searchUsers('テスト')

      expect(result.success).toBe(true)
      if (!result.success) return
      expect(result.data?.users).toHaveLength(1)
      expect(result.data?.users[0]!.followersCount).toBe(10)
    })
  })

  // ============================================================
  // searchShops - empty query with LIKE mode
  // ============================================================

  describe('searchShops - empty query with LIKE', async () => {
    it('空クエリでbigmモードの場合はLIKE検索にフォールバック', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { searchShops } = await import('@/lib/actions/search')
      await searchShops('')

      expect(mockFulltextSearchShops).not.toHaveBeenCalled()
      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalled()
    })
  })

  // ============================================================
  // searchEvents - empty query with bigm mode
  // ============================================================

  describe('searchEvents - empty query with bigm mode', async () => {
    it('空クエリでbigmモードの場合はLIKE検索にフォールバック', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockPrisma.event.findMany.mockResolvedValue([])

      const { searchEvents } = await import('@/lib/actions/search')
      await searchEvents('')

      expect(mockFulltextSearchEvents).not.toHaveBeenCalled()
      expect(mockPrisma.event.findMany).toHaveBeenCalled()
    })
  })

  // ============================================================
  // searchBonsais - empty query with bigm mode
  // ============================================================

  describe('searchBonsais - empty query with bigm mode', async () => {
    it('空クエリでbigmモードの場合はLIKE検索にフォールバック', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockPrisma.bonsai.findMany.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/search')
      await searchBonsais('')

      expect(mockFulltextSearchBonsais).not.toHaveBeenCalled()
      expect(mockPrisma.bonsai.findMany).toHaveBeenCalled()
    })
  })

  // ============================================================
  // searchPosts - LIKE mode no posts returned = no like/bookmark fetch
  // ============================================================

  describe('searchPosts - no results skips like/bookmark fetch', async () => {
    it('投稿が0件の場合はいいね/ブックマーク取得をスキップ', async () => {
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = unwrap(await searchPosts('テスト'))

      expect(mockPrisma.like.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.bookmark.findMany).not.toHaveBeenCalled()
      expect(result.posts).toEqual([])
    })
  })

  // ============================================================
  // searchByTag - no excludedUserIds when empty
  // ============================================================

  describe('searchByTag - no excluded users', async () => {
    it('除外ユーザーが空の場合は userId フィルタが付かない (Hashtag JOIN クエリ)', async () => {
      mockGetExcludedUserIds.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])

      const { searchByTag } = await import('@/lib/actions/search')
      await searchByTag('盆栽')

      const callArg = mockPrisma.post.findMany.mock.calls[0][0]
      expect(callArg.where).toEqual(expect.objectContaining({
        hashtags: { some: { hashtag: { name: '盆栽' } } },
      }))
      expect(callArg.where.userId).toBeUndefined()
    })
  })
})
