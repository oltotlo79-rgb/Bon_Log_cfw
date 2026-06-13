// @vitest-environment node
/**
 * lib/services/notification-read-service のユニットテスト
 *
 * markNotificationsRead の userId 境界（他ユーザー通知を更新しない）・
 * ids 指定 vs 全件、fetchUnreadNotificationCount のミュートフィルタを検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = {
  notification: {
    updateMany: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  mute: {
    findMany: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockGetMutedUserIds = vi.fn()
vi.mock('@/lib/actions/filter-helper', () => ({
  getMutedUserIds: (...args: unknown[]) => mockGetMutedUserIds(...args),
}))

const mockNormalizeCursorPagination = vi.fn()
vi.mock('@/lib/actions/pagination', () => ({
  normalizeCursorPagination: (...args: unknown[]) => mockNormalizeCursorPagination(...args),
}))

describe('markNotificationsRead', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.notification.updateMany.mockResolvedValue({ count: 2 })
  })

  it('ids 指定 → updateMany の where に id: { in: ids } と userId が含まれる', async () => {
    const { markNotificationsRead } = await import('@/lib/services/notification-read-service')
    const ids = ['notif-1', 'notif-2']
    await markNotificationsRead('user-1', ids)

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ids }, userId: 'user-1' },
      data: { isRead: true },
    })
  })

  it('ids 省略 → updateMany の where に { userId, isRead: false } が含まれ全件既読化', async () => {
    const { markNotificationsRead } = await import('@/lib/services/notification-read-service')
    await markNotificationsRead('user-1', undefined)

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
      data: { isRead: true },
    })
  })

  it('空配列 ids → ids 省略と同じく全件既読化（空配列では分岐が ids.length > 0 を通らない）', async () => {
    const { markNotificationsRead } = await import('@/lib/services/notification-read-service')
    await markNotificationsRead('user-1', [])

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
      data: { isRead: true },
    })
  })

  it('他ユーザーの通知を既読化できない（where に userId: user-1 が必ず含まれる）', async () => {
    const { markNotificationsRead } = await import('@/lib/services/notification-read-service')
    const ids = ['notif-other-user']
    await markNotificationsRead('user-1', ids)

    const [[callArg]] = mockPrisma.notification.updateMany.mock.calls as [[{ where: { userId: string } }]]
    expect(callArg.where.userId).toBe('user-1')
  })

  it('userId が空でも updateMany が呼ばれる（呼び出し元が認証済み前提）', async () => {
    const { markNotificationsRead } = await import('@/lib/services/notification-read-service')
    await markNotificationsRead('user-x', ['notif-1'])

    expect(mockPrisma.notification.updateMany).toHaveBeenCalledTimes(1)
  })
})

describe('fetchUnreadNotificationCount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMutedUserIds.mockResolvedValue([])
    mockPrisma.notification.count.mockResolvedValue(5)
  })

  it('未読数を返す', async () => {
    const { fetchUnreadNotificationCount } = await import('@/lib/services/notification-read-service')
    const count = await fetchUnreadNotificationCount('user-1')

    expect(count).toBe(5)
  })

  it('ミュートユーザーがいる場合 actorId: { notIn: mutedUserIds } が where に含まれる', async () => {
    mockGetMutedUserIds.mockResolvedValueOnce(['muted-user-1', 'muted-user-2'])
    const { fetchUnreadNotificationCount } = await import('@/lib/services/notification-read-service')
    await fetchUnreadNotificationCount('user-1')

    expect(mockPrisma.notification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorId: { notIn: ['muted-user-1', 'muted-user-2'] },
        }),
      }),
    )
  })

  it('ミュートユーザーがいない場合 actorId フィルタを含まない', async () => {
    mockGetMutedUserIds.mockResolvedValueOnce([])
    const { fetchUnreadNotificationCount } = await import('@/lib/services/notification-read-service')
    await fetchUnreadNotificationCount('user-1')

    const [[callArg]] = mockPrisma.notification.count.mock.calls as [[{ where: Record<string, unknown> }]]
    expect(callArg.where).not.toHaveProperty('actorId')
  })

  it('count 結果が 0 でも 0 を返す', async () => {
    mockPrisma.notification.count.mockResolvedValueOnce(0)
    const { fetchUnreadNotificationCount } = await import('@/lib/services/notification-read-service')
    const count = await fetchUnreadNotificationCount('user-1')

    expect(count).toBe(0)
  })

  it('where に userId と isRead: false が必ず含まれる', async () => {
    const { fetchUnreadNotificationCount } = await import('@/lib/services/notification-read-service')
    await fetchUnreadNotificationCount('user-1')

    expect(mockPrisma.notification.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1', isRead: false }),
      }),
    )
  })
})

describe('fetchNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMutedUserIds.mockResolvedValue([])
    mockNormalizeCursorPagination.mockReturnValue({ cursor: undefined, limit: 20 })
    mockPrisma.notification.findMany.mockResolvedValue([
      { id: 'notif-1', type: 'like', isRead: false },
      { id: 'notif-2', type: 'follow', isRead: true },
    ])
  })

  it('通知一覧と nextCursor を返す', async () => {
    const { fetchNotifications } = await import('@/lib/services/notification-read-service')
    const result = await fetchNotifications('user-1')

    expect(result.notifications).toHaveLength(2)
    expect(result.nextCursor).toBeUndefined()
  })

  it('ミュートユーザーからの通知は除外される', async () => {
    mockGetMutedUserIds.mockResolvedValueOnce(['muted-1'])
    const { fetchNotifications } = await import('@/lib/services/notification-read-service')
    await fetchNotifications('user-1')

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          actorId: { notIn: ['muted-1'] },
        }),
      }),
    )
  })

  it('アイテム数が limit に達した場合 nextCursor が最後のアイテムの ID になる', async () => {
    mockNormalizeCursorPagination.mockReturnValueOnce({ cursor: undefined, limit: 2 })
    const { fetchNotifications } = await import('@/lib/services/notification-read-service')
    const result = await fetchNotifications('user-1', undefined, 2)

    expect(result.nextCursor).toBe('notif-2')
  })

  it('アイテム数が limit 未満の場合 nextCursor が undefined', async () => {
    mockNormalizeCursorPagination.mockReturnValueOnce({ cursor: undefined, limit: 20 })
    const { fetchNotifications } = await import('@/lib/services/notification-read-service')
    const result = await fetchNotifications('user-1')

    expect(result.nextCursor).toBeUndefined()
  })
})
