// @vitest-environment node

import { vi } from 'vitest'
/**
 * Coverage Boost - fulltext.ts and search.ts
 *
 * Targets uncovered branches in:
 * - fulltextSearchPosts() with trgm mode filter combinations
 * - fulltextSearchUsers() - trgm mode similarity calculation branches
 * - fulltextSearchShops() - Error handling and fallback branch
 * - fulltextSearchEvents() - includeExpired parameter combinations
 * - fulltextSearchBonsais() - Multiple branches with combined filters
 * - getSearchIndexes() - Error handling in loop (inner catch)
 * - search.ts: searchShops cursor, searchEvents includeExpired, searchBonsais userId undefined
 */

vi.unmock('@/lib/search/fulltext')

// ============================================================
// Mocks for fulltext.ts
// ============================================================

const mockPrismaForFulltext = {
  $executeRawUnsafe: vi.fn(),
  $executeRaw: vi.fn(),
  $queryRaw: vi.fn(),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrismaForFulltext }))
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.SEARCH_MODE
})

// ============================================================
// fulltext.ts tests
// ============================================================

describe('fulltext.ts coverage boost', async () => {
  // ----------------------------------------------------------
  // fulltextSearchPosts - trgm mode with various filter combos
  // ----------------------------------------------------------
  describe('fulltextSearchPosts - trgm mode', async () => {
    beforeEach(() => {
      process.env.SEARCH_MODE = 'trgm'
    })

    it('should search with trgm mode and return post IDs', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽')

      expect(result).toEqual(['p1', 'p2'])
    })

    it('should apply excludedUserIds filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('松', { excludedUserIds: ['block1', 'block2'] })

      expect(result).toEqual(['p1'])
    })

    it('should apply genreIds filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('松', { genreIds: ['genre1', 'genre2'] })

      expect(result).toEqual(['p1'])
    })

    it('should apply cursor in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p5' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', { cursor: 'p4' })

      expect(result).toEqual(['p5'])
    })

    it('should apply dateFrom filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        filters: { dateFrom: '2024-01-01' },
      })

      expect(result).toEqual(['p1'])
    })

    it('should apply dateTo filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        filters: { dateTo: '2024-12-31' },
      })

      expect(result).toEqual(['p1'])
    })

    it('should apply mediaType=images filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        filters: { mediaType: 'images' },
      })

      expect(result).toEqual(['p1'])
    })

    it('should apply mediaType=videos filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        filters: { mediaType: 'videos' },
      })

      expect(result).toEqual(['p1'])
    })

    it('should apply mediaType=text filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        filters: { mediaType: 'text' },
      })

      expect(result).toEqual(['p1'])
    })

    it('should apply minLikes filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        filters: { minLikes: 5 },
      })

      expect(result).toEqual(['p1'])
    })

    it('should apply all filters combined in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        excludedUserIds: ['block1'],
        genreIds: ['genre1'],
        cursor: 'cursor1',
        limit: 10,
        filters: {
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          mediaType: 'images',
          minLikes: 3,
        },
      })

      expect(result).toEqual(['p1'])
    })

    it('should fallback to LIKE search on trgm error', async () => {
      // First call for trgm fails, second call for fallback succeeds
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('trgm error'))
        .mockResolvedValueOnce([{ id: 'fallback1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽')

      expect(result).toEqual(['fallback1'])
    })

    it('should skip minLikes filter when minLikes is 0', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        filters: { minLikes: 0 },
      })

      expect(result).toEqual(['p1'])
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchPosts - bigm mode with filters
  // ----------------------------------------------------------
  describe('fulltextSearchPosts - bigm mode with filters', async () => {
    beforeEach(() => {
      process.env.SEARCH_MODE = 'bigm'
    })

    it('should apply dateFrom+dateTo+minLikes+mediaType in bigm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        excludedUserIds: ['u1'],
        genreIds: ['g1'],
        cursor: 'c1',
        filters: {
          dateFrom: '2024-01-01',
          dateTo: '2024-06-30',
          minLikes: 10,
          mediaType: 'videos',
        },
      })

      expect(result).toEqual(['p1'])
    })

    it('should fallback to LIKE on bigm error', async () => {
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('bigm error'))
        .mockResolvedValueOnce([{ id: 'fb1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('テスト')

      expect(result).toEqual(['fb1'])
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchPosts - like mode with filters
  // ----------------------------------------------------------
  describe('fulltextSearchPosts - like mode with all filters', async () => {
    it('should apply all filters in like mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'p1' }])

      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('盆栽', {
        excludedUserIds: ['u1'],
        genreIds: ['g1'],
        cursor: 'c1',
        limit: 5,
        filters: {
          dateFrom: '2024-01-01',
          dateTo: '2024-12-31',
          minLikes: 2,
          mediaType: 'text',
        },
      })

      expect(result).toEqual(['p1'])
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchUsers - trgm mode
  // ----------------------------------------------------------
  describe('fulltextSearchUsers - trgm mode', async () => {
    beforeEach(() => {
      process.env.SEARCH_MODE = 'trgm'
    })

    it('should search users with trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽')

      expect(result).toEqual(['u1', 'u2'])
    })

    it('should apply excludedUserIds in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'u1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽', { excludedUserIds: ['blocked1'] })

      expect(result).toEqual(['u1'])
    })

    it('should apply currentUserId in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'u2' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽', { currentUserId: 'me' })

      expect(result).toEqual(['u2'])
    })

    it('should apply cursor in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'u3' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽', { cursor: 'u2' })

      expect(result).toEqual(['u3'])
    })

    it('should apply all options combined in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'u1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽', {
        excludedUserIds: ['blocked1'],
        currentUserId: 'me',
        cursor: 'c1',
        limit: 5,
      })

      expect(result).toEqual(['u1'])
    })

    it('should fallback to LIKE on trgm user search error', async () => {
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('trgm error'))
        .mockResolvedValueOnce([{ id: 'fb1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽')

      expect(result).toEqual(['fb1'])
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchShops - Error handling and fallback
  // ----------------------------------------------------------
  describe('fulltextSearchShops - trgm and error handling', async () => {
    beforeEach(() => {
      process.env.SEARCH_MODE = 'trgm'
    })

    it('should search shops with trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 's1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('テスト園')

      expect(result).toEqual(['s1'])
    })

    it('should apply prefecture filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 's1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('園', { prefecture: '東京都' })

      expect(result).toEqual(['s1'])
    })

    it('should apply cursor in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 's2' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('園', { cursor: 's1' })

      expect(result).toEqual(['s2'])
    })

    it('should fallback to LIKE on trgm shop search error', async () => {
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('trgm shop error'))
        .mockResolvedValueOnce([{ id: 'fb1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('園')

      expect(result).toEqual(['fb1'])
    })

    it('should apply prefecture in error fallback', async () => {
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValueOnce([{ id: 'fb1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('園', { prefecture: '大阪府', cursor: 'c1' })

      expect(result).toEqual(['fb1'])
    })

    it('should search shops with bigm mode and prefecture', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 's1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('園', { prefecture: '東京都', cursor: 'c1' })

      expect(result).toEqual(['s1'])
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchEvents - includeExpired parameter
  // ----------------------------------------------------------
  describe('fulltextSearchEvents - includeExpired combinations', async () => {
    it('should exclude expired events by default in trgm mode', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'e1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント', { includeExpired: false })

      expect(result).toEqual(['e1'])
    })

    it('should include expired events when includeExpired=true in trgm mode', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント', { includeExpired: true })

      expect(result).toEqual(['e1', 'e2'])
    })

    it('should apply prefecture filter in trgm mode', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'e1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント', { prefecture: '東京都' })

      expect(result).toEqual(['e1'])
    })

    it('should apply cursor in trgm mode', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'e2' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント', { cursor: 'e1' })

      expect(result).toEqual(['e2'])
    })

    it('should include expired events in bigm mode', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'e1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント', { includeExpired: true })

      expect(result).toEqual(['e1'])
    })

    it('should exclude expired events in bigm mode', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'e1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント', { includeExpired: false })

      expect(result).toEqual(['e1'])
    })

    it('should include expired events in like mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'e1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント', { includeExpired: true })

      expect(result).toEqual(['e1'])
    })

    it('should fallback to LIKE on trgm event search error', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('event error'))
        .mockResolvedValueOnce([{ id: 'fb1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント')

      expect(result).toEqual(['fb1'])
    })

    it('should apply includeExpired=true in error fallback', async () => {
      process.env.SEARCH_MODE = 'trgm'
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValueOnce([{ id: 'fb1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント', { includeExpired: true, prefecture: '大阪府', cursor: 'c1' })

      expect(result).toEqual(['fb1'])
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchBonsais - Multiple branches with combined filters
  // ----------------------------------------------------------
  describe('fulltextSearchBonsais - trgm mode with filters', async () => {
    beforeEach(() => {
      process.env.SEARCH_MODE = 'trgm'
    })

    it('should search bonsais with trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'b1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'u1' })

      expect(result).toEqual(['b1'])
    })

    it('should apply userId filter in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'b1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'user1' })

      expect(result).toEqual(['b1'])
    })

    it('should apply cursor in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'b2' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'u1', cursor: 'b1' })

      expect(result).toEqual(['b2'])
    })

    it('should apply userId+cursor combined in trgm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'b3' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'u1', cursor: 'b2', limit: 5 })

      expect(result).toEqual(['b3'])
    })

    it('should fallback to LIKE on trgm bonsai search error', async () => {
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('bonsai error'))
        .mockResolvedValueOnce([{ id: 'fb1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'u1' })

      expect(result).toEqual(['fb1'])
    })

    it('should apply userId in error fallback', async () => {
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('error'))
        .mockResolvedValueOnce([{ id: 'fb1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'u1', cursor: 'c1' })

      expect(result).toEqual(['fb1'])
    })

    it('should search bonsais with bigm mode and userId', async () => {
      process.env.SEARCH_MODE = 'bigm'
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'b1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'u1', cursor: 'c1' })

      expect(result).toEqual(['b1'])
    })
  })

  // ----------------------------------------------------------
  // getSearchIndexes - inner catch per index
  // ----------------------------------------------------------
  describe('getSearchIndexes - individual index errors', async () => {
    it('should skip individual index errors and continue', async () => {
      // First query throws, second returns true, rest return false
      let callCount = 0
      mockPrismaForFulltext.$queryRaw.mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          throw new Error('Individual index error')
        }
        if (callCount === 2) {
          return Promise.resolve([{ exists: true }])
        }
        return Promise.resolve([{ exists: false }])
      })

      const { getSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await getSearchIndexes()

      // Should have at least one index (the second one that returned true)
      expect(result.length).toBeGreaterThanOrEqual(1)
      expect(result[0]!.name).toBe('users_nickname_trgm_idx')
    })

    it('should return indexes that exist, skipping non-existent ones', async () => {
      // All return false (no indexes exist)
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ exists: false }])

      const { getSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await getSearchIndexes()

      expect(result).toEqual([])
    })

    it('should handle multiple existing indexes', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ exists: true }])

      const { getSearchIndexes } = await import('@/lib/search/fulltext')
      const result = await getSearchIndexes()

      // All 12 target indexes should be returned
      expect(result.length).toBe(12)
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchShops - like mode with prefecture and cursor
  // ----------------------------------------------------------
  describe('fulltextSearchShops - like mode', async () => {
    it('should search shops with like mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 's1' }])

      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('園', { prefecture: '東京都', cursor: 'c1' })

      expect(result).toEqual(['s1'])
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchEvents - like mode with prefecture and cursor
  // ----------------------------------------------------------
  describe('fulltextSearchEvents - like mode', async () => {
    it('should search events with like mode and options', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'e1' }])

      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('イベント', { prefecture: '大阪府', cursor: 'c1', includeExpired: false })

      expect(result).toEqual(['e1'])
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchBonsais - like mode with userId and cursor
  // ----------------------------------------------------------
  describe('fulltextSearchBonsais - like mode', async () => {
    it('should search bonsais with like mode and userId', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'b1' }])

      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('黒松', { userId: 'u1', cursor: 'c1' })

      expect(result).toEqual(['b1'])
    })
  })

  // ----------------------------------------------------------
  // fulltextSearchUsers - bigm mode with all options
  // ----------------------------------------------------------
  describe('fulltextSearchUsers - bigm mode', async () => {
    beforeEach(() => {
      process.env.SEARCH_MODE = 'bigm'
    })

    it('should apply all options in bigm mode', async () => {
      mockPrismaForFulltext.$queryRaw.mockResolvedValue([{ id: 'u1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('盆栽', {
        excludedUserIds: ['blocked1'],
        currentUserId: 'me',
        cursor: 'c1',
        limit: 5,
      })

      expect(result).toEqual(['u1'])
    })

    it('should fallback to LIKE on bigm user search error', async () => {
      mockPrismaForFulltext.$queryRaw
        .mockRejectedValueOnce(new Error('bigm error'))
        .mockResolvedValueOnce([{ id: 'fb1' }])

      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('テスト')

      expect(result).toEqual(['fb1'])
    })
  })

  // ----------------------------------------------------------
  // Empty/whitespace queries
  // ----------------------------------------------------------
  describe('empty query handling', async () => {
    it('fulltextSearchPosts returns empty for whitespace query', async () => {
      const { fulltextSearchPosts } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchPosts('   ')
      expect(result).toEqual([])
    })

    it('fulltextSearchUsers returns empty for whitespace query', async () => {
      const { fulltextSearchUsers } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchUsers('   ')
      expect(result).toEqual([])
    })

    it('fulltextSearchShops returns empty for whitespace query', async () => {
      const { fulltextSearchShops } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchShops('   ')
      expect(result).toEqual([])
    })

    it('fulltextSearchEvents returns empty for whitespace query', async () => {
      const { fulltextSearchEvents } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchEvents('   ')
      expect(result).toEqual([])
    })

    it('fulltextSearchBonsais returns empty for whitespace query', async () => {
      const { fulltextSearchBonsais } = await import('@/lib/search/fulltext')
      const result = await fulltextSearchBonsais('   ', { userId: 'u1' })
      expect(result).toEqual([])
    })
  })
})
