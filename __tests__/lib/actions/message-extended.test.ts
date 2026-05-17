import { vi } from 'vitest'
/**
 * Extended message tests - getOrCreateConversation, sendMessage, getConversations, getMessages, markAsRead, deleteMessage
 */
 export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, Record<string, unknown>> = {
  message: { create: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), count: vi.fn(), delete: vi.fn() },
  conversation: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  conversationParticipant: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn() },
  block: { findFirst: vi.fn() },
  notification: { create: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }, logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

/**
 * `ActionResult<T>` を旧フラット形状に展開する互換ヘルパー（message 移行用）。
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


beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
})

describe('getOrCreateConversation', async () => {
  it('returns error when targetUserId is empty (Zod)', async () => {
    const { getOrCreateConversation } = await import('@/lib/actions/message')
    const result = await getOrCreateConversation('')
    expect(result).toHaveProperty('error')
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { getOrCreateConversation } = await import('@/lib/actions/message')
    const result = await getOrCreateConversation('u2')
    expect(result).toHaveProperty('error')
  })

  it('prevents conversation with self', async () => {
    const { getOrCreateConversation } = await import('@/lib/actions/message')
    const result = await getOrCreateConversation('u1')
    expect(result).toHaveProperty('error')
  })

  it('rejects if user not found', async () => {
    const { getOrCreateConversation } = await import('@/lib/actions/message')
    ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(mockPrisma.block.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'b1' })

    const result = await getOrCreateConversation('u999')
    expect(result).toHaveProperty('error')
  })

  it('rejects if blocked', async () => {
    const { getOrCreateConversation } = await import('@/lib/actions/message')
    ;(mockPrisma.block.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'b1' })

    const result = await getOrCreateConversation('u2')
    expect(result).toHaveProperty('error')
  })

  it('returns existing conversation', async () => {
    const { getOrCreateConversation } = await import('@/lib/actions/message')
    ;(mockPrisma.block.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(mockPrisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'conv1' })

    const result = await getOrCreateConversation('u2')
    expect(result).toMatchObject({ success: true, data: { conversationId: 'conv1' } })
  })

  it('creates new conversation', async () => {
    const { getOrCreateConversation } = await import('@/lib/actions/message')
    ;(mockPrisma.block.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(mockPrisma.conversation.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(mockPrisma.conversation.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'conv2' })

    const result = await getOrCreateConversation('u2')
    expect(result).toMatchObject({ success: true, data: { conversationId: 'conv2' } })
  })
})

describe('sendMessage', async () => {
  it('returns error when conversationId is empty (Zod)', async () => {
    const { sendMessage } = await import('@/lib/actions/message')
    const result = await sendMessage('', 'hello')
    expect(result).toHaveProperty('error')
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { sendMessage } = await import('@/lib/actions/message')
    const result = await sendMessage('conv1', 'hello')
    expect(result).toHaveProperty('error')
  })

  it('rejects empty message', async () => {
    const { sendMessage } = await import('@/lib/actions/message')
    const result = await sendMessage('conv1', '')
    expect(result).toHaveProperty('error')
  })

  it('sends message successfully', async () => {
    const { sendMessage } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'cp1', conversationId: 'conv1' })
    ;(mockPrisma.message.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
    ;(mockPrisma.conversationParticipant.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u2' })
    ;(mockPrisma.block.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(mockPrisma.message.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', content: 'hello', sender: { id: 'u1' } })
    ;(mockPrisma.conversation.update as ReturnType<typeof vi.fn>).mockResolvedValue({})
    ;(mockPrisma.notification.create as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await sendMessage('conv1', 'hello')
    expect(result).toHaveProperty('success', true)
  })

  it('rejects if not participant', async () => {
    const { sendMessage } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await sendMessage('conv1', 'hello')
    expect(result).toHaveProperty('error')
  })

  it('rejects too long message', async () => {
    const { sendMessage } = await import('@/lib/actions/message')
    const result = await sendMessage('conv1', 'a'.repeat(1001))
    expect(result).toHaveProperty('error')
  })
})

describe('getConversations', async () => {
  it('returns empty when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getConversations } = await import('@/lib/actions/message')
    const result = unwrap(await getConversations())
    expect(result.conversations).toEqual([])
  })

  it('returns user conversations', async () => {
    const { getConversations } = await import('@/lib/actions/message')
    ;(mockPrisma.conversation.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'conv1',
        updatedAt: new Date(),
        participants: [
          { userId: 'u1', lastReadAt: new Date(), user: { id: 'u1', nickname: 'User1', avatarUrl: null } },
          { userId: 'u2', lastReadAt: null, user: { id: 'u2', nickname: 'User2', avatarUrl: null } },
        ],
        messages: [{ content: 'hi', createdAt: new Date(), senderId: 'u2' }],
      },
    ])

    const result = unwrap(await getConversations())
    expect(result.conversations).toHaveLength(1)
  })
})

describe('getMessages', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { getMessages } = await import('@/lib/actions/message')
    const result = unwrap(await getMessages('conv1'))
    expect(result).toHaveProperty('error')
  })

  it('returns messages', async () => {
    const { getMessages } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'cp1' })
    ;(mockPrisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 'm1', content: 'hello', senderId: 'u1', createdAt: new Date(), sender: { id: 'u1' } },
    ])
    ;(mockPrisma.conversationParticipant.update as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = unwrap(await getMessages('conv1'))
    expect(result).toHaveProperty('messages')
  })

  it('rejects if not participant', async () => {
    const { getMessages } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = unwrap(await getMessages('conv1'))
    expect(result).toHaveProperty('error')
  })

  it('supports cursor pagination', async () => {
    const { getMessages } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'cp1' })
    ;(mockPrisma.message.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.conversationParticipant.update as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = unwrap(await getMessages('conv1', 'm0', 10))
    expect(result).toHaveProperty('messages')
  })
})

describe('markAsRead', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { markAsRead } = await import('@/lib/actions/message')
    const result = await markAsRead('conv1')
    expect(result).toHaveProperty('error')
  })

  it('marks messages as read', async () => {
    const { markAsRead } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.update as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await markAsRead('conv1')
    expect(result).toHaveProperty('success', true)
  })
})

describe('deleteMessage', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteMessage } = await import('@/lib/actions/message')
    const result = await deleteMessage('m1')
    expect(result).toHaveProperty('error')
  })

  it('deletes own message', async () => {
    const { deleteMessage } = await import('@/lib/actions/message')
    ;(mockPrisma.message.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', senderId: 'u1', conversationId: 'conv1' })
    ;(mockPrisma.message.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})

    const result = await deleteMessage('m1')
    expect(result).toHaveProperty('success', true)
  })

  it('rejects non-owner message', async () => {
    const { deleteMessage } = await import('@/lib/actions/message')
    ;(mockPrisma.message.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'm1', senderId: 'other', conversationId: 'conv1' })

    const result = await deleteMessage('m1')
    expect(result).toHaveProperty('error')
  })

  it('rejects non-existent message', async () => {
    const { deleteMessage } = await import('@/lib/actions/message')
    ;(mockPrisma.message.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = await deleteMessage('m999')
    expect(result).toHaveProperty('error')
  })
})

describe('getUnreadMessageCount', async () => {
  it('returns count 0 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getUnreadMessageCount } = await import('@/lib/actions/message')
    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(0)
  })

  it('returns unread count', async () => {
    const { getUnreadMessageCount } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        userId: 'u1',
        lastReadAt: new Date(Date.now() - 3600000),
        conversation: {
          messages: [{ id: 'm1', senderId: 'u2', createdAt: new Date() }],
        },
      },
    ])

    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(1)
  })

  it('returns 0 when no conversations', async () => {
    const { getUnreadMessageCount } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(0)
  })

  it('does not count own messages as unread', async () => {
    const { getUnreadMessageCount } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        userId: 'u1',
        lastReadAt: new Date(Date.now() - 3600000),
        conversation: {
          messages: [{ id: 'm1', senderId: 'u1', createdAt: new Date() }],
        },
      },
    ])

    const result = unwrap(await getUnreadMessageCount())
    expect(result.count).toBe(0)
  })
})

describe('getConversation', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { getConversation } = await import('@/lib/actions/message')
    const result = unwrap(await getConversation('conv1'))
    expect(result).toHaveProperty('error')
  })

  it('returns conversation', async () => {
    const { getConversation } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'cp1' })
    ;(mockPrisma.conversation.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'conv1',
      participants: [
        { userId: 'u1', user: { id: 'u1', nickname: 'User1', avatarUrl: null } },
        { userId: 'u2', user: { id: 'u2', nickname: 'User2', avatarUrl: null } },
      ],
    })

    const result = unwrap(await getConversation('conv1'))
    expect(result).toHaveProperty('conversation')
  })

  it('rejects if not participant', async () => {
    const { getConversation } = await import('@/lib/actions/message')
    ;(mockPrisma.conversationParticipant.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)

    const result = unwrap(await getConversation('conv1'))
    expect(result).toHaveProperty('error')
  })
})
