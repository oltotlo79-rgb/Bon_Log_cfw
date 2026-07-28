// @vitest-environment node
/**
 * GET /api/v1/notifications のユニットテスト
 *
 * 200 カーソルページング / ゲスト拒否 403 / 401 / 429 の全分岐を検証する。
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

const mockFetchNotifications = vi.fn()
vi.mock('@/lib/services/notification-read-service', () => ({
  fetchNotifications: (...args: unknown[]) => mockFetchNotifications(...args),
  fetchUnreadNotificationCount: vi.fn(),
}))

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  searchParams?: Record<string, string>,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = new URL('http://localhost/api/v1/notifications')
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      url.searchParams.set(k, v)
    }
  }
  return new NextRequest(url.toString(), {
    headers: { authorization: `Bearer ${token}` },
  })
}

const mockNotificationsResult = {
  notifications: [
    { id: 'notif-1', type: 'like', isRead: false },
  ],
  nextCursor: undefined,
}

describe('GET /api/v1/notifications', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchNotifications.mockResolvedValue(mockNotificationsResult)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('認証ユーザーで 200 と { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com')
    const { GET } = await import('@/app/api/v1/notifications/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.nextCursor).toBeNull()
  })

  it('nextCursor がある場合レスポンスに含まれる', async () => {
    mockFetchNotifications.mockResolvedValueOnce({
      notifications: [{ id: 'n1' }, { id: 'n2' }],
      nextCursor: 'n2',
    })
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com')
    const { GET } = await import('@/app/api/v1/notifications/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.nextCursor).toBe('n2')
    expect(body.items).toHaveLength(2)
  })

  it('cursor と limit クエリパラメータが fetchNotifications に渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', {
      cursor: 'notif-cursor',
      limit: '10',
    })
    const { GET } = await import('@/app/api/v1/notifications/route')
    await GET(req)

    expect(mockFetchNotifications).toHaveBeenCalledWith('user-1', 'notif-cursor', 10, { excludeBlocked: true })
  })

  it('limit が MAX_PAGE_LIMIT(100) を超えると 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', { limit: '150' })
    const { GET } = await import('@/app/api/v1/notifications/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/notifications/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/notifications')
    const { GET } = await import('@/app/api/v1/notifications/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/notifications', {
      headers: { authorization: 'Bearer bad.token' },
    })
    const { GET } = await import('@/app/api/v1/notifications/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/notifications', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/notifications/route')
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
    const { GET } = await import('@/app/api/v1/notifications/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/notifications')
    const { GET } = await import('@/app/api/v1/notifications/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('fetchNotifications が例外を投げると 500 INTERNAL_ERROR を返す（fail-closed）', async () => {
    mockFetchNotifications.mockRejectedValueOnce(new Error('relation lookup failed'))
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com')
    const { GET } = await import('@/app/api/v1/notifications/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })
})
