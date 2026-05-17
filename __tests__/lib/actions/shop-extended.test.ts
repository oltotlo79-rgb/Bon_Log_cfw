import { vi } from 'vitest'
/**
 * Extended tests for shop actions - covering uncovered branches
 * Targets: rating sort, location sort, getPendingShopChangeRequestsCount, and more
 */
 export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, Record<string, unknown>> = {
  bonsaiShop: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  shopGenre: { findMany: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn() },
  shopReview: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), groupBy: vi.fn() },
  shopChangeRequest: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  shopFavorite: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
  adminLog: { create: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() } }))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue('127.0.0.1') }) }))

beforeEach(() => {
  vi.clearAllMocks()
  ;(mockPrisma.shopReview.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([])
})

describe('getShops - rating sort', async () => {
  it('sorts shops by rating descending with nulls last', async () => {
    const { getShops } = await import('@/lib/actions/shop')
    const shops = [
      { id: 's1', name: 'A', address: '東京都', latitude: '35.6', longitude: '139.7', genres: [], _count: { reviews: 1 }, isHidden: false },
      { id: 's2', name: 'B', address: '東京都', latitude: '35.6', longitude: '139.7', genres: [], _count: { reviews: 0 }, isHidden: false },
      { id: 's3', name: 'C', address: '東京都', latitude: '35.6', longitude: '139.7', genres: [], _count: { reviews: 1 }, isHidden: false },
    ]
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(shops)
    ;(mockPrisma.shopReview.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { shopId: 's1', _avg: { rating: 3 }, _count: { rating: 1 } },
      { shopId: 's3', _avg: { rating: 5 }, _count: { rating: 1 } },
    ])

    const result = await getShops({ sortBy: 'rating' })
    expect(result.shops).toBeDefined()
    if (result.shops) {
      expect(result.shops[0].id).toBe('s3') // rating 5
      expect(result.shops[1].id).toBe('s1') // rating 3
      expect(result.shops[2].id).toBe('s2') // no rating (null)
    }
  })

  it('handles all null ratings', async () => {
    const { getShops } = await import('@/lib/actions/shop')
    const shops = [
      { id: 's1', name: 'A', address: '東京都', latitude: '35.6', longitude: '139.7', genres: [], _count: { reviews: 0 }, isHidden: false },
      { id: 's2', name: 'B', address: '大阪府', latitude: '34.6', longitude: '135.5', genres: [], _count: { reviews: 0 }, isHidden: false },
    ]
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(shops)

    const result = await getShops({ sortBy: 'rating' })
    expect(result.shops).toHaveLength(2)
  })

  it('sorts by rating with one null', async () => {
    const { getShops } = await import('@/lib/actions/shop')
    const shops = [
      { id: 's1', name: 'A', address: '東京都', latitude: '35.6', longitude: '139.7', genres: [], _count: { reviews: 0 }, isHidden: false },
      { id: 's2', name: 'B', address: '東京都', latitude: '35.6', longitude: '139.7', genres: [], _count: { reviews: 1 }, isHidden: false },
    ]
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(shops)
    ;(mockPrisma.shopReview.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { shopId: 's2', _avg: { rating: 4 }, _count: { rating: 1 } },
    ])

    const result = await getShops({ sortBy: 'rating' })
    if (result.shops) {
      expect(result.shops[0].id).toBe('s2')
      expect(result.shops[1].id).toBe('s1')
    }
  })
})

describe('getShops - location sort', async () => {
  it('passes latitude DESC NULLS LAST orderBy to DB', async () => {
    const { getShops } = await import('@/lib/actions/shop')
    const shops = [
      { id: 's1', name: 'South', address: '大阪府大阪市', latitude: '34.6', longitude: '135.5', genres: [], _count: { reviews: 0 }, isHidden: false },
      { id: 's2', name: 'North', address: '北海道札幌市', latitude: '43.0', longitude: '141.3', genres: [], _count: { reviews: 0 }, isHidden: false },
    ]
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(shops)

    await getShops({ sortBy: 'location' })

    expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { latitude: { sort: 'desc', nulls: 'last' } },
          { name: 'asc' },
        ],
      })
    )
  })

  it('returns all shops with latitude values converted to number', async () => {
    const { getShops } = await import('@/lib/actions/shop')
    const shops = [
      { id: 's1', name: 'South', address: '大阪府大阪市', latitude: '34.6', longitude: '135.5', genres: [], _count: { reviews: 0 }, isHidden: false },
      { id: 's2', name: 'North', address: '北海道札幌市', latitude: '43.0', longitude: '141.3', genres: [], _count: { reviews: 0 }, isHidden: false },
    ]
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(shops)

    const result = await getShops({ sortBy: 'location' })
    expect(result.shops).toHaveLength(2)
    if (result.shops) {
      expect(typeof result.shops[0].latitude).toBe('number')
    }
  })

  it('handles shops with null latitude', async () => {
    const { getShops } = await import('@/lib/actions/shop')
    const shops = [
      { id: 's1', name: 'NoCoord', address: '不明', latitude: null, longitude: null, genres: [], _count: { reviews: 0 }, isHidden: false },
      { id: 's2', name: 'WithCoord', address: '東京都', latitude: '35.6', longitude: '139.7', genres: [], _count: { reviews: 0 }, isHidden: false },
    ]
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(shops)

    const result = await getShops({ sortBy: 'location' })
    expect(result.shops).toHaveLength(2)
    if (result.shops) {
      expect(result.shops.find(s => s.id === 's1')?.latitude).toBeNull()
    }
  })

  it('returns shops when both have null latitude and longitude', async () => {
    const { getShops } = await import('@/lib/actions/shop')
    const shops = [
      { id: 's1', name: 'A', address: '不明1', latitude: null, longitude: null, genres: [], _count: { reviews: 0 }, isHidden: false },
      { id: 's2', name: 'B', address: '不明2', latitude: null, longitude: null, genres: [], _count: { reviews: 0 }, isHidden: false },
    ]
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(shops)

    const result = await getShops({ sortBy: 'location' })
    expect(result.shops).toHaveLength(2)
  })
})

describe('getShops - genre mapping', async () => {
  it('maps genre from intermediate table', async () => {
    const { getShops } = await import('@/lib/actions/shop')
    const shops = [
      {
        id: 's1', name: 'Shop1', address: '東京都', latitude: '35.6', longitude: '139.7',
        genres: [{ genre: { id: 'g1', name: '松柏類' } }],
        _count: { reviews: 1 },
        isHidden: false,
      },
    ]
    ;(mockPrisma.bonsaiShop.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(shops)
    ;(mockPrisma.shopReview.groupBy as ReturnType<typeof vi.fn>).mockResolvedValue([
      { shopId: 's1', _avg: { rating: 4 }, _count: { rating: 1 } },
    ])

    const result = await getShops({})
    if (result.shops) {
      expect(result.shops[0].genres).toEqual([{ id: 'g1', name: '松柏類' }])
    }
  })
})

describe('getPendingShopChangeRequestsCount', async () => {
  it('returns count for admin', async () => {
    const { getPendingShopChangeRequestsCount } = await import('@/lib/actions/shop')
    mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
    ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1', userId: 'admin1', role: 'admin' })
    ;(mockPrisma.shopChangeRequest.count as ReturnType<typeof vi.fn>).mockResolvedValue(5)

    const result = await getPendingShopChangeRequestsCount()
    expect(result).toEqual({ count: 5 })
  })

  it('returns 0 when not authenticated', async () => {
    const { getPendingShopChangeRequestsCount } = await import('@/lib/actions/shop')
    mockAuth.mockResolvedValue(null)

    const result = await getPendingShopChangeRequestsCount()
    expect(result).toEqual({ count: 0 })
  })

  it('returns 0 when not admin', async () => {
    const { getPendingShopChangeRequestsCount } = await import('@/lib/actions/shop')
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await getPendingShopChangeRequestsCount()
    expect(result).toEqual({ count: 0 })
  })
})
