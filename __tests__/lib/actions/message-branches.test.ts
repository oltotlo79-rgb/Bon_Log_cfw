// @vitest-environment node
/**
 * message.ts ブランチカバレッジ向上テスト
 *
 * 対象:
 * - getOrCreateConversation: 自分自身への送信、ブロック検出、既存会話発見
 * - sendMessage: バリデーション失敗、日次制限超過、会話参加者でない
 * - getConversation: 不正ID、アクセス権なし
 * - deleteMessage: 不正ID、他人のメッセージ削除
 * - markAsRead: DBエラー
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
vi.unmock('@/lib/actions/message')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireAuth = vi.fn()
const mockRequireActiveUser = vi.fn()
const mockRequireActiveNonGuestUser = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireActiveUser: (...args: unknown[]) => mockRequireActiveUser(...args),
  requireActiveNonGuestUser: (...args: unknown[]) => mockRequireActiveNonGuestUser(...args),
  actionSuccess: (data?: unknown) => ({ success: true, ...(data !== undefined ? { data } : {}) }),
  actionError: (error: string) => ({ success: false, error }),
  enforceUserRateLimit: vi.fn().mockResolvedValue(null),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('@/lib/actions/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))

const importModule = () => import('@/lib/actions/message')

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
  mockRequireActiveUser.mockResolvedValue({ userId: 'user-1' })
  mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
})

describe('getOrCreateConversation', () => {
  it('空のtargetUserIdでバリデーションエラー', async () => {
    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('')
    expect(result).toMatchObject({ success: false })
  })

  it('自分自身へのメッセージはエラー', async () => {
    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('user-1')
    expect(result).toMatchObject({ success: false })
  })

  it('ブロック関係がある場合はエラー', async () => {
    mockPrisma.block.findFirst.mockResolvedValue({ id: 'block-1' })

    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('user-2')
    expect(result).toMatchObject({ success: false })
  })

  it('既存の会話がある場合はそれを返す', async () => {
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' })

    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('user-2')
    expect(result).toMatchObject({ success: true })
  })

  it('認証失敗時にエラーを返す', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })

    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('user-2')
    expect(result).toMatchObject({ success: false })
  })
})

describe('sendMessage', () => {
  it('空コンテンツでバリデーションエラー', async () => {
    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', '')
    expect(result).toMatchObject({ success: false })
  })

  it('空conversationIdでバリデーションエラー', async () => {
    const { sendMessage } = await importModule()
    const result = await sendMessage('', 'テスト')
    expect(result).toMatchObject({ success: false })
  })

  it('会話参加者でない場合エラー', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null)

    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'テスト')
    expect(result).toMatchObject({ success: false })
  })

  it('日次制限超過でエラー', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ conversationId: 'conv-1', userId: 'user-1' })
    mockPrisma.message.count.mockResolvedValue(999)

    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'テスト')
    expect(result).toMatchObject({ success: false })
  })
})

describe('deleteMessage', () => {
  it('認証失敗時にエラーを返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

    const { deleteMessage } = await importModule()
    const result = await deleteMessage('msg-1')
    expect(result).toMatchObject({ success: false })
  })

  it('メッセージが見つからない場合エラー', async () => {
    mockPrisma.message.findUnique.mockResolvedValue(null)

    const { deleteMessage } = await importModule()
    const result = await deleteMessage('msg-nonexistent')
    expect(result).toMatchObject({ success: false })
  })

  it('他人のメッセージは削除できない', async () => {
    mockPrisma.message.findUnique.mockResolvedValue({ id: 'msg-1', senderId: 'other-user' })

    const { deleteMessage } = await importModule()
    const result = await deleteMessage('msg-1')
    expect(result).toMatchObject({ success: false })
  })

  it('正常に削除できる', async () => {
    mockPrisma.message.findUnique.mockResolvedValue({ id: 'msg-1', senderId: 'user-1', conversationId: 'conv-1' })
    mockPrisma.message.delete.mockResolvedValue({})

    const { deleteMessage } = await importModule()
    const result = await deleteMessage('msg-1')
    expect(result).toMatchObject({ success: true })
  })
})

describe('markAsRead', () => {
  it('認証失敗時にエラーを返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

    const { markAsRead } = await importModule()
    const result = await markAsRead('conv-1')
    expect(result).toMatchObject({ success: false })
  })

  it('DB失敗時にエラーを返す', async () => {
    mockPrisma.conversationParticipant.update.mockRejectedValue(new Error('DB error'))

    const { markAsRead } = await importModule()
    const result = await markAsRead('conv-1')
    expect(result).toMatchObject({ success: false })
  })
})

// ============================================================
// 追加ブランチカバレッジ: getOrCreateConversation例外、sendMessage送信時ブロック
// ============================================================

describe('getOrCreateConversation — DB例外ハンドリング', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireActiveUser.mockResolvedValue({ userId: 'user-1' })
  })

  it('conversation.create が例外をスローした場合 ERR_CONVERSATION_CREATE_FAILED を返す', async () => {
    // 相手ユーザーが存在
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2', accountStatus: 'active' })
    // ブロック関係なし
    mockPrisma.block.findFirst.mockResolvedValue(null)
    // 既存会話なし
    mockPrisma.conversation.findFirst.mockResolvedValue(null)
    // 会話作成時にDB例外
    mockPrisma.conversation.create.mockRejectedValue(new Error('DB connection lost'))

    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('user-2')
    expect(result).toEqual({
      success: false,
      error: '会話の作成に失敗しました',
    })
  })
})

describe('sendMessage — 送信時ブロック検出', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireActiveUser.mockResolvedValue({ userId: 'user-1' })
  })

  it('会話作成後にブロックされた場合 ERR_MESSAGE_BLOCKED を返す', async () => {
    // 参加者チェック（findUnique: 自分が参加者か確認）
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
      userId: 'user-1', conversationId: 'conv-1',
    })
    // 相手参加者取得（findFirst: 自分以外の参加者）
    mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
      userId: 'user-2', conversationId: 'conv-1',
    })
    // 日次制限内
    mockPrisma.message.count.mockResolvedValue(0)
    // ブロック関係が存在（会話作成後にブロックされたケース）
    mockPrisma.block.findFirst.mockResolvedValue({
      id: 'block-1',
      blockerId: 'user-2',
      blockedId: 'user-1',
    })

    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'テストメッセージ')
    expect(result).toEqual({
      success: false,
      error: 'このユーザーにはメッセージを送れません',
    })
    // メッセージはDBに保存されない
    expect(mockPrisma.message.create).not.toHaveBeenCalled()
  })

  it('相手参加者が見つからない場合もメッセージ送信は続行する', async () => {
    // 参加者チェック（findUnique: 自分が参加者か確認）
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
      userId: 'user-1', conversationId: 'conv-1',
    })
    // 相手参加者取得（findFirst: 自分以外の参加者）→ 見つからない
    mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
    // ブロックチェックはスキップされる
    mockPrisma.block.findFirst.mockResolvedValue(null)
    // 日次制限内
    mockPrisma.message.count.mockResolvedValue(0)
    // メッセージ作成成功
    mockPrisma.message.create.mockResolvedValue({
      id: 'msg-1',
      content: 'テスト',
      senderId: 'user-1',
      conversationId: 'conv-1',
    })
    // 会話更新
    mockPrisma.conversation.update.mockResolvedValue({})

    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'テストメッセージ')
    // ブロックチェックなしでメッセージ送信成功
    expect(result).toEqual(expect.objectContaining({ success: true }))
    expect(mockPrisma.message.create).toHaveBeenCalled()
  })
})
