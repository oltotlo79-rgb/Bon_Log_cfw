// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockShop, mockReview } from '../../utils/test-utils'

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

describe('Review Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // requireActiveUser needs user.findUnique for suspension check
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  describe('createReview', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()

      const result = await createReview(formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('盆栽園IDがない場合はエラーを返す', async () => {
      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()

      const result = await createReview(formData)

      expect(result).toMatchObject({ error: '盆栽園IDが必要です' })
    })

    it('評価が1未満の場合はエラーを返す', async () => {
      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('shopId', 'test-shop-id')
      formData.append('rating', '0')

      const result = await createReview(formData)

      expect(result).toMatchObject({ error: '評価は1～5の間で選択してください' })
    })

    it('評価が5を超える場合はエラーを返す', async () => {
      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('shopId', 'test-shop-id')
      formData.append('rating', '6')

      const result = await createReview(formData)

      expect(result).toMatchObject({ error: '評価は1～5の間で選択してください' })
    })

    it('画像が3枚を超える場合はエラーを返す', async () => {
      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('shopId', 'test-shop-id')
      formData.append('rating', '5')
      formData.append('imageUrls', 'url1')
      formData.append('imageUrls', 'url2')
      formData.append('imageUrls', 'url3')
      formData.append('imageUrls', 'url4')

      const result = await createReview(formData)

      expect(result).toMatchObject({ error: '画像は3枚までです' })
    })

    it('存在しない盆栽園はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('shopId', 'non-existent')
      formData.append('rating', '5')

      const result = await createReview(formData)

      expect(result).toMatchObject({ error: '盆栽園が見つかりません' })
    })

    it('既にレビュー済みの場合はエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(mockShop)
      mockPrisma.shopReview.findFirst.mockResolvedValue(mockReview)

      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('shopId', 'test-shop-id')
      formData.append('rating', '5')

      const result = await createReview(formData)

      expect(result).toMatchObject({ error: 'この盆栽園には既にレビューを投稿しています' })
    })

    it('正常にレビューを作成できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(mockShop)
      mockPrisma.shopReview.findFirst.mockResolvedValue(null)
      mockPrisma.shopReview.create.mockResolvedValue({
        ...mockReview,
        id: 'new-review-id',
      })

      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('shopId', 'test-shop-id')
      formData.append('rating', '5')
      formData.append('content', '素晴らしい盆栽園です')

      const result = await createReview(formData)

      expect(result.success).toBe(true)
      expect(result.data?.reviewId).toBe('new-review-id')
    })
  })

  describe('updateReview', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateReview } = await import('@/lib/actions/review')
      const formData = new FormData()

      const result = await updateReview('review-id', formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('存在しないレビューはエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue(null)

      const { updateReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('rating', '4')

      const result = await updateReview('non-existent', formData)

      expect(result).toMatchObject({ error: 'レビューが見つかりません' })
    })

    it('他人のレビューは編集できない', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: 'other-user-id',
      })

      const { updateReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('rating', '4')

      const result = await updateReview('review-id', formData)

      expect(result).toMatchObject({ error: '編集権限がありません' })
    })

    it('正常にレビューを更新できる', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'test-shop-id',
      })
      mockPrisma.shopReview.update.mockResolvedValue(mockReview)

      const { updateReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('rating', '4')
      formData.append('content', '更新後のコメント')

      const result = await updateReview('review-id', formData)

      expect(result).toEqual({ success: true })
    })
  })

  describe('deleteReview', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteReview } = await import('@/lib/actions/review')
      const result = await deleteReview('review-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('存在しないレビューはエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue(null)

      const { deleteReview } = await import('@/lib/actions/review')
      const result = await deleteReview('non-existent')

      expect(result).toMatchObject({ error: 'レビューが見つかりません' })
    })

    it('他人のレビューは削除できない', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: 'other-user-id',
      })

      const { deleteReview } = await import('@/lib/actions/review')
      const result = await deleteReview('review-id')

      expect(result).toMatchObject({ error: '削除権限がありません' })
    })

    it('自分のレビューを削除できる', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'test-shop-id',
      })
      mockPrisma.shopReview.delete.mockResolvedValue(mockReview)

      const { deleteReview } = await import('@/lib/actions/review')
      const result = await deleteReview('review-id')

      expect(result).toEqual({ success: true })
    })
  })

  describe('getReviews', async () => {
    it('レビュー一覧を取得できる', async () => {
      mockPrisma.shopReview.findMany.mockResolvedValue([mockReview])

      const { getReviews } = await import('@/lib/actions/review')
      const result = await getReviews('test-shop-id')

      expect(result.reviews).toHaveLength(1)
      expect(result.reviews[0].rating).toBe(5)
    })

    it('ページネーションが動作する', async () => {
      mockPrisma.shopReview.findMany.mockResolvedValue([])

      const { getReviews } = await import('@/lib/actions/review')
      await getReviews('test-shop-id', 'cursor-id', 10)

      expect(mockPrisma.shopReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('カーソルなしの場合はスキップなしで取得する', async () => {
      mockPrisma.shopReview.findMany.mockResolvedValue([])

      const { getReviews } = await import('@/lib/actions/review')
      await getReviews('test-shop-id', undefined, 10)

      expect(mockPrisma.shopReview.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          where: { shopId: 'test-shop-id' },
        })
      )
    })

    it('次のページがある場合はnextCursorを返す', async () => {
      const reviews = [
        { ...mockReview, id: 'review-1' },
        { ...mockReview, id: 'review-2' },
        { ...mockReview, id: 'review-3' },
      ]
      mockPrisma.shopReview.findMany.mockResolvedValue(reviews)

      const { getReviews } = await import('@/lib/actions/review')
      const result = await getReviews('test-shop-id', undefined, 3)

      expect(result.nextCursor).toBe('review-3')
    })

    it('次のページがない場合はnextCursorがundefined', async () => {
      const reviews = [
        { ...mockReview, id: 'review-1' },
        { ...mockReview, id: 'review-2' },
      ]
      mockPrisma.shopReview.findMany.mockResolvedValue(reviews)

      const { getReviews } = await import('@/lib/actions/review')
      const result = await getReviews('test-shop-id', undefined, 10)

      expect(result.nextCursor).toBeUndefined()
    })
  })

  // ============================================================
  // uploadReviewImage
  // ============================================================

  describe('uploadReviewImage', async () => {
    const mockUploadFile = vi.fn()

    beforeEach(() => {
      vi.mock('@/lib/storage', () => ({
        uploadFile: mockUploadFile,
      }))
    })

    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { uploadReviewImage } = await import('@/lib/actions/review')
      const formData = new FormData()

      const result = await uploadReviewImage(formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ファイルがない場合はエラーを返す', async () => {
      const { uploadReviewImage } = await import('@/lib/actions/review')
      const formData = new FormData()

      const result = await uploadReviewImage(formData)

      expect(result).toMatchObject({ error: 'ファイルが選択されていません' })
    })

    it('画像以外のファイルはエラーを返す', async () => {
      const { uploadReviewImage } = await import('@/lib/actions/review')
      const formData = new FormData()
      const textFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      formData.append('file', textFile)

      const result = await uploadReviewImage(formData)

      expect(result).toMatchObject({ error: '画像ファイルを選択してください' })
    })

    it('4MBを超えるファイルはエラーを返す', async () => {
      const { uploadReviewImage } = await import('@/lib/actions/review')
      const formData = new FormData()
      // 5MBのダミーデータを作成
      const largeData = new Uint8Array(5 * 1024 * 1024)
      const largeFile = new File([largeData], 'large.jpg', { type: 'image/jpeg' })
      formData.append('file', largeFile)

      const result = await uploadReviewImage(formData)

      expect(result).toMatchObject({ error: '画像は4MB以下にしてください' })
    })
  })

  // ============================================================
  // createReview - 追加テスト
  // ============================================================

  describe('createReview - 追加テスト', async () => {
    it('画像付きでレビューを作成できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(mockShop)
      mockPrisma.shopReview.findFirst.mockResolvedValue(null)
      mockPrisma.shopReview.create.mockResolvedValue({
        ...mockReview,
        id: 'new-review-id',
      })

      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('shopId', 'test-shop-id')
      formData.append('rating', '5')
      formData.append('content', '素晴らしい盆栽園です')
      formData.append('imageUrls', 'https://example.com/image1.jpg')
      formData.append('imageUrls', 'https://example.com/image2.jpg')

      const result = await createReview(formData)

      expect(result.success).toBe(true)
      expect(mockPrisma.shopReview.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            images: expect.objectContaining({
              create: expect.arrayContaining([
                { url: 'https://example.com/image1.jpg' },
                { url: 'https://example.com/image2.jpg' },
              ]),
            }),
          }),
        })
      )
    })

    it('評価が数値でない場合はエラーを返す', async () => {
      const { createReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('shopId', 'test-shop-id')
      formData.append('rating', 'invalid')

      const result = await createReview(formData)

      expect(result).toMatchObject({ error: '評価は1～5の間で選択してください' })
    })
  })

  // ============================================================
  // updateReview - 追加テスト
  // ============================================================

  describe('updateReview - 追加テスト', async () => {
    it('画像の総数が3枚を超える場合はエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'test-shop-id',
        images: [{ id: 'img-1' }, { id: 'img-2' }],
      })

      const { updateReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('rating', '4')
      formData.append('imageUrls', 'url1')
      formData.append('imageUrls', 'url2')

      const result = await updateReview('review-id', formData)

      expect(result).toMatchObject({ error: '画像は3枚までです' })
    })

    it('画像を削除して新しい画像を追加できる', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'test-shop-id',
        images: [{ id: 'img-1' }, { id: 'img-2' }],
      })

      const { updateReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('rating', '4')
      formData.append('deleteImageIds', 'img-1')
      formData.append('imageUrls', 'url1')
      formData.append('imageUrls', 'url2')

      const result = await updateReview('review-id', formData)

      expect(result).toEqual({ success: true })
    })

    it('評価が1未満の場合はエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'test-shop-id',
        images: [],
      })

      const { updateReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('rating', '0')

      const result = await updateReview('review-id', formData)

      expect(result).toMatchObject({ error: '評価は1～5の間で選択してください' })
    })

    it('評価が5を超える場合はエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        ...mockReview,
        userId: mockUser.id,
        shopId: 'test-shop-id',
        images: [],
      })

      const { updateReview } = await import('@/lib/actions/review')
      const formData = new FormData()
      formData.append('rating', '6')

      const result = await updateReview('review-id', formData)

      expect(result).toMatchObject({ error: '評価は1～5の間で選択してください' })
    })
  })
})
