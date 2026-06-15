// @vitest-environment node
/**
 * lib/services/report-service のユニットテスト
 *
 * createReportService の正常系・自己通報・重複通報・
 * 対象種別の存在チェック・AUTO_HIDE_THRESHOLD 境界値を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPostFindUnique = vi.fn()
const mockCommentFindUnique = vi.fn()
const mockEventFindUnique = vi.fn()
const mockBonsaiShopFindUnique = vi.fn()
const mockShopReviewFindUnique = vi.fn()
const mockUserFindUnique = vi.fn()
const mockReportFindFirst = vi.fn()
const mockReportCreate = vi.fn()
const mockReportCount = vi.fn()
const mockReportUpdateMany = vi.fn()
const mockPostUpdate = vi.fn()
const mockCommentUpdate = vi.fn()
const mockEventUpdate = vi.fn()
const mockBonsaiShopUpdate = vi.fn()
const mockShopReviewUpdate = vi.fn()
const mockUserUpdate = vi.fn()
const mockAdminNotificationCreate = vi.fn()

const mockPrisma = {
  post: {
    findUnique: (...args: unknown[]) => mockPostFindUnique(...args),
    update: (...args: unknown[]) => mockPostUpdate(...args),
  },
  comment: {
    findUnique: (...args: unknown[]) => mockCommentFindUnique(...args),
    update: (...args: unknown[]) => mockCommentUpdate(...args),
  },
  event: {
    findUnique: (...args: unknown[]) => mockEventFindUnique(...args),
    update: (...args: unknown[]) => mockEventUpdate(...args),
  },
  bonsaiShop: {
    findUnique: (...args: unknown[]) => mockBonsaiShopFindUnique(...args),
    update: (...args: unknown[]) => mockBonsaiShopUpdate(...args),
  },
  shopReview: {
    findUnique: (...args: unknown[]) => mockShopReviewFindUnique(...args),
    update: (...args: unknown[]) => mockShopReviewUpdate(...args),
  },
  user: {
    findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    update: (...args: unknown[]) => mockUserUpdate(...args),
  },
  report: {
    findFirst: (...args: unknown[]) => mockReportFindFirst(...args),
    create: (...args: unknown[]) => mockReportCreate(...args),
    count: (...args: unknown[]) => mockReportCount(...args),
    updateMany: (...args: unknown[]) => mockReportUpdateMany(...args),
  },
  adminNotification: {
    create: (...args: unknown[]) => mockAdminNotificationCreate(...args),
  },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const mockRevalidateShopRatingsCache = vi.fn()
vi.mock('@/lib/cache', () => ({
  revalidateShopRatingsCache: (...args: unknown[]) => mockRevalidateShopRatingsCache(...args),
}))

vi.mock('@/lib/constants/report', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/constants/report')>()
  return { ...original }
})

vi.mock('@/lib/constants/status', () => ({
  REPORT_STATUS: {
    PENDING: 'pending',
    AUTO_HIDDEN: 'auto_hidden',
    REVIEWED: 'reviewed',
    RESOLVED: 'resolved',
    DISMISSED: 'dismissed',
  },
}))

const REPORTER = 'reporter-id'
const POST_OWNER = 'post-owner-id'
const POST_ID = 'post-target-id'

describe('createReportService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPostFindUnique.mockResolvedValue({ userId: POST_OWNER })
    mockReportFindFirst.mockResolvedValue(null)
    mockReportCreate.mockResolvedValue({ id: 'report-1' })
    mockReportCount.mockResolvedValue(1)
    mockReportUpdateMany.mockResolvedValue({ count: 1 })
    mockAdminNotificationCreate.mockResolvedValue({ id: 'notif-1' })
  })

  it('正常通報で { ok: true } を返す', async () => {
    const { createReportService } = await import('@/lib/services/report-service')
    const result = await createReportService({
      reporterId: REPORTER,
      targetType: 'post',
      targetId: POST_ID,
      reason: 'spam',
    })
    expect(result).toEqual({ ok: true })
  })

  it('report.create が呼ばれる', async () => {
    const { createReportService } = await import('@/lib/services/report-service')
    await createReportService({
      reporterId: REPORTER,
      targetType: 'post',
      targetId: POST_ID,
      reason: 'spam',
      description: '詳細',
    })
    expect(mockReportCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reporterId: REPORTER,
          targetType: 'post',
          targetId: POST_ID,
          reason: 'spam',
          description: '詳細',
        }),
      }),
    )
  })

  it('自己通報で { ok: false, reason: "self" } を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce({ userId: REPORTER })
    const { createReportService } = await import('@/lib/services/report-service')
    const result = await createReportService({
      reporterId: REPORTER,
      targetType: 'post',
      targetId: POST_ID,
      reason: 'spam',
    })
    expect(result).toEqual({ ok: false, reason: 'self' })
    expect(mockReportCreate).not.toHaveBeenCalled()
  })

  it('対象が存在しない場合 { ok: false, reason: "not_found" } を返す', async () => {
    mockPostFindUnique.mockResolvedValueOnce(null)
    const { createReportService } = await import('@/lib/services/report-service')
    const result = await createReportService({
      reporterId: REPORTER,
      targetType: 'post',
      targetId: 'non-existent',
      reason: 'spam',
    })
    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(mockReportCreate).not.toHaveBeenCalled()
  })

  it('重複通報で { ok: false, reason: "already_reported" } を返す', async () => {
    mockReportFindFirst.mockResolvedValueOnce({ id: 'existing-report' })
    const { createReportService } = await import('@/lib/services/report-service')
    const result = await createReportService({
      reporterId: REPORTER,
      targetType: 'post',
      targetId: POST_ID,
      reason: 'spam',
    })
    expect(result).toEqual({ ok: false, reason: 'already_reported' })
    expect(mockReportCreate).not.toHaveBeenCalled()
  })

  it('report.create がエラーを投げた場合 { ok: false, reason: "error" } を返す', async () => {
    mockReportCreate.mockRejectedValueOnce(new Error('DB error'))
    const { createReportService } = await import('@/lib/services/report-service')
    const result = await createReportService({
      reporterId: REPORTER,
      targetType: 'post',
      targetId: POST_ID,
      reason: 'spam',
    })
    expect(result).toEqual({ ok: false, reason: 'error' })
  })

  describe('対象種別ごとの存在チェック', () => {
    it('targetType=post で post.findUnique が呼ばれる', async () => {
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'post', targetId: POST_ID, reason: 'spam' })
      expect(mockPostFindUnique).toHaveBeenCalledWith({ where: { id: POST_ID }, select: { userId: true } })
    })

    it('targetType=comment で comment.findUnique が呼ばれる', async () => {
      mockCommentFindUnique.mockResolvedValueOnce({ userId: 'comment-owner' })
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'comment', targetId: 'comment-id', reason: 'spam' })
      expect(mockCommentFindUnique).toHaveBeenCalledWith({ where: { id: 'comment-id' }, select: { userId: true } })
    })

    it('targetType=event で event.findUnique が呼ばれる', async () => {
      mockEventFindUnique.mockResolvedValueOnce({ createdBy: 'event-owner' })
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'event', targetId: 'event-id', reason: 'spam' })
      expect(mockEventFindUnique).toHaveBeenCalledWith({ where: { id: 'event-id' }, select: { createdBy: true } })
    })

    it('targetType=shop で bonsaiShop.findUnique が呼ばれる', async () => {
      mockBonsaiShopFindUnique.mockResolvedValueOnce({ createdBy: 'shop-owner' })
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'shop', targetId: 'shop-id', reason: 'spam' })
      expect(mockBonsaiShopFindUnique).toHaveBeenCalledWith({ where: { id: 'shop-id' }, select: { createdBy: true } })
    })

    it('targetType=review で shopReview.findUnique が呼ばれる', async () => {
      mockShopReviewFindUnique.mockResolvedValueOnce({ userId: 'review-owner' })
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'review', targetId: 'review-id', reason: 'spam' })
      expect(mockShopReviewFindUnique).toHaveBeenCalledWith({ where: { id: 'review-id' }, select: { userId: true } })
    })

    it('targetType=user で user.findUnique が呼ばれる', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'user-to-report' })
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'user', targetId: 'user-to-report', reason: 'spam' })
      expect(mockUserFindUnique).toHaveBeenCalledWith({ where: { id: 'user-to-report' }, select: { id: true } })
    })

    it('targetType=user で対象ユーザーが自分自身の場合 { ok: false, reason: "self" }', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: REPORTER })
      const { createReportService } = await import('@/lib/services/report-service')
      const result = await createReportService({
        reporterId: REPORTER,
        targetType: 'user',
        targetId: REPORTER,
        reason: 'spam',
      })
      expect(result).toEqual({ ok: false, reason: 'self' })
    })
  })

  describe('AUTO_HIDE_THRESHOLD 境界値', () => {
    it('通報数が 9 件では auto-hide が発火しない', async () => {
      mockReportCount.mockResolvedValueOnce(9)
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'post', targetId: POST_ID, reason: 'spam' })
      expect(mockPostUpdate).not.toHaveBeenCalled()
      expect(mockAdminNotificationCreate).not.toHaveBeenCalled()
    })

    it('通報数が 10 件（AUTO_HIDE_THRESHOLD）で auto-hide が発火する', async () => {
      mockReportCount.mockResolvedValueOnce(10)
      mockPostUpdate.mockResolvedValueOnce({})
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'post', targetId: POST_ID, reason: 'spam' })
      expect(mockPostUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: POST_ID }, data: expect.objectContaining({ isHidden: true }) }),
      )
      expect(mockAdminNotificationCreate).toHaveBeenCalled()
    })

    it('通報数が 11 件でも auto-hide が発火する（閾値以上）', async () => {
      mockReportCount.mockResolvedValueOnce(11)
      mockPostUpdate.mockResolvedValueOnce({})
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'post', targetId: POST_ID, reason: 'spam' })
      expect(mockPostUpdate).toHaveBeenCalled()
    })

    it('targetType=comment で 10 件到達時に comment.update が呼ばれる', async () => {
      mockCommentFindUnique.mockResolvedValueOnce({ userId: POST_OWNER })
      mockReportCount.mockResolvedValueOnce(10)
      mockCommentUpdate.mockResolvedValueOnce({})
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'comment', targetId: 'comment-id', reason: 'spam' })
      expect(mockCommentUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isHidden: true }) }),
      )
    })

    it('targetType=user で 10 件到達時に user.update（isSuspended: true）が呼ばれる', async () => {
      mockUserFindUnique.mockResolvedValueOnce({ id: 'another-user' })
      mockReportCount.mockResolvedValueOnce(10)
      mockUserUpdate.mockResolvedValueOnce({})
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'user', targetId: 'another-user', reason: 'spam' })
      expect(mockUserUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ isSuspended: true }) }),
      )
    })

    it('targetType=review で 10 件到達時に revalidateShopRatingsCache が呼ばれる', async () => {
      mockShopReviewFindUnique.mockResolvedValueOnce({ userId: POST_OWNER })
      mockReportCount.mockResolvedValueOnce(10)
      mockShopReviewUpdate.mockResolvedValueOnce({})
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'review', targetId: 'review-id', reason: 'spam' })
      expect(mockRevalidateShopRatingsCache).toHaveBeenCalled()
    })

    it('auto-hide 後に report.updateMany で status が auto_hidden になる', async () => {
      mockReportCount.mockResolvedValueOnce(10)
      mockPostUpdate.mockResolvedValueOnce({})
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'post', targetId: POST_ID, reason: 'spam' })
      expect(mockReportUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ targetType: 'post', targetId: POST_ID }),
          data: expect.objectContaining({ status: 'auto_hidden' }),
        }),
      )
    })

    it('auto-hide 後に adminNotification.create が呼ばれる', async () => {
      mockReportCount.mockResolvedValueOnce(10)
      mockPostUpdate.mockResolvedValueOnce({})
      const { createReportService } = await import('@/lib/services/report-service')
      await createReportService({ reporterId: REPORTER, targetType: 'post', targetId: POST_ID, reason: 'spam' })
      expect(mockAdminNotificationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'auto_hidden',
            targetType: 'post',
            targetId: POST_ID,
          }),
        }),
      )
    })
  })
})
