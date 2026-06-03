// @vitest-environment node

/**
 * like.ts 通知耐障害テスト
 *
 * 通知失敗時もいいね操作自体は成功することを確認
 * void createNotification(...).catch() パターンの検証
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

vi.mock('@/lib/services/analytics-recording', () => ({
  recordLikeReceivedService: vi.fn().mockRejectedValue(new Error('Analytics service down')),
}))

const mockCreateNotification = vi.fn()
const mockDeleteNotification = vi.fn()
vi.mock('@/lib/actions/notification', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotification(...args),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  deleteNotification: (...args: unknown[]) => mockDeleteNotification(...args),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

const importModule = () => import('@/lib/actions/like')

describe('Like Notification Resilience Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    // isPublic は投稿著者の閲覧可否判定で参照される（自ユーザーの停止チェックとも共用）
    mockPrisma.user.findUnique.mockResolvedValue({ isPublic: true, isSuspended: false, isGuest: false, email: 'test@example.com' })
    mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id', isHidden: false })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
  })

  describe('togglePostLike - 通知失敗時の耐障害性', () => {
    it('通知サービスがエラーでもいいね追加は成功する', async () => {
      // 投稿は別ユーザーのもの
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id' })
      // いいね未実施
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({ id: 'like-1' })
      // トランザクション
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockPrisma))
      // 通知がエラーを投げる
      mockCreateNotification.mockRejectedValue(new Error('Notification service down'))

      const { togglePostLike } = await importModule()
      const result = await togglePostLike(mockPost.id)

      // いいね自体は成功
      expect(result).toMatchObject({ success: true, data: { liked: true } })
    })

    it('通知サービスがエラーでもいいね解除は成功する', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other-user-id' })
      // 既にいいね済み
      mockPrisma.like.findFirst.mockResolvedValue({ id: 'existing-like' })
      mockPrisma.like.delete.mockResolvedValue({ id: 'existing-like' })
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockPrisma))
      // 通知削除がエラー
      mockDeleteNotification.mockRejectedValue(new Error('Notification service down'))

      const { togglePostLike } = await importModule()
      const result = await togglePostLike(mockPost.id)

      expect(result).toMatchObject({ success: true, data: { liked: false } })
    })
  })

  describe('toggleCommentLike - 通知失敗時の耐障害性', () => {
    it('通知サービスがエラーでもコメントいいねは成功する', async () => {
      mockPrisma.like.findFirst.mockResolvedValue(null)
      mockPrisma.like.create.mockResolvedValue({ id: 'like-1' })
      mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockPrisma))
      // コメント取得
      mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', userId: 'other-user-id' })
      // 通知エラー
      mockCreateNotification.mockRejectedValue(new Error('Notification failed'))

      const { toggleCommentLike } = await importModule()
      const result = await toggleCommentLike('comment-1', 'post-1')

      expect(result).toMatchObject({ success: true, data: { liked: true } })
    })
  })

  describe('togglePostLike - レート制限', () => {
    it('レート制限超過時にエラーを返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: 0 })

      const { togglePostLike } = await importModule()
      const result = await togglePostLike(mockPost.id)

      expect(result).toMatchObject({ success: false })
    })
  })
})
