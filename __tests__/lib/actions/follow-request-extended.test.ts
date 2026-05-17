// @vitest-environment node
import { vi } from 'vitest'
/**
 * Extended follow-request tests
 */

vi.unmock('@/lib/actions/follow-request')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

vi.mock('@/lib/actions/analytics', () => ({ recordNewFollower: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/actions/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
  deleteNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
  deleteNotification: vi.fn().mockResolvedValue({ success: true }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  mockCheckUserRateLimit.mockResolvedValue({ success: true })
})

describe('sendFollowRequest', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { sendFollowRequest } = await import('@/lib/actions/follow-request')
    const result = await sendFollowRequest('u2')
    expect(result).toHaveProperty('error')
  })

  it('prevents self-request', async () => {
    const { sendFollowRequest } = await import('@/lib/actions/follow-request')
    const result = await sendFollowRequest('u1')
    expect(result).toHaveProperty('error')
  })

  it('rejects if target not found', async () => {
    const { sendFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const result = await sendFollowRequest('u2')
    expect(result).toHaveProperty('error')
  })

  it('rejects if blocked', async () => {
    const { sendFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isPublic: false })
    mockPrisma.block.findUnique.mockResolvedValue({ id: 'b1' })
    const result = await sendFollowRequest('u2')
    expect(result).toHaveProperty('error')
  })

  it('rejects if already following', async () => {
    const { sendFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isPublic: false })
    mockPrisma.block.findUnique.mockResolvedValue(null)
    mockPrisma.follow.findUnique.mockResolvedValue({ id: 'f1' })
    const result = await sendFollowRequest('u2')
    expect(result).toHaveProperty('error')
  })

  it('rejects duplicate request', async () => {
    const { sendFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isPublic: false })
    mockPrisma.block.findUnique.mockResolvedValue(null)
    mockPrisma.follow.findUnique.mockResolvedValue(null)
    mockPrisma.followRequest.findUnique.mockResolvedValue({ id: 'fr1', status: 'pending' })
    const result = await sendFollowRequest('u2')
    expect(result).toHaveProperty('error')
  })

  it('sends request successfully', async () => {
    const { sendFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isPublic: false })
    mockPrisma.block.findUnique.mockResolvedValue(null)
    mockPrisma.follow.findUnique.mockResolvedValue(null)
    mockPrisma.followRequest.findUnique.mockResolvedValue(null)
    mockPrisma.followRequest.create.mockResolvedValue({ id: 'fr1' })
    mockPrisma.notification.create.mockResolvedValue({})
    const result = await sendFollowRequest('u2')
    expect(result).toHaveProperty('success', true)
  })

  it('rejects public account', async () => {
    const { sendFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isPublic: true })
    const result = await sendFollowRequest('u2')
    expect(result).toHaveProperty('error')
  })
})

describe('approveFollowRequest', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { approveFollowRequest } = await import('@/lib/actions/follow-request')
    const result = await approveFollowRequest('fr1')
    expect(result).toHaveProperty('error')
  })

  it('rejects non-existent request', async () => {
    const { approveFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue(null)
    const result = await approveFollowRequest('fr1')
    expect(result).toHaveProperty('error')
  })

  it('approves request successfully', async () => {
    const { approveFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue({
      id: 'fr1', requesterId: 'u2', targetId: 'u1', status: 'pending',
      requester: { id: 'u2', nickname: 'User2' },
    })
    mockPrisma.follow.create.mockResolvedValue({})
    mockPrisma.followRequest.delete.mockResolvedValue({})
    mockPrisma.notification.create.mockResolvedValue({})
    const result = await approveFollowRequest('fr1')
    expect(result).toHaveProperty('success', true)
  })

  it('rejects if not target user', async () => {
    const { approveFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue({
      id: 'fr1', requesterId: 'u2', targetId: 'u3', status: 'pending',
      requester: { id: 'u2', nickname: 'User2' },
    })
    const result = await approveFollowRequest('fr1')
    expect(result).toHaveProperty('error')
  })

  it('rejects already processed request', async () => {
    const { approveFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue({
      id: 'fr1', requesterId: 'u2', targetId: 'u1', status: 'approved',
      requester: { id: 'u2', nickname: 'User2' },
    })
    const result = await approveFollowRequest('fr1')
    expect(result).toHaveProperty('error')
  })
})

describe('rejectFollowRequest', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
    const result = await rejectFollowRequest('fr1')
    expect(result).toHaveProperty('error')
  })

  it('rejects non-existent request', async () => {
    const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue(null)
    const result = await rejectFollowRequest('fr1')
    expect(result).toHaveProperty('error')
  })

  it('rejects if not target user', async () => {
    const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue({ id: 'fr1', requesterId: 'u2', targetId: 'u3', status: 'pending' })
    const result = await rejectFollowRequest('fr1')
    expect(result).toHaveProperty('error')
  })

  it('rejects request successfully', async () => {
    const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue({ id: 'fr1', requesterId: 'u2', targetId: 'u1', status: 'pending' })
    mockPrisma.followRequest.delete.mockResolvedValue({})
    const result = await rejectFollowRequest('fr1')
    expect(result).toHaveProperty('success', true)
  })
})

describe('cancelFollowRequest', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
    const result = await cancelFollowRequest('u2')
    expect(result).toHaveProperty('error')
  })

  it('cancels request successfully', async () => {
    const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue({ id: 'fr1', requesterId: 'u1', targetId: 'u2', status: 'pending' })
    mockPrisma.followRequest.delete.mockResolvedValue({})
    const result = await cancelFollowRequest('u2')
    expect(result).toHaveProperty('success', true)
  })

  it('rejects if no pending request', async () => {
    const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue(null)
    const result = await cancelFollowRequest('u2')
    expect(result).toHaveProperty('error')
  })
})

describe('getReceivedFollowRequests', async () => {
  it('returns empty when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
    const result = await getReceivedFollowRequests()
    expect(result.requests).toEqual([])
  })

  it('returns pending requests', async () => {
    const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findMany.mockResolvedValue([
      { id: 'fr1', createdAt: new Date(), requester: { id: 'u2', nickname: 'User2', avatarUrl: null, bio: null } },
    ])
    const result = await getReceivedFollowRequests()
    expect(result.requests).toHaveLength(1)
  })

  it('supports cursor pagination', async () => {
    const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findMany.mockResolvedValue([])
    const result = await getReceivedFollowRequests('cursor1', 5)
    expect(result).toBeDefined()
  })
})

describe('getSentFollowRequests', async () => {
  it('returns empty when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
    const result = await getSentFollowRequests()
    expect(result.requests).toEqual([])
  })

  it('returns sent requests', async () => {
    const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findMany.mockResolvedValue([
      { id: 'fr1', createdAt: new Date(), target: { id: 'u2', nickname: 'User2', avatarUrl: null, bio: null } },
    ])
    const result = await getSentFollowRequests()
    expect(result.requests).toHaveLength(1)
  })
})

describe('getPendingFollowRequestCount', async () => {
  it('returns 0 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getPendingFollowRequestCount } = await import('@/lib/actions/follow-request')
    const result = await getPendingFollowRequestCount()
    expect(result.count).toBe(0)
  })

  it('returns count', async () => {
    const { getPendingFollowRequestCount } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.count.mockResolvedValue(3)
    const result = await getPendingFollowRequestCount()
    expect(result.count).toBe(3)
  })
})

describe('getFollowRequestStatus', async () => {
  it('returns no request when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
    const result = await getFollowRequestStatus('u2')
    expect(result.hasRequest).toBe(false)
  })

  it('returns pending status', async () => {
    const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue({ id: 'fr1', status: 'pending' })
    const result = await getFollowRequestStatus('u2')
    expect(result.hasRequest).toBe(true)
  })

  it('returns no request when not found', async () => {
    const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
    mockPrisma.followRequest.findUnique.mockResolvedValue(null)
    const result = await getFollowRequestStatus('u2')
    expect(result.hasRequest).toBe(false)
  })
})
