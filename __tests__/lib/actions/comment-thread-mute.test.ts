// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/comment-thread-mute')

import { createMockPrismaClient } from '../../utils/test-utils'

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

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}))

describe('Comment Thread Mute Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'test-user-id' } })
  })

  // ============================================================
  // muteThread
  // ============================================================

  describe('muteThread', async () => {
    it('スレッドをミュートできる', async () => {
      mockPrisma.commentThreadMute.upsert.mockResolvedValueOnce({
        userId: 'test-user-id',
        commentId: 'comment-1',
      })

      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('comment-1')

      expect(result).toEqual({ success: true })
    })

    it('upsertを正しい引数で呼び出す', async () => {
      mockPrisma.commentThreadMute.upsert.mockResolvedValueOnce({})

      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      await muteThread('root-comment-id')

      expect(mockPrisma.commentThreadMute.upsert).toHaveBeenCalledWith({
        where: {
          userId_commentId: {
            userId: 'test-user-id',
            commentId: 'root-comment-id',
          },
        },
        create: {
          userId: 'test-user-id',
          commentId: 'root-comment-id',
        },
        update: {},
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('comment-1')

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('セッションにユーザーIDがない場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: {} })

      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('comment-1')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('DBエラーが発生した場合、エラーを返す', async () => {
      mockPrisma.commentThreadMute.upsert.mockRejectedValueOnce(new Error('Database error'))

      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('comment-1')

      expect(result).toEqual({ success: false, error: 'スレッドのミュートに失敗しました' })
    })

    it('異なるスレッドIDでも正しくミュートできる', async () => {
      mockPrisma.commentThreadMute.upsert.mockResolvedValueOnce({})

      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await muteThread('another-root-comment')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.commentThreadMute.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_commentId: {
              userId: 'test-user-id',
              commentId: 'another-root-comment',
            },
          },
        })
      )
    })

    it('同じスレッドを2回ミュートしても正常に完了する（upsertのため）', async () => {
      mockPrisma.commentThreadMute.upsert.mockResolvedValue({})

      const { muteThread } = await import('@/lib/actions/comment-thread-mute')
      const result1 = await muteThread('comment-1')
      const result2 = await muteThread('comment-1')

      expect(result1).toEqual({ success: true })
      expect(result2).toEqual({ success: true })
      expect(mockPrisma.commentThreadMute.upsert).toHaveBeenCalledTimes(2)
    })
  })

  // ============================================================
  // unmuteThread
  // ============================================================

  describe('unmuteThread', async () => {
    it('スレッドのミュートを解除できる', async () => {
      mockPrisma.commentThreadMute.deleteMany.mockResolvedValueOnce({ count: 1 })

      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('comment-1')

      expect(result).toEqual({ success: true })
    })

    it('deleteManyを正しい引数で呼び出す', async () => {
      mockPrisma.commentThreadMute.deleteMany.mockResolvedValueOnce({ count: 1 })

      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      await unmuteThread('root-comment-id')

      expect(mockPrisma.commentThreadMute.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'test-user-id',
          commentId: 'root-comment-id',
        },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('comment-1')

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('セッションにユーザーIDがない場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce({ user: {} })

      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('comment-1')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('DBエラーが発生した場合、エラーを返す', async () => {
      mockPrisma.commentThreadMute.deleteMany.mockRejectedValueOnce(new Error('Database error'))

      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('comment-1')

      expect(result).toEqual({ success: false, error: 'スレッドのミュート解除に失敗しました' })
    })

    it('ミュートされていないスレッドのミュート解除でも正常に完了する（deleteMany件数0）', async () => {
      mockPrisma.commentThreadMute.deleteMany.mockResolvedValueOnce({ count: 0 })

      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      const result = await unmuteThread('not-muted-comment')

      expect(result).toEqual({ success: true })
    })

    it('異なるユーザーのミュートを解除できる', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'another-user-id' } })
      mockPrisma.commentThreadMute.deleteMany.mockResolvedValueOnce({ count: 1 })

      const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
      await unmuteThread('comment-1')

      expect(mockPrisma.commentThreadMute.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'another-user-id',
          commentId: 'comment-1',
        },
      })
    })
  })

  // ============================================================
  // isThreadMuted
  // ============================================================

  describe('isThreadMuted', async () => {
    it('ミュートされている場合、trueを返す', async () => {
      mockPrisma.commentThreadMute.findUnique.mockResolvedValueOnce({
        userId: 'test-user-id',
        commentId: 'comment-1',
      })

      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      const result = await isThreadMuted('test-user-id', 'comment-1')

      expect(result).toBe(true)
    })

    it('ミュートされていない場合、falseを返す', async () => {
      mockPrisma.commentThreadMute.findUnique.mockResolvedValueOnce(null)

      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      const result = await isThreadMuted('test-user-id', 'comment-1')

      expect(result).toBe(false)
    })

    it('findUniqueを正しい引数で呼び出す', async () => {
      mockPrisma.commentThreadMute.findUnique.mockResolvedValueOnce(null)

      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      await isThreadMuted('user-abc', 'comment-xyz')

      expect(mockPrisma.commentThreadMute.findUnique).toHaveBeenCalledWith({
        where: {
          userId_commentId: {
            userId: 'user-abc',
            commentId: 'comment-xyz',
          },
        },
      })
    })

    it('DBエラーが発生した場合、falseを返す', async () => {
      mockPrisma.commentThreadMute.findUnique.mockRejectedValueOnce(new Error('Database error'))

      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      const result = await isThreadMuted('test-user-id', 'comment-1')

      expect(result).toBe(false)
    })

    it('undefinedが返った場合、falseを返す', async () => {
      mockPrisma.commentThreadMute.findUnique.mockResolvedValueOnce(undefined)

      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      const result = await isThreadMuted('test-user-id', 'nonexistent-comment')

      expect(result).toBe(false)
    })

    it('認証チェックを行わない（userIdを引数で受け取る）', async () => {
      mockPrisma.commentThreadMute.findUnique.mockResolvedValueOnce(null)

      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      // 認証モックをnullに設定してもisThreadMutedはエラーを返さない
      mockAuth.mockResolvedValueOnce(null)
      const result = await isThreadMuted('any-user-id', 'comment-1')

      // isThreadMutedは auth() を呼ばないためnullでもエラーにならない
      expect(typeof result).toBe('boolean')
    })

    it('異なるユーザー・コメントの組み合わせで正確に検索する', async () => {
      mockPrisma.commentThreadMute.findUnique.mockResolvedValueOnce({
        userId: 'user-1',
        commentId: 'comment-A',
      })

      const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
      const result = await isThreadMuted('user-1', 'comment-A')

      expect(result).toBe(true)
    })
  })
})
