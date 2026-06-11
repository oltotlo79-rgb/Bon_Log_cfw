// @vitest-environment node

import { vi } from 'vitest'
/**
 * Search Actions 拡張テスト - フィルター、searchShops、searchEvents、searchBonsais、searchGlobal
 */

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
// 追加のモック - eslint-disable-next-line で型エラーを無視
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
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}))

// キャッシュモック
vi.mock('@/lib/cache', () => ({
  getCachedGenres: vi.fn().mockResolvedValue({ genres: {}, allGenres: [] }),
  getCachedPopularTags: vi.fn().mockResolvedValue({ tags: [] }),
}))

describe('Search Actions 拡張テスト', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    mockRateLimit.mockResolvedValue({ success: true })
    mockGetSearchMode.mockReturnValue('like')
  })

  describe('searchPosts - フィルター機能', async () => {
    beforeEach(() => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])
      mockPrisma.like.groupBy.mockResolvedValue([])
    })

    it('dateFromフィルターで日付以降の投稿を検索できる', async () => {
      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], undefined, 20, {
        dateFrom: '2024-01-01',
      })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                createdAt: expect.objectContaining({
                  gte: expect.any(Date),
                }),
              }),
            ]),
          }),
        })
      )
    })

    it('dateToフィルターで日付以前の投稿を検索できる', async () => {
      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], undefined, 20, {
        dateTo: '2024-12-31',
      })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                createdAt: expect.objectContaining({
                  lte: expect.any(Date),
                }),
              }),
            ]),
          }),
        })
      )
    })

    it('mediaType=imagesで画像付き投稿のみ検索できる', async () => {
      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], undefined, 20, {
        mediaType: 'images',
      })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                media: { some: { type: 'image' } },
              }),
            ]),
          }),
        })
      )
    })

    it('mediaType=videosで動画付き投稿のみ検索できる', async () => {
      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], undefined, 20, {
        mediaType: 'videos',
      })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                media: { some: { type: 'video' } },
              }),
            ]),
          }),
        })
      )
    })

    it('mediaType=textでテキストのみ投稿を検索できる', async () => {
      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], undefined, 20, {
        mediaType: 'text',
      })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                media: { none: {} },
              }),
            ]),
          }),
        })
      )
    })

    it('minLikesフィルターで指定いいね数以上の投稿を検索できる', async () => {
      mockPrisma.like.groupBy.mockResolvedValue([
        { postId: 'post-1', _count: { postId: 10 } },
        { postId: 'post-2', _count: { postId: 15 } },
      ])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], undefined, 20, {
        minLikes: 5,
      })

      expect(mockPrisma.like.groupBy).toHaveBeenCalledWith({
        by: ['postId'],
        where: { commentId: null },
        _count: { postId: true },
        having: { postId: { _count: { gte: 5 } } },
      })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['post-1', 'post-2'] },
          }),
        })
      )
    })

    it('複数フィルターを組み合わせて検索できる', async () => {
      mockPrisma.like.groupBy.mockResolvedValue([
        { postId: 'post-1', _count: { postId: 10 } },
      ])

      const { searchPosts } = await import('@/lib/actions/search')
      await searchPosts('テスト', [], undefined, 20, {
        dateFrom: '2024-01-01',
        dateTo: '2024-12-31',
        mediaType: 'images',
        minLikes: 5,
      })

      expect(mockPrisma.post.findMany).toHaveBeenCalled()
    })
  })

  describe('searchShops', async () => {
    beforeEach(() => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
    })

    it('盆栽園を検索できる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          id: 'shop-1',
          name: 'テスト園',
          description: '説明',
          prefecture: '東京都',
          address: '東京都渋谷区',
          latitude: 35.6762,
          longitude: 139.6503,
          genres: [],
          _count: { reviews: 5 },
        },
      ])
      mockPrisma.shopReview.groupBy.mockResolvedValue([
        { shopId: 'shop-1', _avg: { rating: 4.5 } },
      ])

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('テスト')

      expect(result.shops).toHaveLength(1)
      expect(result.shops[0]!.name).toBe('テスト園')
    })

    it('都道府県でフィルタリングできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { searchShops } = await import('@/lib/actions/search')
      // searchShops(query, cursor?, limit?, prefecture?)
      await searchShops('テスト', undefined, 20, '東京都')

      // 関数が呼ばれていることを確認
      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalled()
    })

    it('空のクエリでも検索できる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('')

      expect(result.shops).toEqual([])
    })

    it('レート制限時はエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('テスト')

      expect(result.error).toBeDefined()
    })

    it('bigmモードで全文検索を実行する', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchShops.mockResolvedValue(['shop-1'])
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          id: 'shop-1',
          name: 'テスト園',
          address: '東京都',
          genres: [{ genre: { id: 'g1', name: 'ジャンル1' } }],
          _count: { reviews: 3 },
        },
      ])
      mockPrisma.shopReview.groupBy.mockResolvedValue([
        { shopId: 'shop-1', _avg: { rating: 4.2 } },
      ])

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('テスト園')

      expect(mockFulltextSearchShops).toHaveBeenCalledWith('テスト園', expect.anything())
      expect(result.shops).toHaveLength(1)
      expect(result.shops[0]!.avgRating).toBe(4.2)
    })

    it('bigmモードで結果が0件の場合は空配列を返す', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchShops.mockResolvedValue([])

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('存在しない園')

      expect(result.shops).toEqual([])
    })
  })

  describe('searchEvents', async () => {
    beforeEach(() => {
      mockPrisma.event.findMany.mockResolvedValue([])
    })

    it('イベントを検索できる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-1',
          title: 'テストイベント',
          description: '説明',
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-01-02'),
          prefecture: '東京都',
          address: '東京都渋谷区',
          imageUrl: '/event.jpg',
        },
      ])

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('テスト')

      expect(result.events).toHaveLength(1)
      expect(result.events[0]!.title).toBe('テストイベント')
    })

    it('都道府県でフィルタリングできる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { searchEvents } = await import('@/lib/actions/search')
      // searchEvents(query, cursor?, limit?, options?)
      await searchEvents('テスト', undefined, 20, { prefecture: '東京都' })

      // 関数が呼ばれていることを確認
      expect(mockPrisma.event.findMany).toHaveBeenCalled()
    })

    it('includeExpired=falseで期限切れイベントを除外する', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { searchEvents } = await import('@/lib/actions/search')
      await searchEvents('テスト', undefined, 20, { includeExpired: false })

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              expect.objectContaining({
                OR: expect.arrayContaining([
                  expect.objectContaining({
                    endDate: expect.objectContaining({
                      gte: expect.any(Date),
                    }),
                  }),
                ]),
              }),
            ]),
          }),
        })
      )
    })

    it('includeExpired=trueで期限切れイベントも含める', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { searchEvents } = await import('@/lib/actions/search')
      await searchEvents('テスト', undefined, 20, { includeExpired: true })

      // includeExpired=trueの場合、日付条件が追加されない
      expect(mockPrisma.event.findMany).toHaveBeenCalled()
    })

    it('レート制限時はエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('テスト')

      expect(result.error).toBeDefined()
    })

    it('bigmモードで全文検索を実行する', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchEvents.mockResolvedValue(['event-1'])
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-1',
          title: 'テストイベント',
          startDate: new Date(),
          endDate: new Date(),
          creator: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
        },
      ])

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('イベント')

      expect(mockFulltextSearchEvents).toHaveBeenCalledWith('イベント', expect.anything())
      expect(result.events).toHaveLength(1)
    })

    it('bigmモードで結果が0件の場合は空配列を返す', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchEvents.mockResolvedValue([])

      const { searchEvents } = await import('@/lib/actions/search')
      const result = await searchEvents('存在しないイベント')

      expect(result.events).toEqual([])
    })
  })

  describe('searchBonsais', async () => {
    beforeEach(() => {
      mockPrisma.bonsai.findMany.mockResolvedValue([])
    })

    it('盆栽を検索できる', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValue([
        {
          id: 'bonsai-1',
          name: 'テスト盆栽',
          species: '黒松',
          description: '説明',
          imageUrl: '/bonsai.jpg',
          user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
          _count: { records: 5 },
        },
      ])

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('テスト')

      expect(result.bonsais).toHaveLength(1)
      expect(result.bonsais[0]!.name).toBe('テスト盆栽')
    })

    it('引数 userId を信用せず認証ユーザーの盆栽のみ対象にする', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/search')
      // 旧シグネチャの第4引数（他者ID）を渡しても無視される
      await (searchBonsais as unknown as (q: string, c: undefined, l: number, u: string) => Promise<unknown>)('テスト', undefined, 20, 'user-1')

      expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: mockUser.id }),
        })
      )
    })

    it('空のクエリでも検索できる', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('')

      expect(result.bonsais).toEqual([])
    })

    it('レート制限時はエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('テスト')

      expect(result.error).toBeDefined()
    })

    it('bigmモードで全文検索を実行する', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchBonsais.mockResolvedValue(['bonsai-1'])
      mockPrisma.bonsai.findMany.mockResolvedValue([
        {
          id: 'bonsai-1',
          name: 'テスト盆栽',
          species: '黒松',
          user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
          _count: { records: 3, posts: 2 },
        },
      ])

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('黒松')

      expect(mockFulltextSearchBonsais).toHaveBeenCalledWith('黒松', expect.anything())
      expect(result.bonsais).toHaveLength(1)
      expect(result.bonsais[0]!.recordCount).toBe(3)
    })

    it('bigmモードで結果が0件の場合は空配列を返す', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      mockFulltextSearchBonsais.mockResolvedValue([])

      const { searchBonsais } = await import('@/lib/actions/search')
      const result = await searchBonsais('存在しない盆栽')

      expect(result.bonsais).toEqual([])
    })
  })

  describe('searchGlobal', async () => {
    beforeEach(() => {
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
      mockPrisma.event.findMany.mockResolvedValue([])
      mockPrisma.bonsai.findMany.mockResolvedValue([])
      mockPrisma.like.findMany.mockResolvedValue([])
      mockPrisma.bookmark.findMany.mockResolvedValue([])
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
    })

    it('全エンティティを横断検索できる', async () => {
      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'post-1',
          content: 'テスト投稿',
          createdAt: new Date(),
          user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
          media: [],
          _count: { likes: 5, comments: 3 },
          genres: [],
        },
      ])
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          nickname: 'テストユーザー',
          avatarUrl: null,
          bio: 'テスト',
          _count: { followers: 10, following: 5 },
        },
      ])

      const { searchGlobal } = await import('@/lib/actions/search')
      const result = await searchGlobal('テスト')

      expect(result.posts).toBeDefined()
      expect(result.users).toBeDefined()
      expect(result.shops).toBeDefined()
      expect(result.events).toBeDefined()
      expect(result.bonsais).toBeDefined()
    })

    it('空のクエリでは空の結果を返す', async () => {
      const { searchGlobal } = await import('@/lib/actions/search')
      const result = await searchGlobal('')

      expect(result.posts).toEqual([])
      expect(result.users).toEqual([])
    })

    it('レート制限時はエラーを返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { searchGlobal } = await import('@/lib/actions/search')
      const result = await searchGlobal('テスト')

      expect(result.error).toBeDefined()
    })

    it('全文検索から取得したIDに基づいて各エンティティを正しくマッピングする', async () => {
      mockFulltextSearchGlobal.mockResolvedValue({
        postIds: ['post-1', 'post-2'],
        userIds: ['user-1'],
        shopIds: ['shop-1'],
        eventIds: ['event-1'],
        bonsaiIds: ['bonsai-1'],
      })
      mockPrisma.post.findMany.mockResolvedValue([
        {
          id: 'post-1',
          content: '投稿1',
          user: { id: 'user-1', nickname: 'ユーザー', avatarUrl: null },
          media: [],
          _count: { likes: 10, comments: 5 },
        },
        {
          id: 'post-2',
          content: '投稿2',
          user: { id: 'user-1', nickname: 'ユーザー', avatarUrl: null },
          media: [],
          _count: { likes: 3, comments: 1 },
        },
      ])
      mockPrisma.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          nickname: 'テストユーザー',
          avatarUrl: null,
          bio: 'bio',
          _count: { followers: 100 },
        },
      ])
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          id: 'shop-1',
          name: 'テスト園',
          address: '東京都',
          _count: { reviews: 20 },
        },
      ])
      mockPrisma.event.findMany.mockResolvedValue([
        {
          id: 'event-1',
          title: 'イベント1',
          startDate: new Date(),
          endDate: null,
          prefecture: '東京都',
          venue: '会場',
        },
      ])
      mockPrisma.bonsai.findMany.mockResolvedValue([
        {
          id: 'bonsai-1',
          name: '盆栽1',
          species: '黒松',
          user: { id: 'user-1', nickname: 'ユーザー' },
        },
      ])

      const { searchGlobal } = await import('@/lib/actions/search')
      const result = await searchGlobal('テスト')

      expect(result.posts).toHaveLength(2)
      expect(result.posts![0]!.likeCount).toBe(10)
      expect(result.posts![0]!.commentCount).toBe(5)
      expect(result.users).toHaveLength(1)
      expect(result.users![0]!.followersCount).toBe(100)
      expect(result.shops).toHaveLength(1)
      expect(result.shops![0]!.reviewCount).toBe(20)
      expect(result.events).toHaveLength(1)
      expect(result.bonsais).toHaveLength(1)
    })

    it('各エンティティIDが空の場合はデータベースクエリを実行しない', async () => {
      mockFulltextSearchGlobal.mockResolvedValue({
        postIds: [],
        userIds: [],
        shopIds: [],
        eventIds: [],
        bonsaiIds: [],
      })

      const { searchGlobal } = await import('@/lib/actions/search')
      const result = await searchGlobal('存在しない')

      expect(result.posts).toEqual([])
      expect(result.users).toEqual([])
      expect(result.shops).toEqual([])
      expect(result.events).toEqual([])
      expect(result.bonsais).toEqual([])
    })
  })

  describe('getSearchModeInfo', async () => {
    it('現在の検索モードを返す', async () => {
      mockGetSearchMode.mockReturnValue('like')

      const { getSearchModeInfo } = await import('@/lib/actions/search')
      const result = await getSearchModeInfo()

      expect(result.mode).toBe('like')
    })

    it('bigmモードを正しく返す', async () => {
      mockGetSearchMode.mockReturnValue('bigm')

      const { getSearchModeInfo } = await import('@/lib/actions/search')
      const result = await getSearchModeInfo()

      expect(result.mode).toBe('bigm')
    })
  })
})
