// @vitest-environment node
/**
 * lib/services/account-deletion-service のユニットテスト
 *
 * deleteUserAccount が $transaction 内で
 *   1. userAnalytics.deleteMany
 *   2. message.deleteMany
 *   3. conversationParticipant.deleteMany
 *   4. notification.deleteMany
 *   5. user.delete
 * を正しい順序で呼び出すことを検証する。
 *
 * RefreshToken は User に onDelete: Cascade が設定されているため
 * user.delete 呼び出し = RefreshToken 失効の根拠として検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// ──────────────────────────────────────────────────
// Mock: prisma — $transaction を「コールバック実行形式」でモック
// ──────────────────────────────────────────────────
const mockTxUserAnalyticsDeleteMany = vi.fn()
const mockTxMessageDeleteMany = vi.fn()
const mockTxConversationParticipantDeleteMany = vi.fn()
const mockTxNotificationDeleteMany = vi.fn()
const mockTxUserDelete = vi.fn()

// $transaction の tx オブジェクト（コールバックに渡されるトランザクションクライアント）
const mockTx = {
  userAnalytics: { deleteMany: (...args: unknown[]) => mockTxUserAnalyticsDeleteMany(...args) },
  message: { deleteMany: (...args: unknown[]) => mockTxMessageDeleteMany(...args) },
  conversationParticipant: { deleteMany: (...args: unknown[]) => mockTxConversationParticipantDeleteMany(...args) },
  notification: { deleteMany: (...args: unknown[]) => mockTxNotificationDeleteMany(...args) },
  user: { delete: (...args: unknown[]) => mockTxUserDelete(...args) },
}

// $transaction(callback) → callback(mockTx) を実行する実装でモックする
const mockPrismaTransaction = vi.fn().mockImplementation(async (cb: (tx: typeof mockTx) => Promise<void>) => {
  return cb(mockTx)
})

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: (...args: unknown[]) => mockPrismaTransaction(...args),
  },
}))

// ──────────────────────────────────────────────────
// テスト
// ──────────────────────────────────────────────────
describe('deleteUserAccount', () => {
  const USER_ID = 'user-to-delete-01'

  beforeEach(() => {
    vi.clearAllMocks()
    mockTxUserAnalyticsDeleteMany.mockResolvedValue({ count: 1 })
    mockTxMessageDeleteMany.mockResolvedValue({ count: 2 })
    mockTxConversationParticipantDeleteMany.mockResolvedValue({ count: 1 })
    mockTxNotificationDeleteMany.mockResolvedValue({ count: 3 })
    mockTxUserDelete.mockResolvedValue({ id: USER_ID })
  })

  it('$transaction が 1 回呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1)
  })

  it('userAnalytics.deleteMany が userId で呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxUserAnalyticsDeleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    })
  })

  it('message.deleteMany が senderId=userId で呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxMessageDeleteMany).toHaveBeenCalledWith({
      where: { senderId: USER_ID },
    })
  })

  it('conversationParticipant.deleteMany が userId で呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxConversationParticipantDeleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    })
  })

  it('notification.deleteMany が OR[{userId},{actorId}] で呼ばれること', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxNotificationDeleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: USER_ID }, { actorId: USER_ID }],
      },
    })
  })

  it('user.delete が id=userId で呼ばれること（RefreshToken Cascade 失効の根拠）', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(mockTxUserDelete).toHaveBeenCalledWith({
      where: { id: USER_ID },
    })
  })

  it('削除順序: userAnalytics → message → conversationParticipant → notification → user.delete', async () => {
    const callOrder: string[] = []
    mockTxUserAnalyticsDeleteMany.mockImplementation(async () => { callOrder.push('userAnalytics'); return { count: 0 } })
    mockTxMessageDeleteMany.mockImplementation(async () => { callOrder.push('message'); return { count: 0 } })
    mockTxConversationParticipantDeleteMany.mockImplementation(async () => { callOrder.push('conversationParticipant'); return { count: 0 } })
    mockTxNotificationDeleteMany.mockImplementation(async () => { callOrder.push('notification'); return { count: 0 } })
    mockTxUserDelete.mockImplementation(async () => { callOrder.push('user.delete'); return { id: USER_ID } })

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(USER_ID)

    expect(callOrder).toEqual([
      'userAnalytics',
      'message',
      'conversationParticipant',
      'notification',
      'user.delete',
    ])
  })

  it('成功時に void（undefined）を返すこと', async () => {
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    const result = await deleteUserAccount(USER_ID)

    expect(result).toBeUndefined()
  })

  it('$transaction 内でエラーが発生した場合はスローすること', async () => {
    mockTxUserAnalyticsDeleteMany.mockRejectedValue(new Error('DB constraint error'))

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await expect(deleteUserAccount(USER_ID)).rejects.toThrow('DB constraint error')
  })

  it('user.delete でエラーが発生した場合はスローすること', async () => {
    mockTxUserDelete.mockRejectedValue(new Error('User not found'))

    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await expect(deleteUserAccount(USER_ID)).rejects.toThrow('User not found')
  })

  it('異なる userId を渡した場合も正しく呼ばれること', async () => {
    const OTHER_USER_ID = 'another-user-42'
    const { deleteUserAccount } = await import('@/lib/services/account-deletion-service')
    await deleteUserAccount(OTHER_USER_ID)

    expect(mockTxUserAnalyticsDeleteMany).toHaveBeenCalledWith({ where: { userId: OTHER_USER_ID } })
    expect(mockTxUserDelete).toHaveBeenCalledWith({ where: { id: OTHER_USER_ID } })
  })
})
