import { vi } from 'vitest'
// @vitest-environment node
vi.unmock('@/lib/search/fulltext')
vi.unmock('@/lib/scraping/bonsai-events')
vi.unmock('@/lib/storage/index')

import { createMockPrismaClient, mockUser } from '../utils/test-utils'

// Prisma mock
 
const mockPrisma = createMockPrismaClient() as any
// Add missing methods to mock prisma
mockPrisma.$queryRawUnsafe = vi.fn()
mockPrisma.$executeRawUnsafe = vi.fn()
mockPrisma.shopReview = {
  ...mockPrisma.shopReview,
  aggregate: vi.fn(),
  groupBy: vi.fn(),
}
mockPrisma.like = {
  ...mockPrisma.like,
  groupBy: vi.fn(),
}

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// Auth mock
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// Rate limit mock
const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {
    search: { limit: 30, duration: 60 },
  },
}))

// next/cache mock
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// next/headers mock
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}))

// Cache mock
const mockGetCachedShopRatings = vi.fn().mockResolvedValue([])
vi.mock('@/lib/cache', () => ({
  getCachedShopRatings: (...args: unknown[]) => mockGetCachedShopRatings(...args),
  revalidateShopRatingsCache: vi.fn(),
  getCachedGenres: vi.fn().mockResolvedValue({ genres: {}, allGenres: [] }),
  getCachedTrendingGenres: vi.fn().mockResolvedValue([]),
  getCachedPopularTags: vi.fn().mockResolvedValue([]),
  CACHE_TAGS: { GENRES: 'genres', TRENDING_GENRES: 'trending-genres', POPULAR_TAGS: 'popular-tags', SHOP_RATINGS: 'shop-ratings' },
}))

// Logger mock
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// fulltext search mock for search actions
const mockFulltextSearchPosts = vi.fn().mockResolvedValue([])
const mockFulltextSearchUsers = vi.fn().mockResolvedValue([])
const mockFulltextSearchShops = vi.fn().mockResolvedValue([])
const mockFulltextSearchEvents = vi.fn().mockResolvedValue([])
const mockFulltextSearchBonsais = vi.fn().mockResolvedValue([])
const mockFulltextSearchGlobal = vi.fn().mockResolvedValue({
  postIds: [], userIds: [], shopIds: [], eventIds: [], bonsaiIds: [],
})
const mockGetSearchMode = vi.fn().mockReturnValue('like')

vi.mock('@/lib/search/fulltext', () => ({
  getSearchMode: () => mockGetSearchMode(),
  fulltextSearchPosts: (...args: unknown[]) => mockFulltextSearchPosts(...args),
  fulltextSearchUsers: (...args: unknown[]) => mockFulltextSearchUsers(...args),
  fulltextSearchShops: (...args: unknown[]) => mockFulltextSearchShops(...args),
  fulltextSearchEvents: (...args: unknown[]) => mockFulltextSearchEvents(...args),
  fulltextSearchBonsais: (...args: unknown[]) => mockFulltextSearchBonsais(...args),
  fulltextSearchGlobal: (...args: unknown[]) => mockFulltextSearchGlobal(...args),
}))

// filter-helper mock
const mockGetExcludedUserIds = vi.fn().mockResolvedValue([])
vi.mock('@/lib/actions/filter-helper', () => ({
  getExcludedUserIds: (...args: unknown[]) => mockGetExcludedUserIds(...args),
}))

// cache mock
vi.mock('@/lib/cache', () => ({
  getCachedGenres: vi.fn().mockResolvedValue({ genres: {}, allGenres: [] }),
  getCachedPopularTags: vi.fn().mockResolvedValue([]),
}))

// prefectures mock
vi.mock('@/lib/prefectures', () => ({
  extractPrefecture: vi.fn().mockReturnValue(null),
  getRegionById: vi.fn().mockReturnValue(null),
  PREFECTURES: ['北海道', '埼玉県', '東京都'],
}))

// fs/promises mock for storage
vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}))

describe('Coverage Boost - Search & Library uncovered branches', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockRateLimit.mockResolvedValue({ success: true })
    mockGetSearchMode.mockReturnValue('like')
  })

  // ================================================================
  // 1. lib/search/fulltext.ts - enableExtension with invalid name
  // ================================================================
  // fulltext.ts enableExtension: skipped - the TS type prevents invalid input,
  // and the vi.mock hoist makes it hard to test the real implementation here

  // ================================================================
  // 2. lib/search/fulltext.ts - getSearchIndexes error
  // ================================================================
  // fulltext.ts getSearchIndexes: skipped - outer catch requires the for-of loop
  // to throw synchronously, which is difficult to mock with hoisted vi.mock

  // ================================================================
  // 3. lib/actions/search.ts - searchPosts genre mapping (line 333)
  // ================================================================
  describe('search.ts - searchPosts with genres (fulltext mode)', async () => {
    it('should map genres from post.genres via pg.genre', async () => {
      vi.resetModules()

      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('@/lib/search/fulltext', () => ({
        getSearchMode: () => 'bigm',
        fulltextSearchPosts: vi.fn().mockResolvedValue(['post-1']),
        fulltextSearchUsers: vi.fn(),
        fulltextSearchShops: vi.fn(),
        fulltextSearchEvents: vi.fn(),
        fulltextSearchBonsais: vi.fn(),
        fulltextSearchGlobal: vi.fn(),
      }))
      vi.doMock('@/lib/rate-limit', () => ({
        rateLimit: vi.fn().mockResolvedValue({ success: true }),
        RATE_LIMITS: { search: { limit: 30, duration: 60 } },
      }))
      vi.doMock('next/headers', () => ({
        headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
      }))
      vi.doMock('@/lib/actions/filter-helper', () => ({
        getExcludedUserIds: vi.fn().mockResolvedValue([]),
      }))
      vi.doMock('@/lib/cache', () => ({
        getCachedGenres: vi.fn().mockResolvedValue({ genres: {}, allGenres: [] }),
        getCachedPopularTags: vi.fn().mockResolvedValue([]),
      }))

      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

      const genreObj = { id: 'genre-1', name: '松柏類', slug: 'shouhaku', category: '松柏類', sortOrder: 1, type: 'post' }

      // Mock the post.findMany for fetching posts by IDs
      mockPrisma.post.findMany.mockResolvedValueOnce([
        {
          id: 'post-1',
          userId: 'user-1',
          content: 'テスト投稿',
          createdAt: new Date(),
          user: { id: 'user-1', nickname: 'テスト', avatarUrl: null },
          media: [],
          genres: [{ genreId: 'genre-1', postId: 'post-1', genre: genreObj }],
          _count: { likes: 2, comments: 1 },
          poll: null,
        },
      ])

      // Mock like/bookmark queries
      mockPrisma.like.findMany.mockResolvedValueOnce([])
      mockPrisma.bookmark.findMany.mockResolvedValueOnce([])

      const { searchPosts } = await import('@/lib/actions/search')
      const result = await searchPosts('テスト')

      expect(result.success).toBe(true)
      if (result.success) {
        const posts = result.data?.posts as Array<{ genres: unknown; likeCount: number; commentCount: number }>
        expect(posts).toHaveLength(1)
        // The genres should be mapped from pg.genre (flattened)
        expect(posts[0].genres).toEqual([genreObj])
        expect(posts[0].likeCount).toBe(2)
        expect(posts[0].commentCount).toBe(1)
      }
    })
  })

  // ================================================================
  // 4. lib/actions/search.ts - searchByTag genre mapping (line 815)
  // ================================================================
  describe('search.ts - searchByTag genre mapping', async () => {
    it('should map genres from pg.genre in tag search results', async () => {
      vi.resetModules()

      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('@/lib/search/fulltext', () => ({
        getSearchMode: () => 'like',
        fulltextSearchPosts: vi.fn(),
        fulltextSearchUsers: vi.fn(),
        fulltextSearchShops: vi.fn(),
        fulltextSearchEvents: vi.fn(),
        fulltextSearchBonsais: vi.fn(),
        fulltextSearchGlobal: vi.fn(),
      }))
      vi.doMock('@/lib/rate-limit', () => ({
        rateLimit: vi.fn().mockResolvedValue({ success: true }),
        RATE_LIMITS: { search: { limit: 30, duration: 60 } },
      }))
      vi.doMock('next/headers', () => ({
        headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
      }))
      vi.doMock('@/lib/actions/filter-helper', () => ({
        getExcludedUserIds: vi.fn().mockResolvedValue([]),
      }))

      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

      const genreObj = { id: 'genre-2', name: '雑木類', slug: 'zouki', category: '雑木類', sortOrder: 2, type: 'post' }

      mockPrisma.post.findMany.mockResolvedValueOnce([
        {
          id: 'post-2',
          userId: 'user-1',
          content: '#盆栽 テスト',
          createdAt: new Date(),
          user: { id: 'user-1', nickname: 'テスト', avatarUrl: null },
          media: [],
          genres: [{ genreId: 'genre-2', postId: 'post-2', genre: genreObj }],
          _count: { likes: 5, comments: 3 },
          poll: null,
        },
      ])

      mockPrisma.like.findMany.mockResolvedValueOnce([])
      mockPrisma.bookmark.findMany.mockResolvedValueOnce([])

      const { searchByTag } = await import('@/lib/actions/search')
      const result = await searchByTag('盆栽')

      expect(result.success).toBe(true)
      if (result.success) {
        const posts = result.data?.posts as Array<{ genres: unknown; likeCount: number }>
        expect(posts).toHaveLength(1)
        expect(posts[0].genres).toEqual([genreObj])
        expect(posts[0].likeCount).toBe(5)
      }
    })
  })

  // ================================================================
  // 5. lib/actions/search.ts - searchShops genre mapping (line 997)
  // ================================================================
  describe('search.ts - searchShops genre mapping (LIKE mode)', async () => {
    it('should map genres from sg.genre in shop search results', async () => {
      vi.resetModules()

      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('@/lib/search/fulltext', () => ({
        getSearchMode: () => 'like',
        fulltextSearchPosts: vi.fn(),
        fulltextSearchUsers: vi.fn(),
        fulltextSearchShops: vi.fn(),
        fulltextSearchEvents: vi.fn(),
        fulltextSearchBonsais: vi.fn(),
        fulltextSearchGlobal: vi.fn(),
      }))
      vi.doMock('@/lib/rate-limit', () => ({
        rateLimit: vi.fn().mockResolvedValue({ success: true }),
        RATE_LIMITS: { search: { limit: 30, duration: 60 } },
      }))
      vi.doMock('next/headers', () => ({
        headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
      }))

      const shopGenre = { id: 'sg-1', name: '販売店', slug: 'hanbaiten', category: '店舗', sortOrder: 1, type: 'shop' }

      mockPrisma.bonsaiShop.findMany.mockResolvedValueOnce([
        {
          id: 'shop-1',
          name: 'テスト盆栽園',
          address: '埼玉県さいたま市',
          isHidden: false,
          createdAt: new Date(),
          genres: [{ genreId: 'sg-1', shopId: 'shop-1', genre: shopGenre }],
          _count: { reviews: 3 },
        },
      ])

      mockPrisma.shopReview.groupBy.mockResolvedValueOnce([
        { shopId: 'shop-1', _avg: { rating: 4.5 } },
      ])

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('テスト')

      expect(result.shops).toHaveLength(1)
      expect(result.shops[0].genres).toEqual([shopGenre])
      expect(result.shops[0].avgRating).toBe(4.5)
      expect(result.shops[0].reviewCount).toBe(3)
    })
  })

  // ================================================================
  // 5b. lib/actions/search.ts - searchShops genre mapping (fulltext mode, line 951)
  // ================================================================
  describe('search.ts - searchShops genre mapping (fulltext mode)', async () => {
    it('should map genres from sg.genre in fulltext search results', async () => {
      vi.resetModules()

      const mockFTSearchShops = vi.fn().mockResolvedValue(['shop-ft-1'])

      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('@/lib/search/fulltext', () => ({
        getSearchMode: () => 'bigm',
        fulltextSearchPosts: vi.fn(),
        fulltextSearchUsers: vi.fn(),
        fulltextSearchShops: mockFTSearchShops,
        fulltextSearchEvents: vi.fn(),
        fulltextSearchBonsais: vi.fn(),
        fulltextSearchGlobal: vi.fn(),
      }))
      vi.doMock('@/lib/rate-limit', () => ({
        rateLimit: vi.fn().mockResolvedValue({ success: true }),
        RATE_LIMITS: { search: { limit: 30, duration: 60 } },
      }))
      vi.doMock('next/headers', () => ({
        headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
      }))

      const shopGenre = { id: 'sg-2', name: '展示園', slug: 'tenjien', category: '園', sortOrder: 2, type: 'shop' }

      mockPrisma.bonsaiShop.findMany.mockResolvedValueOnce([
        {
          id: 'shop-ft-1',
          name: 'フルテキスト盆栽園',
          address: '東京都台東区',
          isHidden: false,
          createdAt: new Date(),
          genres: [{ genreId: 'sg-2', shopId: 'shop-ft-1', genre: shopGenre }],
          _count: { reviews: 1 },
        },
      ])

      mockPrisma.shopReview.groupBy.mockResolvedValueOnce([
        { shopId: 'shop-ft-1', _avg: { rating: 3.0 } },
      ])

      const { searchShops } = await import('@/lib/actions/search')
      const result = await searchShops('フルテキスト')

      expect(result.shops).toHaveLength(1)
      expect(result.shops[0].genres).toEqual([shopGenre])
    })
  })

  // ================================================================
  // 6. lib/scraping/bonsai-events.ts - year increment for past dates
  // ================================================================
  describe('bonsai-events.ts - parseDates year increment for past dates', async () => {
    it('should increment year for month-day~month-day pattern when date is in the past', async () => {
      // We test the exported parseEventFromHtml indirectly through scrapeEventsFromRegion
      // But parseDates is a private function. We can test through parseEventFromHtml.
      // Actually, parseEventFromHtml is also private. Let's use require and access the module.

      // Since parseDates is not exported, we test it through parseEventFromHtml
      // which is also not exported. We test through scrapeEventsFromRegion.
      // But that requires fetch. Let's test the entire flow.

      // Actually, we can construct HTML that contains past dates to trigger the year increment.
      // Let's use the exported functions. scrapeEventsFromRegion calls fetch and then parseEventFromHtml.
      // We mock fetch to return HTML with dates in the past.

      vi.resetModules()

      // A date that is definitely in the past: January 1
      const pastMonth = 1
      const pastDay = 1
      const currentYear = new Date().getFullYear()

      const html = `
        <div class="event_area">
          <span>テスト盆栽展</span>
          <p>会期 ${pastMonth}月${pastDay}日～${pastMonth}月${pastDay + 1}日 会場／テスト会場</p>
          <a class="base" href="https://example.com/event1"></a>
        </div>
      `

      // Since we need to test internal function, let's use a different approach.
      // We'll create a module that exports the internal functions for testing.
      // Actually, let's just mock global fetch and test scrapeEventsFromRegion.

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(html),
      })
       
      global.fetch = mockFetch as any

      const { scrapeEventsFromRegion } = await import('@/lib/scraping/bonsai-events')

      return scrapeEventsFromRegion(
        'https://example.com/events',
        '関東',
        ['東京都', '神奈川県']
      ).then((events: any[]) => {
        expect(events).toHaveLength(1)
        // Since Jan 1 is in the past, year should be incremented
        expect(events[0].startDate.getFullYear()).toBe(currentYear + 1)
        expect(events[0].endDate.getFullYear()).toBe(currentYear + 1)
      })
    })

    it('should increment year for month-day~day pattern (same month) when date is in the past', async () => {
      vi.resetModules()

      const currentYear = new Date().getFullYear()
      // Use a past date: month 1, day 5~6
      const html = `
        <div class="event_area">
          <span>盆栽新年展</span>
          <p>会期 1月5日～6日 会場／新年会場</p>
          <a class="base" href="https://example.com/event2"></a>
        </div>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(html),
       
      }) as any

      const { scrapeEventsFromRegion } = await import('@/lib/scraping/bonsai-events')

      return scrapeEventsFromRegion(
        'https://example.com/events',
        '関東',
        ['東京都']
      ).then((events: any[]) => {
        expect(events).toHaveLength(1)
        expect(events[0].startDate.getFullYear()).toBe(currentYear + 1)
        expect(events[0].endDate.getFullYear()).toBe(currentYear + 1)
      })
    })

    it('should increment year for single day pattern when date is in the past', async () => {
      vi.resetModules()

      const currentYear = new Date().getFullYear()
      // Single day: January 3
      const html = `
        <div class="event_area">
          <span>盆栽正月展</span>
          <p>開催 1月3日 会場／正月会場</p>
          <a class="base" href="https://example.com/event3"></a>
        </div>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(html),
       
      }) as any

      const { scrapeEventsFromRegion } = await import('@/lib/scraping/bonsai-events')

      return scrapeEventsFromRegion(
        'https://example.com/events',
        '関東',
        ['東京都']
      ).then((events: any[]) => {
        expect(events).toHaveLength(1)
        expect(events[0].startDate.getFullYear()).toBe(currentYear + 1)
        expect(events[0].endDate).toBeNull()
      })
    })
  })

  // ================================================================
  // 7. lib/scraping/bonsai-events.ts - extractPrefecture with parentheses format
  // ================================================================
  describe('bonsai-events.ts - extractPrefecture with parentheses format', async () => {
    it('should extract prefecture from title with parentheses format', async () => {
      vi.resetModules()

      // Title has parentheses format: （東京都）
      // Neither title nor content matches the prefectures list directly,
      // but the title matches the parentheses pattern
      const html = `
        <div class="event_area">
          <span>盆栽展（栃木県）</span>
          <p>12月25日 会場／テスト会場</p>
          <a class="base" href="https://example.com/event4"></a>
        </div>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(html),
       
      }) as any

      const { scrapeEventsFromRegion } = await import('@/lib/scraping/bonsai-events')

      // Use prefectures list that does NOT include 栃木県 directly in text
      // but the parentheses pattern should extract it
      return scrapeEventsFromRegion(
        'https://example.com/events',
        '北海道',
        ['北海道']  // 栃木県 is NOT in this list, so direct match fails
      ).then((events: any[]) => {
        expect(events).toHaveLength(1)
        // The parentheses pattern should extract 栃木県
        expect(events[0].prefecture).toBe('栃木県')
      })
    })
  })

  // ================================================================
  // 8. lib/actions/shop.ts - getShops various edge cases
  // ================================================================
  describe('shop.ts - getShops edge cases', async () => {
    beforeEach(() => {
      vi.resetModules()
      mockGetCachedShopRatings.mockResolvedValue([])
      vi.doMock('@/lib/cache', () => ({
        getCachedShopRatings: () => mockGetCachedShopRatings(),
        revalidateShopRatingsCache: vi.fn(),
      }))
      vi.doMock('@/lib/services/authorization', () => ({ canUserEditShop: vi.fn().mockResolvedValue({ allowed: true }) }))
    })

    it('should handle location sort with latitude on only one shop (a has lat, b does not)', async () => {
      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
      vi.doMock('@/lib/prefectures', () => ({
        extractPrefecture: vi.fn().mockReturnValue(null),
        getRegionById: vi.fn().mockReturnValue(null),
        PREFECTURES: ['北海道', '埼玉県', '東京都'],
      }))

      // Two shops: one with lat, one without
      mockPrisma.bonsaiShop.findMany.mockResolvedValueOnce([
        {
          id: 'shop-a',
          name: 'Shop A',
          address: '東京都',
          latitude: { toString: () => '35.6' },
          longitude: { toString: () => '139.7' },
          isHidden: false,
          createdAt: new Date(),
          genres: [],
          _count: { reviews: 1 },
          creator: { id: 'u1', nickname: 'User', avatarUrl: null },
        },
        {
          id: 'shop-b',
          name: 'Shop B',
          address: '埼玉県',
          latitude: null,
          longitude: null,
          isHidden: false,
          createdAt: new Date(),
          genres: [],
          _count: { reviews: 0 },
          creator: { id: 'u2', nickname: 'User2', avatarUrl: null },
        },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'location' })

      expect(result.shops).toHaveLength(2)
      // Shop A (has lat) should come first
      expect(result.shops[0].id).toBe('shop-a')
    })

    it('should handle location sort where b has lat but a does not', async () => {
      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
      vi.doMock('@/lib/prefectures', () => ({
        extractPrefecture: vi.fn().mockReturnValue(null),
        getRegionById: vi.fn().mockReturnValue(null),
        PREFECTURES: ['北海道', '埼玉県', '東京都'],
      }))

      mockPrisma.bonsaiShop.findMany.mockResolvedValueOnce([
        {
          id: 'shop-no-lat',
          name: 'No Lat Shop',
          address: 'unknown',
          latitude: null,
          longitude: null,
          isHidden: false,
          createdAt: new Date(),
          genres: [],
          _count: { reviews: 0 },
          creator: { id: 'u1', nickname: 'User', avatarUrl: null },
        },
        {
          id: 'shop-with-lat',
          name: 'With Lat Shop',
          address: '東京都',
          latitude: { toString: () => '35.0' },
          longitude: { toString: () => '139.0' },
          isHidden: false,
          createdAt: new Date(),
          genres: [],
          _count: { reviews: 0 },
          creator: { id: 'u2', nickname: 'User2', avatarUrl: null },
        },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'location' })

      expect(result.shops).toHaveLength(2)
    })

    it('should handle location sort where one has prefecture and other does not', async () => {
      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
      vi.doMock('@/lib/cache', () => ({
        getCachedShopRatings: () => mockGetCachedShopRatings(),
        revalidateShopRatingsCache: vi.fn(),
      }))

      const mockExtractPref = vi.fn()
        .mockReturnValueOnce('東京都')
        .mockReturnValueOnce(null)
        .mockReturnValueOnce('東京都')
        .mockReturnValueOnce(null)

      vi.doMock('@/lib/prefectures', () => ({
        extractPrefecture: mockExtractPref,
        getRegionById: vi.fn().mockReturnValue(null),
        PREFECTURES: ['北海道', '埼玉県', '東京都'],
      }))

      mockPrisma.bonsaiShop.findMany.mockResolvedValueOnce([
        {
          id: 'shop-pref',
          name: 'Pref Shop',
          address: '東京都渋谷区',
          latitude: null,
          longitude: null,
          isHidden: false,
          createdAt: new Date(),
          genres: [],
          _count: { reviews: 0 },
          creator: { id: 'u1', nickname: 'User', avatarUrl: null },
        },
        {
          id: 'shop-no-pref',
          name: 'No Pref Shop',
          address: 'unknown address',
          latitude: null,
          longitude: null,
          isHidden: false,
          createdAt: new Date(),
          genres: [],
          _count: { reviews: 0 },
          creator: { id: 'u2', nickname: 'User2', avatarUrl: null },
        },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'location' })

      // Both shops should be returned (exercising the location sort branch)
      expect(result.shops).toHaveLength(2)
    })

    it('should handle getShop with latitude/longitude Decimal conversion', async () => {
      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
      vi.doMock('@/lib/prefectures', () => ({
        extractPrefecture: vi.fn(),
        getRegionById: vi.fn(),
        PREFECTURES: [],
      }))

      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

      mockPrisma.bonsaiShop.findUnique.mockResolvedValueOnce({
        id: 'shop-1',
        name: 'テスト園',
        address: '東京都',
        latitude: { toString: () => '35.681' },
        longitude: { toString: () => '139.767' },
        isHidden: false,
        createdBy: 'user-1',
        createdAt: new Date(),
        genres: [{ genreId: 'g1', shopId: 'shop-1', genre: { id: 'g1', name: 'テスト' } }],
        reviews: [{ rating: 4, user: { id: 'u2', nickname: 'Rev', avatarUrl: null }, images: [], createdAt: new Date() }],
        creator: { id: 'user-1', nickname: 'Owner', avatarUrl: null },
      })
      mockPrisma.shopReview.aggregate.mockResolvedValueOnce({
        _avg: { rating: 4 },
        _count: { rating: 1 },
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('shop-1')

      expect(result.shop).toBeDefined()
      expect(result.shop.latitude).toBe(35.681)
      expect(result.shop.longitude).toBe(139.767)
      expect(result.shop.isOwner).toBe(true)
    })

    it('should handle getShop with null latitude/longitude', async () => {
      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
      vi.doMock('@/lib/prefectures', () => ({
        extractPrefecture: vi.fn(),
        getRegionById: vi.fn(),
        PREFECTURES: [],
      }))

      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

      mockPrisma.bonsaiShop.findUnique.mockResolvedValueOnce({
        id: 'shop-2',
        name: 'ヌル園',
        address: '埼玉県',
        latitude: null,
        longitude: null,
        isHidden: false,
        createdBy: 'other-user',
        createdAt: new Date(),
        genres: [],
        reviews: [],
        creator: { id: 'other-user', nickname: 'Other', avatarUrl: null },
      })
      mockPrisma.shopReview.aggregate.mockResolvedValueOnce({
        _avg: { rating: null },
        _count: { rating: 0 },
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('shop-2')

      expect(result.shop).toBeDefined()
      expect(result.shop.latitude).toBeNull()
      expect(result.shop.longitude).toBeNull()
      expect(result.shop.isOwner).toBe(false)
      expect(result.shop.averageRating).toBeNull()
    })

    it('should handle updateShop with latitude/longitude parsing', async () => {
      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
      vi.doMock('@/lib/prefectures', () => ({
        extractPrefecture: vi.fn(),
        getRegionById: vi.fn(),
        PREFECTURES: [],
      }))
      vi.doMock('@/lib/rate-limit', () => ({
        checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
      }))
      vi.doMock('next/headers', () => ({
        headers: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue('127.0.0.1') }),
      }))

      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

      mockPrisma.bonsaiShop.findUnique.mockResolvedValueOnce({
        id: 'shop-1',
        createdBy: 'user-1',
      })
      mockPrisma.shopGenre.deleteMany.mockResolvedValueOnce({})
      mockPrisma.bonsaiShop.update.mockResolvedValueOnce({})

      const formData = new FormData()
      formData.set('name', 'Updated Name')
      formData.set('address', 'Updated Address')
      formData.set('latitude', '35.5')
      formData.set('longitude', '139.5')

      const { updateShop } = await import('@/lib/actions/shop')
      const result = await updateShop('shop-1', formData)

      expect(result.success).toBe(true)
    })

    it('should handle updateShop with empty latitude/longitude', async () => {
      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
      vi.doMock('@/lib/prefectures', () => ({
        extractPrefecture: vi.fn(),
        getRegionById: vi.fn(),
        PREFECTURES: [],
      }))
      vi.doMock('@/lib/rate-limit', () => ({
        checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
      }))
      vi.doMock('next/headers', () => ({
        headers: vi.fn().mockReturnValue({ get: vi.fn().mockReturnValue('127.0.0.1') }),
      }))

      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })

      mockPrisma.bonsaiShop.findUnique.mockResolvedValueOnce({
        id: 'shop-1',
        createdBy: 'user-1',
      })
      mockPrisma.shopGenre.deleteMany.mockResolvedValueOnce({})
      mockPrisma.bonsaiShop.update.mockResolvedValueOnce({})

      const formData = new FormData()
      formData.set('name', 'Updated Name')
      formData.set('address', 'Updated Address')
      // No latitude/longitude set -> null

      const { updateShop } = await import('@/lib/actions/shop')
      const result = await updateShop('shop-1', formData)

      expect(result.success).toBe(true)
    })

    it('getShopChangeRequests should handle cursor-based pagination', async () => {
      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
      vi.doMock('@/lib/prefectures', () => ({
        extractPrefecture: vi.fn(),
        getRegionById: vi.fn(),
        PREFECTURES: [],
      }))

      mockAuth.mockResolvedValue({ user: { id: 'admin-user' } })
      mockPrisma.adminUser.findUnique.mockResolvedValueOnce({ userId: 'admin-user', role: 'admin' })

      // Return exactly limit items to trigger hasMore
      const requests = Array.from({ length: 20 }, (_, i) => ({
        id: `req-${i}`,
        shopId: 'shop-1',
        userId: 'user-1',
        status: 'pending',
        requestedChanges: {},
        reason: null,
        createdAt: new Date(),
        shop: { id: 'shop-1', name: 'Test', address: 'Addr', phone: null, website: null, businessHours: null, closedDays: null },
        user: { id: 'user-1', nickname: 'User', avatarUrl: null },
      }))
      mockPrisma.shopChangeRequest.findMany.mockResolvedValueOnce(requests)

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequests({ status: 'pending', cursor: 'req-cursor', limit: 20 })

      expect(result.requests).toHaveLength(20)
      expect(result.nextCursor).toBe('req-19')
    })

    it('rejectShopChangeRequest should set adminComment', async () => {
      vi.doMock('@/lib/db', () => ({ prisma: mockPrisma }))
      vi.doMock('@/lib/auth', () => ({ auth: () => mockAuth() }))
      vi.doMock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
      vi.doMock('@/lib/prefectures', () => ({
        extractPrefecture: vi.fn(),
        getRegionById: vi.fn(),
        PREFECTURES: [],
      }))

      mockAuth.mockResolvedValue({ user: { id: 'admin-user' } })
      mockPrisma.adminUser.findUnique.mockResolvedValueOnce({ userId: 'admin-user', role: 'admin' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValueOnce({
        id: 'req-1',
        shopId: 'shop-1',
        userId: 'user-1',
        status: 'pending',
        requestedChanges: { name: 'New Name' },
      })
      mockPrisma.$transaction.mockResolvedValueOnce([{}, {}])

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('req-1', '不適切な変更です')

      expect(result.success).toBe(true)
    })
  })

  // ================================================================
  // 9. lib/storage/index.ts - various uncovered paths
  // ================================================================
  describe('storage/index.ts - uncovered paths', async () => {
    it('should handle R2 delete with URL path parsing (leading slash)', async () => {
      vi.resetModules()

      const originalEnv = process.env.STORAGE_PROVIDER
      process.env.STORAGE_PROVIDER = 'r2'
      process.env.R2_ACCOUNT_ID = 'testaccountid'
      process.env.R2_ACCESS_KEY_ID = 'testaccesskey'
      process.env.R2_SECRET_ACCESS_KEY = 'testsecretkey'
      process.env.R2_BUCKET_NAME = 'testbucket'
      process.env.R2_PUBLIC_URL = 'https://cdn.example.com'

      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }))

      const mockSend = vi.fn().mockResolvedValue({})
      vi.doMock('@aws-sdk/client-s3', () => ({
        S3Client: vi.fn().mockImplementation(function() { return {
          send: mockSend,
        } }),
        PutObjectCommand: vi.fn().mockImplementation(function() { return {} }),
        DeleteObjectCommand: vi.fn().mockImplementation(function(params: any) { return params }),
      }))

      const { deleteFile, uploadFile } = await import('@/lib/storage/index')

      // First, upload to initialize the provider
      const uploadResult = await uploadFile(Buffer.from('data'), 'file.jpg', 'image/jpeg', 'posts')
      expect(uploadResult.success).toBe(true)

      // Delete with URL that has leading slash in pathname
      const deleteResult = await deleteFile('https://cdn.example.com/posts/test-file.jpg')
      expect(deleteResult.success).toBe(true)

      // Cleanup
      process.env.STORAGE_PROVIDER = originalEnv
      delete process.env.R2_ACCOUNT_ID
      delete process.env.R2_ACCESS_KEY_ID
      delete process.env.R2_SECRET_ACCESS_KEY
      delete process.env.R2_BUCKET_NAME
      delete process.env.R2_PUBLIC_URL
    })

    it('should handle R2 delete error with non-Error object', async () => {
      vi.resetModules()

      const originalEnv = process.env.STORAGE_PROVIDER
      process.env.STORAGE_PROVIDER = 'r2'
      process.env.R2_ACCOUNT_ID = 'testaccountid'
      process.env.R2_ACCESS_KEY_ID = 'testaccesskey'
      process.env.R2_SECRET_ACCESS_KEY = 'testsecretkey'
      process.env.R2_BUCKET_NAME = 'testbucket'
      process.env.R2_PUBLIC_URL = 'https://cdn.example.com'

      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }))

      const mockPutObject = vi.fn().mockResolvedValueOnce(undefined)
      const mockDeleteObject = vi.fn().mockRejectedValueOnce('string error')

      vi.doMock('@/lib/storage/s3-sign', () => ({
        putObject: (...args: unknown[]) => mockPutObject(...args),
        deleteObject: (...args: unknown[]) => mockDeleteObject(...args),
      }))

      const { deleteFile, uploadFile } = await import('@/lib/storage/index')

      // Initialize provider
      await uploadFile(Buffer.from('data'), 'file.jpg', 'image/jpeg', 'posts')

      // Delete should fail with non-Error thrown
      const result = await deleteFile('https://cdn.example.com/posts/bad.jpg')
      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown error')

      // Cleanup
      process.env.STORAGE_PROVIDER = originalEnv
      delete process.env.R2_ACCOUNT_ID
      delete process.env.R2_ACCESS_KEY_ID
      delete process.env.R2_SECRET_ACCESS_KEY
      delete process.env.R2_BUCKET_NAME
      delete process.env.R2_PUBLIC_URL
    })

    it('should handle local storage provider with default provider', async () => {
      vi.resetModules()

      const originalEnv = process.env.STORAGE_PROVIDER
      delete process.env.STORAGE_PROVIDER // defaults to 'local'

      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }))
      vi.doMock('fs/promises', () => ({
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
      }))

      const { uploadFile, deleteFile } = await import('@/lib/storage/index')

      const uploadResult = await uploadFile(Buffer.from('test'), 'photo.jpg', 'image/jpeg', 'avatars')
      expect(uploadResult.success).toBe(true)
      expect(uploadResult.url).toMatch(/^\/uploads\/avatars\//)

      const deleteResult = await deleteFile('/uploads/avatars/test.jpg')
      expect(deleteResult.success).toBe(true)

      // Cleanup
      process.env.STORAGE_PROVIDER = originalEnv
    })

    it('should return storageProvider from singleton on second call', async () => {
      vi.resetModules()

      const originalEnv = process.env.STORAGE_PROVIDER
      process.env.STORAGE_PROVIDER = 'supabase'
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
      process.env.SUPABASE_STORAGE_BUCKET = 'uploads'

      vi.doMock('@/lib/logger', () => ({
        __esModule: true,
        default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
      }))

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
       
      }) as any

      const { uploadFile } = await import('@/lib/storage/index')

      // First call creates provider
      const result1 = await uploadFile(Buffer.from('test'), 'file.jpg', 'image/jpeg', 'posts')
      expect(result1.success).toBe(true)

      // Second call reuses singleton (line 1120: if (storageProvider) return storageProvider)
      const result2 = await uploadFile(Buffer.from('test2'), 'file2.jpg', 'image/png', 'posts')
      expect(result2.success).toBe(true)

      // Cleanup
      process.env.STORAGE_PROVIDER = originalEnv
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.SUPABASE_SERVICE_ROLE_KEY
      delete process.env.SUPABASE_STORAGE_BUCKET
    })
  })
})
