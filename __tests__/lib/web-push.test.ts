// @vitest-environment node

/**
 * web-push.ts のテスト
 *
 * sendPushNotification, getVapidPublicKey,
 * VAPID設定, 無効購読の自動削除をカバー。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mocks ---

const mockSendNotification = vi.fn()
const mockSetVapidDetails = vi.fn()

// web-push の WebPushError 互換。lib/web-push.ts は instanceof で statusCode を narrow する。
class MockWebPushError extends Error {
  readonly statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.name = 'WebPushError'
    this.statusCode = statusCode
  }
}

vi.mock('web-push', () => ({
  __esModule: true,
  default: {
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
  WebPushError: MockWebPushError,
}))

const mockPrisma = {
  pushSubscription: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

// ========== VAPID config + getVapidPublicKey ==========

describe('getVapidPublicKey', () => {
  it('returns null when VAPID key not set', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '')
    // Re-import to get fresh module state
    vi.resetModules()
    const { getVapidPublicKey } = await import('@/lib/web-push')
    expect(getVapidPublicKey()).toBeNull()
  })

  it('returns public key when set', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'test-public-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'test-private-key')
    vi.resetModules()
    const { getVapidPublicKey } = await import('@/lib/web-push')
    expect(getVapidPublicKey()).toBe('test-public-key')
  })
})

// ========== VAPID configuration (lines 25-27) ==========

describe('VAPID configuration', () => {
  it('calls setVapidDetails when both keys are provided', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key')
    vi.stubEnv('VAPID_SUBJECT', 'mailto:test@example.com')
    vi.resetModules()
    await import('@/lib/web-push')
    expect(mockSetVapidDetails).toHaveBeenCalledWith(
      'mailto:test@example.com',
      'pub-key',
      'priv-key'
    )
  })

  it('does not call setVapidDetails when keys are missing', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '')
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    vi.resetModules()
    mockSetVapidDetails.mockClear()
    await import('@/lib/web-push')
    expect(mockSetVapidDetails).not.toHaveBeenCalled()
  })
})

// ========== sendPushNotification ==========

describe('sendPushNotification', () => {
  const payload = { title: 'Test', body: 'Hello' }

  it('returns {sent:0, failed:0} when VAPID not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '')
    vi.stubEnv('VAPID_PRIVATE_KEY', '')
    vi.resetModules()
    const { sendPushNotification } = await import('@/lib/web-push')

    const result = await sendPushNotification('user-1', payload)
    expect(result).toEqual({ sent: 0, failed: 0 })
  })

  it('returns {sent:0, failed:0} when user has no subscriptions', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key')
    vi.resetModules()
    const { sendPushNotification } = await import('@/lib/web-push')

    mockPrisma.pushSubscription.findMany.mockResolvedValue([])

    const result = await sendPushNotification('user-1', payload)
    expect(result).toEqual({ sent: 0, failed: 0 })
  })

  it('sends notification successfully', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key')
    vi.resetModules()
    const { sendPushNotification } = await import('@/lib/web-push')

    mockPrisma.pushSubscription.findMany.mockResolvedValue([
      { id: 's1', endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
      { id: 's2', endpoint: 'https://push.example.com/2', p256dh: 'k2', auth: 'a2' },
    ])
    mockSendNotification.mockResolvedValue({ statusCode: 201 })

    const result = await sendPushNotification('user-1', payload)
    expect(result).toEqual({ sent: 2, failed: 0 })
    expect(mockSendNotification).toHaveBeenCalledTimes(2)
  })

  it('handles mixed success and failure', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key')
    vi.resetModules()
    const { sendPushNotification } = await import('@/lib/web-push')

    mockPrisma.pushSubscription.findMany.mockResolvedValue([
      { id: 's1', endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
      { id: 's2', endpoint: 'https://push.example.com/2', p256dh: 'k2', auth: 'a2' },
    ])
    mockSendNotification
      .mockResolvedValueOnce({ statusCode: 201 })
      .mockRejectedValueOnce(new MockWebPushError('Server error', 500))

    const result = await sendPushNotification('user-1', payload)
    expect(result).toEqual({ sent: 1, failed: 1 })
  })

  it('deletes expired subscriptions (410 Gone)', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key')
    vi.resetModules()
    const { sendPushNotification } = await import('@/lib/web-push')

    mockPrisma.pushSubscription.findMany.mockResolvedValue([
      { id: 's1', endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
    ])
    mockSendNotification.mockRejectedValue(new MockWebPushError('Gone', 410))
    mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 })

    const result = await sendPushNotification('user-1', payload)
    expect(result).toEqual({ sent: 0, failed: 1 })
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['s1'] } },
    })
  })

  it('deletes expired subscriptions (404 Not Found)', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key')
    vi.resetModules()
    const { sendPushNotification } = await import('@/lib/web-push')

    mockPrisma.pushSubscription.findMany.mockResolvedValue([
      { id: 's1', endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
    ])
    mockSendNotification.mockRejectedValue(new MockWebPushError('Not Found', 404))
    mockPrisma.pushSubscription.deleteMany.mockResolvedValue({ count: 1 })

    const result = await sendPushNotification('user-1', payload)
    expect(result).toEqual({ sent: 0, failed: 1 })
    expect(mockPrisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['s1'] } },
    })
  })

  it('does not delete on non-410/404 errors', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key')
    vi.resetModules()
    const { sendPushNotification } = await import('@/lib/web-push')

    mockPrisma.pushSubscription.findMany.mockResolvedValue([
      { id: 's1', endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
    ])
    mockSendNotification.mockRejectedValue(new MockWebPushError('Service Unavailable', 503))

    const result = await sendPushNotification('user-1', payload)
    expect(result).toEqual({ sent: 0, failed: 1 })
    expect(mockPrisma.pushSubscription.deleteMany).not.toHaveBeenCalled()
  })

  it('handles Error instance in rejection', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'pub-key')
    vi.stubEnv('VAPID_PRIVATE_KEY', 'priv-key')
    vi.resetModules()
    const { sendPushNotification } = await import('@/lib/web-push')

    mockPrisma.pushSubscription.findMany.mockResolvedValue([
      { id: 's1', endpoint: 'https://push.example.com/1', p256dh: 'k1', auth: 'a1' },
    ])
    mockSendNotification.mockRejectedValue(new Error('Network error'))

    const result = await sendPushNotification('user-1', payload)
    expect(result).toEqual({ sent: 0, failed: 1 })
  })
})
