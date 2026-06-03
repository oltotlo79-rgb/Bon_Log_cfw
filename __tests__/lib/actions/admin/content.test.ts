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

// 店舗評価キャッシュ無効化を spy する（review 削除時に呼ばれることを検証）
const mockRevalidateShopRatingsCache = vi.fn()
vi.mock('@/lib/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cache')>()
  return { ...actual, revalidateShopRatingsCache: mockRevalidateShopRatingsCache }
})

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
      // review 削除は店舗一覧の集計平均に影響するためキャッシュ無効化される
      expect(mockRevalidateShopRatingsCache).toHaveBeenCalled()
    })
  })

  // ============================================================
  // Zod 失敗ブランチの補完
  // ============================================================
  describe('入力検証の補完', () => {
    it('deleteEventByAdmin: 空 ID は ERR_INVALID_INPUT', async () => {
      const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteEventByAdmin('', '理由')
      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.event.findUnique).not.toHaveBeenCalled()
    })

    it('deleteShopByAdmin: 空 ID は ERR_INVALID_INPUT', async () => {
      const { deleteShopByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteShopByAdmin('', '理由')
      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.bonsaiShop.findUnique).not.toHaveBeenCalled()
    })

    it('deleteReviewByAdmin: 空 ID は ERR_INVALID_INPUT', async () => {
      const { deleteReviewByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteReviewByAdmin('', '理由')
      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.shopReview.findUnique).not.toHaveBeenCalled()
    })

    it('adminReasonSchema は空文字を許可するため空理由でも前進する', async () => {
      // 「理由を残さず即削除」ユースケースを保つため空文字は invalid 扱いにしない (schemas 参照)
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', title: 'T' })
      mockPrisma.$transaction.mockResolvedValue([{}, {}])

      const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteEventByAdmin('event-1', '')
      expect(result).toEqual({ success: true })
    })

    it('過剰な ID 長 (>200) は ERR_INVALID_INPUT', async () => {
      const tooLong = 'x'.repeat(201)
      const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteEventByAdmin(tooLong, '理由')
      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.event.findUnique).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // catch 経路: DB エラーで ERR_OPERATION_FAILED を返す
  // ============================================================
  describe('catch 経路 (DB 失敗時)', () => {
    it('deleteEventByAdmin: $transaction 失敗で ERR_OPERATION_FAILED', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', title: 'T' })
      mockPrisma.$transaction.mockRejectedValue(new Error('TX failure'))

      const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteEventByAdmin('event-1', 'reason')
      expect(result).toMatchObject({ success: false })
    })

    it('deleteShopByAdmin: $transaction 失敗で ERR_OPERATION_FAILED', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({ id: 'shop-1', name: 'S' })
      mockPrisma.$transaction.mockRejectedValue(new Error('TX failure'))

      const { deleteShopByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteShopByAdmin('shop-1', 'reason')
      expect(result).toMatchObject({ success: false })
    })

    it('deleteReviewByAdmin: $transaction 失敗で ERR_OPERATION_FAILED', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({ id: 'review-1', content: 'R' })
      mockPrisma.$transaction.mockRejectedValue(new Error('TX failure'))

      const { deleteReviewByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteReviewByAdmin('review-1', 'reason')
      expect(result).toMatchObject({ success: false })
    })

    it('getAdminReviews: Promise.all 失敗で ERR_OPERATION_FAILED', async () => {
      mockPrisma.shopReview.findMany.mockRejectedValue(new Error('DB error'))

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      const result = await getAdminReviews()
      expect(result).toMatchObject({ success: false })
    })

    it('catch ブランチ: 非 Error オブジェクト throw でも安全に error 文字列を返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({ id: 'event-1', title: 'T' })
      mockPrisma.$transaction.mockRejectedValue('not an error object')

      const { deleteEventByAdmin } = await import('@/lib/actions/admin/content')
      const result = await deleteEventByAdmin('event-1', 'reason')
      expect(result).toMatchObject({ success: false })
    })
  })

  // ============================================================
  // getAdminReviews: nextCursor ブランチ
  // ============================================================
  describe('getAdminReviews: ページネーション境界', () => {
    it('reviews.length === limit のとき nextCursor を末尾IDで返す', async () => {
      const reviews = Array.from({ length: 3 }, (_, i) => ({
        id: `r${i + 1}`,
        content: 'c',
        rating: 5,
        isHidden: false,
        createdAt: new Date(),
        user: { id: 'u', nickname: 'n', avatarUrl: null },
        shop: { id: 's', name: 'sn' },
      }))
      mockPrisma.shopReview.findMany.mockResolvedValue(reviews)
      mockPrisma.shopReview.count.mockResolvedValue(3)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      const result = await getAdminReviews({ limit: 3 })

      if (!result.success) throw new Error('expected success')
      expect(result.data!.nextCursor).toBe('r3')
    })

    it('reviews.length < limit のとき nextCursor は undefined', async () => {
      mockPrisma.shopReview.findMany.mockResolvedValue([
        {
          id: 'r1',
          content: 'c',
          rating: 5,
          isHidden: false,
          createdAt: new Date(),
          user: { id: 'u', nickname: 'n', avatarUrl: null },
          shop: { id: 's', name: 'sn' },
        },
      ])
      mockPrisma.shopReview.count.mockResolvedValue(1)
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getAdminReviews } = await import('@/lib/actions/admin/content')
      const result = await getAdminReviews({ limit: 20 })

      if (!result.success) throw new Error('expected success')
      expect(result.data!.nextCursor).toBeUndefined()
    })
  })
})
