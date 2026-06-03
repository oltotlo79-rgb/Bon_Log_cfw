// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireAuth = vi.fn()
const mockRequireActiveUser = vi.fn()
vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual('@/lib/actions/utils')
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
    requireActiveUser: (...args: unknown[]) => mockRequireActiveUser(...args),
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}))

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  getStartOfToday: vi.fn(() => new Date('2026-01-01T00:00:00Z')),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeMessageContent: vi.fn((s: string) => s),
}))

vi.mock('@/lib/actions/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))

/**
 * `ActionResult<T>` を旧フラット形状に展開する互換ヘルパー（message 移行用）。
 * 成功時: `success: true` + `data` のフラット展開
 * 失敗時: `success: false` + `error` + 旧データ既定値（conversations: [], messages: [], count: 0）
 *
 * これにより `expect(result).toMatchObject({ success: false })` と
 * `expect(result.conversations).toEqual([])` の両方が同じ unwrap 結果で動作する。
 */
type MessageLegacyShape = {
  success?: boolean
  error?: string
  conversations?: unknown[]
  messages?: unknown[]
  count?: number
  capReached?: boolean
  conversation?: unknown
  nextCursor?: string
  currentUserId?: string
  message?: unknown
}
function unwrap<T>(result: import('@/types/action-result').ActionResult<T>): (T extends object ? T : Record<string, never>) & MessageLegacyShape {
  if (result.success) {
    return { success: true, ...(result.data ?? {}) } as (T extends object ? T : Record<string, never>) & MessageLegacyShape
  }
  return {
    success: false,
    error: result.error,
    conversations: [],
    messages: [],
    count: 0,
    capReached: false,
  } as (T extends object ? T : Record<string, never>) & MessageLegacyShape
}

const importModule = () => import('@/lib/actions/message')

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockRequireAuth.mockResolvedValue({ userId: mockUser.id })
  mockRequireActiveUser.mockResolvedValue({ userId: mockUser.id })
})

// ============================================================
// getOrCreateConversation
// ============================================================

describe('getOrCreateConversation', () => {
  it('認証失敗時にエラーを返す', async () => {
    mockRequireActiveUser.mockResolvedValue({ error: '認証が必要です' })
    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('other-user-id')
    expect(result).toMatchObject({ success: false })
  })

  it('空のtargetUserIdでバリデーションエラー', async () => {
    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('')
    expect(result).toMatchObject({ success: false })
  })

  it('自分自身へのメッセージはエラー', async () => {
    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation(mockUser.id)
    expect(result).toMatchObject({ success: false })
  })

  it('ブロック関係がある場合はエラー', async () => {
    mockPrisma.block.findFirst.mockResolvedValue({ id: 'block-1' })
    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('other-user-id')
    expect(result).toMatchObject({ success: false })
  })

  it('既存の会話がある場合はそのIDを返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'other-user-id', isPublic: true, isSuspended: false, email: 'other@example.com' })
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-1' })
    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('other-user-id')
    expect(result).toMatchObject({ success: true, data: { conversationId: 'conv-1' } })
  })

  it('既存会話がない場合は新規作成して返す', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'other-user-id', isPublic: true, isSuspended: false, email: 'other@example.com' })
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.conversation.findFirst.mockResolvedValue(null)
    mockPrisma.conversation.create.mockResolvedValue({ id: 'new-conv-1' })
    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('other-user-id')
    expect(result).toMatchObject({ success: true, data: { conversationId: 'new-conv-1' } })
  })

  it('DB例外時にエラーを返す', async () => {
    mockPrisma.block.findFirst.mockRejectedValue(new Error('DB error'))
    const { getOrCreateConversation } = await importModule()
    const result = await getOrCreateConversation('other-user-id')
    expect(result).toMatchObject({ success: false })
  })
})

// ============================================================
// sendMessage
// ============================================================

describe('sendMessage', () => {
  it('認証失敗時にエラーを返す', async () => {
    mockRequireActiveUser.mockResolvedValue({ error: '認証が必要です' })
    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'hello')
    expect(result).toMatchObject({ success: false })
  })

  it('空のconversationIdでバリデーションエラー', async () => {
    const { sendMessage } = await importModule()
    const result = await sendMessage('', 'hello')
    expect(result).toMatchObject({ success: false })
  })

  it('空のcontentでバリデーションエラー', async () => {
    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', '   ')
    expect(result).toMatchObject({ success: false })
  })

  it('長すぎるcontentでバリデーションエラー', async () => {
    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'a'.repeat(1001))
    expect(result).toMatchObject({ success: false })
  })

  it('レート制限超過時にエラーを返す', async () => {
    const { checkUserRateLimit } = await import('@/lib/rate-limit')
    vi.mocked(checkUserRateLimit).mockResolvedValueOnce({ success: false, limit: 10, remaining: 0, reset: 0 })
    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'hello')
    expect(result).toMatchObject({ success: false })
  })

  it('会話の参加者でない場合はエラー', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null)
    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'hello')
    expect(result).toMatchObject({ success: false })
  })

  it('日次メッセージ制限超過時にエラーを返す', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1', userId: mockUser.id })
    mockPrisma.message.count.mockResolvedValue(100)
    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'hello')
    expect(result).toMatchObject({ success: false })
  })

  it('送信時にブロック関係がある場合はエラー', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1', userId: mockUser.id })
    mockPrisma.message.count.mockResolvedValue(0)
    mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-2', userId: 'other-user-id' })
    mockPrisma.block.findFirst.mockResolvedValue({ id: 'block-1' })
    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'hello')
    expect(result).toMatchObject({ success: false })
  })

  it('正常にメッセージを送信できる', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1', userId: mockUser.id })
    mockPrisma.message.count.mockResolvedValue(0)
    mockPrisma.conversationParticipant.findFirst.mockResolvedValue({ id: 'p-2', userId: 'other-user-id' })
    mockPrisma.block.findFirst.mockResolvedValue(null)
    const mockMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: mockUser.id,
      content: 'hello',
      sender: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
    }
    mockPrisma.message.create.mockResolvedValue(mockMessage)
    mockPrisma.conversation.update.mockResolvedValue({})
    mockPrisma.notification.create.mockResolvedValue({})

    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'hello')
    expect(result).toMatchObject({ success: true })
    if (result.success) {
      expect(result.data).toHaveProperty('message')
    }
  })

  it('相手の参加者がいない場合でもメッセージ送信できる', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1', userId: mockUser.id })
    mockPrisma.message.count.mockResolvedValue(0)
    mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
    mockPrisma.block.findFirst.mockResolvedValue(null)
    const mockMessage = {
      id: 'msg-1',
      conversationId: 'conv-1',
      senderId: mockUser.id,
      content: 'hello',
      sender: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
    }
    mockPrisma.message.create.mockResolvedValue(mockMessage)
    mockPrisma.conversation.update.mockResolvedValue({})

    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'hello')
    expect(result).toMatchObject({ success: true })
  })

  it('DB例外時にエラーを返す', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1', userId: mockUser.id })
    mockPrisma.message.count.mockResolvedValue(0)
    mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)
    mockPrisma.message.create.mockRejectedValue(new Error('DB error'))

    const { sendMessage } = await importModule()
    const result = await sendMessage('conv-1', 'hello')
    expect(result).toMatchObject({ success: false })
  })
})

// ============================================================
// getConversations
// ============================================================

describe('getConversations', () => {
  it('認証失敗時に空配列を返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })
    const { getConversations } = await importModule()
    const result = unwrap(await getConversations())
    expect(result.conversations).toEqual([])
  })

  it('会話がない場合に空配列を返す', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([])
    const { getConversations } = await importModule()
    const result = unwrap(await getConversations())
    expect(result.conversations).toEqual([])
  })

  it('会話一覧を未読フラグ付きで返す', async () => {
    const now = new Date('2026-01-02T00:00:00Z')
    const oldDate = new Date('2026-01-01T00:00:00Z')
    mockPrisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        updatedAt: now,
        participants: [
          { userId: mockUser.id, lastReadAt: oldDate, user: { id: mockUser.id, nickname: 'me', avatarUrl: null } },
          { userId: 'other-id', lastReadAt: null, user: { id: 'other-id', nickname: 'other', avatarUrl: null } },
        ],
        messages: [
          { id: 'msg-1', content: 'new message', createdAt: now, senderId: 'other-id' },
        ],
      },
    ])

    const { getConversations } = await importModule()
    const result = unwrap(await getConversations())
    expect(result.conversations).toHaveLength(1)
    expect(result.conversations[0].hasUnread).toBe(true)
    expect(result.conversations[0].otherUser).toEqual({ id: 'other-id', nickname: 'other', avatarUrl: null })
  })

  it('既読済みの場合はhasUnreadがfalse', async () => {
    const readDate = new Date('2026-01-03T00:00:00Z')
    const msgDate = new Date('2026-01-02T00:00:00Z')
    mockPrisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        updatedAt: readDate,
        participants: [
          { userId: mockUser.id, lastReadAt: readDate, user: { id: mockUser.id, nickname: 'me', avatarUrl: null } },
          { userId: 'other-id', lastReadAt: null, user: { id: 'other-id', nickname: 'other', avatarUrl: null } },
        ],
        messages: [
          { id: 'msg-1', content: 'old message', createdAt: msgDate, senderId: 'other-id' },
        ],
      },
    ])

    const { getConversations } = await importModule()
    const result = unwrap(await getConversations())
    expect(result.conversations[0].hasUnread).toBe(false)
  })

  it('メッセージがない会話はhasUnreadがfalse', async () => {
    mockPrisma.conversation.findMany.mockResolvedValue([
      {
        id: 'conv-1',
        updatedAt: new Date(),
        participants: [
          { userId: mockUser.id, lastReadAt: null, user: { id: mockUser.id, nickname: 'me', avatarUrl: null } },
          { userId: 'other-id', lastReadAt: null, user: { id: 'other-id', nickname: 'other', avatarUrl: null } },
        ],
        messages: [],
      },
    ])

    const { getConversations } = await importModule()
    const result = unwrap(await getConversations())
    expect(result.conversations[0].hasUnread).toBe(false)
  })
})

// ============================================================
// getConversation
// ============================================================

describe('getConversation', () => {
  it('認証失敗時にエラーを返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })
    const { getConversation } = await importModule()
    const result = unwrap(await getConversation('conv-1'))
    expect(result).toMatchObject({ success: false })
  })

  it('参加者でない場合はエラー', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null)
    const { getConversation } = await importModule()
    const result = unwrap(await getConversation('conv-1'))
    expect(result).toMatchObject({ success: false })
  })

  it('会話が見つからない場合はエラー', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' })
    mockPrisma.conversation.findUnique.mockResolvedValue(null)
    const { getConversation } = await importModule()
    const result = unwrap(await getConversation('conv-1'))
    expect(result).toMatchObject({ success: false })
  })

  it('正常に会話詳細を返す', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' })
    mockPrisma.conversation.findUnique.mockResolvedValue({
      id: 'conv-1',
      participants: [
        { userId: mockUser.id, user: { id: mockUser.id, nickname: 'me', avatarUrl: null } },
        { userId: 'other-id', user: { id: 'other-id', nickname: 'other', avatarUrl: '/avatar.jpg' } },
      ],
    })
    const { getConversation } = await importModule()
    const result = unwrap(await getConversation('conv-1'))
    expect(result).toHaveProperty('conversation')
    const conv = (result as { conversation: { id: string; otherUser: { id: string; nickname: string; avatarUrl: string } } }).conversation
    expect(conv.otherUser).toEqual({ id: 'other-id', nickname: 'other', avatarUrl: '/avatar.jpg' })
  })

  it('DB例外時にエラーを返す', async () => {
    mockPrisma.conversationParticipant.findUnique.mockRejectedValue(new Error('DB error'))
    const { getConversation } = await importModule()
    const result = unwrap(await getConversation('conv-1'))
    expect(result).toMatchObject({ success: false })
  })
})

// ============================================================
// getMessages
// ============================================================

describe('getMessages', () => {
  it('認証失敗時にエラーを返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })
    const { getMessages } = await importModule()
    const result = unwrap(await getMessages('conv-1'))
    expect(result).toMatchObject({ success: false })
  })

  it('参加者でない場合はエラー', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null)
    const { getMessages } = await importModule()
    const result = unwrap(await getMessages('conv-1'))
    expect(result).toMatchObject({ success: false })
  })

  it('メッセージ一覧を返しlastReadAtを更新する', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' })
    const messages = [
      { id: 'msg-2', content: 'older', sender: { id: 'other', nickname: 'other', avatarUrl: null }, createdAt: new Date('2026-01-01') },
      { id: 'msg-1', content: 'newest', sender: { id: mockUser.id, nickname: 'me', avatarUrl: null }, createdAt: new Date('2026-01-02') },
    ]
    mockPrisma.message.findMany.mockResolvedValue(messages)
    mockPrisma.conversationParticipant.update.mockResolvedValue({})

    const { getMessages } = await importModule()
    const result = unwrap(await getMessages('conv-1'))
    expect(result).toHaveProperty('messages')
    expect(result).toHaveProperty('currentUserId', mockUser.id)
    expect(mockPrisma.conversationParticipant.update).toHaveBeenCalled()
  })

  it('カーソル付きでページネーションする', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' })
    mockPrisma.message.findMany.mockResolvedValue([])
    mockPrisma.conversationParticipant.update.mockResolvedValue({})

    const { getMessages } = await importModule()
    await getMessages('conv-1', 'cursor-id', 10)
    expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'cursor-id' },
        skip: 1,
        take: 10,
      })
    )
  })

  it('limitぴったりの件数でnextCursorを返す', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' })
    const msgs = Array.from({ length: 50 }, (_, i) => ({
      id: `msg-${i}`,
      content: `msg ${i}`,
      sender: { id: mockUser.id, nickname: 'me', avatarUrl: null },
      createdAt: new Date(),
    }))
    mockPrisma.message.findMany.mockResolvedValue(msgs)
    mockPrisma.conversationParticipant.update.mockResolvedValue({})

    const { getMessages } = await importModule()
    const result = unwrap(await getMessages('conv-1'))
    expect(result).toHaveProperty('nextCursor')
  })

  it('limit未満の件数ではnextCursorがundefined', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' })
    mockPrisma.message.findMany.mockResolvedValue([
      { id: 'msg-1', content: 'hello', sender: { id: mockUser.id, nickname: 'me', avatarUrl: null }, createdAt: new Date() },
    ])
    mockPrisma.conversationParticipant.update.mockResolvedValue({})

    const { getMessages } = await importModule()
    const result = unwrap(await getMessages('conv-1'))
    expect((result as { nextCursor?: string }).nextCursor).toBeUndefined()
  })

  it('DB例外時にエラーを返す', async () => {
    mockPrisma.conversationParticipant.findUnique.mockResolvedValue({ id: 'p-1' })
    mockPrisma.message.findMany.mockRejectedValue(new Error('DB error'))

    const { getMessages } = await importModule()
    const result = unwrap(await getMessages('conv-1'))
    expect(result).toMatchObject({ success: false })
  })
})

// ============================================================
// getUnreadMessageCount
// ============================================================

describe('getUnreadMessageCount', () => {
  it('認証失敗時にcount: 0を返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })
    const { getUnreadMessageCount } = await importModule()
    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(0)
  })

  it('未読メッセージ数を正しくカウントする', async () => {
    const now = new Date('2026-01-02T00:00:00Z')
    const oldDate = new Date('2026-01-01T00:00:00Z')
    mockPrisma.conversationParticipant.findMany.mockResolvedValue([
      {
        userId: mockUser.id,
        lastReadAt: oldDate,
        conversation: {
          messages: [{ id: 'msg-1', createdAt: now, senderId: 'other-user' }],
        },
      },
      {
        userId: mockUser.id,
        lastReadAt: now,
        conversation: {
          messages: [{ id: 'msg-2', createdAt: oldDate, senderId: 'other-user' }],
        },
      },
    ])

    const { getUnreadMessageCount } = await importModule()
    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(1)
  })

  it('自分が送ったメッセージは未読カウントしない', async () => {
    const now = new Date('2026-01-02T00:00:00Z')
    mockPrisma.conversationParticipant.findMany.mockResolvedValue([
      {
        userId: mockUser.id,
        lastReadAt: null,
        conversation: {
          messages: [{ id: 'msg-1', createdAt: now, senderId: mockUser.id }],
        },
      },
    ])

    const { getUnreadMessageCount } = await importModule()
    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(0)
  })

  it('lastReadAtがnullでメッセージがある場合は未読', async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValue([
      {
        userId: mockUser.id,
        lastReadAt: null,
        conversation: {
          messages: [{ id: 'msg-1', createdAt: new Date(), senderId: 'other-user' }],
        },
      },
    ])

    const { getUnreadMessageCount } = await importModule()
    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(1)
  })

  it('メッセージがない会話はカウントしない', async () => {
    mockPrisma.conversationParticipant.findMany.mockResolvedValue([
      {
        userId: mockUser.id,
        lastReadAt: null,
        conversation: {
          messages: [],
        },
      },
    ])

    const { getUnreadMessageCount } = await importModule()
    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(0)
  })

  it('DB例外時にcount: 0を返す', async () => {
    mockPrisma.conversationParticipant.findMany.mockRejectedValue(new Error('DB error'))
    const { getUnreadMessageCount } = await importModule()
    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(0)
    expect(result.capReached).toBe(false)
  })
})

// ============================================================
// markAsRead
// ============================================================

describe('markAsRead', () => {
  it('認証失敗時にエラーを返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })
    const { markAsRead } = await importModule()
    const result = await markAsRead('conv-1')
    expect(result).toMatchObject({ success: false })
  })

  it('正常に既読にできる', async () => {
    mockPrisma.conversationParticipant.update.mockResolvedValue({})
    const { markAsRead } = await importModule()
    const result = await markAsRead('conv-1')
    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.conversationParticipant.update).toHaveBeenCalled()
  })

  it('DB例外時にエラーを返す', async () => {
    mockPrisma.conversationParticipant.update.mockRejectedValue(new Error('DB error'))
    const { markAsRead } = await importModule()
    const result = await markAsRead('conv-1')
    expect(result).toMatchObject({ success: false })
  })
})

// ============================================================
// deleteMessage
// ============================================================

describe('deleteMessage', () => {
  it('認証失敗時にエラーを返す', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })
    const { deleteMessage } = await importModule()
    const result = await deleteMessage('msg-1')
    expect(result).toMatchObject({ success: false })
  })

  it('メッセージが見つからない場合はエラー', async () => {
    mockPrisma.message.findUnique.mockResolvedValue(null)
    const { deleteMessage } = await importModule()
    const result = await deleteMessage('msg-999')
    expect(result).toMatchObject({ success: false })
  })

  it('他人のメッセージは削除できない', async () => {
    mockPrisma.message.findUnique.mockResolvedValue({
      id: 'msg-1',
      senderId: 'other-user-id',
      conversationId: 'conv-1',
    })
    const { deleteMessage } = await importModule()
    const result = await deleteMessage('msg-1')
    expect(result).toMatchObject({ success: false })
  })

  it('自分のメッセージを正常に削除できる', async () => {
    mockPrisma.message.findUnique.mockResolvedValue({
      id: 'msg-1',
      senderId: mockUser.id,
      conversationId: 'conv-1',
    })
    mockPrisma.message.delete.mockResolvedValue({})
    const { deleteMessage } = await importModule()
    const result = await deleteMessage('msg-1')
    expect(result).toMatchObject({ success: true })
    expect(mockPrisma.message.delete).toHaveBeenCalledWith({ where: { id: 'msg-1' } })
  })
})
