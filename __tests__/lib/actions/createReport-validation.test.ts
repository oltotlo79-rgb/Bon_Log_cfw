/**
 * createReport の Zod validation 順序回帰テスト (P1)。
 *
 * 期待: invalid params (targetType / reason / description) でも DB lookup / rate-limit が
 * 呼ばれない。schema 通過後に初めて rate-limit が消費される。
 */
// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockAuth = vi.fn()
const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
const mockPostFindUnique = vi.fn()
const mockReportFindFirst = vi.fn()
const mockReportCreate = vi.fn().mockResolvedValue({})
const mockReportCount = vi.fn().mockResolvedValue(0)
const mockReportUpdateMany = vi.fn().mockResolvedValue({ count: 0 })
const mockUserFindUnique = vi.fn().mockResolvedValue({ isSuspended: false, email: 'a@a.com' })
const mockShopReviewFindUnique = vi.fn()
const mockShopReviewUpdate = vi.fn().mockResolvedValue({})
const mockAdminNotificationCreate = vi.fn().mockResolvedValue({})
const mockRevalidateShopRatingsCache = vi.fn()

vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))
vi.mock('@/lib/cache', () => ({
  revalidateShopRatingsCache: () => mockRevalidateShopRatingsCache(),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    post: { findUnique: (...args: unknown[]) => mockPostFindUnique(...args) },
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    report: {
      findFirst: (...args: unknown[]) => mockReportFindFirst(...args),
      create: (...args: unknown[]) => mockReportCreate(...args),
      count: (...args: unknown[]) => mockReportCount(...args),
      updateMany: (...args: unknown[]) => mockReportUpdateMany(...args),
    },
    adminNotification: { create: (...args: unknown[]) => mockAdminNotificationCreate(...args) },
    comment: { findUnique: vi.fn(), update: vi.fn() },
    event: { findUnique: vi.fn(), update: vi.fn() },
    bonsaiShop: { findUnique: vi.fn(), update: vi.fn() },
    shopReview: {
      findUnique: (...args: unknown[]) => mockShopReviewFindUnique(...args),
      update: (...args: unknown[]) => mockShopReviewUpdate(...args),
    },
  },
}))

describe('createReport — auth → validation → rate-limit 順序', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'reporter-1' } })
    mockUserFindUnique.mockResolvedValue({
      isSuspended: false,
      email: 'a@example.com',
    })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
  })

  it('invalid targetType で rate-limit / DB lookup が呼ばれない', async () => {
    const { createReport } = await import('@/lib/actions/report-user')
    const result = await createReport({
      targetType: 'unknown',
      targetId: 'p1',
      reason: 'spam',
    })
    expect(result.success).toBe(false)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    expect(mockPostFindUnique).not.toHaveBeenCalled()
  })

  it('invalid reason で rate-limit / DB lookup が呼ばれない', async () => {
    const { createReport } = await import('@/lib/actions/report-user')
    const result = await createReport({
      targetType: 'post',
      targetId: 'p1',
      reason: 'evil-reason',
    })
    expect(result.success).toBe(false)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    expect(mockPostFindUnique).not.toHaveBeenCalled()
  })

  it('description が長すぎる場合 rate-limit が呼ばれない', async () => {
    const { createReport } = await import('@/lib/actions/report-user')
    const result = await createReport({
      targetType: 'post',
      targetId: 'p1',
      reason: 'spam',
      description: 'x'.repeat(1001),
    })
    expect(result.success).toBe(false)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('targetId が空文字なら rate-limit が呼ばれない', async () => {
    const { createReport } = await import('@/lib/actions/report-user')
    const result = await createReport({
      targetType: 'post',
      targetId: '',
      reason: 'spam',
    })
    expect(result.success).toBe(false)
    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('valid input なら rate-limit と DB lookup が呼ばれて create に到達する', async () => {
    mockPostFindUnique.mockResolvedValue({ userId: 'target-user' })
    mockReportFindFirst.mockResolvedValue(null)

    const { createReport } = await import('@/lib/actions/report-user')
    const result = await createReport({
      targetType: 'post',
      targetId: 'p1',
      reason: 'spam',
      description: '不適切な広告',
    })
    expect(result.success).toBe(true)
    expect(mockCheckUserRateLimit).toHaveBeenCalledWith('reporter-1', 'create_report')
    expect(mockPostFindUnique).toHaveBeenCalled()
    expect(mockReportCreate).toHaveBeenCalled()
  })

  it('rate-limit 超過時は DB create が呼ばれない', async () => {
    mockCheckUserRateLimit.mockResolvedValue({ success: false })

    const { createReport } = await import('@/lib/actions/report-user')
    const result = await createReport({
      targetType: 'post',
      targetId: 'p1',
      reason: 'spam',
    })
    expect(result.success).toBe(false)
    expect(mockPostFindUnique).not.toHaveBeenCalled()
    expect(mockReportCreate).not.toHaveBeenCalled()
  })

  it('review が AUTO_HIDE_THRESHOLD 到達で自動非表示になり店舗評価キャッシュを無効化する', async () => {
    const { AUTO_HIDE_THRESHOLD } = await import('@/lib/constants/report')
    mockShopReviewFindUnique.mockResolvedValue({ userId: 'review-owner' })
    mockReportFindFirst.mockResolvedValue(null)
    mockReportCount.mockResolvedValue(AUTO_HIDE_THRESHOLD)

    const { createReport } = await import('@/lib/actions/report-user')
    const result = await createReport({
      targetType: 'review',
      targetId: 'review-1',
      reason: 'spam',
    })

    expect(result.success).toBe(true)
    expect(mockShopReviewUpdate).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: expect.objectContaining({ isHidden: true }),
    })
    expect(mockRevalidateShopRatingsCache).toHaveBeenCalled()
  })

  it('閾値未満の review は自動非表示にならずキャッシュ無効化もされない', async () => {
    const { AUTO_HIDE_THRESHOLD } = await import('@/lib/constants/report')
    mockShopReviewFindUnique.mockResolvedValue({ userId: 'review-owner' })
    mockReportFindFirst.mockResolvedValue(null)
    mockReportCount.mockResolvedValue(AUTO_HIDE_THRESHOLD - 1)

    const { createReport } = await import('@/lib/actions/report-user')
    const result = await createReport({
      targetType: 'review',
      targetId: 'review-1',
      reason: 'spam',
    })

    expect(result.success).toBe(true)
    expect(mockShopReviewUpdate).not.toHaveBeenCalled()
    expect(mockRevalidateShopRatingsCache).not.toHaveBeenCalled()
  })
})
