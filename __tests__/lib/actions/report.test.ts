// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost, mockReport } from '../../utils/test-utils'

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

describe('Report Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('createReport', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('存在しない投稿を通報するとエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'non-existent',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '対象が見つかりません' })
    })

    it('存在しないコメントを通報するとエラーを返す', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'comment',
        targetId: 'non-existent',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '対象が見つかりません' })
    })

    it('存在しないイベントを通報するとエラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'event',
        targetId: 'non-existent',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '対象が見つかりません' })
    })

    it('存在しない盆栽園を通報するとエラーを返す', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'shop',
        targetId: 'non-existent',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '対象が見つかりません' })
    })

    it('存在しないレビューを通報するとエラーを返す', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'review',
        targetId: 'non-existent',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '対象が見つかりません' })
    })

    it('存在しないユーザーを通報するとエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'user',
        targetId: 'non-existent',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '対象が見つかりません' })
    })

    it('自分のコンテンツは通報できない', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: mockUser.id,
      })

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '自分自身のコンテンツは通報できません' })
    })

    it('既に通報済みの場合はエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(mockReport)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '既に通報済みです' })
    })

    it('正常に通報を作成できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
        description: 'スパム投稿です',
      })

      expect(result).toEqual({ success: true })
    })

    it('コメントを通報できる', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'comment-id',
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'comment',
        targetId: 'comment-id',
        reason: 'harassment',
      })

      expect(result).toEqual({ success: true })
    })

    it('イベントを通報できる', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'event-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'event',
        targetId: 'event-id',
        reason: 'inappropriate',
      })

      expect(result).toEqual({ success: true })
    })

    it('盆栽園を通報できる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'shop',
        targetId: 'shop-id',
        reason: 'other',
      })

      expect(result).toEqual({ success: true })
    })

    it('レビューを通報できる', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        id: 'review-id',
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'review',
        targetId: 'review-id',
        reason: 'copyright',
      })

      expect(result).toEqual({ success: true })
    })

    it('ユーザーを通報できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'user',
        targetId: 'other-user-id',
        reason: 'harassment',
      })

      expect(result).toEqual({ success: true })
    })

    it('10件の通報でコンテンツが自動非表示になる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({
        ...mockPost,
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(10) // 10件でしきい値に達する
      mockPrisma.post.update.mockResolvedValue(mockPost)
      mockPrisma.report.updateMany.mockResolvedValue({ count: 10 })
      mockPrisma.adminNotification.create.mockResolvedValue({})

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'test-post-id',
        reason: 'spam',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.post.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'test-post-id' },
          data: expect.objectContaining({
            isHidden: true,
          }),
        })
      )
      expect(mockPrisma.adminNotification.create).toHaveBeenCalled()
    })
  })

  describe('getReports (管理者用)', async () => {
    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getReports } = await import('@/lib/actions/report')
      const result = await getReports()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('管理者は通報一覧を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.report.findMany.mockResolvedValue([mockReport])
      mockPrisma.report.count.mockResolvedValue(1)

      const { getReports } = await import('@/lib/actions/report')
      const result = await getReports()

      expect(('reports' in result ? result.reports : undefined)).toHaveLength(1)
      expect(('total' in result ? result.total : undefined)).toBe(1)
    })

    it('ステータスでフィルタリングできる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)

      const { getReports } = await import('@/lib/actions/report')
      await getReports({ status: 'pending' })

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending',
          }),
        })
      )
    })
  })

  describe('updateReportStatus (管理者用)', async () => {
    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('report-id', 'resolved')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('存在しない通報はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.report.findUnique.mockResolvedValue(null)

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('non-existent', 'resolved')

      expect(result).toMatchObject({ error: '通報が見つかりません' })
    })

    it('通報ステータスを更新できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.report.findUnique.mockResolvedValue(mockReport)
      mockPrisma.$transaction.mockResolvedValue([{}, {}])

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('report-id', 'resolved', '対応完了')

      expect(result).toEqual({ success: true })
    })
  })

  describe('getReportStats (管理者用)', async () => {
    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getReportStats } = await import('@/lib/actions/report')
      const result = await getReportStats()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('通報統計を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
      mockPrisma.report.count.mockResolvedValueOnce(5) // pending
      mockPrisma.report.count.mockResolvedValueOnce(3) // reviewed
      mockPrisma.report.count.mockResolvedValueOnce(10) // resolved
      mockPrisma.report.count.mockResolvedValueOnce(2) // dismissed
      mockPrisma.report.groupBy.mockResolvedValue([
        { targetType: 'post', _count: 15 },
        { targetType: 'comment', _count: 5 },
      ])

      const { getReportStats } = await import('@/lib/actions/report')
      const result = await getReportStats()

      expect(('stats' in result ? result.stats : undefined)).toBeDefined()
      expect(('stats' in result ? result.stats : undefined)?.pending).toBe(5)
      expect(('stats' in result ? result.stats : undefined)?.total).toBe(20)
    })

    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getReportStats } = await import('@/lib/actions/report')
      const result = await getReportStats()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // deleteReportedContent (管理者用)
  // ============================================================

  describe('deleteReportedContent (管理者用)', async () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
    })

    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('post', 'post-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('post', 'post-id')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('投稿を削除できる', async () => {
      mockPrisma.post.delete.mockResolvedValue(mockPost)
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('post', 'post-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: { id: 'post-id' },
      })
    })

    it('コメントを削除できる', async () => {
      mockPrisma.comment.delete.mockResolvedValue({})
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('comment', 'comment-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({
        where: { id: 'comment-id' },
      })
    })

    it('イベントを削除できる', async () => {
      mockPrisma.event.delete.mockResolvedValue({})
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('event', 'event-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.event.delete).toHaveBeenCalledWith({
        where: { id: 'event-id' },
      })
    })

    it('盆栽園を削除できる', async () => {
      mockPrisma.bonsaiShop.delete.mockResolvedValue({})
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('shop', 'shop-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.bonsaiShop.delete).toHaveBeenCalledWith({
        where: { id: 'shop-id' },
      })
    })

    it('レビューを削除できる', async () => {
      mockPrisma.shopReview.delete.mockResolvedValue({})
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('review', 'review-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.shopReview.delete).toHaveBeenCalledWith({
        where: { id: 'review-id' },
      })
    })

    it('ユーザーを停止できる', async () => {
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('user', 'user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-id' },
        data: expect.objectContaining({
          isSuspended: true,
        }),
      })
    })

    it('削除に失敗した場合はエラーを返す', async () => {
      mockPrisma.post.delete.mockRejectedValue(new Error('削除エラー'))

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('post', 'post-id')

      expect(result).toMatchObject({ error: '削除に失敗しました' })
    })
  })

  // ============================================================
  // deleteReport (管理者用)
  // ============================================================

  describe('deleteReport (管理者用)', async () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
    })

    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteReport } = await import('@/lib/actions/report')
      const result = await deleteReport('report-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { deleteReport } = await import('@/lib/actions/report')
      const result = await deleteReport('report-id')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('通報レコードを削除できる', async () => {
      mockPrisma.report.delete.mockResolvedValue({})
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReport } = await import('@/lib/actions/report')
      const result = await deleteReport('report-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.report.delete).toHaveBeenCalledWith({
        where: { id: 'report-id' },
      })
      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'delete_report',
            targetType: 'report',
            targetId: 'report-id',
          }),
        })
      )
    })

    it('削除に失敗した場合はエラーを返す', async () => {
      mockPrisma.report.delete.mockRejectedValue(new Error('削除エラー'))

      const { deleteReport } = await import('@/lib/actions/report')
      const result = await deleteReport('report-id')

      expect(result).toMatchObject({ error: '削除に失敗しました' })
    })
  })

  // ============================================================
  // createReport - 自動非表示の追加テスト
  // ============================================================

  describe('createReport - 自動非表示の追加テスト', async () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    })

    it('10件の通報でコメントが自動非表示になる', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({
        id: 'comment-id',
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(10)
      mockPrisma.comment.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 10 })
      mockPrisma.adminNotification.create.mockResolvedValue({})

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'comment',
        targetId: 'comment-id',
        reason: 'harassment',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.comment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'comment-id' },
          data: expect.objectContaining({
            isHidden: true,
          }),
        })
      )
    })

    it('10件の通報でイベントが自動非表示になる', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        id: 'event-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(10)
      mockPrisma.event.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 10 })
      mockPrisma.adminNotification.create.mockResolvedValue({})

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'event',
        targetId: 'event-id',
        reason: 'spam',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.event.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'event-id' },
          data: expect.objectContaining({
            isHidden: true,
          }),
        })
      )
    })

    it('10件の通報で盆栽園が自動非表示になる', async () => {
      mockPrisma.bonsaiShop.findUnique.mockResolvedValue({
        id: 'shop-id',
        createdBy: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(10)
      mockPrisma.bonsaiShop.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 10 })
      mockPrisma.adminNotification.create.mockResolvedValue({})

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'shop',
        targetId: 'shop-id',
        reason: 'inappropriate',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.bonsaiShop.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'shop-id' },
          data: expect.objectContaining({
            isHidden: true,
          }),
        })
      )
    })

    it('10件の通報でレビューが自動非表示になる', async () => {
      mockPrisma.shopReview.findUnique.mockResolvedValue({
        id: 'review-id',
        userId: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(10)
      mockPrisma.shopReview.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 10 })
      mockPrisma.adminNotification.create.mockResolvedValue({})

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'review',
        targetId: 'review-id',
        reason: 'copyright',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.shopReview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'review-id' },
          data: expect.objectContaining({
            isHidden: true,
          }),
        })
      )
    })

    it('10件の通報でユーザーが自動停止される', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'other-user-id',
      })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(10)
      mockPrisma.user.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 10 })
      mockPrisma.adminNotification.create.mockResolvedValue({})

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'user',
        targetId: 'other-user-id',
        reason: 'harassment',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'other-user-id' },
          data: expect.objectContaining({
            isSuspended: true,
          }),
        })
      )
    })
  })

  // ============================================================
  // getReports - 追加テスト
  // ============================================================

  describe('getReports - 追加テスト', async () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
    })

    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getReports } = await import('@/lib/actions/report')
      const result = await getReports()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('対象タイプでフィルタリングできる', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)

      const { getReports } = await import('@/lib/actions/report')
      await getReports({ targetType: 'post' })

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            targetType: 'post',
          }),
        })
      )
    })

    it('cursor ページネーションが動作する', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)

      const { getReports } = await import('@/lib/actions/report')
      await getReports({ limit: 20, cursor: 'report-cursor' })

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 20,
          cursor: { id: 'report-cursor' },
          skip: 1,
        })
      )
    })
  })

  // ============================================================
  // updateReportStatus - 追加テスト
  // ============================================================

  describe('updateReportStatus - 追加テスト', async () => {
    beforeEach(() => {
      mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
    })

    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('report-id', 'resolved')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })
  })
})
