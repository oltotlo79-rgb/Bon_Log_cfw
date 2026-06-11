// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/report')

import { createMockPrismaClient, mockPost, mockReport } from '../../utils/test-utils'

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

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('Report Actions Extended', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  // ============================================================
  // createReport
  // ============================================================

  describe('createReport', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'post-1',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('投稿を正常に通報できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ ...mockPost, userId: 'other-user' })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'post-1',
        reason: 'spam',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.report.create).toHaveBeenCalled()
    })

    it('コメントを正常に通報できる', async () => {
      mockPrisma.comment.findUnique.mockResolvedValue({ id: 'c1', userId: 'other-user' })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'comment',
        targetId: 'c1',
        reason: 'harassment',
      })

      expect(result).toEqual({ success: true })
    })

    it('対象が見つからない場合はエラーを返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'nonexistent',
        reason: 'spam',
      })

      expect(result).toMatchObject({ error: '対象が見つかりません' })
    })

    it('説明付きで通報できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ ...mockPost, userId: 'other-user' })
      mockPrisma.report.findFirst.mockResolvedValue(null)
      mockPrisma.report.create.mockResolvedValue(mockReport)
      mockPrisma.report.count.mockResolvedValue(1)

      const { createReport } = await import('@/lib/actions/report')
      const result = await createReport({
        targetType: 'post',
        targetId: 'post-1',
        reason: 'spam',
        description: 'スパム投稿です',
      })

      expect(result).toEqual({ success: true })
    })

  })

  // ============================================================
  // getReports
  // ============================================================

  describe('getReports', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getReports } = await import('@/lib/actions/report')
      const result = await getReports()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getReports } = await import('@/lib/actions/report')
      const result = await getReports()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('通報一覧を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'u1', role: 'admin' })
      mockPrisma.report.findMany.mockResolvedValue([mockReport])
      mockPrisma.report.count.mockResolvedValue(1)

      const { getReports } = await import('@/lib/actions/report')
      const result = await getReports()

      expect(('reports' in result ? result.reports : undefined)).toHaveLength(1)
      expect(('total' in result ? result.total : undefined)).toBe(1)
    })

    it('ステータスでフィルタリングできる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'u1', role: 'admin' })
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)

      const { getReports } = await import('@/lib/actions/report')
      await getReports({ status: 'pending' })

      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        })
      )
    })

    it('空の結果を返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'u1', role: 'admin' })
      mockPrisma.report.findMany.mockResolvedValue([])

      const { getReports } = await import('@/lib/actions/report')
      const result = await getReports()

      expect(result).toHaveProperty('reports')
    })
  })

  // ============================================================
  // updateReportStatus
  // ============================================================

  describe('updateReportStatus', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('report-1', 'resolved')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('report-1', 'resolved')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('通報ステータスを更新できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'u1', role: 'admin' })
      mockPrisma.report.findUnique.mockResolvedValue(mockReport)
      mockPrisma.$transaction.mockResolvedValue([{}, {}])

      const { updateReportStatus } = await import('@/lib/actions/report')
      const result = await updateReportStatus('report-1', 'resolved', '対応完了')

      expect(result).toEqual({ success: true })
    })
  })

  // ============================================================
  // deleteReport
  // ============================================================

  describe('deleteReport', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteReport } = await import('@/lib/actions/report')
      const result = await deleteReport('report-1')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { deleteReport } = await import('@/lib/actions/report')
      const result = await deleteReport('report-1')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('通報を削除できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'u1', role: 'admin' })
      mockPrisma.report.delete.mockResolvedValue({})
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReport } = await import('@/lib/actions/report')
      const result = await deleteReport('report-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.report.delete).toHaveBeenCalledWith({
        where: { id: 'report-1' },
      })
    })
  })

  // ============================================================
  // deleteReportedContent
  // ============================================================

  describe('deleteReportedContent', async () => {
    beforeEach(() => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'u1', role: 'admin' })
    })

    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('post', 'post-1')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('post', 'post-1')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('投稿を削除できる', async () => {
      mockPrisma.post.delete.mockResolvedValue(mockPost)
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('post', 'post-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({ where: { id: 'post-1' } })
    })

    it('コメントを削除できる', async () => {
      mockPrisma.comment.delete.mockResolvedValue({})
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteReportedContent } = await import('@/lib/actions/report')
      const result = await deleteReportedContent('comment', 'c1')

      expect(result).toEqual({ success: true })
    })
  })

  // ============================================================
  // getReportStats
  // ============================================================

  describe('getReportStats', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getReportStats } = await import('@/lib/actions/report')
      const result = await getReportStats()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getReportStats } = await import('@/lib/actions/report')
      const result = await getReportStats()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('通報統計を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: 'u1', role: 'admin' })
      mockPrisma.report.count.mockResolvedValueOnce(5)  // pending
      mockPrisma.report.count.mockResolvedValueOnce(3)  // reviewed
      mockPrisma.report.count.mockResolvedValueOnce(10) // resolved
      mockPrisma.report.count.mockResolvedValueOnce(2)  // dismissed
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
  })
})
