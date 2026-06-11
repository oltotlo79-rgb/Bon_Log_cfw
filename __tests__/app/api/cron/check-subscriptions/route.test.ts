// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    scheduledPost: {
      updateMany: vi.fn(),
    },
    notification: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/email', () => ({
  sendSubscriptionExpiringEmail: vi.fn(),
  sendSubscriptionExpiredEmail: vi.fn(),
}))

vi.mock('@/lib/cron-auth', () => ({
  verifyCronAuth: vi.fn(),
}))

vi.mock('@/lib/services/notification-bulk', () => ({
  createSystemNotificationsBulk: vi.fn(),
}))

vi.mock('@/lib/constants/errors', () => ({
  API_ERR_UNAUTHORIZED: 'Unauthorized',
  API_ERR_INTERNAL_SERVER_ERROR: 'Internal server error',
}))

vi.mock('@/lib/constants/limits', () => ({
  SUBSCRIPTION_EXPIRY_WARNING_DAYS: 3,
  ONE_DAY_MS: 86400000,
  CRON_FUNCTION_TIMEOUT_SECONDS: 60,
  SUBSCRIPTION_EMAIL_BATCH_SIZE: 50,
}))

vi.mock('@/lib/constants/status', () => ({
  SCHEDULED_POST_STATUS: {
    PENDING: 'pending',
    CANCELLED: 'cancelled',
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

function makeGetRequest(authHeader?: string, timestamp?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader) headers['authorization'] = authHeader
  if (timestamp) headers['x-cron-timestamp'] = timestamp
  return new NextRequest('http://localhost:3000/api/cron/check-subscriptions', {
    method: 'GET',
    headers,
  })
}

function makePostRequest(authHeader?: string, timestamp?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (authHeader) headers['authorization'] = authHeader
  if (timestamp) headers['x-cron-timestamp'] = timestamp
  return new NextRequest('http://localhost:3000/api/cron/check-subscriptions', {
    method: 'POST',
    headers,
  })
}

describe('Cron Check Subscriptions API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('GET - expired subscriptions', () => {
    it('returns 401 when auth fails', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      vi.mocked(verifyCronAuth).mockReturnValue({ valid: false, error: 'Invalid signature' })

      const { GET } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await GET(makeGetRequest())

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Invalid signature')
    })

    it('returns success with processedCount 0 when no expired users', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })
      // GET は「失効処理」と「期限間近の警告」で findMany を2回呼ぶ（どちらも空）
      vi.mocked(prisma.user.findMany).mockResolvedValue([])
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never)

      const { GET } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await GET(makeGetRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.processedCount).toBe(0)
      expect(data.expiringCount).toBe(0)
    })

    it('processes expired subscriptions correctly', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')
      const { sendSubscriptionExpiredEmail } = await import('@/lib/email')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

      const expiredUsers = [
        { id: 'user-1', email: 'user1@test.com', nickname: 'User1', premiumExpiresAt: new Date('2025-01-01') },
        { id: 'user-2', email: 'user2@test.com', nickname: 'User2', premiumExpiresAt: new Date('2025-01-02') },
      ]

      // 1回目=失効ユーザー、2回目=期限間近ユーザー（このテストでは空）
      vi.mocked(prisma.user.findMany)
        .mockResolvedValueOnce(expiredUsers as never)
        .mockResolvedValueOnce([] as never)
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never)
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 2 } as never)
      vi.mocked(prisma.scheduledPost.updateMany).mockResolvedValue({ count: 1 } as never)
      vi.mocked(sendSubscriptionExpiredEmail).mockResolvedValue({ success: true } as never)

      const { GET } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await GET(makeGetRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.processedCount).toBe(2)
      expect(data.cancelledPostsCount).toBe(1)
      expect(data.emailsSent).toBe(2)

      // Verify updateMany was called with expired user IDs
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['user-1', 'user-2'] } },
        data: { isPremium: false },
      })

      // Verify scheduled posts were cancelled
      expect(prisma.scheduledPost.updateMany).toHaveBeenCalledWith({
        where: {
          userId: { in: ['user-1', 'user-2'] },
          status: 'pending',
        },
        data: { status: 'cancelled' },
      })

      // Verify emails were sent
      expect(sendSubscriptionExpiredEmail).toHaveBeenCalledTimes(2)
      expect(sendSubscriptionExpiredEmail).toHaveBeenCalledWith('user1@test.com', 'User1')
      expect(sendSubscriptionExpiredEmail).toHaveBeenCalledWith('user2@test.com', 'User2')
    })

    it('counts email send failures', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')
      const { sendSubscriptionExpiredEmail } = await import('@/lib/email')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

      const expiredUsers = [
        { id: 'user-1', email: 'user1@test.com', nickname: 'User1', premiumExpiresAt: new Date('2025-01-01') },
        { id: 'user-2', email: 'user2@test.com', nickname: 'User2', premiumExpiresAt: new Date('2025-01-02') },
      ]

      vi.mocked(prisma.user.findMany)
        .mockResolvedValueOnce(expiredUsers as never)
        .mockResolvedValueOnce([] as never)
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never)
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 2 } as never)
      vi.mocked(prisma.scheduledPost.updateMany).mockResolvedValue({ count: 0 } as never)
      vi.mocked(sendSubscriptionExpiredEmail)
        .mockResolvedValueOnce({ success: true } as never)
        .mockResolvedValueOnce({ success: false } as never)

      const { GET } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await GET(makeGetRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.emailsSent).toBe(1)
      expect(data.emailsFailed).toBe(1)
    })

    it('failed の集計に rejected も含める（expired email が reject）', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')
      const { sendSubscriptionExpiredEmail } = await import('@/lib/email')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })
      vi.mocked(prisma.user.findMany)
        .mockResolvedValueOnce([
          { id: 'user-1', email: 'u1@test.com', nickname: 'U1', premiumExpiresAt: new Date('2025-01-01') },
        ] as never)
        .mockResolvedValueOnce([] as never)
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never)
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 } as never)
      vi.mocked(prisma.scheduledPost.updateMany).mockResolvedValue({ count: 0 } as never)
      vi.mocked(sendSubscriptionExpiredEmail).mockRejectedValue(new Error('SMTP down'))

      const { GET } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await GET(makeGetRequest('HMAC sig', '1700000000000'))

      const data = await response.json()
      expect(data.emailsSent).toBe(0)
      expect(data.emailsFailed).toBe(1)
    })

    it('バッチサイズを超える失効ユーザーでも全員に送信し件数を正しく集計する', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')
      const { sendSubscriptionExpiredEmail } = await import('@/lib/email')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

      // バッチサイズ(50)を跨ぐ 120 件。複数バッチに分割されても全件送信されることを検証。
      const expiredUsers = Array.from({ length: 120 }, (_, i) => ({
        id: `user-${i}`,
        email: `user${i}@test.com`,
        nickname: `User${i}`,
        premiumExpiresAt: new Date('2025-01-01'),
      }))

      vi.mocked(prisma.user.findMany)
        .mockResolvedValueOnce(expiredUsers as never)
        .mockResolvedValueOnce([] as never)
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never)
      vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 120 } as never)
      vi.mocked(prisma.scheduledPost.updateMany).mockResolvedValue({ count: 0 } as never)
      vi.mocked(sendSubscriptionExpiredEmail).mockResolvedValue({ success: true } as never)

      const { GET } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await GET(makeGetRequest('HMAC sig', '1700000000000'))

      const data = await response.json()
      expect(data.emailsSent).toBe(120)
      expect(data.emailsFailed).toBe(0)
      expect(sendSubscriptionExpiredEmail).toHaveBeenCalledTimes(120)
    })

    it('GET でも期限間近ユーザーに事前警告を送る（cron 発火の核心）', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')
      const { sendSubscriptionExpiringEmail } = await import('@/lib/email')
      const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })
      // 1回目=失効（空）、2回目=期限間近（1名）
      vi.mocked(prisma.user.findMany)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([
          { id: 'user-9', email: 'u9@test.com', nickname: 'U9', premiumExpiresAt: new Date('2026-04-01') },
        ] as never)
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never)
      vi.mocked(sendSubscriptionExpiringEmail).mockResolvedValue({ success: true } as never)
      vi.mocked(createSystemNotificationsBulk).mockResolvedValue({ attempted: 1, filtered: 0 })

      const { GET } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await GET(makeGetRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.expiringCount).toBe(1)
      expect(data.warningEmailsSent).toBe(1)
      expect(sendSubscriptionExpiringEmail).toHaveBeenCalledWith('u9@test.com', 'U9', expect.any(Date))
      expect(createSystemNotificationsBulk).toHaveBeenCalledWith({
        recipientIds: ['user-9'],
        type: 'subscription_expiring',
        skipPushNotification: true,
      })
    })

    it('returns 500 on error', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })
      vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('DB error'))

      const { GET } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await GET(makeGetRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('POST - warning emails', () => {
    it('returns 401 when auth fails', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      vi.mocked(verifyCronAuth).mockReturnValue({ valid: false, error: 'Missing timestamp header' })

      const { POST } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await POST(makePostRequest())

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Missing timestamp header')
    })

    it('sends warnings to expiring users and creates notifications', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')
      const { sendSubscriptionExpiringEmail } = await import('@/lib/email')
      const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

      const expiringUsers = [
        { id: 'user-1', email: 'user1@test.com', nickname: 'User1', premiumExpiresAt: new Date('2026-04-01') },
      ]

      vi.mocked(prisma.user.findMany).mockResolvedValue(expiringUsers as never)
      vi.mocked(sendSubscriptionExpiringEmail).mockResolvedValue({ success: true } as never)
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never)
      vi.mocked(createSystemNotificationsBulk).mockResolvedValue({ attempted: 1, filtered: 0 })

      const { POST } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await POST(makePostRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.expiringCount).toBe(1)
      expect(data.emailsSent).toBe(1)

      // Verify email sent
      expect(sendSubscriptionExpiringEmail).toHaveBeenCalledWith(
        'user1@test.com',
        'User1',
        expiringUsers[0]!.premiumExpiresAt,
      )

      // Verify batch notification lookup (no existing notifications)
      expect(prisma.notification.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: ['user-1'] },
          type: 'subscription_expiring',
          createdAt: { gte: expect.any(Date) },
        },
        select: { userId: true },
      })
      expect(createSystemNotificationsBulk).toHaveBeenCalledWith({
        recipientIds: ['user-1'],
        type: 'subscription_expiring',
        skipPushNotification: true,
      })
      expect(prisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('does not create duplicate notifications', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')
      const { sendSubscriptionExpiringEmail } = await import('@/lib/email')
      const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

      const expiringUsers = [
        { id: 'user-1', email: 'user1@test.com', nickname: 'User1', premiumExpiresAt: new Date('2026-04-01') },
      ]

      vi.mocked(prisma.user.findMany).mockResolvedValue(expiringUsers as never)
      vi.mocked(sendSubscriptionExpiringEmail).mockResolvedValue({ success: true } as never)
      // Existing notification found - should skip creation
      vi.mocked(prisma.notification.findMany).mockResolvedValue([{ userId: 'user-1' }] as never)

      const { POST } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await POST(makePostRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(200)
      expect(createSystemNotificationsBulk).not.toHaveBeenCalled()
      expect(prisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('handles notification creation error gracefully', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')
      const { sendSubscriptionExpiringEmail } = await import('@/lib/email')
      const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')
      const { logger } = await import('@/lib/logger')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

      const expiringUsers = [
        { id: 'user-1', email: 'user1@test.com', nickname: 'User1', premiumExpiresAt: new Date('2026-04-01') },
      ]

      vi.mocked(prisma.user.findMany).mockResolvedValue(expiringUsers as never)
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never)
      vi.mocked(createSystemNotificationsBulk).mockRejectedValue(new Error('DB Error'))
      vi.mocked(sendSubscriptionExpiringEmail).mockResolvedValue({ success: true } as never)

      const { POST } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await POST(makePostRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(logger.error).toHaveBeenCalled()
    })

    it('counts POST email send failures', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')
      const { sendSubscriptionExpiringEmail } = await import('@/lib/email')
      const { createSystemNotificationsBulk } = await import('@/lib/services/notification-bulk')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

      const expiringUsers = [
        { id: 'user-1', email: 'user1@test.com', nickname: 'User1', premiumExpiresAt: new Date('2026-04-01') },
        { id: 'user-2', email: 'user2@test.com', nickname: 'User2', premiumExpiresAt: new Date('2026-04-02') },
      ]

      vi.mocked(prisma.user.findMany).mockResolvedValue(expiringUsers as never)
      vi.mocked(prisma.notification.findMany).mockResolvedValue([] as never)
      vi.mocked(createSystemNotificationsBulk).mockResolvedValue({ attempted: 2, filtered: 0 })
      vi.mocked(sendSubscriptionExpiringEmail)
        .mockResolvedValueOnce({ success: true } as never)
        .mockRejectedValueOnce(new Error('Email error'))

      const { POST } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await POST(makePostRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.emailsSent).toBe(1)
      expect(data.emailsFailed).toBe(1)
    })

    it('returns 500 on error', async () => {
      const { verifyCronAuth } = await import('@/lib/cron-auth')
      const { prisma } = await import('@/lib/db')

      vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })
      vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('DB error'))

      const { POST } = await import('@/app/api/cron/check-subscriptions/route')
      const response = await POST(makePostRequest('HMAC sig', '1700000000000'))

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('Internal server error')
    })
  })
})
