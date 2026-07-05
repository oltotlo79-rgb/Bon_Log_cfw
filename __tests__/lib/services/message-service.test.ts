// @vitest-environment node
/**
 * lib/services/message-service の listConversations ユニットテスト。
 *
 * orderBy に id タイブレークを追加した修正（同一 updatedAt での非決定順序排除）と
 * native cursor（cursor:{id}, skip:1）の継続取得を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockConversationFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    conversation: {
      findMany: (...args: unknown[]) => mockConversationFindMany(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/prisma/shared-includes', () => ({
  USER_MINIMAL_RELATION: { select: { id: true, nickname: true, avatarUrl: true } },
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
})
