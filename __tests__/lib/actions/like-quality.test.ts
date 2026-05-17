// @vitest-environment node

/**
 * Additional like.ts coverage tests targeting uncovered lines 77 and 103.
 *
 * Line 77: logger.error inside recordLikeReceived .catch() handler
 * Line 103: toggleCommentLike empty-string validation returning ERR_INVALID_INPUT
 */

import { vi } from 'vitest'
vi.unmock('@/lib/actions/like')

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))

const mockRecordLikeReceived = vi.fn()
vi.mock('@/lib/actions/analytics', () => ({
  recordLikeReceived: (...args: unknown[]) => mockRecordLikeReceived(...args),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn), cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() } }))

const mockCreateNotification = vi.fn().mockResolvedValue({ success: true })
const mockDeleteNotification = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/actions/notification', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotification(...args),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotification(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  mockCheckUserRateLimit.mockResolvedValue({ success: true })
  mockRecordLikeReceived.mockResolvedValue(undefined)
})

describe('toggleCommentLike - empty string validation (line 103)', () => {
  const importModule = () => import('@/lib/actions/like')

  it('returns ERR_INVALID_INPUT when commentId is empty', async () => {
    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('', 'p1')

    expect(result).toEqual({ success: false, error: '入力データが不正です' })
    // CLAUDE.md ルール3: 認証→Zod→レート制限の順序なので、auth は Zod より先に呼ばれる。
    // ただしDBクエリには到達せずバリデーションで早期リターンしている。
    expect(mockPrisma.like.findFirst).not.toHaveBeenCalled()
  })

  it('returns ERR_INVALID_INPUT when postId is empty', async () => {
    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('c1', '')

    expect(result).toEqual({ success: false, error: '入力データが不正です' })
    expect(mockPrisma.like.findFirst).not.toHaveBeenCalled()
  })

  it('returns ERR_INVALID_INPUT when both are empty', async () => {
    const { toggleCommentLike } = await importModule()
    const result = await toggleCommentLike('', '')

    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })
})

describe('togglePostLike - empty string validation', () => {
  const importModule = () => import('@/lib/actions/like')

  it('returns ERR_INVALID_INPUT when postId is empty', async () => {
    const { togglePostLike } = await importModule()
    const result = await togglePostLike('')

    expect(result).toEqual({ success: false, error: '入力データが不正です' })
  })
})

describe('togglePostLike - recordLikeReceived failure (line 77)', () => {
  const importModule = () => import('@/lib/actions/like')

  it('still succeeds when recordLikeReceived rejects', async () => {
    // Setup: like a post from another user so recordLikeReceived is called
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l1', postId: 'p1', userId: mockUser.id })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p1', userId: 'other-user' })
    mockPrisma.notification.create.mockResolvedValue({})

    // Make recordLikeReceived reject to exercise .catch() handler
    mockRecordLikeReceived.mockRejectedValueOnce(new Error('Analytics service unavailable'))

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p1')

    // The action should still succeed despite analytics failure
    expect(result).toEqual({ success: true, data: { liked: true } })
    expect(mockRecordLikeReceived).toHaveBeenCalledWith('other-user')
  })

  it('handles non-Error rejection from recordLikeReceived', async () => {
    mockPrisma.like.findFirst.mockResolvedValue(null)
    mockPrisma.like.create.mockResolvedValue({ id: 'l2', postId: 'p2', userId: mockUser.id })
    mockPrisma.post.findUnique.mockResolvedValue({ id: 'p2', userId: 'other-user-2' })
    mockPrisma.notification.create.mockResolvedValue({})

    mockRecordLikeReceived.mockRejectedValueOnce('string-error')

    const { togglePostLike } = await importModule()
    const result = await togglePostLike('p2')

    expect(result).toEqual({ success: true, data: { liked: true } })
  })
})
