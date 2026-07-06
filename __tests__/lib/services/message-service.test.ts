// @vitest-environment node
/**
 * lib/services/message-service のユニットテスト。
 *
 * listConversations: orderBy に id タイブレークを追加した修正（同一 updatedAt での
 * 非決定順序排除）と native cursor（cursor:{id}, skip:1）の継続取得を検証する。
 *
 * startConversation / listConversationMessages / sendDirectMessage /
 * deleteDirectMessage / markConversationRead: 認可（参加者確認）・ブロック関係・
 * 日次上限・カーソル境界・通知発火を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockConversationFindMany = vi.fn()
const mockConversationFindFirst = vi.fn()
const mockConversationCreate = vi.fn()
const mockConversationUpdate = vi.fn()
const mockConversationParticipantFindUnique = vi.fn()
const mockConversationParticipantFindFirst = vi.fn()
const mockConversationParticipantUpdate = vi.fn()
const mockMessageFindMany = vi.fn()
const mockMessageCount = vi.fn()
const mockMessageCreate = vi.fn()
const mockMessageFindUnique = vi.fn()
const mockMessageDelete = vi.fn()
const mockBlockFindFirst = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findMany: (...args: unknown[]) => mockConversationFindMany(...args),
      findFirst: (...args: unknown[]) => mockConversationFindFirst(...args),
      create: (...args: unknown[]) => mockConversationCreate(...args),
      update: (...args: unknown[]) => mockConversationUpdate(...args),
    },
    conversationParticipant: {
      findUnique: (...args: unknown[]) => mockConversationParticipantFindUnique(...args),
      findFirst: (...args: unknown[]) => mockConversationParticipantFindFirst(...args),
      update: (...args: unknown[]) => mockConversationParticipantUpdate(...args),
    },
    message: {
      findMany: (...args: unknown[]) => mockMessageFindMany(...args),
      count: (...args: unknown[]) => mockMessageCount(...args),
      create: (...args: unknown[]) => mockMessageCreate(...args),
      findUnique: (...args: unknown[]) => mockMessageFindUnique(...args),
      delete: (...args: unknown[]) => mockMessageDelete(...args),
    },
    block: {
      findFirst: (...args: unknown[]) => mockBlockFindFirst(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/prisma/shared-includes', () => ({
  USER_MINIMAL_RELATION: { select: { id: true, nickname: true, avatarUrl: true } },
}))

const mockCheckInteractionEligibility = vi.fn()
vi.mock('@/lib/services/user-eligibility', () => ({
  checkInteractionEligibility: (...args: unknown[]) => mockCheckInteractionEligibility(...args),
}))

const mockCreateNotification = vi.fn()
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeMessageContent: (s: string) => s,
}))

const USER_ID = 'user-cjld2cyuq0001'
const OTHER_ID = 'user-cjld2cyuq0002'

const makeConversationRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'conv-001',
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  participants: [
    { userId: USER_ID, lastReadAt: null, user: { id: USER_ID, nickname: '自分', avatarUrl: null } },
    { userId: OTHER_ID, lastReadAt: null, user: { id: OTHER_ID, nickname: '相手', avatarUrl: null } },
  ],
  messages: [],
  ...overrides,
})

describe('listConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('orderBy は [{updatedAt: desc}, {id: desc}]（同一 updatedAt のタイブレーク）', async () => {
    mockConversationFindMany.mockResolvedValue([])

    const { listConversations } = await import('@/lib/services/message-service')
    await listConversations(USER_ID)

    const callArgs = mockConversationFindMany.mock.calls[0]?.[0] as { orderBy: unknown }
    expect(callArgs?.orderBy).toEqual([{ updatedAt: 'desc' }, { id: 'desc' }])
  })

  it('cursor 指定時: native cursor（cursor:{id}, skip:1）が渡される', async () => {
    mockConversationFindMany.mockResolvedValue([])

    const { listConversations } = await import('@/lib/services/message-service')
    await listConversations(USER_ID, 'conv-cursor-id')

    const callArgs = mockConversationFindMany.mock.calls[0]?.[0] as {
      cursor?: { id: string }
      skip?: number
    }
    expect(callArgs?.cursor).toEqual({ id: 'conv-cursor-id' })
    expect(callArgs?.skip).toBe(1)
  })

  it('cursor 未指定: findMany に cursor/skip が渡らない', async () => {
    mockConversationFindMany.mockResolvedValue([])

    const { listConversations } = await import('@/lib/services/message-service')
    await listConversations(USER_ID)

    const callArgs = mockConversationFindMany.mock.calls[0]?.[0] as {
      cursor?: unknown
      skip?: number
    }
    expect(callArgs?.cursor).toBeUndefined()
    expect(callArgs?.skip).toBeUndefined()
  })

  it('2ページ目継続: 1ページ目の nextCursor を渡すと native cursor で欠落・重複なく継続取得できる', async () => {
    const page1Records = Array.from({ length: 20 }, (_, i) =>
      makeConversationRow({ id: `conv-${String(i).padStart(2, '0')}` }),
    )
    const page2Records = Array.from({ length: 5 }, (_, i) =>
      makeConversationRow({ id: `conv-${String(i + 20).padStart(2, '0')}` }),
    )

    mockConversationFindMany.mockResolvedValueOnce(page1Records)
    const { listConversations } = await import('@/lib/services/message-service')
    const page1 = await listConversations(USER_ID, undefined, 20)
    expect(page1.ok).toBe(true)
    if (!page1.ok) throw new Error('ok=false')
    expect(page1.data.items).toHaveLength(20)
    expect(page1.data.nextCursor).toBe('conv-19')

    mockConversationFindMany.mockResolvedValueOnce(page2Records)
    const page2 = await listConversations(USER_ID, page1.data.nextCursor ?? undefined, 20)
    expect(page2.ok).toBe(true)
    if (!page2.ok) throw new Error('ok=false')

    const page2CallArgs = mockConversationFindMany.mock.calls[1]?.[0] as {
      cursor?: { id: string }
      skip?: number
    }
    expect(page2CallArgs?.cursor).toEqual({ id: 'conv-19' })
    expect(page2CallArgs?.skip).toBe(1)

    const allIds = [...page1.data.items.map((c) => c.id), ...page2.data.items.map((c) => c.id)]
    expect(new Set(allIds).size).toBe(allIds.length)
    expect(page2.data.nextCursor).toBeNull()
  })

  it('prisma が例外をスローした場合 ok: false / INTERNAL_ERROR を返す', async () => {
    mockConversationFindMany.mockRejectedValue(new Error('DB error'))

    const { listConversations } = await import('@/lib/services/message-service')
    const result = await listConversations(USER_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('INTERNAL_ERROR')
  })

  it('最終メッセージが自分の送信の場合は hasUnread: false になる', async () => {
    mockConversationFindMany.mockResolvedValueOnce([
      makeConversationRow({
        messages: [
          { id: 'm1', content: 'hi', senderId: USER_ID, createdAt: new Date('2025-01-02T00:00:00Z') },
        ],
      }),
    ])

    const { listConversations } = await import('@/lib/services/message-service')
    const result = await listConversations(USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.data.items[0]?.hasUnread).toBe(false)
  })

  it('相手からの最終メッセージで自分が未読（lastReadAt が null）の場合は hasUnread: true になる', async () => {
    mockConversationFindMany.mockResolvedValueOnce([
      makeConversationRow({
        participants: [
          { userId: USER_ID, lastReadAt: null, user: { id: USER_ID, nickname: '自分', avatarUrl: null } },
          { userId: OTHER_ID, lastReadAt: null, user: { id: OTHER_ID, nickname: '相手', avatarUrl: null } },
        ],
        messages: [
          { id: 'm1', content: 'hi', senderId: OTHER_ID, createdAt: new Date('2025-01-02T00:00:00Z') },
        ],
      }),
    ])

    const { listConversations } = await import('@/lib/services/message-service')
    const result = await listConversations(USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.data.items[0]?.hasUnread).toBe(true)
  })

  it('相手からの最終メッセージが lastReadAt より前（既読済み）の場合は hasUnread: false になる', async () => {
    mockConversationFindMany.mockResolvedValueOnce([
      makeConversationRow({
        participants: [
          {
            userId: USER_ID,
            lastReadAt: new Date('2025-01-03T00:00:00Z'),
            user: { id: USER_ID, nickname: '自分', avatarUrl: null },
          },
          { userId: OTHER_ID, lastReadAt: null, user: { id: OTHER_ID, nickname: '相手', avatarUrl: null } },
        ],
        messages: [
          { id: 'm1', content: 'hi', senderId: OTHER_ID, createdAt: new Date('2025-01-02T00:00:00Z') },
        ],
      }),
    ])

    const { listConversations } = await import('@/lib/services/message-service')
    const result = await listConversations(USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.data.items[0]?.hasUnread).toBe(false)
  })

  it('メッセージが 1 件もない会話は lastMessage: null / hasUnread: false になる', async () => {
    mockConversationFindMany.mockResolvedValueOnce([makeConversationRow({ messages: [] })])

    const { listConversations } = await import('@/lib/services/message-service')
    const result = await listConversations(USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.data.items[0]?.lastMessage).toBeNull()
    expect(result.data.items[0]?.hasUnread).toBe(false)
  })

  it('相手参加者が存在しない場合（データ不整合）は otherUser: null になる', async () => {
    mockConversationFindMany.mockResolvedValueOnce([
      makeConversationRow({
        participants: [
          { userId: USER_ID, lastReadAt: null, user: { id: USER_ID, nickname: '自分', avatarUrl: null } },
        ],
      }),
    ])

    const { listConversations } = await import('@/lib/services/message-service')
    const result = await listConversations(USER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.data.items[0]?.otherUser).toBeNull()
  })
})

// ── startConversation ──────────────────────────────────────────

describe('startConversation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('自分自身を指定した場合は VALIDATION_ERROR / SELF_MESSAGE を返す', async () => {
    const { startConversation } = await import('@/lib/services/message-service')
    const result = await startConversation(USER_ID, USER_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(mockCheckInteractionEligibility).not.toHaveBeenCalled()
  })

  it('相手がブロック関係にある場合は FORBIDDEN を返す', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: false, reason: 'blocked' })

    const { startConversation } = await import('@/lib/services/message-service')
    const result = await startConversation(USER_ID, OTHER_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('FORBIDDEN')
  })

  it('相手が存在しない/停止/ゲストの場合は NOT_FOUND を返す', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: false, reason: 'not_found' })

    const { startConversation } = await import('@/lib/services/message-service')
    const result = await startConversation(USER_ID, OTHER_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('NOT_FOUND')
  })

  it('既存の会話がある場合は新規作成せずその conversationId を返す', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: true, target: { id: OTHER_ID, isPublic: true } })
    mockConversationFindFirst.mockResolvedValueOnce({ id: 'existing-conv-id' })

    const { startConversation } = await import('@/lib/services/message-service')
    const result = await startConversation(USER_ID, OTHER_ID)

    expect(result).toEqual({ ok: true, data: { conversationId: 'existing-conv-id' } })
    expect(mockConversationCreate).not.toHaveBeenCalled()
  })

  it('既存の会話がない場合は双方を参加者とする新規会話を作成する', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: true, target: { id: OTHER_ID, isPublic: true } })
    mockConversationFindFirst.mockResolvedValueOnce(null)
    mockConversationCreate.mockResolvedValueOnce({ id: 'new-conv-id' })

    const { startConversation } = await import('@/lib/services/message-service')
    const result = await startConversation(USER_ID, OTHER_ID)

    expect(result).toEqual({ ok: true, data: { conversationId: 'new-conv-id' } })
    expect(mockConversationCreate).toHaveBeenCalledWith({
      data: { participants: { create: [{ userId: USER_ID }, { userId: OTHER_ID }] } },
    })
  })

  it('DB エラー時は INTERNAL_ERROR を返す', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: true, target: { id: OTHER_ID, isPublic: true } })
    mockConversationFindFirst.mockRejectedValueOnce(new Error('DB error'))

    const { startConversation } = await import('@/lib/services/message-service')
    const result = await startConversation(USER_ID, OTHER_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('INTERNAL_ERROR')
  })
})

// ── listConversationMessages ────────────────────────────────────

describe('listConversationMessages', () => {
  const CONVERSATION_ID = 'conv-001'

  beforeEach(() => {
    vi.clearAllMocks()
    mockConversationParticipantUpdate.mockResolvedValue({})
  })

  it('参加者でない場合は FORBIDDEN を返しメッセージ取得を行わない', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce(null)

    const { listConversationMessages } = await import('@/lib/services/message-service')
    const result = await listConversationMessages(USER_ID, CONVERSATION_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('FORBIDDEN')
    expect(mockMessageFindMany).not.toHaveBeenCalled()
  })

  it('cursor 未指定時は MESSAGES_PAGE_LIMIT をデフォルト limit として使う', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce({ conversationId: CONVERSATION_ID, userId: USER_ID })
    mockMessageFindMany.mockResolvedValueOnce([])

    const { listConversationMessages } = await import('@/lib/services/message-service')
    await listConversationMessages(USER_ID, CONVERSATION_ID)

    const { MESSAGES_PAGE_LIMIT } = await import('@/lib/constants/limits')
    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MESSAGES_PAGE_LIMIT }),
    )
  })

  it('cursor 指定時: native cursor（cursor:{id}, skip:1）が渡される', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce({ conversationId: CONVERSATION_ID, userId: USER_ID })
    mockMessageFindMany.mockResolvedValueOnce([])

    const { listConversationMessages } = await import('@/lib/services/message-service')
    await listConversationMessages(USER_ID, CONVERSATION_ID, 'msg-cursor-id')

    expect(mockMessageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'msg-cursor-id' }, skip: 1 }),
    )
  })

  it('取得件数が limit ちょうどのとき nextCursor は最古メッセージの id になる（reverse 前の最後の要素）', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce({ conversationId: CONVERSATION_ID, userId: USER_ID })
    // DESC（新→古）で返る: msg-19（最新）〜msg-0（最古）
    const descRows = Array.from({ length: 20 }, (_, i) => ({
      id: `msg-${19 - i}`,
      conversationId: CONVERSATION_ID,
      content: `content-${19 - i}`,
      senderId: OTHER_ID,
      createdAt: new Date(2024, 0, 20 - i),
      sender: { id: OTHER_ID, nickname: '相手', avatarUrl: null },
    }))
    mockMessageFindMany.mockResolvedValueOnce(descRows)

    const { listConversationMessages } = await import('@/lib/services/message-service')
    const result = await listConversationMessages(USER_ID, CONVERSATION_ID, undefined, 20)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.data.nextCursor).toBe('msg-0')
    // reverse 後は最古(msg-0)が先頭になる
    expect(result.data.items[0]?.id).toBe('msg-0')
    expect(result.data.items[result.data.items.length - 1]?.id).toBe('msg-19')
  })

  it('取得件数が limit 未満のとき nextCursor は null になる', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce({ conversationId: CONVERSATION_ID, userId: USER_ID })
    mockMessageFindMany.mockResolvedValueOnce([
      {
        id: 'msg-1',
        conversationId: CONVERSATION_ID,
        content: 'hello',
        senderId: OTHER_ID,
        createdAt: new Date(),
        sender: { id: OTHER_ID, nickname: '相手', avatarUrl: null },
      },
    ])

    const { listConversationMessages } = await import('@/lib/services/message-service')
    const result = await listConversationMessages(USER_ID, CONVERSATION_ID, undefined, 20)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.data.nextCursor).toBeNull()
  })

  it('呼び出しごとに lastReadAt を現在時刻に更新する（ポーリング前提の既読処理）', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce({ conversationId: CONVERSATION_ID, userId: USER_ID })
    mockMessageFindMany.mockResolvedValueOnce([])

    const { listConversationMessages } = await import('@/lib/services/message-service')
    await listConversationMessages(USER_ID, CONVERSATION_ID)

    expect(mockConversationParticipantUpdate).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId: CONVERSATION_ID, userId: USER_ID } },
      data: { lastReadAt: expect.any(Date) },
    })
  })

  it('DB エラー時は INTERNAL_ERROR を返す', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce({ conversationId: CONVERSATION_ID, userId: USER_ID })
    mockMessageFindMany.mockRejectedValueOnce(new Error('DB error'))

    const { listConversationMessages } = await import('@/lib/services/message-service')
    const result = await listConversationMessages(USER_ID, CONVERSATION_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('INTERNAL_ERROR')
  })
})

// ── sendDirectMessage ───────────────────────────────────────────

describe('sendDirectMessage', () => {
  const CONVERSATION_ID = 'conv-001'

  beforeEach(() => {
    vi.clearAllMocks()
    mockConversationParticipantFindUnique.mockResolvedValue({ conversationId: CONVERSATION_ID, userId: USER_ID })
    mockMessageCount.mockResolvedValue(0)
    mockConversationParticipantFindFirst.mockResolvedValue({ conversationId: CONVERSATION_ID, userId: OTHER_ID })
    mockBlockFindFirst.mockResolvedValue(null)
    mockConversationUpdate.mockResolvedValue({})
    mockCreateNotification.mockResolvedValue(undefined)
  })

  it('空文字コンテンツは VALIDATION_ERROR / CONTENT_REQUIRED を返し DB にアクセスしない', async () => {
    const { sendDirectMessage } = await import('@/lib/services/message-service')
    const result = await sendDirectMessage(USER_ID, CONVERSATION_ID, '   ')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(mockConversationParticipantFindUnique).not.toHaveBeenCalled()
  })

  it('MAX_MESSAGE_LENGTH を超えるコンテンツは VALIDATION_ERROR / TOO_LONG を返す', async () => {
    const { MAX_MESSAGE_LENGTH } = await import('@/lib/constants/limits')
    const { sendDirectMessage } = await import('@/lib/services/message-service')
    const result = await sendDirectMessage(USER_ID, CONVERSATION_ID, 'a'.repeat(MAX_MESSAGE_LENGTH + 1))

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('VALIDATION_ERROR')
  })

  it('参加者でない場合は FORBIDDEN を返す', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce(null)

    const { sendDirectMessage } = await import('@/lib/services/message-service')
    const result = await sendDirectMessage(USER_ID, CONVERSATION_ID, 'こんにちは')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('FORBIDDEN')
  })

  it('日次送信上限に達している場合は VALIDATION_ERROR / DAILY_LIMIT を返す', async () => {
    const { DAILY_MESSAGE_LIMIT } = await import('@/lib/constants/limits')
    mockMessageCount.mockResolvedValueOnce(DAILY_MESSAGE_LIMIT)

    const { sendDirectMessage } = await import('@/lib/services/message-service')
    const result = await sendDirectMessage(USER_ID, CONVERSATION_ID, 'こんにちは')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('VALIDATION_ERROR')
    expect(mockMessageCreate).not.toHaveBeenCalled()
  })

  it('相手とブロック関係にある場合（会話作成後の再チェック）は FORBIDDEN を返す', async () => {
    mockBlockFindFirst.mockResolvedValueOnce({ blockerId: OTHER_ID, blockedId: USER_ID })

    const { sendDirectMessage } = await import('@/lib/services/message-service')
    const result = await sendDirectMessage(USER_ID, CONVERSATION_ID, 'こんにちは')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('FORBIDDEN')
    expect(mockMessageCreate).not.toHaveBeenCalled()
  })

  it('正常系: メッセージを保存し会話の updatedAt を更新して相手に通知する', async () => {
    mockMessageCreate.mockResolvedValueOnce({
      id: 'msg-new',
      conversationId: CONVERSATION_ID,
      content: 'こんにちは',
      senderId: USER_ID,
      createdAt: new Date(),
      sender: { id: USER_ID, nickname: '自分', avatarUrl: null },
    })

    const { sendDirectMessage } = await import('@/lib/services/message-service')
    const result = await sendDirectMessage(USER_ID, CONVERSATION_ID, 'こんにちは')

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.data.message.content).toBe('こんにちは')
    expect(mockConversationUpdate).toHaveBeenCalledWith({
      where: { id: CONVERSATION_ID },
      data: { updatedAt: expect.any(Date) },
    })
    expect(mockCreateNotification).toHaveBeenCalledWith({
      userId: OTHER_ID,
      actorId: USER_ID,
      type: 'message',
      conversationId: CONVERSATION_ID,
    })
  })

  it('相手参加者がいない場合（データ不整合）は通知を送らない', async () => {
    mockConversationParticipantFindFirst.mockResolvedValueOnce(null)
    mockMessageCreate.mockResolvedValueOnce({
      id: 'msg-new',
      conversationId: CONVERSATION_ID,
      content: 'こんにちは',
      senderId: USER_ID,
      createdAt: new Date(),
      sender: { id: USER_ID, nickname: '自分', avatarUrl: null },
    })

    const { sendDirectMessage } = await import('@/lib/services/message-service')
    const result = await sendDirectMessage(USER_ID, CONVERSATION_ID, 'こんにちは')

    expect(result.ok).toBe(true)
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('通知の送信に失敗してもメッセージ送信自体は成功として扱う（fire-and-forget）', async () => {
    mockCreateNotification.mockRejectedValueOnce(new Error('notification error'))
    mockMessageCreate.mockResolvedValueOnce({
      id: 'msg-new',
      conversationId: CONVERSATION_ID,
      content: 'こんにちは',
      senderId: USER_ID,
      createdAt: new Date(),
      sender: { id: USER_ID, nickname: '自分', avatarUrl: null },
    })

    const { sendDirectMessage } = await import('@/lib/services/message-service')
    const result = await sendDirectMessage(USER_ID, CONVERSATION_ID, 'こんにちは')

    expect(result.ok).toBe(true)
  })

  it('DB エラー時は INTERNAL_ERROR を返す', async () => {
    mockMessageCreate.mockRejectedValueOnce(new Error('DB error'))

    const { sendDirectMessage } = await import('@/lib/services/message-service')
    const result = await sendDirectMessage(USER_ID, CONVERSATION_ID, 'こんにちは')

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('INTERNAL_ERROR')
  })
})

// ── deleteDirectMessage ─────────────────────────────────────────

describe('deleteDirectMessage', () => {
  const MESSAGE_ID = 'msg-001'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('メッセージが存在しない場合は NOT_FOUND を返す', async () => {
    mockMessageFindUnique.mockResolvedValueOnce(null)

    const { deleteDirectMessage } = await import('@/lib/services/message-service')
    const result = await deleteDirectMessage(USER_ID, MESSAGE_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('NOT_FOUND')
    expect(mockMessageDelete).not.toHaveBeenCalled()
  })

  it('他人のメッセージを削除しようとした場合は FORBIDDEN を返す', async () => {
    mockMessageFindUnique.mockResolvedValueOnce({ id: MESSAGE_ID, senderId: OTHER_ID })

    const { deleteDirectMessage } = await import('@/lib/services/message-service')
    const result = await deleteDirectMessage(USER_ID, MESSAGE_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('FORBIDDEN')
    expect(mockMessageDelete).not.toHaveBeenCalled()
  })

  it('正常系: 自分のメッセージを削除する', async () => {
    mockMessageFindUnique.mockResolvedValueOnce({ id: MESSAGE_ID, senderId: USER_ID })
    mockMessageDelete.mockResolvedValueOnce({ id: MESSAGE_ID })

    const { deleteDirectMessage } = await import('@/lib/services/message-service')
    const result = await deleteDirectMessage(USER_ID, MESSAGE_ID)

    expect(result).toEqual({ ok: true, data: undefined })
    expect(mockMessageDelete).toHaveBeenCalledWith({ where: { id: MESSAGE_ID } })
  })

  it('DB エラー時は INTERNAL_ERROR を返す', async () => {
    mockMessageFindUnique.mockRejectedValueOnce(new Error('DB error'))

    const { deleteDirectMessage } = await import('@/lib/services/message-service')
    const result = await deleteDirectMessage(USER_ID, MESSAGE_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('INTERNAL_ERROR')
  })
})

// ── markConversationRead ────────────────────────────────────────

describe('markConversationRead', () => {
  const CONVERSATION_ID = 'conv-001'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('参加者でない場合は FORBIDDEN を返し更新を行わない', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce(null)

    const { markConversationRead } = await import('@/lib/services/message-service')
    const result = await markConversationRead(USER_ID, CONVERSATION_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('FORBIDDEN')
    expect(mockConversationParticipantUpdate).not.toHaveBeenCalled()
  })

  it('正常系: lastReadAt を現在時刻に更新する', async () => {
    mockConversationParticipantFindUnique.mockResolvedValueOnce({ conversationId: CONVERSATION_ID, userId: USER_ID })
    mockConversationParticipantUpdate.mockResolvedValueOnce({})

    const { markConversationRead } = await import('@/lib/services/message-service')
    const result = await markConversationRead(USER_ID, CONVERSATION_ID)

    expect(result).toEqual({ ok: true, data: undefined })
    expect(mockConversationParticipantUpdate).toHaveBeenCalledWith({
      where: { conversationId_userId: { conversationId: CONVERSATION_ID, userId: USER_ID } },
      data: { lastReadAt: expect.any(Date) },
    })
  })

  it('DB エラー時は INTERNAL_ERROR を返す', async () => {
    mockConversationParticipantFindUnique.mockRejectedValueOnce(new Error('DB error'))

    const { markConversationRead } = await import('@/lib/services/message-service')
    const result = await markConversationRead(USER_ID, CONVERSATION_ID)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('ok=true')
    expect(result.code).toBe('INTERNAL_ERROR')
  })
})
