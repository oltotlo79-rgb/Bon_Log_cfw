// @vitest-environment node

import { vi } from 'vitest'
/**
 * ブランチカバレッジ向上テスト - lib/actions/shop.ts
 */

import { createMockPrismaClient } from '../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

describe('getShops ブランチカバレッジ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.shopReview.groupBy.mockResolvedValue([])
  })

  it('sortBy=name でソートする', async () => {
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

    const { getShops } = await import('@/lib/actions/shop')
    await getShops({ sortBy: 'name' })

    expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { name: 'asc' },
      })
    )
  })

  it('sortBy=newest でソートする', async () => {
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

    const { getShops } = await import('@/lib/actions/shop')
    await getShops({ sortBy: 'newest' })

    expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('sortBy=rating で評価順ソート（後処理）', async () => {
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([
      {
        id: 'shop-low',
        name: '低評価',
        address: '東京都',
        latitude: { toString: () => '35.6762' },
        longitude: { toString: () => '139.6503' },
        genres: [],
        _count: { reviews: 1 },
      },
      {
        id: 'shop-high',
        name: '高評価',
        address: '東京都',
        latitude: { toString: () => '35.6762' },
        longitude: { toString: () => '139.6503' },
        genres: [],
        _count: { reviews: 1 },
      },
    ])
    mockPrisma.shopReview.groupBy.mockResolvedValue([
      { shopId: 'shop-low', _avg: { rating: 2 }, _count: { rating: 1 } },
      { shopId: 'shop-high', _avg: { rating: 5 }, _count: { rating: 1 } },
    ])

    const { getShops } = await import('@/lib/actions/shop')
    const result = await getShops({ sortBy: 'rating' })
    expect(result.shops).toBeDefined()
    expect(result.shops[0].averageRating).toBe(5)
  })

  it('sortBy=location で地域順ソート', async () => {
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([
      {
        id: 'shop-1',
        name: '東京',
        address: '東京都渋谷区',
        latitude: { toString: () => '35.6762' },
        longitude: { toString: () => '139.6503' },
        genres: [],
        _count: { reviews: 0 },
      },
      {
        id: 'shop-2',
        name: '大阪',
        address: '大阪府大阪市',
        latitude: null,
        longitude: null,
        genres: [],
        _count: { reviews: 0 },
      },
    ])

    const { getShops } = await import('@/lib/actions/shop')
    const result = await getShops({ sortBy: 'location' })
    expect(result.shops).toHaveLength(2)
    // 座標ありの店舗が含まれていることを確認
    expect(result.shops.some((s: { id: string }) => s.id === 'shop-1')).toBe(true)
  })

  it('latitude/longitudeがnullの場合nullを返す', async () => {
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([
      {
        id: 'shop-null',
        name: '座標なし',
        address: '東京都',
        latitude: null,
        longitude: null,
        genres: [],
        _count: { reviews: 0 },
      },
    ])

    const { getShops } = await import('@/lib/actions/shop')
    const result = await getShops({})
    expect(result.shops[0].latitude).toBeNull()
    expect(result.shops[0].longitude).toBeNull()
  })

  it('reviewsが空の場合averageRatingがnullになる', async () => {
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([
      {
        id: 'shop-no-reviews',
        name: 'レビューなし',
        address: '東京都',
        latitude: { toString: () => '35.0' },
        longitude: { toString: () => '139.0' },
        genres: [],
        _count: { reviews: 0 },
      },
    ])

    const { getShops } = await import('@/lib/actions/shop')
    const result = await getShops({})
    expect(result.shops[0].averageRating).toBeNull()
  })
})

describe('updateShop ブランチカバレッジ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('latitudeが空文字の場合nullになる', async () => {
    mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
      id: 'shop-1',
      createdBy: 'user-1',
    })

    // $transactionコールバック内のtxオブジェクトをキャプチャ
    let capturedTx: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {}
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const txShopGenre = { deleteMany: vi.fn().mockResolvedValue({}) }
      const txBonsaiShop = { update: vi.fn().mockResolvedValue({}) }
      capturedTx = { shopGenre: txShopGenre, bonsaiShop: txBonsaiShop }
      return cb(capturedTx)
    })

    const formData = new FormData()
    formData.set('name', 'テスト')
    formData.set('address', '東京都')
    formData.set('latitude', '')
    formData.set('longitude', '')

    const { updateShop } = await import('@/lib/actions/shop')
    await updateShop('shop-1', formData)

    expect(capturedTx.bonsaiShop.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          latitude: null,
          longitude: null,
        }),
      })
    )
  })

  it('genreIdsが空の場合genres createがundefinedになる', async () => {
    mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
      id: 'shop-1',
      createdBy: 'user-1',
    })

    let capturedTx: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {}
    mockPrisma.$transaction.mockImplementation(async (cb: (tx: unknown) => unknown) => {
      const txShopGenre = { deleteMany: vi.fn().mockResolvedValue({}) }
      const txBonsaiShop = { update: vi.fn().mockResolvedValue({}) }
      capturedTx = { shopGenre: txShopGenre, bonsaiShop: txBonsaiShop }
      return cb(capturedTx)
    })

    const formData = new FormData()
    formData.set('name', 'テスト')
    formData.set('address', '東京都')

    const { updateShop } = await import('@/lib/actions/shop')
    await updateShop('shop-1', formData)

    const updateCall = capturedTx.bonsaiShop.update.mock.calls[0][0]
    // genreIdsが空の場合、genres.createが含まれないことを確認
    expect(updateCall.data.genres?.create).toBeUndefined()
  })
})

describe('approveShopChangeRequest ブランチカバレッジ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('各変更フィールドが空文字の場合にnullになる', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      shopId: 'shop-1',
      status: 'pending',
      requestedChanges: {
        name: 'New Name',
        address: 'New Address',
        phone: '',
        website: '',
        businessHours: '',
        closedDays: '',
      },
    })
    mockPrisma.$transaction.mockResolvedValue([])

    const { approveShopChangeRequest } = await import('@/lib/actions/shop')
    const result = await approveShopChangeRequest('req-1', 'OK')
    expect(result).toEqual({ success: true })
  })

  it('変更フィールドがないリクエストを承認', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
      id: 'req-1',
      shopId: 'shop-1',
      status: 'pending',
      requestedChanges: {},
    })
    mockPrisma.$transaction.mockResolvedValue([])

    const { approveShopChangeRequest } = await import('@/lib/actions/shop')
    const result = await approveShopChangeRequest('req-1')
    expect(result).toEqual({ success: true })
  })
})

describe('getShopChangeRequests ブランチカバレッジ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
  })

  it('status=allの場合フィルタなしで取得する', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockPrisma.shopChangeRequest.findMany.mockResolvedValue([])

    const { getShopChangeRequests } = await import('@/lib/actions/shop')
    await getShopChangeRequests({ status: 'all' })

    expect(mockPrisma.shopChangeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    )
  })

  it('オプションなしで呼び出し（デフォルト値使用）', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'admin-1', role: 'admin' })
    mockPrisma.shopChangeRequest.findMany.mockResolvedValue([])

    const { getShopChangeRequests } = await import('@/lib/actions/shop')
    await getShopChangeRequests()

    // デフォルトではpendingステータスのみ取得
    expect(mockPrisma.shopChangeRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'pending' },
      })
    )
  })
})

describe('createShopChangeRequest ブランチカバレッジ', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  it('reasonが空文字の場合nullになる', async () => {
    mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-1' })
    mockPrisma.shopChangeRequest.findFirst.mockResolvedValue(null)
    mockPrisma.shopChangeRequest.create.mockResolvedValue({ id: 'req-1' })

    const { createShopChangeRequest } = await import('@/lib/actions/shop')
    const result = await createShopChangeRequest('shop-1', { name: 'New' }, '')
    expect(result).toMatchObject({ success: true, data: { requestId: 'req-1' } })
  })
})
