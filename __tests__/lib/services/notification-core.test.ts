import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = {
  block: { findFirst: vi.fn() },
  user: { findUnique: vi.fn() },
  notification: { findFirst: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockSendPush = vi.fn()
vi.mock('@/lib/web-push', () => ({ sendPushNotification: (...args: unknown[]) => mockSendPush(...args) }))

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

describe('isSystemNotification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('system / subscription_expiring は true', async () => {
    const { isSystemNotification } = await import('@/lib/services/notification-core')
    expect(isSystemNotification('system')).toBe(true)
    expect(isSystemNotification('subscription_expiring')).toBe(true)
  })

  it('通常通知は false', async () => {
    const { isSystemNotification } = await import('@/lib/services/notification-core')
    expect(isSystemNotification('like')).toBe(false)
    expect(isSystemNotification('comment')).toBe(false)
    expect(isSystemNotification('follow')).toBe(false)
  })
})

describe('createNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma))
  })

  it('不正パラメータはエラーを返す', async () => {
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: '', actorId: '', type: 'like' })
    expect(result).toMatchObject({ success: false })
  })

  it('自己通知はスキップしても成功を返す', async () => {
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'u1', actorId: 'u1', type: 'like' })
    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('ブロック関係がある場合はスキップして成功を返す', async () => {
    mockPrisma.block.findFirst.mockResolvedValue({ blockerId: 'u1' })
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'u1', actorId: 'u2', type: 'like' })
    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('受信者が該当タイプを無効化している場合はスキップ', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: { like: false } })
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'u1', actorId: 'u2', type: 'like' })
    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
  })

  it('既存の重複通知がある場合はスキップ（プッシュ送信なし）', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: {} })
    mockPrisma.notification.findFirst.mockResolvedValueOnce({ id: 'existing' })
    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'u1', actorId: 'u2', type: 'like', postId: 'p1' })
    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.notification.create).not.toHaveBeenCalled()
    expect(mockSendPush).not.toHaveBeenCalled()
  })

  it('新規通知を作成し、プッシュ通知も送信する', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ notificationPreferences: {} })
      .mockResolvedValueOnce({ nickname: '田中' })
    mockPrisma.notification.findFirst.mockResolvedValueOnce(null)
    mockPrisma.notification.create.mockResolvedValueOnce({ id: 'n1' })
    mockSendPush.mockResolvedValue(undefined)

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'u1', actorId: 'u2', type: 'like', postId: 'p1' })

    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'u1', actorId: 'u2', type: 'like' }) }),
    )
    expect(mockSendPush).toHaveBeenCalled()
  })

  it('システム通知はブロック関係・自己通知チェックをスキップ', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce({ notificationPreferences: {} })
    mockPrisma.notification.findFirst.mockResolvedValueOnce(null)
    mockPrisma.notification.create.mockResolvedValueOnce({ id: 'sys' })

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'u1', actorId: 'system', type: 'system' })
    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.block.findFirst).not.toHaveBeenCalled()
  })

  it('プッシュ送信失敗は通知作成の成功を妨げない（fire-and-forget）', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ notificationPreferences: {} })
      .mockResolvedValueOnce({ nickname: '佐藤' })
    mockPrisma.notification.findFirst.mockResolvedValueOnce(null)
    mockPrisma.notification.create.mockResolvedValueOnce({ id: 'n2' })
    mockSendPush.mockRejectedValue(new Error('push down'))

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({ userId: 'u1', actorId: 'u2', type: 'follow' })
    expect(result).toMatchObject({ success: true })
  })
})

describe('deleteNotification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('不正パラメータはエラーを返す', async () => {
    const { deleteNotification } = await import('@/lib/services/notification-core')
    const result = await deleteNotification({ userId: '', actorId: '', type: 'like' })
    expect(result).toMatchObject({ success: false })
  })

  it('条件一致する通知を削除する', async () => {
    mockPrisma.notification.deleteMany.mockResolvedValue({ count: 1 })
    const { deleteNotification } = await import('@/lib/services/notification-core')
    const result = await deleteNotification({ userId: 'u1', actorId: 'u2', type: 'like', postId: 'p1' })
    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'u1', actorId: 'u2', type: 'like', postId: 'p1', commentId: null },
    })
  })
})
