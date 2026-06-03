// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/comment-thread-mute')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('@/lib/logger', () => ({ default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }, logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

describe('comment-thread-mute actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  // ============================================================
  // muteThread
  // ============================================================
  describe('muteThread', async () => {
    it('requires auth', async () => {
      mockAuth.mockResolvedValue(null)
      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('comment1')
      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('mutes thread successfully', async () => {
      mockPrisma.commentThreadMute.upsert.mockResolvedValue({})
      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('comment1')
      expect(result).toEqual({ success: true })
      expect(mockPrisma.commentThreadMute.upsert).toHaveBeenCalledWith({
        where: { userId_commentId: { userId: 'u1', commentId: 'comment1' } },
        create: { userId: 'u1', commentId: 'comment1' },
        update: {},
      })
    })

    it('handles db error', async () => {
      mockPrisma.commentThreadMute.upsert.mockRejectedValue(new Error('DB error'))
      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('comment1')
      expect(result).toEqual({ success: false, error: 'スレッドのミュートに失敗しました' })
    })
  })

  // ============================================================
  // unmuteThread
  // ============================================================
  describe('unmuteThread', async () => {
    it('requires auth', async () => {
      mockAuth.mockResolvedValue(null)
      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('comment1')
      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('unmutes thread successfully', async () => {
      mockPrisma.commentThreadMute.deleteMany.mockResolvedValue({ count: 1 })
      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('comment1')
      expect(result).toEqual({ success: true })
      expect(mockPrisma.commentThreadMute.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'u1', commentId: 'comment1' },
      })
    })

    it('handles db error', async () => {
      mockPrisma.commentThreadMute.deleteMany.mockRejectedValue(new Error('DB error'))
      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('comment1')
      expect(result).toEqual({ success: false, error: 'スレッドのミュート解除に失敗しました' })
    })
  })

  // ============================================================
  // isThreadMuted
  // ============================================================
  describe('isThreadMuted', async () => {
    it('returns true when muted', async () => {
      mockPrisma.commentThreadMute.findUnique.mockResolvedValue({ id: 'mute1' })
      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      const result = await isThreadMuted('u1', 'comment1')
      expect(result).toBe(true)
    })

    it('returns false when not muted', async () => {
      mockPrisma.commentThreadMute.findUnique.mockResolvedValue(null)
      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      const result = await isThreadMuted('u1', 'comment1')
      expect(result).toBe(false)
    })

    it('returns false on error', async () => {
      mockPrisma.commentThreadMute.findUnique.mockRejectedValue(new Error('DB error'))
      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      const result = await isThreadMuted('u1', 'comment1')
      expect(result).toBe(false)
    })

    it('returns false for non-existent record', async () => {
      mockPrisma.commentThreadMute.findUnique.mockResolvedValue(undefined)
      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      const result = await isThreadMuted('u2', 'comment99')
      expect(result).toBe(false)
    })
  })

  // ============================================================
  // Zod / レート制限ブランチ
  // ============================================================
  describe('入力検証 + レート制限', async () => {
    it('muteThread: 空文字 ID は ERR_INVALID_INPUT を返し、upsert は呼ばない', async () => {
      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.commentThreadMute.upsert).not.toHaveBeenCalled()
    })

    it('unmuteThread: 空文字 ID は ERR_INVALID_INPUT を返し、deleteMany は呼ばない', async () => {
      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.commentThreadMute.deleteMany).not.toHaveBeenCalled()
    })

    it('muteThread: 上限長を超える ID は ERR_INVALID_INPUT を返す', async () => {
      const tooLong = 'x'.repeat(10000)
      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread(tooLong)

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.commentThreadMute.upsert).not.toHaveBeenCalled()
    })

    it('muteThread: レート制限超過時は upsert を呼ばずエラーを返す', async () => {
      vi.doMock('@/lib/rate-limit', async () => {
        const actual = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit')
        return {
          ...actual,
          checkUserRateLimit: vi.fn().mockResolvedValue({
            success: false,
            remaining: 0,
            resetAt: Date.now() + 60000,
          }),
        }
      })
      vi.resetModules()

      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('comment1')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.commentThreadMute.upsert).not.toHaveBeenCalled()
      vi.doUnmock('@/lib/rate-limit')
    })

    it('unmuteThread: レート制限超過時は deleteMany を呼ばずエラーを返す', async () => {
      vi.doMock('@/lib/rate-limit', async () => {
        const actual = await vi.importActual<typeof import('@/lib/rate-limit')>('@/lib/rate-limit')
        return {
          ...actual,
          checkUserRateLimit: vi.fn().mockResolvedValue({
            success: false,
            remaining: 0,
            resetAt: Date.now() + 60000,
          }),
        }
      })
      vi.resetModules()

      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('comment1')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.commentThreadMute.deleteMany).not.toHaveBeenCalled()
      vi.doUnmock('@/lib/rate-limit')
    })
  })
})
