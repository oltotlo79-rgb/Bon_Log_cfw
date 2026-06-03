// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockNotification, mockPost } from '../../utils/test-utils'

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

// フィルターヘルパーモック
const mockGetMutedUserIds = vi.fn()
const mockGetExcludedUserIds = vi.fn()
vi.mock('@/lib/actions/filter-helper', () => ({
  getMutedUserIds: mockGetMutedUserIds,
  getExcludedUserIds: (...args: unknown[]) => mockGetExcludedUserIds(...args),
}))

describe('Notification Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockGetMutedUserIds.mockResolvedValue([])
    mockGetExcludedUserIds.mockResolvedValue([])
  })

  // ============================================================
  // getNotifications
  // ============================================================

  describe('getNotifications', async () => {
    it('通知一覧を取得できる', async () => {
      const mockNotifications = [
        {
          ...mockNotification,
          actor: {
            id: 'other-user-id',
            nickname: '他のユーザー',
            avatarUrl: '/avatar.jpg',
          },
          post: { id: mockPost.id, content: 'テスト投稿' },
          comment: null,
        },
      ]
      mockPrisma.notification.findMany.mockResolvedValueOnce(mockNotifications)

      const { getNotifications } = await import('@/lib/actions/notification')
      const result = await getNotifications()

      expect(result.notifications).toHaveLength(1)
      expect(result.notifications[0].actor.nickname).toBe('他のユーザー')
    })

    it('未認証の場合、空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getNotifications } = await import('@/lib/actions/notification')
      const result = await getNotifications()

      expect(result).toEqual({
        notifications: [],
        nextCursor: undefined,
      })
    })

    it('ミュートユーザーからの通知を除外する', async () => {
      mockGetMutedUserIds.mockResolvedValueOnce(['muted-user-id'])
      mockPrisma.notification.findMany.mockResolvedValueOnce([])

      const { getNotifications } = await import('@/lib/actions/notification')
      await getNotifications()

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actorId: { notIn: ['muted-user-id'] },
          }),
        })
      )
    })

    it('カーソル付きで取得できる', async () => {
      mockPrisma.notification.findMany.mockResolvedValueOnce([])

      const { getNotifications } = await import('@/lib/actions/notification')
      await getNotifications('cursor-id', 10)

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-id' },
          skip: 1,
          take: 10,
        })
      )
    })

    it('過大な limit は MAX_PAGE_LIMIT に clamp する', async () => {
      mockPrisma.notification.findMany.mockResolvedValueOnce([])

      const { getNotifications } = await import('@/lib/actions/notification')
      await getNotifications(undefined, 1_000_000)

      expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      )
    })
  })

  // ============================================================
  // markAsRead
  // ============================================================

  describe('markAsRead', async () => {
    it('通知を既読にできる', async () => {
      mockPrisma.notification.update.mockResolvedValueOnce({
        ...mockNotification,
        isRead: true,
      })

      const { markAsRead } = await import('@/lib/actions/notification')
      const result = await markAsRead('notification-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.update).toHaveBeenCalledWith({
        where: {
          id: 'notification-1',
          userId: mockUser.id,
        },
        data: { isRead: true },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { markAsRead } = await import('@/lib/actions/notification')
      const result = await markAsRead('notification-1')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // markAllAsRead
  // ============================================================

  describe('markAllAsRead', async () => {
    it('全ての通知を既読にできる', async () => {
      mockPrisma.notification.updateMany.mockResolvedValueOnce({ count: 5 })

      const { markAllAsRead } = await import('@/lib/actions/notification')
      const result = await markAllAsRead()

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          isRead: false,
        },
        data: { isRead: true },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { markAllAsRead } = await import('@/lib/actions/notification')
      const result = await markAllAsRead()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })
  })

  // ============================================================
  // getUnreadCount
  // ============================================================

  describe('getUnreadCount', async () => {
    it('未読通知の件数を取得できる', async () => {
      mockPrisma.notification.count.mockResolvedValueOnce(5)

      const { getUnreadCount } = await import('@/lib/actions/notification')
      const result = await getUnreadCount()

      expect(result).toEqual({ count: 5 })
    })

    it('未認証の場合、0を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getUnreadCount } = await import('@/lib/actions/notification')
      const result = await getUnreadCount()

      expect(result).toEqual({ count: 0 })
    })

    it('ミュートユーザーからの通知をカウントしない', async () => {
      mockGetMutedUserIds.mockResolvedValueOnce(['muted-user-id'])
      mockPrisma.notification.count.mockResolvedValueOnce(3)

      const { getUnreadCount } = await import('@/lib/actions/notification')
      await getUnreadCount()

      expect(mockPrisma.notification.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            actorId: { notIn: ['muted-user-id'] },
          }),
        })
      )
    })
  })

  // ============================================================
  // createNotification
  // ============================================================

  describe('createNotification', async () => {
    it('通知を作成できる', async () => {
      mockPrisma.block.findFirst.mockResolvedValueOnce(null) // ブロックなし
      mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: {} }) // 設定なし
      mockPrisma.notification.findFirst.mockResolvedValueOnce(null) // 重複なし
      mockPrisma.notification.create.mockResolvedValueOnce(mockNotification)

      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await createNotification({
        userId: 'other-user-id',
        actorId: mockUser.id,
        type: 'like',
        postId: mockPost.id,
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('自分自身への通知は作成しない', async () => {
      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await createNotification({
        userId: mockUser.id,
        actorId: mockUser.id,
        type: 'like',
        postId: mockPost.id,
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('ブロック関係がある場合は通知を作成しない', async () => {
      // 新実装では getExcludedUserIds ではなく prisma.block.findFirst で判定するため
      // ブロック行が存在するモックを返す。
      mockPrisma.block.findFirst.mockResolvedValueOnce({ blockerId: mockUser.id })

      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await createNotification({
        userId: 'other-user-id',
        actorId: mockUser.id,
        type: 'like',
        postId: mockPost.id,
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('通知設定でOFFの場合は通知を作成しない', async () => {
      mockPrisma.block.findFirst.mockResolvedValueOnce(null) // ブロックなし
      mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: { like: false } })

      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await createNotification({
        userId: 'other-user-id',
        actorId: mockUser.id,
        type: 'like',
        postId: mockPost.id,
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('通知設定でONの場合は通知を作成する', async () => {
      mockPrisma.block.findFirst.mockResolvedValueOnce(null)
      mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: { like: true } })
      mockPrisma.notification.findFirst.mockResolvedValueOnce(null)
      mockPrisma.notification.create.mockResolvedValueOnce(mockNotification)

      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await createNotification({
        userId: 'other-user-id',
        actorId: mockUser.id,
        type: 'like',
        postId: mockPost.id,
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('通知設定が未設定の場合は通知を作成する（デフォルトON）', async () => {
      mockPrisma.block.findFirst.mockResolvedValueOnce(null)
      mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: null })
      mockPrisma.notification.findFirst.mockResolvedValueOnce(null)
      mockPrisma.notification.create.mockResolvedValueOnce(mockNotification)

      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await createNotification({
        userId: 'other-user-id',
        actorId: mockUser.id,
        type: 'like',
        postId: mockPost.id,
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })

    it('重複する通知は作成しない', async () => {
      mockPrisma.block.findFirst.mockResolvedValueOnce(null)
      mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: {} })
      mockPrisma.notification.findFirst.mockResolvedValueOnce(mockNotification) // 既存あり

      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await createNotification({
        userId: 'other-user-id',
        actorId: mockUser.id,
        type: 'like',
        postId: mockPost.id,
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('バリデーション失敗時は actionError を返す（旧実装はサイレント成功）', async () => {
      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await createNotification({
        userId: '',
        actorId: mockUser.id,
        // @ts-expect-error: 型レベルで弾かれる不正値だがランタイム検証を確認
        type: 'invalid-type',
      })

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeTruthy()
      }
      expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    })

    it('system 通知は actor が userId 自身でも作成できる（ブロック判定をスキップ）', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: {} })
      mockPrisma.notification.findFirst.mockResolvedValueOnce(null)
      mockPrisma.notification.create.mockResolvedValueOnce(mockNotification)

      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await createNotification({
        userId: mockUser.id,
        actorId: mockUser.id,
        type: 'system',
      })

      expect(result).toEqual({ success: true })
      expect(mockGetExcludedUserIds).not.toHaveBeenCalled()
      expect(mockPrisma.notification.create).toHaveBeenCalled()
    })
  })

  // ============================================================
  // deleteNotification
  // ============================================================

  describe('deleteNotification', async () => {
    it('通知を削除できる', async () => {
      mockPrisma.notification.deleteMany.mockResolvedValueOnce({ count: 1 })

      const { deleteNotification } = await import('@/lib/services/notification-core')
      const result = await deleteNotification({
        userId: 'other-user-id',
        actorId: mockUser.id,
        type: 'like',
        postId: mockPost.id,
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: 'other-user-id',
          actorId: mockUser.id,
          type: 'like',
          postId: mockPost.id,
          commentId: null,
        },
      })
    })
  })
})
