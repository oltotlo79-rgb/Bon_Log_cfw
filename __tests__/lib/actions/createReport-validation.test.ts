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
const mockUserFindUnique = vi.fn().mockResolvedValue({ isSuspended: false, email: 'a@a.com' })

vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    post: { findUnique: (...args: unknown[]) => mockPostFindUnique(...args) },
    user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) },
    report: {
      findFirst: (...args: unknown[]) => mockReportFindFirst(...args),
      create: (...args: unknown[]) => mockReportCreate(...args),
      count: (...args: unknown[]) => mockReportCount(...args),
      updateMany: vi.fn(),
    },
    adminNotification: { create: vi.fn() },
    comment: { findUnique: vi.fn(), update: vi.fn() },
    event: { findUnique: vi.fn(), update: vi.fn() },
    bonsaiShop: { findUnique: vi.fn(), update: vi.fn() },
    shopReview: { findUnique: vi.fn(), update: vi.fn() },
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
})
