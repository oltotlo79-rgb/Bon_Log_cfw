// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

// Prismaモック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// revalidatePathモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const mockAdminUser = {
  id: 'admin-user-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

describe('Admin Content Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
  })

  // ============================================================
  // deleteEventByAdmin
  // ============================================================

  describe('deleteEventByAdmin', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteEventByAdmin('event-1', '不適切なイベント')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteEventByAdmin('event-1', '不適切なイベント')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('存在しないイベントはエラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null)

      const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteEventByAdmin('non-existent', '理由')

      expect(result).toMatchObject({ error: 'イベントが見つかりません' })
    })

    it('イベントを削除できる', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'event-1',
        title: 'テストイベント',
      })
      mockPrisma.$transaction.mockResolvedValue([{}, {}])

      const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteEventByAdmin('event-1', '不適切なイベント')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  // ============================================================
  // deleteShopByAdmin
  // ============================================================

  describe('deleteShopByAdmin', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteShopByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteShopByAdmin('shop-1', '不適切な盆栽園')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { deleteShopByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteShopByAdmin('shop-1', '不適切な盆栽園')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('存在しない盆栽園はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { deleteShopByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteShopByAdmin('non-existent', '理由')

      expect(result).toMatchObject({ error: '盆栽園が見つかりません' })
    })

    it('盆栽園を削除できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-1',
        name: 'テスト盆栽園',
      })
      mockPrisma.$transaction.mockResolvedValue([{}, {}])

      const { deleteShopByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteShopByAdmin('shop-1', '不適切な盆栽園')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })

  // ============================================================
  // getAdminReviews
  // ============================================================

  describe('getAdminReviews', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      const result = await getAdminReviews()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      const result = await getAdminReviews()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('レビュー一覧を取得できる', async () => {
      const mockReviews = [
        {
          id: 'review-1',
          content: 'とても良い盆栽園',
          rating: 5,
          isHidden: false,
          createdAt: new Date(),
          user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
          shop: { id: 'shop-1', name: '盆栽園1' },
        },
      ]
      mockPrisma.shopReview.findMany.mockResolvedValue(mockReviews)
      mockPrisma.shopReview.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([
        { targetId: 'review-1', _count: { targetId: 2 } },
      ])

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      const result = await getAdminReviews()

      expect(result.success).toBe(true)
      if (!result.success) throw new Error('expected success')
      expect(result.data!.reviews).toHaveLength(1)
      expect(result.data!.total).toBe(1)
      expect(result.data!.reviews[0].reportCount).toBe(2)
    })

    it('検索クエリでフィルタリングできる', async () => {
      mockPrisma.shopReview.findMany.mockResolvedValue([])
      mockPrisma.shopReview.count.mockResolvedValue(0)

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      await getAdminReviews({ search: '良い' })

      expect(mockPrisma.shopReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            content: { contains: '良い' },
          }),
        })
      )
    })

    it('通報フィルターが動作する', async () => {
      mockPrisma.report.findMany.mockResolvedValue([
        { targetId: 'review-1' },
        { targetId: 'review-2' },
      ])
      mockPrisma.shopReview.findMany.mockResolvedValue([])
      mockPrisma.shopReview.count.mockResolvedValue(0)

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      await getAdminReviews({ hasReports: true })

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { targetType: 'review' },
        })
      )
      expect(mockPrisma.shopReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['review-1', 'review-2'] },
          }),
        })
      )
    })

    it('cursor ページネーションが動作する', async () => {
      mockPrisma.shopReview.findMany.mockResolvedValue([])
      mockPrisma.shopReview.count.mockResolvedValue(0)

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      await getAdminReviews({ limit: 10, cursor: 'review-cursor' })

      expect(mockPrisma.shopReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'review-cursor' },
          skip: 1,
        })
      )
    })

    it('ソートが動作する', async () => {
      mockPrisma.shopReview.findMany.mockResolvedValue([])
      mockPrisma.shopReview.count.mockResolvedValue(0)

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      await getAdminReviews({ sortBy: 'rating', sortOrder: 'asc' })

      expect(mockPrisma.shopReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ rating: 'asc' }, { id: 'asc' }],
        })
      )
    })

    it('レビューがない場合はreport.groupByを呼ばない', async () => {
      mockPrisma.shopReview.findMany.mockResolvedValue([])
      mockPrisma.shopReview.count.mockResolvedValue(0)

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      const result = await getAdminReviews()

      expect(mockPrisma.report.groupBy).not.toHaveBeenCalled()
      expect(result.success).toBe(true)
      if (!result.success) throw new Error('expected success')
      expect(result.data!.reviews).toEqual([])
    })
  })

  // ============================================================
  // deleteReviewByAdmin
  // ============================================================

  describe('deleteReviewByAdmin', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteReviewByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteReviewByAdmin('review-1', '不適切なレビュー')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { deleteReviewByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteReviewByAdmin('review-1', '不適切なレビュー')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('存在しないレビューはエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue(null)

      const { deleteReviewByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteReviewByAdmin('non-existent', '理由')

      expect(result).toMatchObject({ error: 'レビューが見つかりません' })
    })

    it('レビューを削除できる', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        id: 'review-1',
        content: 'テストレビュー',
        rating: 3,
      })
      mockPrisma.$transaction.mockResolvedValue([{}, {}])

      const { deleteReviewByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteReviewByAdmin('review-1', '不適切なレビュー')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })
  })
})
