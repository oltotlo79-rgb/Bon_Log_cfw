// @vitest-environment node

/**
 * review.ts セキュリティ・バリデーション強化テスト
 *
 * 今回の修正で追加された以下をカバー:
 * - updateReviewSchema による Zod バリデーション
 * - updateReview / deleteReview のレート制限
 * - updateReview の画像上限チェック
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser, mockReview } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
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

vi.mock('@/lib/cache', () => ({
  revalidateShopRatingsCache: vi.fn(),
}))

const importModule = () => import('@/lib/actions/review')

describe('Review Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
  })

  // ============================================================
  // updateReview - レート制限
  // ============================================================

  describe('updateReview - レート制限', () => {
    it('レート制限超過時にエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: 0 })

      const { updateReview } = await importModule()
      const formData = new FormData()
      formData.append('rating', '4')

      const result = await updateReview('review-id', formData)

      expect(result).toMatchObject({ success: false })
      expect(result.success === false && result.error).toContain('操作が多すぎます')
    })
  })

  // ============================================================
  // updateReview - Zodバリデーション
  // ============================================================

  describe('updateReview - Zodバリデーション', () => {
    it('ratingが空の場合はバリデーションエラーを返す', async () => {
      const { updateReview } = await importModule()
      const formData = new FormData()
      // rating を設定しない

      const result = await updateReview('review-id', formData)

      expect(result.success).toBe(false)
    })

    it('ratingが範囲外(0)の場合はエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'shop-1',
        images: [],
      })

      const { updateReview } = await importModule()
      const formData = new FormData()
      formData.append('rating', '0')

      const result = await updateReview('review-id', formData)

      expect(result).toMatchObject({ success: false, error: '評価は1～5の間で選択してください' })
    })

    it('ratingが範囲外(6)の場合はエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'shop-1',
        images: [],
      })

      const { updateReview } = await importModule()
      const formData = new FormData()
      formData.append('rating', '6')

      const result = await updateReview('review-id', formData)

      expect(result).toMatchObject({ success: false, error: '評価は1～5の間で選択してください' })
    })

    it('画像上限を超える場合はエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'shop-1',
        images: [{ id: 'img-1' }, { id: 'img-2' }],
      })

      const { updateReview } = await importModule()
      const formData = new FormData()
      formData.append('rating', '4')
      formData.append('imageUrls', 'new1.jpg')
      formData.append('imageUrls', 'new2.jpg')

      const result = await updateReview('review-id', formData)

      // 既存2枚 + 新規2枚 = 4枚 > MAX_REVIEW_IMAGES(3)
      expect(result).toMatchObject({ success: false, error: '画像は3枚までです' })
    })

    it('削除画像IDを考慮した画像上限チェック', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'shop-1',
        images: [{ id: 'img-1' }, { id: 'img-2' }, { id: 'img-3' }],
      })

      const { updateReview } = await importModule()
      const formData = new FormData()
      formData.append('rating', '4')
      formData.append('deleteImageIds', 'img-1')
      formData.append('deleteImageIds', 'img-2')
      formData.append('imageUrls', 'new1.jpg')
      formData.append('imageUrls', 'new2.jpg')

      // 既存3 - 削除2 + 新規2 = 3 (ギリギリOK)
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => {
        return fn(mockPrisma)
      })
      mockPrisma.shopReviewImage.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.shopReviewImage.createMany.mockResolvedValue({ count: 2 })
      mockPrisma.shopReview.update.mockResolvedValue(mockReview)

      const result = await updateReview('review-id', formData)

      expect(result).toEqual({ success: true })
    })
  })

  // ============================================================
  // deleteReview - レート制限
  // ============================================================

  describe('deleteReview - レート制限', () => {
    it('レート制限超過時にエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: 0 })

      const { deleteReview } = await importModule()
      const result = await deleteReview('review-id')

      expect(result).toMatchObject({ success: false })
      expect(result.success === false && result.error).toContain('操作が多すぎます')
    })

    it('レート制限通過後は正常に削除できる', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'shop-1',
      })
      mockPrisma.shopReview.delete.mockResolvedValue(mockReview)

      const { deleteReview } = await importModule()
      const result = await deleteReview('review-id')

      expect(result).toEqual({ success: true })
    })
  })
})
