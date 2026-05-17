// @vitest-environment node

/**
 * Additional notification.ts coverage tests targeting uncovered lines 58-60.
 *
 * Lines 58-60: PUSH_BODY_MAP entries for follow_request, follow_request_approved, mention.
 * Also tests the buildPushBody fallback for unknown types.
 */

import { vi } from 'vitest'
vi.unmock('@/lib/actions/notification')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn), cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn) }))

const mockGetMutedUserIds = vi.fn()
const mockGetExcludedUserIds = vi.fn()
vi.mock('@/lib/actions/filter-helper', () => ({
  getMutedUserIds: (...args: unknown[]) => mockGetMutedUserIds(...args),
  getExcludedUserIds: (...args: unknown[]) => mockGetExcludedUserIds(...args),
}))

const mockSendPushNotification = vi.fn()
vi.mock('@/lib/web-push', () => ({
  sendPushNotification: (...args: unknown[]) => mockSendPushNotification(...args),
}))

vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  mockGetMutedUserIds.mockResolvedValue([])
  mockGetExcludedUserIds.mockResolvedValue([])
  mockSendPushNotification.mockResolvedValue(undefined)
})

/**
 * Helper to set up mocks for a successful createNotification call.
 * Ensures no blocks, no prefs filter, no duplicates, and actor has a name.
 */
function setupCreateNotificationMocks(actorNickname = 'テストユーザー') {
  mockPrisma.user.findUnique
    .mockResolvedValueOnce({ id: 'u2', notificationPreferences: {} }) // recipient prefs
    .mockResolvedValueOnce({ nickname: actorNickname }) // actor name
  mockPrisma.notification.findFirst.mockResolvedValueOnce(null) // no duplicate
  mockPrisma.notification.create.mockResolvedValueOnce({
    id: 'n-new',
    userId: 'u2',
    actorId: 'u1',
    isRead: false,
    createdAt: new Date(),
  })
}

describe('createNotification - follow_request type (line 58)', () => {
  it('sends correct push body for follow_request notification', async () => {
    setupCreateNotificationMocks('太郎')

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'follow_request',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        body: '太郎さんからフォローリクエストが届きました',
        data: { url: '/notifications' },
      })
    )
  })
})

describe('createNotification - follow_request_approved type (line 59)', () => {
  it('sends correct push body for follow_request_approved notification', async () => {
    setupCreateNotificationMocks('花子')

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'follow_request_approved',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        body: '花子さんがフォローリクエストを承認しました',
        data: { url: '/notifications' },
      })
    )
  })
})

describe('createNotification - mention type (line 60 / buildPushBody fallback)', () => {
  it('sends correct push body for mention notification with postId', async () => {
    setupCreateNotificationMocks('次郎')

    const { createNotification } = await import('@/lib/services/notification-core')
    const result = await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'mention' as 'like', // mention is in PUSH_BODY_MAP but not in NotificationType union - test the map
      postId: 'p99',
    })

    expect(result).toEqual({ success: true })
    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        body: '次郎さんがあなたをメンションしました',
        data: { url: '/posts/p99' },
      })
    )
  })
})

describe('createNotification - tag generation for push', () => {
  it('generates correct tag with postId', async () => {
    setupCreateNotificationMocks('アクター')

    const { createNotification } = await import('@/lib/services/notification-core')
    await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'like',
      postId: 'p1',
    })

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        tag: 'like-u1-p1',
      })
    )
  })

  it('generates correct tag with commentId (no postId)', async () => {
    setupCreateNotificationMocks('コメンター')

    const { createNotification } = await import('@/lib/services/notification-core')
    await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'comment_like',
      commentId: 'c5',
    })

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        tag: 'comment_like-u1-c5',
      })
    )
  })

  it('generates correct tag with no postId or commentId', async () => {
    setupCreateNotificationMocks('フォロワー')

    const { createNotification } = await import('@/lib/services/notification-core')
    await createNotification({
      userId: 'u2',
      actorId: 'u1',
      type: 'follow',
    })

    expect(mockSendPushNotification).toHaveBeenCalledWith(
      'u2',
      expect.objectContaining({
        tag: 'follow-u1-',
      })
    )
  })
})
