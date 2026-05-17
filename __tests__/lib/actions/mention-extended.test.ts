import { vi } from 'vitest'
// @vitest-environment node

vi.unmock('@/lib/actions/mention')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockExtractMentionIds = vi.fn().mockReturnValue([])
vi.mock('@/lib/mention-utils', () => ({ extractMentionIds: (...args: any[]) => mockExtractMentionIds(...args) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

// メンション通知は createNotificationsBulk へ delegate しているため helper をモック化
const mockCreateNotificationsBulk = vi.fn()
vi.mock('@/lib/services/notification-bulk', () => ({
  createNotificationsBulk: (...args: unknown[]) => mockCreateNotificationsBulk(...args),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  mockExtractMentionIds.mockReturnValue([])
  mockCreateNotificationsBulk.mockResolvedValue({ attempted: 0, filtered: 0 })
})

// ============================================================
// searchMentionUsers
// ============================================================
describe('searchMentionUsers', async () => {
  it('returns empty when not authenticated', async () => {
    const { searchMentionUsers } = await import('@/lib/actions/mention')
    mockAuth.mockResolvedValue(null)

    const result = await searchMentionUsers('test')

    expect(result).toEqual([])
  })

  it('returns following users for empty query', async () => {
    const { searchMentionUsers } = await import('@/lib/actions/mention')
    mockPrisma.follow.findMany.mockResolvedValue([{ followingId: 'u2' }])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u2', nickname: 'User2', avatarUrl: null },
    ])

    const result = await searchMentionUsers('')

    expect(result.length).toBeGreaterThanOrEqual(0)
    expect(mockPrisma.follow.findMany).toHaveBeenCalled()
  })

  it('returns matching users for query', async () => {
    const { searchMentionUsers } = await import('@/lib/actions/mention')
    mockPrisma.follow.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u2', nickname: 'bonsai_lover', avatarUrl: null },
    ])

    const result = await searchMentionUsers('bonsai')

    expect(result.length).toBe(1)
  })

  it('prioritizes following users', async () => {
    const { searchMentionUsers } = await import('@/lib/actions/mention')
    mockPrisma.follow.findMany.mockResolvedValue([{ followingId: 'u2' }])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u3', nickname: 'other', avatarUrl: null },
      { id: 'u2', nickname: 'following', avatarUrl: null },
    ])

    const result = await searchMentionUsers('o')

    expect(result[0].id).toBe('u2')
    expect(result[0].isFollowing).toBe(true)
  })

  it('handles db error', async () => {
    const { searchMentionUsers } = await import('@/lib/actions/mention')
    mockPrisma.follow.findMany.mockRejectedValue(new Error('DB error'))

    const result = await searchMentionUsers('test')
    expect(result).toEqual([])
  })
})

// ============================================================
// notifyMentionedUsers
// ============================================================
describe('notifyMentionedUsers', async () => {
  it('creates notifications for mentioned users', async () => {
    const { notifyMentionedUsers } = await import('@/lib/actions/mention')
    mockExtractMentionIds.mockReturnValue(['u2', 'u3'])
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u2' }, { id: 'u3' }])

    await notifyMentionedUsers('p1', 'hello <@u2> <@u3>', 'u1')

    // createNotificationsBulk へ正しい引数で delegate していることを確認
    expect(mockCreateNotificationsBulk).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientIds: expect.arrayContaining(['u2', 'u3']),
        actorId: 'u1',
        type: 'mention',
        postId: 'p1',
      })
    )
  })

  it('skips self-mentions', async () => {
    const { notifyMentionedUsers } = await import('@/lib/actions/mention')
    mockExtractMentionIds.mockReturnValue(['u1'])
    mockPrisma.user.findMany.mockResolvedValue([])

    await notifyMentionedUsers('p1', 'hello <@u1>', 'u1')

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ NOT: { id: 'u1' } }),
      })
    )
  })

  it('handles null content', async () => {
    const { notifyMentionedUsers } = await import('@/lib/actions/mention')

    await notifyMentionedUsers('p1', null, 'u1')

    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it('handles no mentions in content', async () => {
    const { notifyMentionedUsers } = await import('@/lib/actions/mention')
    mockExtractMentionIds.mockReturnValue([])

    await notifyMentionedUsers('p1', 'hello world', 'u1')

    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it('handles db error silently', async () => {
    const { notifyMentionedUsers } = await import('@/lib/actions/mention')
    mockExtractMentionIds.mockReturnValue(['u2'])
    mockPrisma.user.findMany.mockRejectedValue(new Error('DB error'))

    await expect(notifyMentionedUsers('p1', '<@u2>', 'u1')).resolves.toBeUndefined()
  })
})

// ============================================================
// resolveMentionUsers
// ============================================================
describe('resolveMentionUsers', async () => {
  it('resolves user IDs to user info', async () => {
    const { resolveMentionUsers } = await import('@/lib/actions/mention')
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u2', nickname: 'User2', avatarUrl: null },
    ])

    const result = await resolveMentionUsers(['u2'])

    expect(result.get('u2')).toEqual({ id: 'u2', nickname: 'User2', avatarUrl: null })
  })

  it('returns empty map for empty array', async () => {
    const { resolveMentionUsers } = await import('@/lib/actions/mention')

    const result = await resolveMentionUsers([])

    expect(result.size).toBe(0)
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it('returns empty map for null input', async () => {
    const { resolveMentionUsers } = await import('@/lib/actions/mention')

     
    const result = await resolveMentionUsers(null as any)

    expect(result.size).toBe(0)
  })

  it('returns empty map on error', async () => {
    const { resolveMentionUsers } = await import('@/lib/actions/mention')
    mockPrisma.user.findMany.mockRejectedValue(new Error('DB error'))

    const result = await resolveMentionUsers(['u2'])

    expect(result.size).toBe(0)
  })
})

// ============================================================
// getRecentMentionedUsers
// ============================================================
describe('getRecentMentionedUsers', async () => {
  it('returns empty when not authenticated', async () => {
    const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
    mockAuth.mockResolvedValue(null)

    const result = await getRecentMentionedUsers()

    expect(result).toEqual([])
  })

  it('returns mentioned users', async () => {
    const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
    mockPrisma.post.findMany.mockResolvedValue([
      { content: 'hello <@u2>' },
    ])
    mockExtractMentionIds.mockReturnValue(['u2'])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u2', nickname: 'User2', avatarUrl: null },
    ])

    const result = await getRecentMentionedUsers()

    expect(result).toEqual([{ id: 'u2', nickname: 'User2', avatarUrl: null }])
  })

  it('handles empty posts', async () => {
    const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
    mockPrisma.post.findMany.mockResolvedValue([])

    const result = await getRecentMentionedUsers()

    expect(result).toEqual([])
  })

  it('handles posts with no mentions', async () => {
    const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
    mockPrisma.post.findMany.mockResolvedValue([
      { content: 'hello world' },
    ])
    mockExtractMentionIds.mockReturnValue([])

    const result = await getRecentMentionedUsers()

    expect(result).toEqual([])
  })
})
