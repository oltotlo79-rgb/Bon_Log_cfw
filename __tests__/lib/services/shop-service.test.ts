// @vitest-environment node
/**
 * lib/services/shop-service のユニットテスト
 *
 * listShopsV1 / getShopV1 / createShopV1 / updateShopV1 / listReviewsV1 / createReviewV1 / listGenresV1 の
 * 正常系・権限ガード・404・409 重複・バリデーション・フィルタ・カーソル・sortBy を網羅する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { Decimal } from '@prisma/client/runtime/library'

// ──────────────────────────────────────────────────
// Mock: prisma
// ──────────────────────────────────────────────────
const mockBonsaiShopFindMany = vi.fn()
const mockBonsaiShopFindUnique = vi.fn()
const mockBonsaiShopFindFirst = vi.fn()
const mockBonsaiShopCreate = vi.fn()
const mockShopReviewAggregate = vi.fn()
const mockShopReviewFindMany = vi.fn()
const mockShopReviewFindUnique = vi.fn()
const mockShopReviewCreate = vi.fn()
const mockShopGenreDeleteMany = vi.fn()
const mockGenreFindMany = vi.fn()
const mockAdminUserFindUnique = vi.fn()

const mockTransaction = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    bonsaiShop: {
      findMany: (...args: unknown[]) => mockBonsaiShopFindMany(...args),
      findUnique: (...args: unknown[]) => mockBonsaiShopFindUnique(...args),
      findFirst: (...args: unknown[]) => mockBonsaiShopFindFirst(...args),
      create: (...args: unknown[]) => mockBonsaiShopCreate(...args),
      update: vi.fn(),
    },
    shopReview: {
      aggregate: (...args: unknown[]) => mockShopReviewAggregate(...args),
      findMany: (...args: unknown[]) => mockShopReviewFindMany(...args),
      findUnique: (...args: unknown[]) => mockShopReviewFindUnique(...args),
      create: (...args: unknown[]) => mockShopReviewCreate(...args),
    },
    shopGenre: {
      deleteMany: (...args: unknown[]) => mockShopGenreDeleteMany(...args),
    },
    genre: {
      findMany: (...args: unknown[]) => mockGenreFindMany(...args),
    },
    adminUser: {
      findUnique: (...args: unknown[]) => mockAdminUserFindUnique(...args),
    },
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}))

// ──────────────────────────────────────────────────
// Mock: logger
// ──────────────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// ──────────────────────────────────────────────────
// Mock: sanitize
// ──────────────────────────────────────────────────
vi.mock('@/lib/sanitize', () => ({
  sanitizeText: (s: string) => s,
  sanitizeUrl: (s: string) => s,
}))

// ──────────────────────────────────────────────────
// Mock: cache（getCachedShopRatings / revalidateShopRatingsCache）
// ──────────────────────────────────────────────────
const mockGetCachedShopRatings = vi.fn()
const mockRevalidateShopRatingsCache = vi.fn()

vi.mock('@/lib/cache', () => ({
  getCachedShopRatings: (...args: unknown[]) => mockGetCachedShopRatings(...args),
  revalidateShopRatingsCache: (...args: unknown[]) => mockRevalidateShopRatingsCache(...args),
}))

// ──────────────────────────────────────────────────
// Mock: authorization（canUserEditShop）
// ──────────────────────────────────────────────────
const mockCanUserEditShop = vi.fn()

vi.mock('@/lib/services/authorization', () => ({
  canUserEditShop: (...args: unknown[]) => mockCanUserEditShop(...args),
}))

// ──────────────────────────────────────────────────
// Mock: media-url-validator（assertMediaUrlsFromOwnStorage）
// ──────────────────────────────────────────────────
const mockAssertMediaUrlsFromOwnStorage = vi.fn()

vi.mock('@/lib/services/media-url-validator', () => ({
  assertMediaUrlsFromOwnStorage: (...args: unknown[]) => mockAssertMediaUrlsFromOwnStorage(...args),
}))

// ──────────────────────────────────────────────────
// Mock: prisma-filters（containsInsensitive）
// ──────────────────────────────────────────────────
vi.mock('@/lib/actions/prisma-filters', () => ({
  containsInsensitive: (q: string) => ({ contains: q, mode: 'insensitive' }),
}))

// ──────────────────────────────────────────────────
// テスト用定数
// ──────────────────────────────────────────────────
const OWNER_ID = 'user-owner-id'
const OTHER_ID = 'user-other-id'
const SHOP_ID = 'shop-cjld2cyuq001'

const makeShopRow = (overrides: Record<string, unknown> = {}) => ({
  id: SHOP_ID,
  name: 'テスト盆栽園',
  address: '東京都渋谷区テスト1-1-1',
  latitude: new Decimal('35.6895'),
  longitude: new Decimal('139.6917'),
  phone: '03-0000-0000',
  website: 'https://example.com',
  businessHours: '10:00-18:00',
  closedDays: '水曜定休',
  isHidden: false,
  createdBy: OWNER_ID,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  creator: {
    id: OWNER_ID,
    nickname: 'オーナー',
    avatarUrl: null,
  },
  genres: [
    { genre: { id: 'genre-1', name: '松柏類' } },
  ],
  _count: { reviews: 5 },
  ...overrides,
})

const makeReviewRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'review-001',
  shopId: SHOP_ID,
  userId: OWNER_ID,
  rating: 4,
  content: 'とても良い園芸店です',
  isHidden: false,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  user: {
    id: OWNER_ID,
    nickname: 'レビュアー',
    avatarUrl: null,
  },
  images: [{ url: 'https://storage.example.com/review-img.jpg' }],
  ...overrides,
})

const mockRatingAggs = [
  { shopId: SHOP_ID, _avg: { rating: 4.2 }, _count: { rating: 5 } },
]

// ──────────────────────────────────────────────────
// スキーマバリデーション
// ──────────────────────────────────────────────────

describe('listShopsV1QuerySchema.prefecture.refine', () => {
  it('prefecture が undefined のとき refine を通過する', async () => {
    const { listShopsV1QuerySchema } = await import('@/lib/services/shop-service')
    const result = listShopsV1QuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('有効な都道府県（東京都）は refine を通過する', async () => {
    const { listShopsV1QuerySchema } = await import('@/lib/services/shop-service')
    const result = listShopsV1QuerySchema.safeParse({ prefecture: '東京都' })
    expect(result.success).toBe(true)
  })

  it('無効な都道府県は refine で失敗する', async () => {
    const { listShopsV1QuerySchema } = await import('@/lib/services/shop-service')
    const result = listShopsV1QuerySchema.safeParse({ prefecture: '架空県' })
    expect(result.success).toBe(false)
  })
})

describe('createShopV1Schema.website.refine', () => {
  const base = { name: 'テスト盆栽園', address: '東京都渋谷区1-1-1', genreIds: [] }

  it('website が null のとき refine を通過する', async () => {
    const { createShopV1Schema } = await import('@/lib/services/shop-service')
    const result = createShopV1Schema.safeParse({ ...base, website: null })
    expect(result.success).toBe(true)
  })

  it('website が空文字のとき refine を通過する', async () => {
    const { createShopV1Schema } = await import('@/lib/services/shop-service')
    const result = createShopV1Schema.safeParse({ ...base, website: '' })
    expect(result.success).toBe(true)
  })

  it('website が https URL のとき refine を通過する', async () => {
    const { createShopV1Schema } = await import('@/lib/services/shop-service')
    const result = createShopV1Schema.safeParse({ ...base, website: 'https://example.com' })
    expect(result.success).toBe(true)
  })

  it('website が http URL のとき refine を通過する', async () => {
    const { createShopV1Schema } = await import('@/lib/services/shop-service')
    const result = createShopV1Schema.safeParse({ ...base, website: 'http://example.com' })
    expect(result.success).toBe(true)
  })

  it('website が ftp:// で始まる場合 refine で失敗する', async () => {
    const { createShopV1Schema } = await import('@/lib/services/shop-service')
    const result = createShopV1Schema.safeParse({ ...base, website: 'ftp://example.com' })
    expect(result.success).toBe(false)
  })
})

describe('updateShopV1Schema.website.refine', () => {
  it('website が https URL のとき refine を通過する', async () => {
    const { updateShopV1Schema } = await import('@/lib/services/shop-service')
    const result = updateShopV1Schema.safeParse({ website: 'https://example.com' })
    expect(result.success).toBe(true)
  })

  it('website が空文字のとき refine を通過する', async () => {
    const { updateShopV1Schema } = await import('@/lib/services/shop-service')
    const result = updateShopV1Schema.safeParse({ website: '' })
    expect(result.success).toBe(true)
  })

  it('website が null のとき refine を通過する', async () => {
    const { updateShopV1Schema } = await import('@/lib/services/shop-service')
    const result = updateShopV1Schema.safeParse({ website: null })
    expect(result.success).toBe(true)
  })

  it('website が無効な URL のとき refine で失敗する', async () => {
    const { updateShopV1Schema } = await import('@/lib/services/shop-service')
    const result = updateShopV1Schema.safeParse({ website: 'not-a-url' })
    expect(result.success).toBe(false)
  })
})

// ──────────────────────────────────────────────────
// listShopsV1
// ──────────────────────────────────────────────────
describe('listShopsV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiShopFindMany.mockResolvedValue([makeShopRow()])
    mockGetCachedShopRatings.mockResolvedValue(mockRatingAggs)
  })

  it('正常系: 盆栽園一覧を返す', async () => {
    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ id: SHOP_ID, name: 'テスト盆栽園' })
    expect(result.nextCursor).toBeNull()
  })

  it('ゲスト（requestUserId=null）でも一覧取得できる', async () => {
    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items[0]?.isOwner).toBe(false)
  })

  it('requestUserId が作成者と一致する場合 isOwner が true', async () => {
    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items[0]?.isOwner).toBe(true)
  })

  it('requestUserId が他ユーザーの場合 isOwner が false', async () => {
    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, OTHER_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items[0]?.isOwner).toBe(false)
  })

  it('latitude/longitude は Decimal から number に変換される', async () => {
    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(typeof result.items[0]?.latitude).toBe('number')
    expect(typeof result.items[0]?.longitude).toBe('number')
    expect(result.items[0]?.latitude).toBeCloseTo(35.6895)
    expect(result.items[0]?.longitude).toBeCloseTo(139.6917)
  })

  it('latitude/longitude が null のとき null を返す', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([makeShopRow({ latitude: null, longitude: null })])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items[0]?.latitude).toBeNull()
    expect(result.items[0]?.longitude).toBeNull()
  })

  it('ratingMap で平均評価と件数が反映される', async () => {
    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items[0]?.averageRating).toBeCloseTo(4.2)
    expect(result.items[0]?.reviewCount).toBe(5)
  })

  it('sortBy=rating: items が評価降順にソートされる', async () => {
    const shops = [
      makeShopRow({ id: 'shop-a', name: 'A園', _count: { reviews: 3 } }),
      makeShopRow({ id: 'shop-b', name: 'B園', _count: { reviews: 1 } }),
      makeShopRow({ id: 'shop-c', name: 'C園（評価なし）', _count: { reviews: 0 } }),
    ]
    mockBonsaiShopFindMany.mockResolvedValue(shops)
    mockGetCachedShopRatings.mockResolvedValue([
      { shopId: 'shop-a', _avg: { rating: 3.0 }, _count: { rating: 3 } },
      { shopId: 'shop-b', _avg: { rating: 5.0 }, _count: { rating: 1 } },
    ])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({ sortBy: 'rating' }, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items[0]?.id).toBe('shop-b')
    expect(result.items[1]?.id).toBe('shop-a')
    expect(result.items[2]?.id).toBe('shop-c')
  })

  it('sortBy=name: orderBy に name: asc + id: desc（タイブレーカ）が渡される', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({ sortBy: 'name' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as { orderBy: unknown }
    expect(callArgs?.orderBy).toEqual([{ name: 'asc' }, { id: 'desc' }])
  })

  it('sortBy=newest: orderBy に createdAt: desc + id: desc（タイブレーカ）が渡される', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({ sortBy: 'newest' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as { orderBy: unknown }
    expect(callArgs?.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'desc' }])
  })

  it('sortBy=location: orderBy に latitude: desc + name: asc + id: desc（タイブレーカ）が渡される', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({ sortBy: 'location' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as { orderBy: unknown }
    expect(callArgs?.orderBy).toEqual([
      { latitude: { sort: 'desc', nulls: 'last' } },
      { name: 'asc' },
      { id: 'desc' },
    ])
  })

  it('sortBy 未指定（デフォルト=location）: orderBy にも id タイブレーカが含まれる', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({}, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as { orderBy: unknown }
    expect(callArgs?.orderBy).toEqual([
      { latitude: { sort: 'desc', nulls: 'last' } },
      { name: 'asc' },
      { id: 'desc' },
    ])
  })

  // 同一 createdAt/name/latitude を持つ複数店舗がある場合、id タイブレーカが無いと
  // ネイティブカーソル（cursor:{id}, skip:1）で重複・欠落が起き得る。
  // ここでは実際の Prisma ソートを模倣せず、「id が orderBy の末尾に必ず含まれる」ことで
  // 決定的な全順序（total order）が保証されることを確認する。
  it.each(['newest', 'name', 'location'] as const)(
    'sortBy=%s: 同値ソートキーの重複/欠落防止のため id が orderBy の最後に含まれる',
    async (sortBy) => {
      mockBonsaiShopFindMany.mockResolvedValue([])
      mockGetCachedShopRatings.mockResolvedValue([])

      const { listShopsV1 } = await import('@/lib/services/shop-service')
      await listShopsV1({ sortBy }, null)

      const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as { orderBy: unknown }
      expect(Array.isArray(callArgs?.orderBy)).toBe(true)
      const orderByArr = callArgs?.orderBy as Array<Record<string, unknown>>
      const last = orderByArr[orderByArr.length - 1]
      expect(last).toEqual({ id: 'desc' })
    }
  )

  it('isHidden: false が where に含まれる', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({}, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as { where: Record<string, unknown> }
    expect(callArgs?.where?.isHidden).toBe(false)
  })

  it('prefecture フィルタ: where に address.startsWith が含まれる', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({ prefecture: '東京都' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as {
      where: { AND?: unknown[] }
    }
    const andConds = callArgs?.where?.AND
    expect(Array.isArray(andConds)).toBe(true)
    if (!Array.isArray(andConds)) throw new Error()
    const prefCond = andConds.find(
      (c) => typeof c === 'object' && c !== null && 'address' in c,
    )
    expect(prefCond).toBeDefined()
  })

  it('genreId フィルタ: where に genres.some.genreId が含まれる', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({ genreId: 'genre-1' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as {
      where: { genres?: { some: { genreId: string } } }
    }
    expect(callArgs?.where?.genres?.some?.genreId).toBe('genre-1')
  })

  it('cursor 指定（DBカラムソート）: where に id フィルタを含めず native cursor（cursor:{id}, skip:1）を使う', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({ cursor: 'cursor-shop-id', sortBy: 'name' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as {
      where: { id?: unknown }
      cursor?: { id: string }
      skip?: number
    }
    expect(callArgs?.where?.id).toBeUndefined()
    expect(callArgs?.cursor).toEqual({ id: 'cursor-shop-id' })
    expect(callArgs?.skip).toBe(1)
  })

  it('cursor 未指定（DBカラムソート）: findMany に cursor/skip が渡らない', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({ sortBy: 'newest' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as {
      cursor?: unknown
      skip?: number
    }
    expect(callArgs?.cursor).toBeUndefined()
    expect(callArgs?.skip).toBeUndefined()
  })

  it('sortBy=rating かつ cursor 指定: findMany に cursor/skip を渡さず全候補を take:MAX_SHOPS_LIMIT で取得する', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const { MAX_SHOPS_LIMIT } = await import('@/lib/constants/limits')
    await listShopsV1({ cursor: 'cursor-shop-id', sortBy: 'rating' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as {
      cursor?: unknown
      skip?: number
      take: number
    }
    expect(callArgs?.cursor).toBeUndefined()
    expect(callArgs?.skip).toBeUndefined()
    expect(callArgs?.take).toBe(MAX_SHOPS_LIMIT)
  })

  it('sortBy=rating: cursor（前頁最終行 id）指定時、rating 順ソート後にその次から limit 件をスライスする（欠落・重複なし）', async () => {
    const shops = [
      makeShopRow({ id: 'shop-a', name: 'A園' }),
      makeShopRow({ id: 'shop-b', name: 'B園' }),
      makeShopRow({ id: 'shop-c', name: 'C園' }),
      makeShopRow({ id: 'shop-d', name: 'D園' }),
    ]
    mockBonsaiShopFindMany.mockResolvedValue(shops)
    // rating 降順: shop-d(5.0) > shop-c(4.0) > shop-b(3.0) > shop-a(2.0)
    mockGetCachedShopRatings.mockResolvedValue([
      { shopId: 'shop-a', _avg: { rating: 2.0 }, _count: { rating: 1 } },
      { shopId: 'shop-b', _avg: { rating: 3.0 }, _count: { rating: 1 } },
      { shopId: 'shop-c', _avg: { rating: 4.0 }, _count: { rating: 1 } },
      { shopId: 'shop-d', _avg: { rating: 5.0 }, _count: { rating: 1 } },
    ])

    const { listShopsV1 } = await import('@/lib/services/shop-service')

    // 1ページ目: limit=2 → shop-d, shop-c が返り nextCursor=shop-c
    const page1 = await listShopsV1({ sortBy: 'rating', limit: 2 }, null)
    expect(page1).toMatchObject({ ok: true })
    if (!page1.ok) throw new Error('ok=false')
    expect(page1.items.map((i) => i.id)).toEqual(['shop-d', 'shop-c'])
    expect(page1.nextCursor).toBe('shop-c')

    // 2ページ目: cursor=shop-c → shop-b, shop-a が続く（重複・欠落なし）
    const page2 = await listShopsV1({ sortBy: 'rating', limit: 2, cursor: page1.nextCursor ?? undefined }, null)
    expect(page2).toMatchObject({ ok: true })
    if (!page2.ok) throw new Error('ok=false')
    expect(page2.items.map((i) => i.id)).toEqual(['shop-b', 'shop-a'])
    expect(page2.nextCursor).toBeNull()

    const allIds = [...page1.items.map((i) => i.id), ...page2.items.map((i) => i.id)]
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(allIds).toHaveLength(4)
  })

  it('sortBy=rating: cursor 行が候補から消えている場合は空配列を返す（重複表示を避ける安全側フォールバック）', async () => {
    const shops = [
      makeShopRow({ id: 'shop-a', name: 'A園' }),
      makeShopRow({ id: 'shop-b', name: 'B園' }),
    ]
    mockBonsaiShopFindMany.mockResolvedValue(shops)
    mockGetCachedShopRatings.mockResolvedValue([
      { shopId: 'shop-a', _avg: { rating: 2.0 }, _count: { rating: 1 } },
      { shopId: 'shop-b', _avg: { rating: 3.0 }, _count: { rating: 1 } },
    ])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({ sortBy: 'rating', cursor: 'deleted-shop-id' }, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('カーソルページネーション: limit+1 件返されたとき nextCursor を設定する', async () => {
    const shops = Array.from({ length: 21 }, (_, i) =>
      makeShopRow({ id: `shop-${i}`, name: `園${i}` }),
    )
    mockBonsaiShopFindMany.mockResolvedValue(shops)
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({ limit: 20 }, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('shop-19')
  })

  it('件数が limit 以下なら nextCursor は null', async () => {
    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({ limit: 20 }, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.nextCursor).toBeNull()
  })

  it('空リスト: items が [] で nextCursor が null', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, null)

    expect(result).toMatchObject({ ok: true, items: [], nextCursor: null })
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockBonsaiShopFindMany.mockRejectedValue(new Error('DB error'))

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, null)

    expect(result).toMatchObject({ ok: false })
  })

  it('search フィルタ: where に名前・住所の OR 条件が含まれる', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({ search: '盆栽' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as {
      where: { AND?: unknown[] }
    }
    const andConds = callArgs?.where?.AND
    expect(Array.isArray(andConds)).toBe(true)
    if (!Array.isArray(andConds)) throw new Error()
    const orCond = andConds.find(
      (c) => typeof c === 'object' && c !== null && 'OR' in c,
    )
    expect(orCond).toBeDefined()
  })

  it('search と prefecture 両方指定: AND に OR 条件と address.startsWith 条件の両方が含まれる', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    await listShopsV1({ search: '盆栽', prefecture: '東京都' }, null)

    const callArgs = mockBonsaiShopFindMany.mock.calls[0]?.[0] as {
      where: { AND?: unknown[] }
    }
    const andConds = callArgs?.where?.AND
    expect(Array.isArray(andConds)).toBe(true)
    if (!Array.isArray(andConds)) throw new Error()
    expect(andConds).toHaveLength(2)
    const orCond = andConds.find((c) => typeof c === 'object' && c !== null && 'OR' in c)
    const prefCond = andConds.find((c) => typeof c === 'object' && c !== null && 'address' in c)
    expect(orCond).toBeDefined()
    expect(prefCond).toBeDefined()
  })

  it('ratingMap にないショップ: averageRating が null で reviewCount は _count.reviews から取得される', async () => {
    mockBonsaiShopFindMany.mockResolvedValue([makeShopRow({ id: 'shop-no-rating', _count: { reviews: 7 } })])
    mockGetCachedShopRatings.mockResolvedValue([])

    const { listShopsV1 } = await import('@/lib/services/shop-service')
    const result = await listShopsV1({}, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items[0]?.averageRating).toBeNull()
    expect(result.items[0]?.reviewCount).toBe(7)
  })
})

// ──────────────────────────────────────────────────
// getShopV1
// ──────────────────────────────────────────────────
describe('getShopV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiShopFindUnique.mockResolvedValue(makeShopRow())
    mockShopReviewAggregate.mockResolvedValue({
      _avg: { rating: 4.2 },
      _count: { rating: 5 },
    })
  })

  it('正常系: shop が存在すれば ok: true と shop を返す', async () => {
    const { getShopV1 } = await import('@/lib/services/shop-service')
    const result = await getShopV1(SHOP_ID, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.shop.id).toBe(SHOP_ID)
    expect(result.shop.averageRating).toBeCloseTo(4.2)
    expect(result.shop.reviewCount).toBe(5)
  })

  it('isHidden: false が where に含まれる', async () => {
    const { getShopV1 } = await import('@/lib/services/shop-service')
    await getShopV1(SHOP_ID, null)

    const callArgs = mockBonsaiShopFindUnique.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
    }
    expect(callArgs?.where?.isHidden).toBe(false)
  })

  it('shop が存在しない(null): ok: false と ERR_SHOP_NOT_FOUND', async () => {
    mockBonsaiShopFindUnique.mockResolvedValue(null)

    const { getShopV1 } = await import('@/lib/services/shop-service')
    const result = await getShopV1('nonexistent', null)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_SHOP_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_SHOP_NOT_FOUND)
  })

  it('isHidden のショップ（null 返却）: 404 相当の ok: false', async () => {
    mockBonsaiShopFindUnique.mockResolvedValue(null)

    const { getShopV1 } = await import('@/lib/services/shop-service')
    const result = await getShopV1(SHOP_ID, null)

    expect(result).toMatchObject({ ok: false })
  })

  it('latitude/longitude が Decimal から number に変換される', async () => {
    const { getShopV1 } = await import('@/lib/services/shop-service')
    const result = await getShopV1(SHOP_ID, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(typeof result.shop.latitude).toBe('number')
    expect(typeof result.shop.longitude).toBe('number')
  })

  it('ゲスト（requestUserId=null）でも取得できる', async () => {
    const { getShopV1 } = await import('@/lib/services/shop-service')
    const result = await getShopV1(SHOP_ID, null)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.shop.isOwner).toBe(false)
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockBonsaiShopFindUnique.mockRejectedValue(new Error('DB error'))

    const { getShopV1 } = await import('@/lib/services/shop-service')
    const result = await getShopV1(SHOP_ID, null)

    expect(result).toMatchObject({ ok: false })
  })
})

// ──────────────────────────────────────────────────
// createShopV1
// ──────────────────────────────────────────────────
describe('createShopV1', () => {
  const validInput = {
    name: 'テスト盆栽園',
    address: '東京都渋谷区テスト1-1-1',
    latitude: null,
    longitude: null,
    phone: null,
    website: null,
    businessHours: null,
    closedDays: null,
    genreIds: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiShopFindFirst.mockResolvedValue(null)
    mockBonsaiShopCreate.mockResolvedValue({ id: SHOP_ID })
  })

  it('正常系: ok: true と作成済みショップ ID を返す', async () => {
    const { createShopV1 } = await import('@/lib/services/shop-service')
    const result = await createShopV1(validInput, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.shop.id).toBe(SHOP_ID)
    expect(mockBonsaiShopCreate).toHaveBeenCalledTimes(1)
  })

  it('userId が data.createdBy として渡される', async () => {
    const { createShopV1 } = await import('@/lib/services/shop-service')
    await createShopV1(validInput, OWNER_ID)

    const callArgs = mockBonsaiShopCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArgs?.data?.createdBy).toBe(OWNER_ID)
  })

  it('重複住所: ok: false と ERR_SHOP_DUPLICATE_ADDRESS と existingId を返す', async () => {
    mockBonsaiShopFindFirst.mockResolvedValue({ id: 'existing-shop-id' })

    const { createShopV1 } = await import('@/lib/services/shop-service')
    const result = await createShopV1(validInput, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_SHOP_DUPLICATE_ADDRESS } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_SHOP_DUPLICATE_ADDRESS)
    if ('existingId' in result) {
      expect(result.existingId).toBe('existing-shop-id')
    }
    expect(mockBonsaiShopCreate).not.toHaveBeenCalled()
  })

  it('genreIds の存在確認: type=shop のジャンルが正確に一致する場合は ok: true', async () => {
    mockGenreFindMany.mockResolvedValue([{ id: 'genre-1' }])

    const { createShopV1 } = await import('@/lib/services/shop-service')
    const result = await createShopV1({ ...validInput, genreIds: ['genre-1'] }, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
  })

  it('genreIds に無効なジャンルが含まれる: ok: false と ERR_INVALID_GENRE', async () => {
    mockGenreFindMany.mockResolvedValue([])

    const { createShopV1 } = await import('@/lib/services/shop-service')
    const result = await createShopV1({ ...validInput, genreIds: ['invalid-genre'] }, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_INVALID_GENRE } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_INVALID_GENRE)
  })

  it('prisma.create が例外をスローした場合 ok: false と ERR_SHOP_CREATE_FAILED', async () => {
    mockBonsaiShopCreate.mockRejectedValue(new Error('DB error'))

    const { createShopV1 } = await import('@/lib/services/shop-service')
    const result = await createShopV1(validInput, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_SHOP_CREATE_FAILED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_SHOP_CREATE_FAILED)
  })

  it('phone/website/businessHours/closedDays/latitude/longitude を設定した場合 create data に含まれる', async () => {
    const { createShopV1 } = await import('@/lib/services/shop-service')
    const result = await createShopV1(
      {
        name: 'テスト盆栽園',
        address: '東京都渋谷区テスト1-1-1',
        latitude: 35.6895,
        longitude: 139.6917,
        phone: '03-0000-0000',
        website: 'https://example.com',
        businessHours: '10:00-18:00',
        closedDays: '水曜定休',
        genreIds: [],
      },
      OWNER_ID,
    )
    expect(result).toMatchObject({ ok: true })
    const callArgs = mockBonsaiShopCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArgs?.data?.phone).toBe('03-0000-0000')
    expect(callArgs?.data?.website).toBe('https://example.com')
    expect(callArgs?.data?.businessHours).toBe('10:00-18:00')
    expect(callArgs?.data?.closedDays).toBe('水曜定休')
    expect(callArgs?.data?.latitude).toBe(35.6895)
    expect(callArgs?.data?.longitude).toBe(139.6917)
  })
})

// ──────────────────────────────────────────────────
// updateShopV1
// ──────────────────────────────────────────────────
describe('updateShopV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanUserEditShop.mockResolvedValue({ allowed: true })
    mockTransaction.mockImplementation(async (fn: unknown) => {
      if (typeof fn === 'function') {
        const tx = {
          shopGenre: { deleteMany: mockShopGenreDeleteMany },
          bonsaiShop: { update: vi.fn() },
        }
        return fn(tx)
      }
    })
  })

  it('正常系（作成者）: ok: true を返す', async () => {
    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1(SHOP_ID, { name: '更新後' }, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
  })

  it('admin ユーザーは ok: true を返す', async () => {
    mockCanUserEditShop.mockResolvedValue({ allowed: true, isAdmin: true })

    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1(SHOP_ID, { name: 'admin更新' }, 'admin-user-id')

    expect(result).toMatchObject({ ok: true })
  })

  it('他人（作成者でない）: ok: false と ERR_EDIT_PERMISSION_DENIED', async () => {
    mockCanUserEditShop.mockResolvedValue({ allowed: false, reason: 'Not the shop owner' })

    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1(SHOP_ID, { name: '変更' }, OTHER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_EDIT_PERMISSION_DENIED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_EDIT_PERMISSION_DENIED)
  })

  it('shop が存在しない: ok: false と ERR_SHOP_NOT_FOUND', async () => {
    mockCanUserEditShop.mockResolvedValue({ allowed: false, reason: 'Shop not found' })

    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1('nonexistent', { name: '変更' }, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_SHOP_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_SHOP_NOT_FOUND)
  })

  it('403 と 404 が区別される（Not the shop owner vs Shop not found）', async () => {
    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const { ERR_EDIT_PERMISSION_DENIED, ERR_SHOP_NOT_FOUND } = await import('@/lib/constants/errors')

    mockCanUserEditShop.mockResolvedValue({ allowed: false, reason: 'Not the shop owner' })
    const result403 = await updateShopV1(SHOP_ID, {}, OTHER_ID)
    expect(result403).toMatchObject({ ok: false })
    if (result403.ok) throw new Error('ok=true')
    expect(result403.error).toBe(ERR_EDIT_PERMISSION_DENIED)

    mockCanUserEditShop.mockResolvedValue({ allowed: false, reason: 'Shop not found' })
    const result404 = await updateShopV1('nonexistent', {}, OWNER_ID)
    expect(result404).toMatchObject({ ok: false })
    if (result404.ok) throw new Error('ok=true')
    expect(result404.error).toBe(ERR_SHOP_NOT_FOUND)
  })

  it('無効なジャンルが含まれる: ok: false と ERR_INVALID_GENRE', async () => {
    mockGenreFindMany.mockResolvedValue([])

    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1(SHOP_ID, { genreIds: ['invalid-genre'] }, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_INVALID_GENRE } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_INVALID_GENRE)
  })

  it('transaction が例外をスローした場合 ok: false と ERR_SHOP_UPDATE_FAILED', async () => {
    mockTransaction.mockRejectedValue(new Error('TX error'))

    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1(SHOP_ID, { name: '更新' }, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_SHOP_UPDATE_FAILED } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_SHOP_UPDATE_FAILED)
  })

  it('有効な genreIds を設定した場合 shopGenre.deleteMany が呼ばれる', async () => {
    mockGenreFindMany.mockResolvedValue([{ id: 'genre-1' }])

    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1(SHOP_ID, { genreIds: ['genre-1'] }, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    expect(mockShopGenreDeleteMany).toHaveBeenCalledWith({ where: { shopId: SHOP_ID } })
  })

  it('すべてのフィールドを指定した場合 update の data に各フィールドが含まれる', async () => {
    mockGenreFindMany.mockResolvedValue([{ id: 'genre-1' }])

    let capturedData: Record<string, unknown> = {}
    mockTransaction.mockImplementationOnce(async (fn: unknown) => {
      if (typeof fn === 'function') {
        const tx = {
          shopGenre: { deleteMany: mockShopGenreDeleteMany },
          bonsaiShop: {
            update: vi.fn().mockImplementation((args: { where: unknown; data: Record<string, unknown> }) => {
              capturedData = args.data
            }),
          },
        }
        return fn(tx)
      }
    })

    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1(
      SHOP_ID,
      {
        name: '更新後の名前',
        address: '更新後の住所',
        latitude: 35.0,
        longitude: 139.0,
        phone: '06-0000-0000',
        website: 'https://updated.example.com',
        businessHours: '9:00-17:00',
        closedDays: '日曜',
        genreIds: ['genre-1'],
      },
      OWNER_ID,
    )

    expect(result).toMatchObject({ ok: true })
    expect(capturedData.name).toBe('更新後の名前')
    expect(capturedData.address).toBe('更新後の住所')
    expect(capturedData.latitude).toBe(35.0)
    expect(capturedData.longitude).toBe(139.0)
    expect(capturedData.phone).toBe('06-0000-0000')
    expect(capturedData.website).toBe('https://updated.example.com')
    expect(capturedData.businessHours).toBe('9:00-17:00')
    expect(capturedData.closedDays).toBe('日曜')
    expect(capturedData.genres).toBeDefined()
  })

  it('genreIds が空配列のとき genres.create は含まれず deleteMany は呼ばれる', async () => {
    let capturedData: Record<string, unknown> = {}
    mockTransaction.mockImplementationOnce(async (fn: unknown) => {
      if (typeof fn === 'function') {
        const tx = {
          shopGenre: { deleteMany: mockShopGenreDeleteMany },
          bonsaiShop: {
            update: vi.fn().mockImplementation((args: { where: unknown; data: Record<string, unknown> }) => {
              capturedData = args.data
            }),
          },
        }
        return fn(tx)
      }
    })

    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1(SHOP_ID, { genreIds: [] }, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    expect(capturedData.genres).toBeUndefined()
    expect(mockShopGenreDeleteMany).toHaveBeenCalledWith({ where: { shopId: SHOP_ID } })
  })

  it('phone が空文字のとき update data の phone が null になる', async () => {
    let capturedData: Record<string, unknown> = {}
    mockTransaction.mockImplementationOnce(async (fn: unknown) => {
      if (typeof fn === 'function') {
        const tx = {
          shopGenre: { deleteMany: mockShopGenreDeleteMany },
          bonsaiShop: {
            update: vi.fn().mockImplementation((args: { where: unknown; data: Record<string, unknown> }) => {
              capturedData = args.data
            }),
          },
        }
        return fn(tx)
      }
    })

    const { updateShopV1 } = await import('@/lib/services/shop-service')
    const result = await updateShopV1(SHOP_ID, { phone: '' }, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    expect(capturedData.phone).toBeNull()
  })
})

// ──────────────────────────────────────────────────
// listReviewsV1
// ──────────────────────────────────────────────────
describe('listReviewsV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockShopReviewFindMany.mockResolvedValue([makeReviewRow()])
  })

  it('正常系: レビュー一覧を返す', async () => {
    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    const result = await listReviewsV1(SHOP_ID, {})

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({ id: 'review-001', rating: 4 })
    expect(result.nextCursor).toBeNull()
  })

  it('ゲストでも一覧取得できる（認証不要）', async () => {
    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    const result = await listReviewsV1(SHOP_ID, {})

    expect(result).toMatchObject({ ok: true })
  })

  it('カーソルページネーション: nextCursor が設定される', async () => {
    const reviews = Array.from({ length: 21 }, (_, i) =>
      makeReviewRow({ id: `review-${i}` }),
    )
    mockShopReviewFindMany.mockResolvedValue(reviews)

    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    const result = await listReviewsV1(SHOP_ID, { limit: 20 })

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('review-19')
  })

  it('cursor 指定: where に id フィルタを含めず native cursor（cursor:{id}, skip:1）を使う', async () => {
    mockShopReviewFindMany.mockResolvedValue([])

    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    await listReviewsV1(SHOP_ID, { cursor: 'cursor-review-id' })

    const callArgs = mockShopReviewFindMany.mock.calls[0]?.[0] as {
      where: { id?: unknown }
      cursor?: { id: string }
      skip?: number
    }
    expect(callArgs?.where?.id).toBeUndefined()
    expect(callArgs?.cursor).toEqual({ id: 'cursor-review-id' })
    expect(callArgs?.skip).toBe(1)
  })

  it('cursor 未指定: findMany に cursor/skip が渡らない', async () => {
    mockShopReviewFindMany.mockResolvedValue([])

    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    await listReviewsV1(SHOP_ID, {})

    const callArgs = mockShopReviewFindMany.mock.calls[0]?.[0] as {
      cursor?: unknown
      skip?: number
    }
    expect(callArgs?.cursor).toBeUndefined()
    expect(callArgs?.skip).toBeUndefined()
  })

  it('2ページ目継続: 1ページ目の nextCursor を渡すと native cursor で欠落・重複なく継続取得できる', async () => {
    const page1Records = Array.from({ length: 21 }, (_, i) =>
      makeReviewRow({ id: `review-${String(i).padStart(2, '0')}` }),
    )
    const page2Records = Array.from({ length: 5 }, (_, i) =>
      makeReviewRow({ id: `review-${String(i + 20).padStart(2, '0')}` }),
    )

    mockShopReviewFindMany.mockResolvedValueOnce(page1Records)
    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    const page1 = await listReviewsV1(SHOP_ID, { limit: 20 })
    expect(page1).toMatchObject({ ok: true })
    if (!page1.ok) throw new Error('ok=false')
    expect(page1.items).toHaveLength(20)
    expect(page1.nextCursor).toBe('review-19')

    mockShopReviewFindMany.mockResolvedValueOnce(page2Records)
    const page2 = await listReviewsV1(SHOP_ID, { limit: 20, cursor: page1.nextCursor ?? undefined })
    expect(page2).toMatchObject({ ok: true })
    if (!page2.ok) throw new Error('ok=false')

    const page2CallArgs = mockShopReviewFindMany.mock.calls[1]?.[0] as {
      cursor?: { id: string }
      skip?: number
    }
    expect(page2CallArgs?.cursor).toEqual({ id: 'review-19' })
    expect(page2CallArgs?.skip).toBe(1)

    const allIds = [...page1.items.map((r) => r.id), ...page2.items.map((r) => r.id)]
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(page2.nextCursor).toBeNull()
  })

  it('formatReviewForApi: createdAt が ISO 文字列で返る', async () => {
    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    const result = await listReviewsV1(SHOP_ID, {})

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(typeof result.items[0]?.createdAt).toBe('string')
    expect(result.items[0]?.createdAt).toBe('2025-01-01T00:00:00.000Z')
  })

  it('images フィールドが正しく返る', async () => {
    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    const result = await listReviewsV1(SHOP_ID, {})

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items[0]?.images).toEqual([{ url: 'https://storage.example.com/review-img.jpg' }])
  })

  it('空リスト: items が [] で nextCursor が null', async () => {
    mockShopReviewFindMany.mockResolvedValue([])

    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    const result = await listReviewsV1(SHOP_ID, {})

    expect(result).toMatchObject({ ok: true, items: [], nextCursor: null })
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockShopReviewFindMany.mockRejectedValue(new Error('DB error'))

    const { listReviewsV1 } = await import('@/lib/services/shop-service')
    const result = await listReviewsV1(SHOP_ID, {})

    expect(result).toMatchObject({ ok: false })
  })
})

// ──────────────────────────────────────────────────
// createReviewV1
// ──────────────────────────────────────────────────
describe('createReviewV1', () => {
  const validInput = {
    rating: 4,
    content: 'とても良い園芸店です',
    mediaUrls: [],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiShopFindUnique.mockResolvedValue({ id: SHOP_ID })
    mockShopReviewFindUnique.mockResolvedValue(null)
    mockShopReviewCreate.mockResolvedValue(makeReviewRow())
    mockAssertMediaUrlsFromOwnStorage.mockReturnValue(true)
  })

  it('正常系: ok: true と作成済みレビューを返す', async () => {
    const { createReviewV1 } = await import('@/lib/services/shop-service')
    const result = await createReviewV1(SHOP_ID, validInput, OWNER_ID)

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.review.id).toBe('review-001')
    expect(mockShopReviewCreate).toHaveBeenCalledTimes(1)
    expect(mockRevalidateShopRatingsCache).toHaveBeenCalledTimes(1)
  })

  it('shop が存在しない: ok: false と ERR_SHOP_NOT_FOUND', async () => {
    mockBonsaiShopFindUnique.mockResolvedValue(null)

    const { createReviewV1 } = await import('@/lib/services/shop-service')
    const result = await createReviewV1('nonexistent', validInput, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_SHOP_NOT_FOUND } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_SHOP_NOT_FOUND)
    expect(mockShopReviewCreate).not.toHaveBeenCalled()
  })

  it('二重レビュー（同一 shopId+userId）: ok: false、ERR_REVIEW_ALREADY_EXISTS、conflict: true', async () => {
    mockShopReviewFindUnique.mockResolvedValue({ id: 'existing-review' })

    const { createReviewV1 } = await import('@/lib/services/shop-service')
    const result = await createReviewV1(SHOP_ID, validInput, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_REVIEW_ALREADY_EXISTS } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_REVIEW_ALREADY_EXISTS)
    if ('conflict' in result) {
      expect(result.conflict).toBe(true)
    }
    expect(mockShopReviewCreate).not.toHaveBeenCalled()
  })

  it('外部 URL の mediaUrls: ok: false と ERR_INVALID_INPUT', async () => {
    mockAssertMediaUrlsFromOwnStorage.mockReturnValue(false)

    const { createReviewV1 } = await import('@/lib/services/shop-service')
    const result = await createReviewV1(
      SHOP_ID,
      { ...validInput, mediaUrls: ['https://external.example.com/img.jpg'] },
      OWNER_ID,
    )

    expect(result).toMatchObject({ ok: false })
    if (result.ok) throw new Error('ok=true')
    const { ERR_INVALID_INPUT } = await import('@/lib/constants/errors')
    expect(result.error).toBe(ERR_INVALID_INPUT)
  })

  it('mediaUrls が空の場合は assertMediaUrlsFromOwnStorage を呼ばない', async () => {
    const { createReviewV1 } = await import('@/lib/services/shop-service')
    await createReviewV1(SHOP_ID, { ...validInput, mediaUrls: [] }, OWNER_ID)

    expect(mockAssertMediaUrlsFromOwnStorage).not.toHaveBeenCalled()
  })

  it('data.rating が create に渡される', async () => {
    const { createReviewV1 } = await import('@/lib/services/shop-service')
    await createReviewV1(SHOP_ID, { ...validInput, rating: 5 }, OWNER_ID)

    const callArgs = mockShopReviewCreate.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(callArgs?.data?.rating).toBe(5)
  })

  it('prisma.create が例外をスローした場合 ok: false を返す', async () => {
    mockShopReviewCreate.mockRejectedValue(new Error('DB error'))

    const { createReviewV1 } = await import('@/lib/services/shop-service')
    const result = await createReviewV1(SHOP_ID, validInput, OWNER_ID)

    expect(result).toMatchObject({ ok: false })
  })
})

// ──────────────────────────────────────────────────
// listGenresV1
// ──────────────────────────────────────────────────
describe('listGenresV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenreFindMany.mockResolvedValue([
      { id: 'genre-1', name: '松柏類', category: '樹種' },
      { id: 'genre-2', name: '雑木類', category: '樹種' },
    ])
  })

  it('正常系（type=shop）: ジャンル一覧を返す', async () => {
    const { listGenresV1 } = await import('@/lib/services/shop-service')
    const result = await listGenresV1({ type: 'shop' })

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toMatchObject({ id: 'genre-1', name: '松柏類', category: '樹種' })
  })

  it('items[].category が文字列で返る（type=post/shop 双方）', async () => {
    const { listGenresV1 } = await import('@/lib/services/shop-service')

    const shopResult = await listGenresV1({ type: 'shop' })
    expect(shopResult).toMatchObject({ ok: true })
    if (!shopResult.ok) throw new Error('ok=false')
    for (const item of shopResult.items) {
      expect(typeof item.category).toBe('string')
    }

    mockGenreFindMany.mockResolvedValue([
      { id: 'genre-3', name: 'その他', category: 'カテゴリ' },
    ])
    const postResult = await listGenresV1({ type: 'post' })
    expect(postResult).toMatchObject({ ok: true })
    if (!postResult.ok) throw new Error('ok=false')
    for (const item of postResult.items) {
      expect(typeof item.category).toBe('string')
    }
  })

  it('GENRE_MINIMAL_SELECT を通じて select に category が含まれる', async () => {
    const { listGenresV1 } = await import('@/lib/services/shop-service')
    await listGenresV1({ type: 'shop' })

    const callArgs = mockGenreFindMany.mock.calls[0]?.[0] as { select: Record<string, unknown> }
    expect(callArgs?.select).toMatchObject({ id: true, name: true, category: true })
  })

  it('type=shop のとき where.type が "shop" になる', async () => {
    const { listGenresV1 } = await import('@/lib/services/shop-service')
    await listGenresV1({ type: 'shop' })

    const callArgs = mockGenreFindMany.mock.calls[0]?.[0] as { where: { type: string } }
    expect(callArgs?.where?.type).toBe('shop')
  })

  it('type=post のとき where.type が "post" になる', async () => {
    const { listGenresV1 } = await import('@/lib/services/shop-service')
    await listGenresV1({ type: 'post' })

    const callArgs = mockGenreFindMany.mock.calls[0]?.[0] as { where: { type: string } }
    expect(callArgs?.where?.type).toBe('post')
  })

  it('type=shop と type=post は別の where になる（ジャンル分離）', async () => {
    const { listGenresV1 } = await import('@/lib/services/shop-service')
    await listGenresV1({ type: 'shop' })
    await listGenresV1({ type: 'post' })

    const shopCall = mockGenreFindMany.mock.calls[0]?.[0] as { where: { type: string } }
    const postCall = mockGenreFindMany.mock.calls[1]?.[0] as { where: { type: string } }
    expect(shopCall?.where?.type).toBe('shop')
    expect(postCall?.where?.type).toBe('post')
  })

  it('空リスト: items が []', async () => {
    mockGenreFindMany.mockResolvedValue([])

    const { listGenresV1 } = await import('@/lib/services/shop-service')
    const result = await listGenresV1({ type: 'shop' })

    expect(result).toMatchObject({ ok: true, items: [] })
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockGenreFindMany.mockRejectedValue(new Error('DB error'))

    const { listGenresV1 } = await import('@/lib/services/shop-service')
    const result = await listGenresV1({ type: 'shop' })

    expect(result).toMatchObject({ ok: false })
  })
})

// ──────────────────────────────────────────────────
// getShopMapPinsV1（M-1）
// ──────────────────────────────────────────────────

const mockMapPinShops = [
  {
    id: 'shop-1',
    name: 'テスト盆栽園1',
    address: '東京都渋谷区テスト1-1-1',
    latitude: new Decimal('35.6895'),
    longitude: new Decimal('139.6917'),
  },
  {
    id: 'shop-2',
    name: 'テスト盆栽園2',
    address: '大阪府大阪市1-1-1',
    latitude: new Decimal('34.6937'),
    longitude: new Decimal('135.5023'),
  },
]

const mockMapPinRatings = [
  { shopId: 'shop-1', _avg: { rating: 4.2 }, _count: { rating: 10 } },
]

describe('getShopMapPinsV1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBonsaiShopFindMany.mockResolvedValue(mockMapPinShops)
    mockGetCachedShopRatings.mockResolvedValue(mockMapPinRatings)
  })

  it('正常系: ok: true と items 配列を返す', async () => {
    const { getShopMapPinsV1 } = await import('@/lib/services/shop-service')
    const result = await getShopMapPinsV1()

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(2)
  })

  it('各 item に { id, name, latitude, longitude, address, averageRating, reviewCount } がある', async () => {
    const { getShopMapPinsV1 } = await import('@/lib/services/shop-service')
    const result = await getShopMapPinsV1()

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items[0]).toMatchObject({
      id: 'shop-1',
      name: 'テスト盆栽園1',
      address: '東京都渋谷区テスト1-1-1',
    })
  })

  it('latitude/longitude は Decimal から number に変換される', async () => {
    const { getShopMapPinsV1 } = await import('@/lib/services/shop-service')
    const result = await getShopMapPinsV1()

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(typeof result.items[0]?.latitude).toBe('number')
    expect(typeof result.items[0]?.longitude).toBe('number')
    expect(result.items[0]?.latitude).toBeCloseTo(35.6895)
    expect(result.items[0]?.longitude).toBeCloseTo(139.6917)
  })

  it('評価データがある店舗: averageRating と reviewCount が付与される', async () => {
    const { getShopMapPinsV1 } = await import('@/lib/services/shop-service')
    const result = await getShopMapPinsV1()

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    const shop1 = result.items.find((i) => i.id === 'shop-1')
    expect(shop1?.averageRating).toBe(4.2)
    expect(shop1?.reviewCount).toBe(10)
  })

  it('評価データがない店舗: averageRating=null, reviewCount=0', async () => {
    const { getShopMapPinsV1 } = await import('@/lib/services/shop-service')
    const result = await getShopMapPinsV1()

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    const shop2 = result.items.find((i) => i.id === 'shop-2')
    expect(shop2?.averageRating).toBeNull()
    expect(shop2?.reviewCount).toBe(0)
  })

  it('空リスト: ok: true と空 items', async () => {
    mockBonsaiShopFindMany.mockResolvedValueOnce([])
    mockGetCachedShopRatings.mockResolvedValueOnce([])

    const { getShopMapPinsV1 } = await import('@/lib/services/shop-service')
    const result = await getShopMapPinsV1()

    expect(result).toMatchObject({ ok: true })
    if (!result.ok) throw new Error('ok=false')
    expect(result.items).toHaveLength(0)
  })

  it('prisma が例外をスローした場合 ok: false を返す', async () => {
    mockBonsaiShopFindMany.mockRejectedValue(new Error('DB error'))

    const { getShopMapPinsV1 } = await import('@/lib/services/shop-service')
    const result = await getShopMapPinsV1()

    expect(result).toMatchObject({ ok: false })
  })

  it('Error インスタンス以外が throw されたときも ok: false を返す', async () => {
    mockGetCachedShopRatings.mockRejectedValue('cache error')

    const { getShopMapPinsV1 } = await import('@/lib/services/shop-service')
    const result = await getShopMapPinsV1()

    expect(result).toMatchObject({ ok: false })
  })
})
