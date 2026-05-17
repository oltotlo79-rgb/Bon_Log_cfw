// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

// ============================================================================
// モックのセットアップ
// ============================================================================

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

const mockLogger = { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: mockLogger,
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
  cache: vi.fn((fn: unknown) => fn),
}))

// ============================================================================
// テストスイート
// ============================================================================

describe('Analytics Recording Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: 'test-user-id', name: 'Test User', email: 'test@example.com' },
    })
    mockPrisma.userAnalytics.upsert.mockResolvedValue({})
  })

  // ==========================================================================
  // recordProfileView
  // ==========================================================================
  describe('recordProfileView', () => {
    it('未認証の場合はDBを呼ばず success を返す（fire-and-forget の no-op）', async () => {
      mockAuth.mockResolvedValue(null)

      const { recordProfileView } = await import('@/lib/actions/analytics-recording')
      const result = await recordProfileView('target-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.userAnalytics.upsert).not.toHaveBeenCalled()
    })

    it('userIdが空文字の場合はDBを呼ばず actionError を返す', async () => {
      const { recordProfileView } = await import('@/lib/actions/analytics-recording')
      const result = await recordProfileView('')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.userAnalytics.upsert).not.toHaveBeenCalled()
    })

    it('認証済みかつ有効なuserIdの場合はupsertで記録する', async () => {
      const { recordProfileView } = await import('@/lib/actions/analytics-recording')
      const result = await recordProfileView('target-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.userAnalytics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_date: { userId: 'target-user-id', date: expect.any(Date) } },
          update: { profileViews: { increment: 1 } },
          create: expect.objectContaining({ userId: 'target-user-id', profileViews: 1 }),
        })
      )
    })

    it('DBエラー発生時はlogger.errorを呼び actionError を返す（スローしない）', async () => {
      mockPrisma.userAnalytics.upsert.mockRejectedValue(new Error('DB connection lost'))

      const { recordProfileView } = await import('@/lib/actions/analytics-recording')
      const result = await recordProfileView('target-user-id')

      expect(result).toMatchObject({ success: false })
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Record profile view error:',
        expect.any(Error)
      )
    })
  })

  // ==========================================================================
  // recordPostView
  // ==========================================================================
  describe('recordPostView', () => {
    it('未認証の場合はDBを呼ばず success を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { recordPostView } = await import('@/lib/actions/analytics-recording')
      const result = await recordPostView('target-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.userAnalytics.upsert).not.toHaveBeenCalled()
    })

    it('userIdが空文字の場合はDBを呼ばず actionError を返す', async () => {
      const { recordPostView } = await import('@/lib/actions/analytics-recording')
      const result = await recordPostView('')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.userAnalytics.upsert).not.toHaveBeenCalled()
    })

    it('認証済みかつ有効なuserIdの場合はupsertで記録する', async () => {
      const { recordPostView } = await import('@/lib/actions/analytics-recording')
      const result = await recordPostView('target-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.userAnalytics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { postViews: { increment: 1 } },
          create: expect.objectContaining({ userId: 'target-user-id', postViews: 1 }),
        })
      )
    })

    it('DBエラー発生時はlogger.errorを呼び actionError を返す（スローしない）', async () => {
      mockPrisma.userAnalytics.upsert.mockRejectedValue(new Error('DB timeout'))

      const { recordPostView } = await import('@/lib/actions/analytics-recording')
      const result = await recordPostView('target-user-id')

      expect(result).toMatchObject({ success: false })
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Record post view error:',
        expect.any(Error)
      )
    })
  })

  // ==========================================================================
  // recordLikeReceived
  // ==========================================================================
  describe('recordLikeReceived', () => {
    it('未認証の場合はDBを呼ばず success を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { recordLikeReceived } = await import('@/lib/actions/analytics-recording')
      const result = await recordLikeReceived('target-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.userAnalytics.upsert).not.toHaveBeenCalled()
    })

    it('userIdが空文字の場合はDBを呼ばず actionError を返す', async () => {
      const { recordLikeReceived } = await import('@/lib/actions/analytics-recording')
      const result = await recordLikeReceived('')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.userAnalytics.upsert).not.toHaveBeenCalled()
    })

    it('認証済みかつ有効なuserIdの場合はupsertで記録する', async () => {
      const { recordLikeReceived } = await import('@/lib/actions/analytics-recording')
      const result = await recordLikeReceived('target-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.userAnalytics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { likesReceived: { increment: 1 } },
          create: expect.objectContaining({ userId: 'target-user-id', likesReceived: 1 }),
        })
      )
    })

    it('DBエラー発生時はlogger.errorを呼び actionError を返す（スローしない）', async () => {
      mockPrisma.userAnalytics.upsert.mockRejectedValue(new Error('Unique constraint'))

      const { recordLikeReceived } = await import('@/lib/actions/analytics-recording')
      const result = await recordLikeReceived('target-user-id')

      expect(result).toMatchObject({ success: false })
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Record like received error:',
        expect.any(Error)
      )
    })
  })

  // ==========================================================================
  // recordNewFollower
  // ==========================================================================
  describe('recordNewFollower', () => {
    it('未認証の場合はDBを呼ばず success を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { recordNewFollower } = await import('@/lib/actions/analytics-recording')
      const result = await recordNewFollower('target-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.userAnalytics.upsert).not.toHaveBeenCalled()
    })

    it('userIdが空文字の場合はDBを呼ばず actionError を返す', async () => {
      const { recordNewFollower } = await import('@/lib/actions/analytics-recording')
      const result = await recordNewFollower('')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.userAnalytics.upsert).not.toHaveBeenCalled()
    })

    it('認証済みかつ有効なuserIdの場合はupsertで記録する', async () => {
      const { recordNewFollower } = await import('@/lib/actions/analytics-recording')
      const result = await recordNewFollower('target-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.userAnalytics.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { newFollowers: { increment: 1 } },
          create: expect.objectContaining({ userId: 'target-user-id', newFollowers: 1 }),
        })
      )
    })

    it('DBエラー発生時はlogger.errorを呼び actionError を返す（スローしない）', async () => {
      mockPrisma.userAnalytics.upsert.mockRejectedValue(new Error('Connection refused'))

      const { recordNewFollower } = await import('@/lib/actions/analytics-recording')
      const result = await recordNewFollower('target-user-id')

      expect(result).toMatchObject({ success: false })
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Record new follower error:',
        expect.any(Error)
      )
    })
  })
})
