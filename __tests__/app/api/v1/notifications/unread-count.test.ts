// @vitest-environment node
/**
 * GET /api/v1/notifications/unread-count のユニットテスト
 *
 * 200 { count } / ゲスト拒否 403 / 401 / 429 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockFetchUnreadNotificationCount = vi.fn()
vi.mock('@/lib/services/notification-read-service', () => ({
  fetchNotifications: vi.fn(),
  fetchUnreadNotificationCount: (...args: unknown[]) => mockFetchUnreadNotificationCount(...args),
}))

async function makeAuthenticatedRequest(userId: string, email: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/notifications/unread-count', {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/notifications/unread-count', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchUnreadNotificationCount.mockResolvedValue(3)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('認証ユーザーで 200 と { count } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com')
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(3)
  })

  it('未読が 0 件のとき count:0 を返す', async () => {
    mockFetchUnreadNotificationCount.mockResolvedValueOnce(0)
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com')
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.count).toBe(0)
  })

  it('fetchUnreadNotificationCount に userId が渡される', async () => {
    const req = await makeAuthenticatedRequest('user-abc', 'u@example.com')
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    await GET(req)

    expect(mockFetchUnreadNotificationCount).toHaveBeenCalledWith('user-abc', { excludeBlocked: true })
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/notifications/unread-count')
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/notifications/unread-count', {
      headers: { authorization: 'Bearer bad.token' },
    })
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/notifications/unread-count', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com')
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/notifications/unread-count')
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('fetchUnreadNotificationCount が例外を投げると 500 INTERNAL_ERROR を返す（fail-closed）', async () => {
    mockFetchUnreadNotificationCount.mockRejectedValueOnce(new Error('relation lookup failed'))
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com')
    const { GET } = await import('@/app/api/v1/notifications/unread-count/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
