// @vitest-environment node

import { vi } from 'vitest'
import {
  createMockPrismaClient,
  mockUser,
  mockPost,
  mockAdminUser,
  mockAdminNotification,
} from '../../utils/test-utils'

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

describe('Admin Hidden Content Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
  })

  describe('getHiddenContent', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('非表示コンテンツ一覧を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.post.findMany.mockResolvedValue([
        {
          ...mockPost,
          isHidden: true,
          hiddenAt: new Date(),
          user: { id: mockUser.id, nickname: 'テスト', avatarUrl: null },
        },
      ])
      mockPrisma.comment.findMany.mockResolvedValue([])
      mockPrisma.event.findMany.mockResolvedValue([])
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
      mockPrisma.shopReview.findMany.mockResolvedValue([])
      mockPrisma.report.groupBy.mockResolvedValue([
        { targetType: 'post', targetId: mockPost.id, _count: 10 },
      ])

      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent()

      expect(('items' in result ? result.items : undefined)).toBeDefined()
      expect(('items' in result ? result.items : undefined)).toHaveLength(1)
      expect(('items' in result ? result.items : undefined)![0]!.type).toBe('post')
    })

    it('タイプでフィルタリングできる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.post.findMany.mockResolvedValue([])
      mockPrisma.report.groupBy.mockResolvedValue([])

      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      await getHiddenContent({ type: 'post' })

      expect(mockPrisma.post.findMany).toHaveBeenCalled()
      expect(mockPrisma.comment.findMany).not.toHaveBeenCalled()
    })
  })

  describe('restoreContent', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('post', 'test-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('post', 'test-id')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('投稿を再表示できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.post.update.mockResolvedValue(mockPost)
      mockPrisma.report.updateMany.mockResolvedValue({ count: 5 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('post', 'test-post-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'test-post-id' },
        data: { isHidden: false, hiddenAt: null },
      })
    })

    it('コメントを再表示できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.comment.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 5 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('comment', 'test-comment-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.comment.update).toHaveBeenCalled()
    })

    it('イベントを再表示できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.event.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 5 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('event', 'test-event-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.event.update).toHaveBeenCalled()
    })

    it('盆栽園を再表示できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.bonsaiShop.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 5 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('shop', 'test-shop-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.bonsaiShop.update).toHaveBeenCalled()
    })

    it('レビューを再表示できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.shopReview.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 5 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('review', 'test-review-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.shopReview.update).toHaveBeenCalled()
    })
  })

  describe('deleteHiddenContent', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('post', 'test-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('post', 'test-id')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('投稿を完全に削除できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.post.delete.mockResolvedValue(mockPost)
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 5 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('post', 'test-post-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({
        where: { id: 'test-post-id' },
      })
    })

    it('コメントを完全に削除できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.comment.delete.mockResolvedValue({})
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 5 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('comment', 'test-comment-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.comment.delete).toHaveBeenCalled()
    })
  })

  describe('getAdminNotifications', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      const result = await getAdminNotifications()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      const result = await getAdminNotifications()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('管理者通知一覧を取得できる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.adminNotification.findMany.mockResolvedValue([mockAdminNotification])
      mockPrisma.adminNotification.count.mockResolvedValue(1)

      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      const result = await getAdminNotifications()

      expect(('notifications' in result ? result.notifications : undefined)).toHaveLength(1)
      expect(('unreadCount' in result ? result.unreadCount : undefined)).toBe(1)
    })

    it('未読のみフィルタリングできる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.adminNotification.findMany.mockResolvedValue([])
      mockPrisma.adminNotification.count.mockResolvedValue(0)

      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      await getAdminNotifications({ unreadOnly: true })

      expect(mockPrisma.adminNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isRead: false },
        })
      )
    })
  })

  describe('markAdminNotificationAsRead', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { markAdminNotificationAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAdminNotificationAsRead('notification-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { markAdminNotificationAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAdminNotificationAsRead('notification-id')

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('通知を既読にできる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.adminNotification.update.mockResolvedValue({})

      const { markAdminNotificationAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAdminNotificationAsRead('notification-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.adminNotification.update).toHaveBeenCalledWith({
        where: { id: 'notification-id' },
        data: { isRead: true },
      })
    })
  })

  describe('markAllAdminNotificationsAsRead', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { markAllAdminNotificationsAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAllAdminNotificationsAsRead()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('全ての通知を既読にできる', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 5 })

      const { markAllAdminNotificationsAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAllAdminNotificationsAsRead()

      expect(result).toEqual({ success: true })
      expect(mockPrisma.adminNotification.updateMany).toHaveBeenCalledWith({
        where: { isRead: false },
        data: { isRead: true },
      })
    })
  })
})
