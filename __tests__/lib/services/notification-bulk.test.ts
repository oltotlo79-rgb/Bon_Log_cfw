// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockSendPushNotification = vi.fn()
vi.mock('@/lib/web-push', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  default: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}))

/**
 * Promise.allSettled / void Promise の dispatch は背後でマイクロタスク化される。
 * 「呼ばれたか」の検証は `await flushPromises()` を挟んで行う。
 */
async function flushPromises(times = 4) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
  }
}

describe('createNotificationsBulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.block.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.notification.createMany.mockResolvedValue({ count: 0 })
    mockSendPushNotification.mockResolvedValue(undefined)
  })

  it('受信者が空の場合は何もしない', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createNotificationsBulk({
      recipientIds: [],
      actorId: 'actor-1',
      type: 'mention',
    })

    expect(result).toEqual({ attempted: 0, filtered: 0 })
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
  })

  it('actor 自身は受信者から除外される', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['actor-1', 'user-2'],
      actorId: 'actor-1',
      type: 'mention',
    })

    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'user-2', actorId: 'actor-1', type: 'mention' }),
      ],
      skipDuplicates: true,
    })
  })

  it('受信者の重複は除去される', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['user-2', 'user-2', 'user-3', 'user-3'],
      actorId: 'actor-1',
      type: 'like',
    })

    const args = mockPrisma.notification.createMany.mock.calls[0]?.[0]
    expect(args?.data).toHaveLength(2)
    expect(args?.data.map((d: { userId: string }) => d.userId).sort()).toEqual(['user-2', 'user-3'])
  })

  it('falsy / 空文字の受信者 ID は除外される', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['', 'user-2'] as readonly string[],
      actorId: 'actor-1',
      type: 'like',
    })

    const args = mockPrisma.notification.createMany.mock.calls[0]?.[0]
    expect(args?.data).toEqual([
      expect.objectContaining({ userId: 'user-2' }),
    ])
  })

  it('双方向ブロック（自分→相手）でブロックされた受信者は除外される', async () => {
    mockPrisma.block.findMany.mockResolvedValueOnce([
      { blockerId: 'actor-1', blockedId: 'user-2' },
    ])

    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createNotificationsBulk({
      recipientIds: ['user-2', 'user-3'],
      actorId: 'actor-1',
      type: 'mention',
    })

    expect(result.filtered).toBe(1)
    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'user-3' }),
      ],
      skipDuplicates: true,
    })
  })

  it('双方向ブロック（相手→自分）でブロックされた受信者は除外される', async () => {
    // user-3 が actor-1 をブロックしているケース
    mockPrisma.block.findMany.mockResolvedValueOnce([
      { blockerId: 'user-3', blockedId: 'actor-1' },
    ])

    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createNotificationsBulk({
      recipientIds: ['user-2', 'user-3'],
      actorId: 'actor-1',
      type: 'mention',
    })

    expect(result.filtered).toBe(1)
    const args = mockPrisma.notification.createMany.mock.calls[0]?.[0]
    expect(args?.data.map((d: { userId: string }) => d.userId)).toEqual(['user-2'])
  })

  it('全員ブロックされた場合は createMany を呼ばず filtered だけ返す', async () => {
    mockPrisma.block.findMany.mockResolvedValueOnce([
      { blockerId: 'actor-1', blockedId: 'user-2' },
      { blockerId: 'actor-1', blockedId: 'user-3' },
    ])

    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createNotificationsBulk({
      recipientIds: ['user-2', 'user-3'],
      actorId: 'actor-1',
      type: 'mention',
    })

    expect(result).toEqual({ attempted: 0, filtered: 2 })
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    // プッシュ通知も送られない
    expect(mockSendPushNotification).not.toHaveBeenCalled()
  })

  it('notificationPreferences で type:false のユーザーは除外される', async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'user-2', notificationPreferences: { mention: false } },
      { id: 'user-3', notificationPreferences: { mention: true } },
    ])

    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createNotificationsBulk({
      recipientIds: ['user-2', 'user-3'],
      actorId: 'actor-1',
      type: 'mention',
    })

    expect(result.attempted).toBe(1)
    expect(result.filtered).toBe(1)
    expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'user-3' }),
      ],
      skipDuplicates: true,
    })
  })

  it('notificationPreferences が null/array/プリミティブの場合はデフォルト ON 扱い', async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'user-2', notificationPreferences: null },
      { id: 'user-3', notificationPreferences: ['invalid'] },
      { id: 'user-4', notificationPreferences: 'string-not-object' },
      { id: 'user-5', notificationPreferences: { mention: 'not-a-boolean' } },
    ])

    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createNotificationsBulk({
      recipientIds: ['user-2', 'user-3', 'user-4', 'user-5'],
      actorId: 'actor-1',
      type: 'mention',
    })

    expect(result.attempted).toBe(4)
    expect(result.filtered).toBe(0)
  })

  it('checkBlocks=false でブロックチェックを完全スキップ（システム告知用）', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['user-2'],
      actorId: 'admin-1',
      type: 'system',
      checkBlocks: false,
      checkPreferences: false,
    })

    expect(mockPrisma.block.findMany).not.toHaveBeenCalled()
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it('skipPushNotification=true でプッシュ通知を送らない', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['user-2'],
      actorId: 'actor-1',
      type: 'mention',
      skipPushNotification: true,
    })

    await flushPromises()
    expect(mockSendPushNotification).not.toHaveBeenCalled()
  })

  it('デフォルトで全ターゲット受信者にプッシュ通知が送られる', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['user-2', 'user-3'],
      actorId: 'actor-1',
      type: 'mention',
    })

    await flushPromises()
    expect(mockSendPushNotification).toHaveBeenCalledTimes(2)
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({
        title: 'BON-LOG',
        body: '新しい通知が届きました',
      }),
    )
  })

  it('postId 指定時は data.url が /posts/{postId} になる', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['user-2'],
      actorId: 'actor-1',
      type: 'like',
      postId: 'post-xyz',
    })

    await flushPromises()
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({
        data: { url: '/posts/post-xyz' },
        tag: expect.stringContaining('post-xyz'),
      }),
    )
    const args = mockPrisma.notification.createMany.mock.calls[0]?.[0]
    expect(args?.data[0]).toEqual(expect.objectContaining({ postId: 'post-xyz' }))
  })

  it('postId なし時は data.url が /notifications になる', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['user-2'],
      actorId: 'actor-1',
      type: 'follow',
    })

    await flushPromises()
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({
        data: { url: '/notifications' },
      }),
    )
  })

  it('カスタム pushBody が指定された場合はそれが使われる', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['user-2'],
      actorId: 'actor-1',
      type: 'mention',
      pushBody: 'カスタム本文',
    })

    await flushPromises()
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({ body: 'カスタム本文' }),
    )
  })

  it('commentId 指定時は createMany データに含まれ、tag にも含まれる', async () => {
    const { createNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createNotificationsBulk({
      recipientIds: ['user-2'],
      actorId: 'actor-1',
      type: 'reply',
      commentId: 'cmt-1',
    })

    await flushPromises()
    const args = mockPrisma.notification.createMany.mock.calls[0]?.[0]
    expect(args?.data[0]).toEqual(expect.objectContaining({ commentId: 'cmt-1' }))
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({ tag: expect.stringContaining('cmt-1') }),
    )
  })
})

describe('createSystemNotificationsBulk', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findMany.mockResolvedValue([])
    mockPrisma.notification.createMany.mockResolvedValue({ count: 0 })
    mockSendPushNotification.mockResolvedValue(undefined)
  })

  it('非システムタイプを渡すと例外を投げる', async () => {
    const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await expect(
      createSystemNotificationsBulk({
        recipientIds: ['user-1'],
        // @ts-expect-error: 非システムタイプを意図的に渡す
        type: 'like',
      }),
    ).rejects.toThrow(/non-system type/)
  })

  it('受信者が空の場合は何もしない', async () => {
    const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createSystemNotificationsBulk({
      recipientIds: [],
      type: 'system',
    })
    expect(result).toEqual({ attempted: 0, filtered: 0 })
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
  })

  it('文字列以外/空文字の受信者 ID は除外される', async () => {
    const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createSystemNotificationsBulk({
      recipientIds: ['', 'valid-1'] as readonly string[],
      type: 'system',
    })
    expect(result.attempted).toBe(1)
    const args = mockPrisma.notification.createMany.mock.calls[0]?.[0]
    expect(args?.data).toEqual([
      expect.objectContaining({ userId: 'valid-1', actorId: 'valid-1', type: 'system' }),
    ])
  })

  it('preferences で system:false のユーザーは除外される', async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'u1', notificationPreferences: { system: false } },
      { id: 'u2', notificationPreferences: { system: true } },
    ])

    const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createSystemNotificationsBulk({
      recipientIds: ['u1', 'u2'],
      type: 'system',
    })

    expect(result.attempted).toBe(1)
    expect(result.filtered).toBe(1)
    const args = mockPrisma.notification.createMany.mock.calls[0]?.[0]
    expect(args?.data).toEqual([
      expect.objectContaining({ userId: 'u2' }),
    ])
  })

  it('全員 prefs で除外された場合は createMany を呼ばない', async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([
      { id: 'u1', notificationPreferences: { system: false } },
    ])

    const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
    const result = await createSystemNotificationsBulk({
      recipientIds: ['u1'],
      type: 'system',
    })

    expect(result).toEqual({ attempted: 0, filtered: 1 })
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
  })

  it('postId 指定時は data に含まれ、push 通知 url も /posts/{postId}', async () => {
    const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createSystemNotificationsBulk({
      recipientIds: ['u1'],
      type: 'system',
      postId: 'post-1',
    })

    await flushPromises()
    const args = mockPrisma.notification.createMany.mock.calls[0]?.[0]
    expect(args?.data[0]).toEqual(expect.objectContaining({ postId: 'post-1' }))
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        data: { url: '/posts/post-1' },
        tag: 'system-system-post-1',
      }),
    )
  })

  it('postId なし時は push 通知 url が /notifications', async () => {
    const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createSystemNotificationsBulk({
      recipientIds: ['u1'],
      type: 'subscription_expiring',
    })

    await flushPromises()
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        data: { url: '/notifications' },
      }),
    )
  })

  it('カスタム pushBody が反映される', async () => {
    const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createSystemNotificationsBulk({
      recipientIds: ['u1'],
      type: 'system',
      pushBody: 'メンテナンスお知らせ',
    })

    await flushPromises()
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ body: 'メンテナンスお知らせ' }),
    )
  })

  it('skipPushNotification=true でプッシュ通知を送らない', async () => {
    const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
    await createSystemNotificationsBulk({
      recipientIds: ['u1'],
      type: 'system',
      skipPushNotification: true,
    })

    await flushPromises()
    expect(mockSendPushNotification).not.toHaveBeenCalled()
  })
})
