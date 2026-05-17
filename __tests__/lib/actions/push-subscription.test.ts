// @vitest-environment node

/**
 * push-subscription.ts のテスト
 *
 * subscribePush, unsubscribePush, getPushSubscriptionStatus をカバー。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mocks (vi.hoisted to avoid TDZ issues with vi.mock hoisting) ---

const { mockPrisma, mockRequireAuth, mockRequireActiveNonGuestUser } = vi.hoisted(() => ({
  mockPrisma: {
    pushSubscription: {
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
  mockRequireAuth: vi.fn(),
  mockRequireActiveNonGuestUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/actions/utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireActiveNonGuestUser: (...args: unknown[]) => mockRequireActiveNonGuestUser(...args),
  actionSuccess: () => ({ success: true }),
  actionError: (msg: string) => ({ success: false, error: msg }),
  enforceUserRateLimit: vi.fn().mockResolvedValue(null),
}))

import {
  subscribePush,
  unsubscribePush,
  getPushSubscriptionStatus,
} from '@/lib/actions/push-subscription'

beforeEach(() => {
  vi.clearAllMocks()
  mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
  mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
})

const validSubscription = {
  endpoint: 'https://push.example.com/sub/123',
  keys: { p256dh: 'key-p256dh', auth: 'key-auth' },
}

// ========== subscribePush ==========

describe('subscribePush', () => {
  it('returns error when not authenticated', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })

    const result = await subscribePush(validSubscription)
    expect(result).toEqual({ success: false, error: '認証が必要です' })
  })

  it('returns error for invalid input (bad endpoint)', async () => {
    const result = await subscribePush({
      endpoint: 'not-a-url',
      keys: { p256dh: 'key', auth: 'key' },
    })
    expect(result).toEqual({ success: false, error: expect.any(String) })
  })

  it('returns error for invalid input (empty keys)', async () => {
    const result = await subscribePush({
      endpoint: 'https://push.example.com/sub/123',
      keys: { p256dh: '', auth: 'key' },
    })
    expect(result).toEqual({ success: false, error: expect.any(String) })
  })

  it('creates new subscription when under limit', async () => {
    mockPrisma.pushSubscription.count.mockResolvedValue(2)
    mockPrisma.pushSubscription.findUnique.mockResolvedValue(null)
    mockPrisma.pushSubscription.upsert.mockResolvedValue({})

    const result = await subscribePush(validSubscription)
    expect(result).toEqual({ success: true })
    expect(mockPrisma.pushSubscription.upsert).toHaveBeenCalled()
    expect(mockPrisma.pushSubscription.delete).not.toHaveBeenCalled()
  })

  it('updates existing subscription (same endpoint)', async () => {
    mockPrisma.pushSubscription.count.mockResolvedValue(3)
    mockPrisma.pushSubscription.findUnique.mockResolvedValue({ id: 'existing-1' })
    mockPrisma.pushSubscription.upsert.mockResolvedValue({})

    const result = await subscribePush(validSubscription)
    expect(result).toEqual({ success: true })
    // Should not delete oldest since endpoint already exists
    expect(mockPrisma.pushSubscription.delete).not.toHaveBeenCalled()
  })

  it('deletes oldest subscription when at device limit with new endpoint', async () => {
    mockPrisma.pushSubscription.count.mockResolvedValue(5)
    mockPrisma.pushSubscription.findUnique.mockResolvedValue(null)
    mockPrisma.pushSubscription.findFirst.mockResolvedValue({ id: 'oldest-1' })
    mockPrisma.pushSubscription.delete.mockResolvedValue({})
    mockPrisma.pushSubscription.upsert.mockResolvedValue({})

    const result = await subscribePush(validSubscription)
    expect(result).toEqual({ success: true })
    expect(mockPrisma.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: 'oldest-1' },
    })
  })

  it('handles case where oldest is null at limit', async () => {
    mockPrisma.pushSubscription.count.mockResolvedValue(5)
    mockPrisma.pushSubscription.findUnique.mockResolvedValue(null)
    mockPrisma.pushSubscription.findFirst.mockResolvedValue(null)
    mockPrisma.pushSubscription.upsert.mockResolvedValue({})

    const result = await subscribePush(validSubscription)
    expect(result).toEqual({ success: true })
    expect(mockPrisma.pushSubscription.delete).not.toHaveBeenCalled()
  })

  it('returns error on database failure', async () => {
    mockPrisma.pushSubscription.count.mockRejectedValue(new Error('DB error'))

    const result = await subscribePush(validSubscription)
    expect(result).toEqual({ success: false, error: expect.any(String) })
  })
})

// ========== unsubscribePush ==========

describe('unsubscribePush', () => {
  it('returns error when not authenticated', async () => {
    mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })

    const result = await unsubscribePush('https://push.example.com/sub/123')
    expect(result).toEqual({ success: false, error: '認証が必要です' })
  })

  it('returns error for empty endpoint', async () => {
    const result = await unsubscribePush('')
    expect(result).toEqual({ success: false, error: expect.any(String) })
  })

  it('deletes subscription successfully', async () => {
    mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 })

    const result = await unsubscribePush('https://push.example.com/sub/123')
    expect(result).toEqual({ success: true })
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', endpoint: 'https://push.example.com/sub/123' },
    })
  })

  it('returns error on database failure', async () => {
    mockPrisma.pushSubscription.deleteMany.mockRejectedValue(new Error('DB error'))

    const result = await unsubscribePush('https://push.example.com/sub/123')
    expect(result).toEqual({ success: false, error: expect.any(String) })
  })
})

// ========== getPushSubscriptionStatus ==========

describe('getPushSubscriptionStatus', () => {
  it('returns not subscribed when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

    const result = await getPushSubscriptionStatus()
    expect(result).toEqual({ subscribed: false, count: 0 })
  })

  it('returns subscribed=true when user has subscriptions', async () => {
    mockPrisma.pushSubscription.count.mockResolvedValue(3)

    const result = await getPushSubscriptionStatus()
    expect(result).toEqual({ subscribed: true, count: 3 })
  })

  it('returns subscribed=false when user has no subscriptions', async () => {
    mockPrisma.pushSubscription.count.mockResolvedValue(0)

    const result = await getPushSubscriptionStatus()
    expect(result).toEqual({ subscribed: false, count: 0 })
  })
})
