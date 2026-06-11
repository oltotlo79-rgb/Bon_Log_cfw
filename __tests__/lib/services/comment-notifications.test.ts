// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// 通知作成は createNotification / createNotificationsBulk へ delegate しているため、
// このテストではサービス側の参加者抽出・フィルタリングロジックに集中する。
const mockCreateNotification = vi.fn()
const mockCreateNotificationsBulk = vi.fn()

vi.mock('@/lib/actions/notification', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

vi.mock('@/lib/services/notification-bulk', () => ({
  createNotificationsBulk: (...args: unknown[]) => mockCreateNotificationsBulk(...args),
}))

describe('comment-notifications service', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateNotification.mockResolvedValue({ success: true })
    mockCreateNotificationsBulk.mockResolvedValue({ attempted: 0, filtered: 0 })
  })

  describe('notifyCommentParticipants', async () => {
    // ============================================================
    // 新規コメント（parentId なし）
    // ============================================================
    it('新規コメント: 投稿オーナーに createNotification を呼ぶ', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'post-owner' })

      const { notifyCommentParticipants } = await import('@/lib/services/comment-notifications')
      await notifyCommentParticipants('post-1', 'comment-1', 'actor-1', null)

      expect(mockCreateNotification).toHaveBeenCalledWith({
        userId: 'post-owner',
        actorId: 'actor-1',
        type: 'comment',
        postId: 'post-1',
        commentId: 'comment-1',
      })
    })

    it('新規コメント: アクターが投稿オーナーの場合は通知しない', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'actor-1' })

      const { notifyCommentParticipants } = await import('@/lib/services/comment-notifications')
      await notifyCommentParticipants('post-1', 'comment-1', 'actor-1', null)

      expect(mockCreateNotification).not.toHaveBeenCalled()
    })

    it('新規コメント: 投稿が見つからない場合は通知しない', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { notifyCommentParticipants } = await import('@/lib/services/comment-notifications')
      await notifyCommentParticipants('post-1', 'comment-1', 'actor-1', null)

      expect(mockCreateNotification).not.toHaveBeenCalled()
    })

    // ============================================================
    // 返信（parentId あり）
    // ============================================================
    it('返信: スレッド参加者に createNotificationsBulk を呼ぶ', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'parent-comment', user_id: 'parent-author', parent_id: null },
      ])
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'post-owner' })
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([])

      const { notifyCommentParticipants } = await import('@/lib/services/comment-notifications')
      await notifyCommentParticipants('post-1', 'comment-2', 'actor-1', 'parent-comment')

      expect(mockCreateNotificationsBulk).toHaveBeenCalledTimes(1)
      const callArg = mockCreateNotificationsBulk.mock.calls[0]![0]!
      expect(callArg.type).toBe('reply')
      expect(callArg.actorId).toBe('actor-1')
      expect(callArg.postId).toBe('post-1')
      expect(callArg.commentId).toBe('comment-2')
      expect(callArg.recipientIds).toEqual(expect.arrayContaining(['parent-author', 'post-owner']))
    })

    it('返信: アクター自身は recipientIds から除外される', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'parent-comment', user_id: 'actor-1', parent_id: null },
      ])
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'post-owner' })
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([])

      const { notifyCommentParticipants } = await import('@/lib/services/comment-notifications')
      await notifyCommentParticipants('post-1', 'comment-2', 'actor-1', 'parent-comment')

      const callArg = mockCreateNotificationsBulk.mock.calls[0]![0]!
      expect(callArg.recipientIds).not.toContain('actor-1')
    })

    it('返信: ミュートしたスレッドのユーザーは recipientIds から除外される', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([
        { id: 'parent-comment', user_id: 'participant-1', parent_id: null },
      ])
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'post-owner' })
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([
        { userId: 'participant-1' },
      ])

      const { notifyCommentParticipants } = await import('@/lib/services/comment-notifications')
      await notifyCommentParticipants('post-1', 'comment-2', 'actor-1', 'parent-comment')

      const callArg = mockCreateNotificationsBulk.mock.calls[0]![0]!
      expect(callArg.recipientIds).not.toContain('participant-1')
    })

    it('返信: CTE失敗時はエラーをスローせず空リストにフォールバックする', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('CTE query failed'))
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'post-owner' })
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([])

      const { notifyCommentParticipants } = await import('@/lib/services/comment-notifications')

      // エラーがスローされないことを確認（fire-and-forget）
      await expect(
        notifyCommentParticipants('post-1', 'comment-2', 'actor-1', 'parent-comment')
      ).resolves.not.toThrow()
    })

    it('参加者がいない場合は createNotificationsBulk を呼ばない', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([])
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'actor-1' })
      mockPrisma.commentThreadMute.findMany.mockResolvedValue([])

      const { notifyCommentParticipants } = await import('@/lib/services/comment-notifications')
      await notifyCommentParticipants('post-1', 'comment-2', 'actor-1', 'parent-comment')

      expect(mockCreateNotificationsBulk).not.toHaveBeenCalled()
    })
  })
})
