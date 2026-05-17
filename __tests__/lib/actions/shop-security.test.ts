// @vitest-environment node

/**
 * shop.ts セキュリティ強化テスト
 *
 * createShop / updateShop のレート制限テスト
 * GSI_ADDRESS_SEARCH_URL 定数利用の確認
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser, mockShop } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
;(mockPrisma.shopReview as any).aggregate = vi.fn()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue('127.0.0.1') }),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

vi.mock('@/lib/services/authorization', () => ({
  canUserEditShop: vi.fn().mockResolvedValue({ allowed: true }),
}))

vi.mock('@/lib/cache', () => ({
  getCachedShopRatings: vi.fn().mockResolvedValue([]),
}))

const importModule = () => import('@/lib/actions/shop')

describe('Shop Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
    mockPrisma.shopReview.groupBy.mockResolvedValue([])
    ;(mockPrisma.shopReview as any).aggregate.mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    })
  })

  describe('createShop - レート制限', () => {
    it('レート制限超過時にエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: 0 })

      const { createShop } = await importModule()
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区')

      const result = await createShop(formData)

      expect(result.success).toBe(false)
    })

    it('レート制限通過後は正常に作成処理に進む', async () => {
      mockPrisma.bonsaiShop.findFirst.mockResolvedValue(null)
      mockPrisma.bonsaiShop.create.mockResolvedValue({ ...mockShop, id: 'new-shop' })

      const { createShop } = await importModule()
      const formData = new FormData()
      formData.append('name', 'テスト盆栽園')
      formData.append('address', '東京都渋谷区')

      const result = await createShop(formData)

      expect(result.success).toBe(true)
      expect(mockCheckUserRateLimit).toHaveBeenCalledWith(mockUser.id, 'create_shop')
    })
  })

  describe('updateShop - レート制限', () => {
    it('レート制限超過時にエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: 0 })

      const { updateShop } = await importModule()
      const formData = new FormData()
      formData.append('name', '更新テスト')
      formData.append('address', '東京都港区')

      const result = await updateShop('shop-id', formData)

      expect(result).toMatchObject({ success: false })
    })
  })

  describe('GSI_ADDRESS_SEARCH_URL 定数使用', () => {
    it('GSI_ADDRESS_SEARCH_URL が正しくエクスポートされている', async () => {
      const { GSI_ADDRESS_SEARCH_URL } = await import('@/lib/constants/limits')
      expect(GSI_ADDRESS_SEARCH_URL).toBe('https://msearch.gsi.go.jp/address-search/AddressSearch')
    })
  })
})
