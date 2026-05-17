// @vitest-environment node
import { vi } from 'vitest'
/**
 * Extended notification tests
 */

vi.unmock('@/lib/actions/notification')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const mockGetMutedUserIds = vi.fn()
const mockGetExcludedUserIds = vi.fn()
vi.mock('@/lib/actions/filter-helper', () => ({
  getMutedUserIds: (...args: unknown[]) => mockGetMutedUserIds(...args),
  getExcludedUserIds: (...args: unknown[]) => mockGetExcludedUserIds(...args),
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockSendPushNotification = vi.fn()
vi.mock('@/lib/web-push', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  mockCheckUserRateLimit.mockResolvedValue({ success: true })
  mockGetMutedUserIds.mockResolvedValue([])
  mockGetExcludedUserIds.mockResolvedValue([])
  mockSendPushNotification.mockResolvedValue(undefined)
})

// ============================================================
// getNotifications tests
// ============================================================

describe('getNotifications', async () => {
  it('未認証の場合は空配列を返す', async () => {
    mockAuth.mockResolvedValue(null)
    const { getNotifications } = await import('@/lib/actions/notification')
    const result = await getNotifications()
    expect(result.notifications).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('通知一覧を取得できる', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        userId: 'u1',
        actorId: 'u2',
        type: 'like',
        postId: 'p1',
        commentId: null,
        isRead: false,
        createdAt: new Date(),
        actor: { id: 'u2', nickname: 'User2', avatarUrl: null },
        post: { id: 'p1', content: 'Test post' },
        comment: null,
      },
    ])

    const { getNotifications } = await import('@/lib/actions/notification')
    const result = await getNotifications()

    expect(result).toHaveProperty('notifications')
    expect(result.notifications).toHaveLength(1)
    expect(result.notifications[0].type).toBe('like')
  })

  it('ミュートユーザーからの通知を除外する', async () => {
    mockGetMutedUserIds.mockResolvedValue(['u3', 'u4'])
    mockPrisma.notification.findMany.mockResolvedValue([])

    const { getNotifications } = await import('@/lib/actions/notification')
    await getNotifications()

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorId: { notIn: ['u3', 'u4'] },
        }),
      })
    )
  })

  it('カーソルベースページネーション対応', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'n2',
        userId: 'u1',
        actorId: 'u2',
        type: 'comment',
        postId: 'p1',
        commentId: 'c1',
        isRead: false,
        createdAt: new Date(),
        actor: { id: 'u2', nickname: 'User2', avatarUrl: null },
        post: { id: 'p1', content: 'Test' },
        comment: { id: 'c1', content: 'Comment' },
      },
    ])

    const { getNotifications } = await import('@/lib/actions/notification')
    const result = await getNotifications('n1', 10)

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'n1' },
        skip: 1,
        take: 10,
      })
    )
    expect(result.notifications).toBeDefined()
  })

  it('limit件取得した場合nextCursorを返す', async () => {
    const notifications = Array.from({ length: 20 }, (_, i) => ({
      id: `n${i + 1}`,
      userId: 'u1',
      actorId: 'u2',
      type: 'like' as const,
      postId: 'p1',
      commentId: null,
      isRead: false,
      createdAt: new Date(),
      actor: { id: 'u2', nickname: 'User2', avatarUrl: null },
      post: { id: 'p1', content: 'Test' },
      comment: null,
    }))
    mockPrisma.notification.findMany.mockResolvedValue(notifications)

    const { getNotifications } = await import('@/lib/actions/notification')
    const result = await getNotifications(undefined, 20)

    expect(result.nextCursor).toBe('n20')
  })

  it('limit未満の場合nextCursorはundefined', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        userId: 'u1',
        actorId: 'u2',
        type: 'follow',
        postId: null,
        commentId: null,
        isRead: false,
        createdAt: new Date(),
        actor: { id: 'u2', nickname: 'User2', avatarUrl: null },
        post: null,
        comment: null,
      },
    ])

    const { getNotifications } = await import('@/lib/actions/notification')
    const result = await getNotifications(undefined, 20)

    expect(result.nextCursor).toBeUndefined()
  })

  it('空の通知一覧を返せる', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([])

    const { getNotifications } = await import('@/lib/actions/notification')
    const result = await getNotifications()

    expect(result.notifications).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })
})

// ============================================================
// markAsRead tests
// ============================================================

describe('markAsRead', async () => {
  it('認証が必要', async () => {
    mockAuth.mockResolvedValue(null)
    const { markAsRead } = await import('@/lib/actions/notification')
    const result = await markAsRead('n1')
    expect(result).toHaveProperty('error')
    expect(result.error).toBe('認証が必要です')
  })

  it('通知を既読にできる', async () => {
    mockPrisma.notification.update.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      actorId: 'u2',
      type: 'like',
      postId: 'p1',
      commentId: null,
      isRead: true,
      createdAt: new Date(),
    })

    const { markAsRead } = await import('@/lib/actions/notification')
    const result = await markAsRead('n1')

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: {
        id: 'n1',
        userId: 'u1',
      },
      data: { isRead: true },
    })
  })

  it('自分の通知のみ既読にできる', async () => {
    mockPrisma.notification.update.mockResolvedValue({
      id: 'n1',
      userId: 'u1',
      actorId: 'u2',
      type: 'like',
      postId: 'p1',
      commentId: null,
      isRead: true,
      createdAt: new Date(),
    })

    const { markAsRead } = await import('@/lib/actions/notification')
    await markAsRead('n1')

    expect(mockPrisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'u1' }),
      })
    )
  })

  it('DB更新エラー時にエラーメッセージを返す', async () => {
    mockPrisma.notification.update.mockRejectedValue(new Error('DB connection failed'))

    const { markAsRead } = await import('@/lib/actions/notification')
    const result = await markAsRead('n1')

    expect(result).toHaveProperty('error')
  })
})

// ============================================================
// markAllAsRead tests
// ============================================================

describe('markAllAsRead', async () => {
  it('認証が必要', async () => {
    mockAuth.mockResolvedValue(null)
    const { markAllAsRead } = await import('@/lib/actions/notification')
    const result = await markAllAsRead()
    expect(result).toHaveProperty('error')
    expect(result.error).toBe('認証が必要です')
  })

  it('全ての未読通知を既読にできる', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 5 })

    const { markAllAsRead } = await import('@/lib/actions/notification')
    const result = await markAllAsRead()

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'u1',
        isRead: false,
      },
      data: { isRead: true },
    })
  })

  it('未読通知がゼロでも成功する', async () => {
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 0 })

    const { markAllAsRead } = await import('@/lib/actions/notification')
    const result = await markAllAsRead()

    expect(result).toEqual({ success: true })
  })

  it('DB更新エラー時にエラーメッセージを返す', async () => {
    mockPrisma.notification.updateMany.mockRejectedValue(new Error('DB connection failed'))

    const { markAllAsRead } = await import('@/lib/actions/notification')
    const result = await markAllAsRead()

    expect(result).toHaveProperty('error')
  })
})

// ============================================================
// getUnreadCount tests
// ============================================================

describe('getUnreadCount', async () => {
  it('未ログイン時は0を返す', async () => {
    mockAuth.mockResolvedValue(null)
    const { getUnreadCount } = await import('@/lib/actions/notification')
    const result = await getUnreadCount()
    expect(result.count).toBe(0)
  })

  it('未読通知件数を返す', async () => {
    mockPrisma.notification.count.mockResolvedValue(3)

    const { getUnreadCount } = await import('@/lib/actions/notification')
    const result = await getUnreadCount()

    expect(result.count).toBe(3)
    expect(mockPrisma.notification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'u1',
          isRead: false,
        }),
      })
    )
  })

  it('ミュートユーザーからの通知を除外する', async () => {
    mockGetMutedUserIds.mockResolvedValue(['u2', 'u3'])
    mockPrisma.notification.count.mockResolvedValue(5)

    const { getUnreadCount } = await import('@/lib/actions/notification')
    await getUnreadCount()

    expect(mockPrisma.notification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorId: { notIn: ['u2', 'u3'] },
        }),
      })
    )
  })

  it('ミュートユーザーがいない場合も正常動作', async () => {
    mockGetMutedUserIds.mockResolvedValue([])
    mockPrisma.notification.count.mockResolvedValue(2)

    const { getUnreadCount } = await import('@/lib/actions/notification')
    const result = await getUnreadCount()

    expect(result.count).toBe(2)
  })
})

// ============================================================
// createNotification tests
// ============================================================

describe('createNotification', async () => {
  it('自分自身への通知は作成しない', async () => {
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u1',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('ブロック関係がある場合は通知を作成しない(自分がブロック)', async () => {
    // 新実装は prisma.block.findFirst を直接使う
    mockPrisma.block.findFirst.mockResolvedValueOnce({ blockerId: 'u2' })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('ブロック関係がある場合は通知を作成しない(相手がブロック)', async () => {
    mockPrisma.block.findFirst.mockResolvedValueOnce({ blockerId: 'u1' })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'comment',
      postId: 'p1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('通知設定でOFFの場合は作成しない', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      notificationPreferences: { like: false },
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('同じ通知が既に存在する場合は作成しない', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      notificationPreferences: {},
    })
    mockPrisma.notification.findFirst.mockResolvedValue({
      id: 'n1',
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('いいね通知を作成できる', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      notificationPreferences: {},
    })
    mockPrisma.notification.findFirst.mockResolvedValue(null)
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n1',
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'u2',
        actorId: 'u1',
        type: 'like',
        postId: 'p1',
        commentId: undefined,
      },
    })
  })

  it('コメント通知を作成できる', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      notificationPreferences: {},
    })
    mockPrisma.notification.findFirst.mockResolvedValue(null)
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n2',
      userId: 'u2',
      actorId: 'u1',
      type: 'comment',
      postId: 'p1',
      commentId: 'c1',
      isRead: false,
      createdAt: new Date(),
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'comment',
      postId: 'p1',
      commentId: 'c1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).toHaveBeenCalled()
  })

  it('フォロー通知を作成できる', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      notificationPreferences: {},
    })
    mockPrisma.notification.findFirst.mockResolvedValue(null)
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n3',
      userId: 'u2',
      actorId: 'u1',
      type: 'follow',
      postId: null,
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'follow',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).toHaveBeenCalled()
  })

  it('引用投稿通知を作成できる', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      notificationPreferences: {},
    })
    mockPrisma.notification.findFirst.mockResolvedValue(null)
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n4',
      userId: 'u2',
      actorId: 'u1',
      type: 'quote',
      postId: 'p1',
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'quote',
      postId: 'p1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).toHaveBeenCalled()
  })

  it('返信通知を作成できる', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      notificationPreferences: {},
    })
    mockPrisma.notification.findFirst.mockResolvedValue(null)
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n5',
      userId: 'u2',
      actorId: 'u1',
      type: 'reply',
      postId: 'p1',
      commentId: 'c2',
      isRead: false,
      createdAt: new Date(),
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'reply',
      postId: 'p1',
      commentId: 'c2',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).toHaveBeenCalled()
  })

  it('プッシュ通知送信失敗時もアプリ内通知は成功する', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u2',
        notificationPreferences: {},
      })
      .mockResolvedValueOnce({
        nickname: 'テストアクター',
      })
    mockPrisma.notification.findFirst.mockResolvedValue(null)
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n-push',
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    })
    mockSendPushNotification.mockRejectedValue(new Error('Push failed'))

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
    })

    // プッシュ通知が失敗してもアプリ内通知は成功する
    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).toHaveBeenCalled()
  })

  it('postIdなしの通知はURLが/notificationsになる', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u2',
        notificationPreferences: {},
      })
      .mockResolvedValueOnce({
        nickname: 'フォロワー',
      })
    mockPrisma.notification.findFirst.mockResolvedValue(null)
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n-follow',
      userId: 'u2',
      actorId: 'u1',
      type: 'follow',
      postId: null,
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'follow',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        data: { url: '/notifications' },
      })
    )
  })

  it('actorのnicknameがない場合はデフォルト名を使う', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({
        id: 'u2',
        notificationPreferences: {},
      })
      .mockResolvedValueOnce(null) // actor not found
    mockPrisma.notification.findFirst.mockResolvedValue(null)
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n-no-actor',
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
      commentId: null,
      isRead: false,
      createdAt: new Date(),
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        body: expect.stringContaining('ユーザー'),
      })
    )
  })

  it('コメントいいね通知を作成できる', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u2',
      notificationPreferences: {},
    })
    mockPrisma.notification.findFirst.mockResolvedValue(null)
    mockPrisma.notification.create.mockResolvedValue({
      id: 'n6',
      userId: 'u2',
      actorId: 'u1',
      type: 'comment_like',
      postId: null,
      commentId: 'c1',
      isRead: false,
      createdAt: new Date(),
    })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'comment_like',
      commentId: 'c1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.create).toHaveBeenCalled()
  })
})

// ============================================================
// deleteNotification tests
// ============================================================

describe('deleteNotification', async () => {
  it('指定条件の通知を削除できる', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 })

    const { deleteNotification } = await import('@/lib/services/notification-core')
    const result = await deleteNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'u2',
        actorId: 'u1',
        type: 'like',
        postId: 'p1',
        commentId: null,
      },
    })
  })

  it('コメント通知を削除できる', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 })

    const { deleteNotification } = await import('@/lib/services/notification-core')
    const result = await deleteNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'comment',
      postId: 'p1',
      commentId: 'c1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'u2',
        actorId: 'u1',
        type: 'comment',
        postId: 'p1',
        commentId: 'c1',
      },
    })
  })

  it('該当する通知がない場合もエラーにならない', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 0 })

    const { deleteNotification } = await import('@/lib/services/notification-core')
    const result = await deleteNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'follow',
    })

    expect(result).toEqual({ success: true })
  })

  it('commentIdを指定して削除できる', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 })

    const { deleteNotification } = await import('@/lib/services/notification-core')
    const result = await deleteNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'comment_like',
      commentId: 'c1',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'u2',
        actorId: 'u1',
        type: 'comment_like',
        postId: null,
        commentId: 'c1',
      },
    })
  })

  it('フォロー通知を削除できる', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 })

    const { deleteNotification } = await import('@/lib/services/notification-core')
    const result = await deleteNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'follow',
    })

    expect(result).toEqual({ success: true })
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'follow',
          postId: null,
          commentId: null,
        }),
      })
    )
  })
})
