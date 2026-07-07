// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
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

const mockGetSearchMode = vi.fn().mockReturnValue('like')
vi.mock('@/lib/search/fulltext', () => ({
  fulltextSearchShops: vi.fn().mockResolvedValue([]),
  fulltextSearchEvents: vi.fn().mockResolvedValue([]),
  fulltextSearchBonsais: vi.fn().mockResolvedValue([]),
  fulltextSearchGlobal: vi.fn().mockResolvedValue({ postIds: [], userIds: [], shopIds: [], eventIds: [], bonsaiIds: [] }),
  getSearchMode: () => mockGetSearchMode(),
}))

vi.mock('@/lib/actions/filter-helper', () => ({
  getExcludedUserIds: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual('@/lib/actions/utils')
  return {
    ...actual,
    getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
    getGuestUserId: vi.fn().mockResolvedValue(null),
  }
})

import { ERR_SEARCH_QUERY_TOO_LONG, ERR_SEARCH_RATE_LIMIT } from '@/lib/constants/errors'

const longQuery = 'a'.repeat(101)

describe('search-entities actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
    mockGetSearchMode.mockReturnValue('like')
    mockAuth.mockResolvedValue(null)
  })

  // ============================================================
  // searchShops
  // ============================================================
  describe('searchShops', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/search-entities')
      return mod.searchShops
    }

    it('クエリが長すぎる場合エラーを返す', async () => {
      const action = await importAction()
      const result = await action(longQuery)
      expect(result).toMatchObject({ shops: [], error: ERR_SEARCH_QUERY_TOO_LONG })
      expect(result.nextCursor).toBeUndefined()
    })

    it('レート制限超過時にエラーを返す', async () => {
      mockRateLimit.mockResolvedValue({ success: false })
      const action = await importAction()
      const result = await action('松')
      expect(result).toMatchObject({ shops: [], error: ERR_SEARCH_RATE_LIMIT })
    })

    it('LIKE検索で盆栽園一覧をreviewCount・avgRating付きで返す', async () => {
      const shops = [
        {
          id: 'shop-1',
          name: '松風園',
          address: '東京都渋谷区',
          createdAt: new Date(),
          _count: { reviews: 3 },
          genres: [{ genre: { id: 'g1', name: '松柏類', category: '盆栽' } }],
        },
      ]
      mockPrisma.bonsaiShop.findMany.mockResolvedValue(shops)
      mockPrisma.shopReview.groupBy.mockResolvedValue([
        { shopId: 'shop-1', _avg: { rating: 4.5 } },
      ])
      const action = await importAction()

      const result = await action('松風')
      expect(result.shops).toHaveLength(1)
      expect(result.shops[0]).toMatchObject({
        id: 'shop-1',
        name: '松風園',
        reviewCount: 3,
        avgRating: 4.5,
      })
      // genres should be flattened (sg.genre)
      expect(result.shops[0]!.genres).toEqual([{ id: 'g1', name: '松柏類', category: '盆栽' }])
      expect(result.error).toBeUndefined()
    })

    it('都道府県フィルタを適用する', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
      const action = await importAction()

      await action('test', undefined, undefined, '東京都')

      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { address: { contains: '東京都' } },
            ]),
          }),
        })
      )
    })

    it('結果がない場合は空配列を返す', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
      const action = await importAction()

      const result = await action('存在しない')
      expect(result.shops).toEqual([])
      expect(result.nextCursor).toBeUndefined()
    })

    it('limit件取得時にnextCursorを返す', async () => {
      const shops = Array.from({ length: 20 }, (_, i) => ({
        id: `shop-${i}`,
        name: `Shop ${i}`,
        address: 'Addr',
        createdAt: new Date(),
        _count: { reviews: 0 },
        genres: [],
      }))
      mockPrisma.bonsaiShop.findMany.mockResolvedValue(shops)
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
      const action = await importAction()

      const result = await action('', undefined, 20)
      expect(result.nextCursor).toBe('shop-19')
    })

    it('結果がlimit未満の場合nextCursorを返さない', async () => {
      const shops = [
        {
          id: 'shop-1',
          name: 'Shop',
          address: 'Addr',
          createdAt: new Date(),
          _count: { reviews: 0 },
          genres: [],
        },
      ]
      mockPrisma.bonsaiShop.findMany.mockResolvedValue(shops)
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
      const action = await importAction()

      const result = await action('Shop')
      expect(result.nextCursor).toBeUndefined()
    })

    it('レビューがない盆栽園のavgRatingは0', async () => {
      const shops = [
        {
          id: 'shop-1',
          name: 'Shop',
          address: 'Addr',
          createdAt: new Date(),
          _count: { reviews: 0 },
          genres: [],
        },
      ]
      mockPrisma.bonsaiShop.findMany.mockResolvedValue(shops)
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
      const action = await importAction()

      const result = await action('Shop')
      expect(result.shops[0]!.avgRating).toBe(0)
    })

    it('過大な limit は MAX_PAGE_LIMIT に clamp する', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
      const action = await importAction()

      await action('Shop', undefined, 1_000_000)
      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      )
    })

    it('全文検索の final fetch で isHidden:false を再適用する', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      vi.mocked(fulltextSearchShops).mockResolvedValue(['shop-1'])
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
      const action = await importAction()

      await action('盆栽')
      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isHidden: false }) }),
      )
    })

    it('trgmモード: 結果がsafeLimit件でもnextCursorは常にundefined（類似度順でkeysetが成立しないため）', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const shopIds = Array.from({ length: 20 }, (_, i) => `shop-${i}`)
      vi.mocked(fulltextSearchShops).mockResolvedValue(shopIds)
      const shops = shopIds.map((id) => ({
        id,
        name: id,
        address: 'Addr',
        createdAt: new Date(),
        _count: { reviews: 0 },
        genres: [],
      }))
      mockPrisma.bonsaiShop.findMany.mockResolvedValue(shops)
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
      const action = await importAction()

      const result = await action('盆栽', undefined, 20)
      expect(result.shops).toHaveLength(20)
      expect(result.nextCursor).toBeUndefined()
    })

    it('bigmモード: 結果がsafeLimit件の場合は従来通りnextCursorを返す（回帰確認）', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const shopIds = Array.from({ length: 20 }, (_, i) => `shop-${i}`)
      vi.mocked(fulltextSearchShops).mockResolvedValue(shopIds)
      const shops = shopIds.map((id) => ({
        id,
        name: id,
        address: 'Addr',
        createdAt: new Date(),
        _count: { reviews: 0 },
        genres: [],
      }))
      mockPrisma.bonsaiShop.findMany.mockResolvedValue(shops)
      mockPrisma.shopReview.groupBy.mockResolvedValue([])
      const action = await importAction()

      const result = await action('盆栽', undefined, 20)
      expect(result.nextCursor).toBe('shop-19')
    })
  })

  // ============================================================
  // searchEvents
  // ============================================================
  describe('searchEvents', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/search-entities')
      return mod.searchEvents
    }

    it('クエリが長すぎる場合エラーを返す', async () => {
      const action = await importAction()
      const result = await action(longQuery)
      expect(result).toMatchObject({ events: [], error: ERR_SEARCH_QUERY_TOO_LONG })
      expect(result.nextCursor).toBeUndefined()
    })

    it('レート制限超過時にエラーを返す', async () => {
      mockRateLimit.mockResolvedValue({ success: false })
      const action = await importAction()
      const result = await action('盆栽展')
      expect(result).toMatchObject({ events: [], error: ERR_SEARCH_RATE_LIMIT })
    })

    it('LIKE検索でcreator情報付きのイベント一覧を返す', async () => {
      const events = [
        {
          id: 'ev-1',
          title: '盆栽展',
          description: '素晴らしいイベント',
          startDate: new Date('2026-06-01'),
          endDate: new Date('2026-06-03'),
          isHidden: false,
          prefecture: '東京都',
          venue: '東京ホール',
          creator: { id: 'u1', nickname: 'Creator', avatarUrl: null },
        },
      ]
      mockPrisma.event.findMany.mockResolvedValue(events)
      const action = await importAction()

      const result = await action('盆栽展')
      expect(result.events).toHaveLength(1)
      expect(result.events[0]!.title).toBe('盆栽展')
      expect(result.events[0]!.creator).toMatchObject({ id: 'u1', nickname: 'Creator' })
      expect(result.error).toBeUndefined()
    })

    it('デフォルトで期限切れイベントを除外する', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])
      const action = await importAction()

      await action('test')

      const callArgs = mockPrisma.event.findMany.mock.calls[0][0]
      const andConditions = callArgs.where.AND
      // Should have a date filter with OR condition (non-expired)
      const hasDateFilter = andConditions.some(
        (c: Record<string, unknown>) => c.OR !== undefined
      )
      expect(hasDateFilter).toBe(true)
    })

    it('includeExpired=trueで期限切れイベントも含む', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])
      const action = await importAction()

      await action('test', undefined, undefined, { includeExpired: true })

      const callArgs = mockPrisma.event.findMany.mock.calls[0][0]
      const andConditions = callArgs.where.AND
      // When includeExpired is true, first condition is empty object
      const hasEmptyDateFilter = andConditions.some(
        (c: Record<string, unknown>) => Object.keys(c).length === 0
      )
      expect(hasEmptyDateFilter).toBe(true)
    })

    it('都道府県フィルタを適用する', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])
      const action = await importAction()

      await action('test', undefined, undefined, { prefecture: '大阪府' })

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { prefecture: '大阪府' },
            ]),
          }),
        })
      )
    })

    it('limit件取得時にnextCursorを返す', async () => {
      const events = Array.from({ length: 20 }, (_, i) => ({
        id: `event-${i}`,
        title: `Event ${i}`,
        description: '',
        startDate: new Date(),
        endDate: null,
        isHidden: false,
        creator: { id: 'u1', nickname: 'User', avatarUrl: null },
      }))
      mockPrisma.event.findMany.mockResolvedValue(events)
      const action = await importAction()

      const result = await action('Event')
      expect(result.nextCursor).toBe('event-19')
    })

    it('全文検索の final fetch で isHidden:false を再適用する', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      vi.mocked(fulltextSearchEvents).mockResolvedValue(['ev-1'])
      mockPrisma.event.findMany.mockResolvedValue([])
      const action = await importAction()

      await action('盆栽展')
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ isHidden: false }) }),
      )
    })

    it('trgmモード: 結果がsafeLimit件でもnextCursorは常にundefined', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const eventIds = Array.from({ length: 20 }, (_, i) => `event-${i}`)
      vi.mocked(fulltextSearchEvents).mockResolvedValue(eventIds)
      const events = eventIds.map((id) => ({
        id,
        title: id,
        description: '',
        startDate: new Date(),
        endDate: null,
        isHidden: false,
        creator: { id: 'u1', nickname: 'User', avatarUrl: null },
      }))
      mockPrisma.event.findMany.mockResolvedValue(events)
      const action = await importAction()

      const result = await action('盆栽展', undefined, 20)
      expect(result.events).toHaveLength(20)
      expect(result.nextCursor).toBeUndefined()
    })

    it('bigmモード: 結果がsafeLimit件の場合は従来通りnextCursorを返す（回帰確認）', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const eventIds = Array.from({ length: 20 }, (_, i) => `event-${i}`)
      vi.mocked(fulltextSearchEvents).mockResolvedValue(eventIds)
      const events = eventIds.map((id) => ({
        id,
        title: id,
        description: '',
        startDate: new Date(),
        endDate: null,
        isHidden: false,
        creator: { id: 'u1', nickname: 'User', avatarUrl: null },
      }))
      mockPrisma.event.findMany.mockResolvedValue(events)
      const action = await importAction()

      const result = await action('盆栽展', undefined, 20)
      expect(result.nextCursor).toBe('event-19')
    })
  })

  // ============================================================
  // searchBonsais
  // ============================================================
  describe('searchBonsais', () => {
    beforeEach(() => {
      // 盆栽検索は所有者専用（要認証）
      mockAuth.mockResolvedValue({ user: { id: 'auth-user' } })
    })

    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/search-entities')
      return mod.searchBonsais
    }

    it('クエリが長すぎる場合エラーを返す', async () => {
      const action = await importAction()
      const result = await action(longQuery)
      expect(result).toMatchObject({ bonsais: [], error: ERR_SEARCH_QUERY_TOO_LONG })
      expect(result.nextCursor).toBeUndefined()
    })

    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const action = await importAction()
      const result = await action('黒松')
      expect(result.bonsais).toEqual([])
      expect(result.error).toBeDefined()
      expect(mockPrisma.bonsai.findMany).not.toHaveBeenCalled()
    })

    it('レート制限超過時にエラーを返す', async () => {
      mockRateLimit.mockResolvedValue({ success: false })
      const action = await importAction()
      const result = await action('黒松')
      expect(result).toMatchObject({ bonsais: [], error: ERR_SEARCH_RATE_LIMIT })
    })

    it('LIKE検索でuser情報・recordCount・postCount付きの盆栽一覧を返す', async () => {
      const bonsais = [
        {
          id: 'b1',
          name: '黒松',
          species: 'Pinus thunbergii',
          description: '立派な黒松',
          createdAt: new Date(),
          _count: { records: 5, posts: 2 },
          user: { id: 'u1', nickname: 'Owner', avatarUrl: null },
        },
      ]
      mockPrisma.bonsai.findMany.mockResolvedValue(bonsais)
      const action = await importAction()

      const result = await action('黒松')
      expect(result.bonsais).toHaveLength(1)
      expect(result.bonsais[0]).toMatchObject({
        id: 'b1',
        recordCount: 5,
        postCount: 2,
      })
      expect(result.bonsais[0]!.user).toMatchObject({ id: 'u1', nickname: 'Owner' })
      expect(result.error).toBeUndefined()
    })

    it('認証済み本人の盆栽のみを対象にする（引数 userId は信用しない）', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValue([])
      const action = await importAction()

      // 旧シグネチャの第4引数（他者ID）を渡しても無視され、auth ユーザーで絞られる
      await (action as unknown as (q: string, c: undefined, l: number, u: string) => Promise<unknown>)('', undefined, 20, 'user-123')
      expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'auth-user' }),
        })
      )
    })

    it('結果がない場合は空配列を返す', async () => {
      mockPrisma.bonsai.findMany.mockResolvedValue([])
      const action = await importAction()

      const result = await action('存在しない')
      expect(result.bonsais).toEqual([])
      expect(result.nextCursor).toBeUndefined()
    })

    it('limit件取得時にnextCursorを返す', async () => {
      const bonsais = Array.from({ length: 20 }, (_, i) => ({
        id: `bonsai-${i}`,
        name: `Bonsai ${i}`,
        species: 'sp',
        description: '',
        createdAt: new Date(),
        _count: { records: 0, posts: 0 },
        user: { id: 'u1', nickname: 'U', avatarUrl: null },
      }))
      mockPrisma.bonsai.findMany.mockResolvedValue(bonsais)
      const action = await importAction()

      const result = await action('Bonsai')
      expect(result.nextCursor).toBe('bonsai-19')
    })

    it('trgmモード: 結果がsafeLimit件でもnextCursorは常にundefined', async () => {
      mockGetSearchMode.mockReturnValue('trgm')
      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const bonsaiIds = Array.from({ length: 20 }, (_, i) => `bonsai-${i}`)
      vi.mocked(fulltextSearchBonsais).mockResolvedValue(bonsaiIds)
      const bonsais = bonsaiIds.map((id) => ({
        id,
        name: id,
        species: 'sp',
        description: '',
        createdAt: new Date(),
        _count: { records: 0, posts: 0 },
        user: { id: 'u1', nickname: 'U', avatarUrl: null },
      }))
      mockPrisma.bonsai.findMany.mockResolvedValue(bonsais)
      const action = await importAction()

      const result = await action('黒松', undefined, 20)
      expect(result.bonsais).toHaveLength(20)
      expect(result.nextCursor).toBeUndefined()
    })

    it('bigmモード: 結果がsafeLimit件の場合は従来通りnextCursorを返す（回帰確認）', async () => {
      mockGetSearchMode.mockReturnValue('bigm')
      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const bonsaiIds = Array.from({ length: 20 }, (_, i) => `bonsai-${i}`)
      vi.mocked(fulltextSearchBonsais).mockResolvedValue(bonsaiIds)
      const bonsais = bonsaiIds.map((id) => ({
        id,
        name: id,
        species: 'sp',
        description: '',
        createdAt: new Date(),
        _count: { records: 0, posts: 0 },
        user: { id: 'u1', nickname: 'U', avatarUrl: null },
      }))
      mockPrisma.bonsai.findMany.mockResolvedValue(bonsais)
      const action = await importAction()

      const result = await action('黒松', undefined, 20)
      expect(result.nextCursor).toBe('bonsai-19')
    })
  })

  // ============================================================
  // searchGlobal
  // ============================================================
  describe('searchGlobal', () => {
    async function importAction() {
      vi.resetModules()
      const mod = await import('@/lib/actions/search-entities')
      return mod.searchGlobal
    }

    it('クエリが長すぎる場合エラーを返す', async () => {
      const action = await importAction()
      const result = await action(longQuery)
      expect(result).toMatchObject({ error: ERR_SEARCH_QUERY_TOO_LONG })
    })

    it('レート制限超過時にエラーを返す', async () => {
      mockRateLimit.mockResolvedValue({ success: false })
      const action = await importAction()
      const result = await action('盆栽')
      expect(result).toMatchObject({ error: ERR_SEARCH_RATE_LIMIT })
    })

    it('IDが見つからない場合は空配列を返す', async () => {
      const action = await importAction()
      const result = await action('存在しない')

      expect(result.posts).toEqual([])
      expect(result.users).toEqual([])
      expect(result.shops).toEqual([])
      expect(result.events).toEqual([])
      expect(result.bonsais).toEqual([])
    })

    it('全カテゴリの結果を集約して返す', async () => {
      // 盆栽カテゴリは所有者専用のため認証済みユーザーが必要
      mockAuth.mockResolvedValue({ user: { id: 'current-user' } })
      const { fulltextSearchGlobal: mockFtGlobal } = await import('@/lib/search/fulltext')
      vi.mocked(mockFtGlobal).mockResolvedValue({
        postIds: ['p1'],
        userIds: ['u1'],
        shopIds: ['s1'],
        eventIds: ['e1'],
        bonsaiIds: ['b1'],
      })

      mockPrisma.post.findMany.mockResolvedValue([
        { id: 'p1', content: 'Hello', user: { id: 'u1', nickname: 'User1', avatarUrl: null }, media: [], _count: { likes: 3, comments: 1 } },
      ])
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'u1', nickname: 'User1', avatarUrl: null, bio: 'bio', _count: { followers: 10 } },
      ])
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        { id: 's1', name: 'Shop1', address: 'Addr', _count: { reviews: 2 } },
      ])
      mockPrisma.event.findMany.mockResolvedValue([
        { id: 'e1', title: 'Event1', startDate: new Date(), endDate: null, prefecture: '東京都', venue: 'Venue' },
      ])
      mockPrisma.bonsai.findMany.mockResolvedValue([
        { id: 'b1', name: '黒松', species: 'sp', user: { id: 'u1', nickname: 'User1' } },
      ])

      const action = await importAction()
      const result = await action('盆栽')

      expect(result.posts).toHaveLength(1)
      expect(result.posts![0]).toMatchObject({ id: 'p1', likeCount: 3, commentCount: 1 })
      expect(result.users).toHaveLength(1)
      expect(result.users![0]).toMatchObject({ id: 'u1', followersCount: 10 })
      expect(result.shops).toHaveLength(1)
      expect(result.shops![0]).toMatchObject({ id: 's1', reviewCount: 2 })
      expect(result.events).toHaveLength(1)
      expect(result.events![0]).toMatchObject({ id: 'e1', title: 'Event1' })
      expect(result.bonsais).toHaveLength(1)
      expect(result.bonsais![0]).toMatchObject({ id: 'b1', name: '黒松' })
    })

    it('認証済みユーザーのブロック・ミュート対象を除外する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'current-user' } })

      const { getExcludedUserIds } = await import('@/lib/actions/filter-helper')
      vi.mocked(getExcludedUserIds).mockResolvedValue(['blocked-user'])

      const action = await importAction()
      await action('test')

      const { fulltextSearchGlobal: mockFtGlobal } = await import('@/lib/search/fulltext')
      expect(mockFtGlobal).toHaveBeenCalledWith(
        'test',
        expect.objectContaining({
          excludedUserIds: expect.arrayContaining(['blocked-user']),
          currentUserId: 'current-user',
        })
      )
    })
  })
})
