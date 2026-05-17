// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    mute: { findMany: vi.fn() },
    notification: { count: vi.fn() },
    conversationParticipant: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}))

vi.mock('@/lib/constants/limits', () => ({
  BADGES_CONVERSATIONS_LIMIT: 3,
}))

describe('GET /api/badges', async () => {
  const { auth } = await import('@/lib/auth')
  const { prisma } = await import('@/lib/db')

  const mockAuth = auth as ReturnType<typeof vi.fn>
  const mockMuteFindMany = prisma.mute.findMany as ReturnType<typeof vi.fn>
  const mockNotificationCount = prisma.notification.count as ReturnType<typeof vi.fn>
  const mockParticipantFindMany = prisma.conversationParticipant.findMany as ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証の場合 notifications:0, messages:0 を返す', async () => {
    mockAuth.mockResolvedValue(null)

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data).toEqual({ notifications: 0, messages: 0 })
  })

  it('認証済みユーザーの正しい通知数を返す（ミュートユーザー除外）', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([{ mutedId: 'muted1' }, { mutedId: 'muted2' }])
    mockNotificationCount.mockResolvedValue(5)
    mockParticipantFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data.notifications).toBe(5)

    // ミュートユーザー除外の条件が使われていることを確認
    expect(mockNotificationCount).toHaveBeenCalledWith({
      where: {
        userId: 'user1',
        isRead: false,
        actorId: { notIn: ['muted1', 'muted2'] },
      },
    })
  })

  it('ミュートユーザーがいない場合 actorId フィルタなしで通知を数える', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([])
    mockNotificationCount.mockResolvedValue(3)
    mockParticipantFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data.notifications).toBe(3)
    expect(mockNotificationCount).toHaveBeenCalledWith({
      where: {
        userId: 'user1',
        isRead: false,
      },
    })
  })

  it('未読メッセージ数を正しく返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([])
    mockNotificationCount.mockResolvedValue(0)

    const oldDate = new Date('2024-01-01')
    const newDate = new Date('2024-06-01')

    mockParticipantFindMany.mockResolvedValue([
      {
        lastReadAt: oldDate,
        conversation: {
          messages: [{ senderId: 'other1', createdAt: newDate }],
        },
      },
      {
        lastReadAt: newDate,
        conversation: {
          messages: [{ senderId: 'other2', createdAt: oldDate }],
        },
      },
    ])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    // 1つ目: lastReadAt < createdAt → 未読
    // 2つ目: lastReadAt > createdAt → 既読
    expect(data.messages).toBe(1)
  })

  it('自分が送ったメッセージは未読カウントしない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([])
    mockNotificationCount.mockResolvedValue(0)

    mockParticipantFindMany.mockResolvedValue([
      {
        lastReadAt: null,
        conversation: {
          messages: [{ senderId: 'user1', createdAt: new Date() }],
        },
      },
    ])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data.messages).toBe(0)
  })

  it('lastReadAt が null の場合、他者のメッセージは未読カウントする', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([])
    mockNotificationCount.mockResolvedValue(0)

    mockParticipantFindMany.mockResolvedValue([
      {
        lastReadAt: null,
        conversation: {
          messages: [{ senderId: 'other1', createdAt: new Date() }],
        },
      },
    ])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data.messages).toBe(1)
  })

  it('会話数がリミットに達した場合 messagesCapReached を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([])
    mockNotificationCount.mockResolvedValue(0)

    // BADGES_CONVERSATIONS_LIMIT = 3 なので3件返す
    mockParticipantFindMany.mockResolvedValue([
      { lastReadAt: null, conversation: { messages: [] } },
      { lastReadAt: null, conversation: { messages: [] } },
      { lastReadAt: null, conversation: { messages: [] } },
    ])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data.messagesCapReached).toBe(true)
  })

  it('会話数がリミット未満の場合 messagesCapReached は含まれない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([])
    mockNotificationCount.mockResolvedValue(0)

    mockParticipantFindMany.mockResolvedValue([
      { lastReadAt: null, conversation: { messages: [] } },
    ])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data.messagesCapReached).toBeUndefined()
  })

  it('通知取得エラー時は notifications:0 を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([])
    mockNotificationCount.mockRejectedValue(new Error('Count error'))
    mockParticipantFindMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data.notifications).toBe(0)
    expect(data.messages).toBe(0)
  })

  it('lastReadAt > createdAt のメッセージは既読扱い', async () => {
    const now = new Date()
    const futureDate = new Date(now.getTime() + 1000)

    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([])
    mockNotificationCount.mockResolvedValue(0)
    mockParticipantFindMany.mockResolvedValue([
      {
        lastReadAt: futureDate,
        conversation: {
          messages: [{ senderId: 'other1', createdAt: now }],
        },
      },
    ])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data.messages).toBe(0)
  })

  it('メッセージがない会話はカウントしない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user1' } })
    mockMuteFindMany.mockResolvedValue([])
    mockNotificationCount.mockResolvedValue(0)
    mockParticipantFindMany.mockResolvedValue([
      {
        lastReadAt: null,
        conversation: {
          messages: [],
        },
      },
    ])

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data.messages).toBe(0)
  })

  it('エラー発生時に notifications:0, messages:0 を返す', async () => {
    mockAuth.mockRejectedValue(new Error('Auth failed'))

    const { GET } = await import('@/app/api/badges/route')
    const response = await GET()
    const data = await response.json()

    expect(data).toEqual({ notifications: 0, messages: 0 })
  })
})
