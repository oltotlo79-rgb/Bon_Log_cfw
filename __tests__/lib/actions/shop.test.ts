// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockShop } from '../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
// Add aggregate mock for shopReview (not in createMockPrismaClient)
;(mockPrisma.shopReview as Record<string, unknown>).aggregate = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// テスト中は DB が利用可能と仮定 (本番 build 用のスキップ判定を無効化)
vi.mock('@/lib/build/db-availability', () => ({
  shouldSkipBuildTimeDbAccess: () => false,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// revalidatePathモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// レート制限モック
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))

// headersモック
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

describe('Shop Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // requireActiveUser needs user.findUnique for suspension check
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    // getShops uses shopReview.groupBy for average rating aggregation
    mockPrisma.shopReview.groupBy.mockResolvedValue([])
    // getShop uses shopReview.aggregate for average rating
    ;(mockPrisma.shopReview as any).aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    })
  })

  describe('getShops', async () => {
    it('盆栽園一覧を取得できる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          ...mockShop,
          genres: [],
          _count: { reviews: 2 },
        },
      ])
      mockPrisma.shopReview.groupBy.mockResolvedValue([
        { shopId: mockShop.id, _avg: { rating: 4.5 }, _count: { rating: 2 } },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops()

      expect(result.shops).toHaveLength(1)
      expect(result.shops[0]!.name).toBe('テスト盆栽園')
      expect(result.shops[0]!.averageRating).toBe(4.5)
    })

    it('非表示盆栽園は除外される', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops()

      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isHidden: false,
          }),
        })
      )
    })

    it('検索キーワードでフィルタリングできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops({ search: 'テスト' })

      // search の OR は AND 配列の要素として組み込まれる（prefecture との衝突回避）
      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                OR: [
                  { name: { contains: 'テスト', mode: 'insensitive' } },
                  { address: { contains: 'テスト', mode: 'insensitive' } },
                ],
              },
            ]),
          }),
        })
      )
    })
  })

  describe('getShop', async () => {
    it('盆栽園詳細を取得できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        genres: [],
        reviews: [{ rating: 5, user: mockUser, images: [] }],
      })
      mockPrisma.shopReview.aggregate.mockResolvedValue({
        _avg: { rating: 5 },
        _count: { rating: 1 },
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('test-shop-id')

      expect(('shop' in result ? result.shop : undefined)).toBeDefined()
      expect(('shop' in result ? result.shop : undefined)?.name).toBe('テスト盆栽園')
    })

    it('存在しない盆栽園はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)
      mockPrisma.shopReview.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('non-existent')

      expect(('success' in result ? result.success : undefined)).toBe(false)
      expect(('error' in result ? result.error : undefined)).toBe('盆栽園が見つかりません')
    })

    it('自分の盆栽園はisOwner=trueを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        genres: [],
        reviews: [],
      })
      mockPrisma.shopReview.aggregate.mockResolvedValue({
        _avg: { rating: null },
        _count: { rating: 0 },
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('test-shop-id')

      expect(('shop' in result ? result.shop : undefined)?.isOwner).toBe(true)
    })
  })

  describe('createShop', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()

      const result = await createShop(formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('名称が空の場合はエラーを返す', async () => {
      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', '')

      const result = await createShop(formData)

      expect(result).toMatchObject({ error: '名称を入力してください' })
    })

    it('住所が空の場合はエラーを返す', async () => {
      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '')

      const result = await createShop(formData)

      expect(result).toMatchObject({ error: '住所を入力してください' })
    })

    it('同じ住所の盆栽園が既に存在する場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findFirst.mockResolvedValue({
        id: 'existing-shop-id',
        address: '東京都渋谷区',
      })

      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区')

      const result = await createShop(formData)

      expect(result).toMatchObject({ success: false, error: 'この住所の盆栽園は既に登録されています' })
      expect('existingId' in result && result.existingId).toBe('existing-shop-id')
    })

    it('正常に盆栽園を作成できる', async () => {
      mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
      mockPrisma.bonsaiShop.create.mockResolvedValue({
        ...mockShop,
        id: 'new-shop-id',
      })

      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区代々木1-1-1')

      const result = await createShop(formData)

      expect(result).toMatchObject({ success: true, data: { shopId: 'new-shop-id' } })
    })
  })

  describe('updateShop', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()

      const result = await updateShop('shop-id', formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('存在しない盆栽園はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区代々木1-1-1')

      const result = await updateShop('non-existent', formData)

      expect(result).toMatchObject({ error: '盆栽園が見つかりません' })
    })

    it('他人の盆栽園は編集できない', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: 'other-user-id',
      })

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区代々木1-1-1')

      const result = await updateShop('shop-id', formData)

      expect(result).toMatchObject({ error: '編集権限がありません' })
    })
  })

  describe('deleteShop', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteShop } = await import('@/lib/actions/shop')
      const result = await deleteShop('shop-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('他人の盆栽園は削除できない', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: 'other-user-id',
      })

      const { deleteShop } = await import('@/lib/actions/shop')
      const result = await deleteShop('shop-id')

      expect(result).toMatchObject({ error: '削除権限がありません' })
    })

    it('自分の盆栽園を削除できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })
      mockPrisma.bonsaiShop.delete.mockResolvedValue(mockShop)

      const { deleteShop } = await import('@/lib/actions/shop')
      const result = await deleteShop('shop-id')

      expect(result).toEqual({ success: true })
    })

    it('存在しない盆栽園は削除できない', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { deleteShop } = await import('@/lib/actions/shop')
      const result = await deleteShop('non-existent')

      expect(result).toMatchObject({ error: '盆栽園が見つかりません' })
    })
  })

  describe('getShops - 追加テスト', async () => {
    it('都道府県でフィルタリングできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops({ prefecture: '東京都' })

      // 住所のstartsWith検索でフィルタリング（AND 配列内）
      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              { OR: [{ address: { startsWith: '東京都' } }] },
            ]),
          }),
        })
      )
    })

    it('地方でフィルタリングできる（関東）', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops({ region: 'kanto' })

      // 関東地方の都道府県でOR検索（AND 配列内）
      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: expect.arrayContaining([
              {
                OR: expect.arrayContaining([
                  { address: { startsWith: '東京都' } },
                  { address: { startsWith: '神奈川県' } },
                ]),
              },
            ]),
          }),
        })
      )
    })

    it('存在しない地方の場合はフィルタなし', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops({ region: 'invalid-region' })

      // ORフィルタが設定されないことを確認（isHiddenのみ）
      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            isHidden: false,
          },
        })
      )
    })

    it('ジャンルでフィルタリングできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops({ genreId: 'genre-1' })

      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            genres: {
              some: { genreId: 'genre-1' },
            },
          }),
        })
      )
    })

    it('名前順でソートできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])

      const { getShops } = await import('@/lib/actions/shop')
      await getShops({ sortBy: 'name' })

      expect(mockPrisma.bonsaiShop.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { name: 'asc' },
        })
      )
    })

    it('評価順でソートできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          ...mockShop,
          id: 'shop-1',
          genres: [],
          _count: { reviews: 1 },
        },
        {
          ...mockShop,
          id: 'shop-2',
          genres: [],
          _count: { reviews: 1 },
        },
      ])
      mockPrisma.shopReview.groupBy.mockResolvedValue([
        { shopId: 'shop-1', _avg: { rating: 3 }, _count: { rating: 1 } },
        { shopId: 'shop-2', _avg: { rating: 5 }, _count: { rating: 1 } },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'rating' })

      // 評価の高い方が先
      expect(result.shops[0]!.averageRating).toBe(5)
      expect(result.shops[1]!.averageRating).toBe(3)
    })

    it('レビューがない盆栽園は評価順ソートで後ろになる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          ...mockShop,
          id: 'shop-1',
          genres: [],
          _count: { reviews: 0 },
        },
        {
          ...mockShop,
          id: 'shop-2',
          genres: [],
          _count: { reviews: 1 },
        },
      ])
      mockPrisma.shopReview.groupBy.mockResolvedValue([
        { shopId: 'shop-2', _avg: { rating: 3 }, _count: { rating: 1 } },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'rating' })

      expect(result.shops[0]!.averageRating).toBe(3)
      expect(result.shops[1]!.averageRating).toBeNull()
    })
  })

  describe('updateShop - 追加テスト', async () => {
    it('正常に盆栽園を更新できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })
      mockPrisma.shopGenre.deleteMany.mockResolvedValue({})
      mockPrisma.bonsaiShop.update.mockResolvedValue(mockShop)

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', '新しい名前')
      formData.append('address', '新しい住所')

      const result = await updateShop('shop-id', formData)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.bonsaiShop.update).toHaveBeenCalled()
    })

    it('名称が空の場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', '')
      formData.append('address', '東京都渋谷区')

      const result = await updateShop('shop-id', formData)

      expect(result).toMatchObject({ error: '名称を入力してください' })
    })

    it('住所が空の場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '')

      const result = await updateShop('shop-id', formData)

      expect(result).toMatchObject({ error: '住所を入力してください' })
    })
  })

  describe('geocodeAddress', async () => {
    it('住所から緯度経度を取得できる', async () => {
      // fetchのモック
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            geometry: { coordinates: [139.6503, 35.6762] },
            properties: { title: '東京都渋谷区代々木1-1-1' },
          },
        ]),
      })

      const { geocodeAddress } = await import('@/lib/actions/shop')
      const result = await geocodeAddress('東京都渋谷区')

      expect('latitude' in result ? result.latitude : undefined).toBe(35.6762)
      expect('longitude' in result ? result.longitude : undefined).toBe(139.6503)
      expect('displayName' in result ? result.displayName : undefined).toBe('東京都渋谷区代々木1-1-1')
    })

    it('住所が見つからない場合はエラーを返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      const { geocodeAddress } = await import('@/lib/actions/shop')
      const result = await geocodeAddress('存在しない住所')

      expect(('success' in result ? result.success : undefined)).toBe(false)
      expect(('error' in result ? result.error : undefined)).toBe('住所が見つかりませんでした')
    })

    it('APIエラーの場合はエラーを返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      })

      const { geocodeAddress } = await import('@/lib/actions/shop')
      const result = await geocodeAddress('東京都')

      expect(('success' in result ? result.success : undefined)).toBe(false)
      expect(('error' in result ? result.error : undefined)).toBe('住所の検索に失敗しました')
    })

    it('例外発生時はエラーを返す', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const { geocodeAddress } = await import('@/lib/actions/shop')
      const result = await geocodeAddress('東京都')

      expect(('success' in result ? result.success : undefined)).toBe(false)
      expect(('error' in result ? result.error : undefined)).toBe('住所の検索中にエラーが発生しました')
    })
  })

  describe('searchAddressSuggestions', async () => {
    it('住所候補を検索できる', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([
          {
            geometry: { coordinates: [139.6503, 35.6762] },
            properties: { title: '東京都渋谷区' },
          },
          {
            geometry: { coordinates: [139.7454, 35.6585] },
            properties: { title: '東京都港区' },
          },
        ]),
      })

      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('東京都')

      expect(result.suggestions).toHaveLength(2)
      expect(result.suggestions[0]!.displayName).toBe('東京都渋谷区')
    })

    it('クエリが2文字未満の場合は空を返す', async () => {
      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('東')

      expect(result.suggestions).toEqual([])
    })

    it('空のクエリの場合は空を返す', async () => {
      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('')

      expect(result.suggestions).toEqual([])
    })

    it('APIエラーの場合は空を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
      })

      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('東京都')

      expect(result.suggestions).toEqual([])
      expect(result.originalQuery).toBe('東京都')
    })

    it('結果がない場合は空を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      })

      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('存在しない地名')

      expect(result.suggestions).toEqual([])
    })

    it('最大5件の候補を返す', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(
          Array(10).fill(null).map((_, i) => ({
            geometry: { coordinates: [139.0 + i, 35.0 + i] },
            properties: { title: `地名${i}` },
          }))
        ),
      })

      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('東京')

      expect(result.suggestions).toHaveLength(5)
    })
  })

  describe('getShopGenres', async () => {
    it('盆栽園のジャンル一覧を取得できる', async () => {
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'genre-1', name: '販売店', category: 'shop', sortOrder: 1, type: 'shop' },
        { id: 'genre-2', name: '展示園', category: 'shop', sortOrder: 2, type: 'shop' },
      ])

      const { getShopGenres } = await import('@/lib/actions/shop')
      const result = await getShopGenres()

      expect(result.genres).toHaveLength(2)
      expect(mockPrisma.genre.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: 'shop' },
        })
      )
    })
  })

  describe('updateShopGenres', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', ['genre-1'])

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ジャンルの形式が不正な場合はエラーを返す', async () => {
      const { updateShopGenres } = await import('@/lib/actions/shop')
      // @ts-expect-error - 意図的に不正な値を渡す
      const result = await updateShopGenres('shop-id', 'not-an-array')

      expect(result).toMatchObject({ error: '入力データが不正です' })
    })

    it('ジャンルが5つを超える場合はエラーを返す', async () => {
      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', ['g1', 'g2', 'g3', 'g4', 'g5', 'g6'])

      expect(result).toMatchObject({ error: 'ジャンルは5つまで選択できます' })
    })

    it('盆栽園が存在しない場合はエラーを返す', async () => {
      // canUserEditShop: bonsaiShop.findUnique returns null (shop not found)
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('non-existent', ['genre-1'])

      expect(result).toMatchObject({ error: '盆栽園が見つかりません' })
    })

    it('無効なジャンルIDが含まれる場合はエラーを返す', async () => {
      // canUserEditShop: bonsaiShop.findUnique + adminUser.findUnique
      mockPrisma.bonsaiShop.findUnique
        .mockResolvedValueOnce({ id: 'shop-id', createdBy: mockUser.id })  // canUserEditShop
        .mockResolvedValueOnce({ id: 'shop-id' })  // isHidden check
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'genre-1' },
      ])

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', ['genre-1', 'invalid-genre'])

      expect(result).toMatchObject({ error: '無効なジャンルが含まれています' })
    })

    it('正常にジャンルを更新できる', async () => {
      // canUserEditShop: bonsaiShop.findUnique + adminUser.findUnique
      mockPrisma.bonsaiShop.findUnique
        .mockResolvedValueOnce({ id: 'shop-id', createdBy: mockUser.id })  // canUserEditShop
        .mockResolvedValueOnce({ id: 'shop-id' })  // isHidden check
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      mockPrisma.genre.findMany.mockResolvedValue([
        { id: 'genre-1' },
        { id: 'genre-2' },
      ])

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', ['genre-1', 'genre-2'])

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('空のジャンル配列で更新できる', async () => {
      // canUserEditShop: bonsaiShop.findUnique + adminUser.findUnique
      mockPrisma.bonsaiShop.findUnique
        .mockResolvedValueOnce({ id: 'shop-id', createdBy: mockUser.id })  // canUserEditShop
        .mockResolvedValueOnce({ id: 'shop-id' })  // isHidden check
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { updateShopGenres } = await import('@/lib/actions/shop')
      const result = await updateShopGenres('shop-id', [])

      expect(result).toEqual({ success: true })
    })
  })

  describe('createShopChangeRequest', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', { name: '新しい名前' })

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('盆栽園が存在しない場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('non-existent', { name: '新しい名前' })

      expect(result).toMatchObject({ error: '盆栽園が見つかりません' })
    })

    it('登録者は変更リクエストを作成できない', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: mockUser.id,
      })

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', { name: '新しい名前' })

      expect(result).toMatchObject({ error: '登録者は直接編集できます' })
    })

    it('変更内容がない場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: 'other-user-id',
      })

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', {})

      expect(result).toMatchObject({ error: '変更内容を入力してください' })
    })

    it('既に保留中のリクエストがある場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.shopChangeRequest.findFirst.mockResolvedValue({ id: 'existing-request' })

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', { name: '新しい名前' })

      expect(result).toMatchObject({ error: '既に保留中のリクエストがあります。承認/却下を待ってください。' })
    })

    it('正常に変更リクエストを作成できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.shopChangeRequest.findFirst.mockResolvedValue(null)
      mockPrisma.shopChangeRequest.create.mockResolvedValue({ id: 'new-request-id' })

      const { createShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await createShopChangeRequest('shop-id', { name: '新しい名前' }, '名前が間違っていたため')

      expect(result).toMatchObject({ success: true, data: { requestId: 'new-request-id' } })
    })
  })

  describe('getShopChangeRequests', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequests()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequests()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('管理者は変更リクエスト一覧を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findMany.mockResolvedValue([
        { id: 'request-1', shop: mockShop, user: mockUser },
      ])

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequests()

      expect(('requests' in result ? result.requests : undefined)).toHaveLength(1)
    })

    it('ステータスでフィルタリングできる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findMany.mockResolvedValue([])

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      await getShopChangeRequests({ status: 'approved' })

      expect(mockPrisma.shopChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'approved',
          }),
        })
      )
    })

    it('status=allの場合はステータスフィルタなし', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findMany.mockResolvedValue([])

      const { getShopChangeRequests } = await import('@/lib/actions/shop')
      await getShopChangeRequests({ status: 'all' })

      expect(mockPrisma.shopChangeRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            status: expect.anything(),
          }),
        })
      )
    })
  })

  describe('approveShopChangeRequest', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('request-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('request-id')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('リクエストが存在しない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(null)

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('non-existent')

      expect(result).toMatchObject({ error: 'リクエストが見つかりません' })
    })

    it('既に処理済みのリクエストはエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        status: 'approved',
        shop: mockShop,
      })

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('request-id')

      expect(result).toMatchObject({ error: 'このリクエストは既に処理済みです' })
    })

    it('正常にリクエストを承認できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        status: 'pending',
        shopId: 'shop-id',
        requestedChanges: { name: '新しい名前' },
        shop: mockShop,
      })

      const { approveShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await approveShopChangeRequest('request-id', '承認しました')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('rejectShopChangeRequest', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('request-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('request-id')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('リクエストが存在しない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(null)

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('non-existent')

      expect(result).toMatchObject({ error: 'リクエストが見つかりません' })
    })

    it('既に処理済みのリクエストはエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        status: 'rejected',
      })

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('request-id')

      expect(result).toMatchObject({ error: 'このリクエストは既に処理済みです' })
    })

    it('正常にリクエストを却下できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        status: 'pending',
        shopId: 'shop-id',
      })

      const { rejectShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await rejectShopChangeRequest('request-id', '却下理由')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  describe('getPendingShopChangeRequestCount', async () => {
    it('未認証の場合は0を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPendingShopChangeRequestCount } = await import('@/lib/actions/shop')
      const result = await getPendingShopChangeRequestCount()

      expect(result).toEqual({ count: 0 })
    })

    it('管理者でない場合は0を返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getPendingShopChangeRequestCount } = await import('@/lib/actions/shop')
      const result = await getPendingShopChangeRequestCount()

      expect(result).toEqual({ count: 0 })
    })

    it('管理者は未対応リクエスト数を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.count.mockResolvedValue(5)

      const { getPendingShopChangeRequestCount } = await import('@/lib/actions/shop')
      const result = await getPendingShopChangeRequestCount()

      expect(result).toEqual({ count: 5 })
    })
  })

  // ============================================================
  // getShop - ジャンル付きデータ
  // ============================================================

  describe('getShop - ジャンル付き', async () => {
    it('ジャンル付きの盆栽園詳細を取得できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        genres: [
          { genreId: 'genre-1', genre: { id: 'genre-1', name: '販売店', category: 'shop' } },
          { genreId: 'genre-2', genre: { id: 'genre-2', name: '展示園', category: 'shop' } },
        ],
        reviews: [{ rating: 5, user: mockUser, images: [] }],
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('test-shop-id')

      expect(('shop' in result ? result.shop : undefined)).toBeDefined()
      expect(('shop' in result ? result.shop : undefined)?.genres).toBeDefined()
    })

    it('レビューなしの盆栽園は平均評価がnull', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        genres: [],
        reviews: [],
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('test-shop-id')

      expect(('shop' in result ? result.shop : undefined)).toBeDefined()
      expect(('shop' in result ? result.shop : undefined)?.averageRating).toBeNull()
    })

    it('未認証でも盆栽園詳細を取得できる', async () => {
      mockAuth.mockResolvedValue(null)
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        genres: [],
        reviews: [],
      })

      const { getShop } = await import('@/lib/actions/shop')
      const result = await getShop('test-shop-id')

      expect(('shop' in result ? result.shop : undefined)).toBeDefined()
      expect(('shop' in result ? result.shop : undefined)?.isOwner).toBe(false)
    })
  })

  // ============================================================
  // getShops - ソート詳細テスト
  // ============================================================

  describe('getShops - ソート詳細', async () => {
    it('両方のレビューがない場合の評価順ソート', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          ...mockShop,
          id: 'shop-1',
          genres: [],
          _count: { reviews: 0 },
        },
        {
          ...mockShop,
          id: 'shop-2',
          genres: [],
          _count: { reviews: 0 },
        },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'rating' })

      expect(result.shops).toHaveLength(2)
    })

    it('location順でソートできる', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          ...mockShop,
          id: 'shop-1',
          latitude: 35.0,
          address: '東京都渋谷区',
          genres: [],
          _count: { reviews: 0 },
        },
        {
          ...mockShop,
          id: 'shop-2',
          latitude: 36.0,
          address: '埼玉県さいたま市',
          genres: [],
          _count: { reviews: 0 },
        },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'location' })

      expect(result.shops).toHaveLength(2)
    })

    it('latitudeがnullの場合のlocationソート', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([
        {
          ...mockShop,
          id: 'shop-1',
          latitude: null,
          address: '東京都渋谷区',
          genres: [],
          _count: { reviews: 0 },
        },
        {
          ...mockShop,
          id: 'shop-2',
          latitude: null,
          address: '大阪府大阪市',
          genres: [],
          _count: { reviews: 0 },
        },
      ])

      const { getShops } = await import('@/lib/actions/shop')
      const result = await getShops({ sortBy: 'location' })

      expect(result.shops).toHaveLength(2)
    })
  })

  // ============================================================
  // updateShop - ジャンル付き更新
  // ============================================================

  describe('updateShop - ジャンル付き更新', async () => {
    it('ジャンル付きで盆栽園を更新できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })
      mockPrisma.shopGenre.deleteMany.mockResolvedValue({})
      mockPrisma.bonsaiShop.update.mockResolvedValue(mockShop)

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', '新しい名前')
      formData.append('address', '新しい住所')
      formData.append('genreIds', 'genre-1')
      formData.append('genreIds', 'genre-2')

      const result = await updateShop('shop-id', formData)

      expect(result).toEqual({ success: true })
    })

    it('電話番号・ウェブサイト付きで更新できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        ...mockShop,
        createdBy: mockUser.id,
      })
      mockPrisma.shopGenre.deleteMany.mockResolvedValue({})
      mockPrisma.bonsaiShop.update.mockResolvedValue(mockShop)

      const { updateShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', '新しい名前')
      formData.append('address', '新しい住所')
      formData.append('phone', '03-1234-5678')
      formData.append('website', 'https://example.com')
      formData.append('businessHours', '9:00-17:00')
      formData.append('closedDays', '水曜定休')

      const result = await updateShop('shop-id', formData)

      expect(result).toEqual({ success: true })
    })
  })

  // ============================================================
  // searchAddressSuggestions - fetch例外
  // ============================================================

  describe('searchAddressSuggestions - fetch例外', async () => {
    it('fetch例外時は空を返す', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      const { searchAddressSuggestions } = await import('@/lib/actions/shop')
      const result = await searchAddressSuggestions('東京都')

      expect(result.suggestions).toEqual([])
    })
  })

  // ============================================================
  // createShop - 追加テスト
  // ============================================================

  describe('createShop - 追加テスト', async () => {
    it('ジャンル付きで盆栽園を作成できる', async () => {
      mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
      mockPrisma.bonsaiShop.create.mockResolvedValue({
        ...mockShop,
        id: 'new-shop-id',
      })

      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区代々木1-1-1')
      formData.append('genreIds', 'genre-1')

      const result = await createShop(formData)

      expect(result.success).toBe(true)
    })

    it('緯度経度付きで盆栽園を作成できる', async () => {
      mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
      mockPrisma.bonsaiShop.create.mockResolvedValue({
        ...mockShop,
        id: 'new-shop-id',
      })

      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区代々木1-1-1')
      formData.append('latitude', '35.6762')
      formData.append('longitude', '139.6503')

      const result = await createShop(formData)

      expect(result.success).toBe(true)
    })

    it('DB作成エラー時はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
      mockPrisma.bonsaiShop.create.mockRejectedValue(new Error('DB error'))

      const { createShop } = await import('@/lib/actions/shop')
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区代々木1-1-1')

      const result = await createShop(formData)
      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBeTruthy()
    })
  })

  describe('getShopChangeRequest', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequest('request-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者でない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequest('request-id')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('リクエストが存在しない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue(null)

      const { getShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequest('non-existent')

      expect(result).toMatchObject({ error: 'リクエストが見つかりません' })
    })

    it('正常にリクエスト詳細を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.shopChangeRequest.findUnique.mockResolvedValue({
        id: 'request-id',
        shop: mockShop,
        user: mockUser,
      })

      const { getShopChangeRequest } = await import('@/lib/actions/shop')
      const result = await getShopChangeRequest('request-id')

      expect(('request' in result ? result.request : undefined)).toBeDefined()
      expect(('request' in result ? result.request : undefined)?.id).toBe('request-id')
    })
  })
})
