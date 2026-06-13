// @vitest-environment node
/**
 * PATCH /api/v1/notifications/read のユニットテスト
 *
 * ids 指定→個別既読 / ids 省略→全件既読 / 他ユーザー通知不可 / 400 / 401 / 403 / 429 を検証する。
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

const mockMarkNotificationsRead = vi.fn()
const mockFetchUnreadNotificationCount = vi.fn()
vi.mock('@/lib/services/notification-read-service', () => ({
  markNotificationsRead: (...args: unknown[]) => mockMarkNotificationsRead(...args),
  fetchUnreadNotificationCount: (...args: unknown[]) => mockFetchUnreadNotificationCount(...args),
  fetchNotifications: vi.fn(),
}))

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  body?: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/notifications/read', {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

/** valid cuid 形式の ID を生成（テスト用途） */
function makeCuid(index: number): string {
  return `c${'abcdefghijklmno'.slice(0, 8)}${String(index).padStart(16, '0')}`
}

describe('PATCH /api/v1/notifications/read', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockMarkNotificationsRead.mockResolvedValue(undefined)
    mockFetchUnreadNotificationCount.mockResolvedValue(3)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('ids 指定で個別既読化 → 200 { success: true, unreadCount }', async () => {
    const ids = [makeCuid(1), makeCuid(2)]
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', { ids })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(typeof body.unreadCount).toBe('number')
  })

  it('ids 指定時に markNotificationsRead(userId, ids) が呼ばれる', async () => {
    const ids = [makeCuid(1), makeCuid(2)]
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', { ids })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    await PATCH(req)

    expect(mockMarkNotificationsRead).toHaveBeenCalledWith('user-1', ids)
  })

  it('ids 省略時に全件既読化 → markNotificationsRead(userId, undefined)', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', {})
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    await PATCH(req)

    expect(mockMarkNotificationsRead).toHaveBeenCalledWith('user-1', undefined)
  })

  it('空配列 ids: [] でも全件既読化 → markNotificationsRead(userId, undefined)', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', { ids: [] })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    await PATCH(req)

    expect(mockMarkNotificationsRead).toHaveBeenCalledWith('user-1', undefined)
  })

  it('他ユーザーの通知を既読化できない（where に userId が必ず含まれる）', async () => {
    const ids = [makeCuid(99)]
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', { ids })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    await PATCH(req)

    const [calledUserId, calledIds] = mockMarkNotificationsRead.mock.calls[0] as [string, string[]]
    expect(calledUserId).toBe('user-1')
    expect(calledIds).toEqual(ids)
  })

  it('操作後の unreadCount がレスポンスに含まれる', async () => {
    mockFetchUnreadNotificationCount.mockResolvedValueOnce(7)
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', {})
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    const body = await res.json()
    expect(body.unreadCount).toBe(7)
  })

  it('ids が 101 件（MAX_NOTIFICATION_READ_IDS 超）で 400 VALIDATION_ERROR', async () => {
    const ids = Array.from({ length: 101 }, (_, i) => makeCuid(i))
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', { ids })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ids が cuid 以外（数値配列）で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', { ids: [1, 2, 3] })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な JSON ボディでも空 {} 扱いとして全件既読化を実行する', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-1')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/notifications/read', {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: 'invalid json',
    })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(mockMarkNotificationsRead).toHaveBeenCalledWith('user-1', undefined)
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, {})
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/notifications/read', { method: 'PATCH' })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/notifications/read', {
      method: 'PATCH',
      headers: { authorization: 'Bearer bad.token' },
    })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/notifications/read', {
      method: 'PATCH',
      headers: { authorization: `Bearer ${token}` },
    })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

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
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', {})
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/notifications/read', { method: 'PATCH' })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('ids が 100 件（MAX_NOTIFICATION_READ_IDS 丁度）でも正常に処理される', async () => {
    const ids = Array.from({ length: 100 }, (_, i) => makeCuid(i))
    const req = await makeAuthenticatedRequest('user-1', 'u@example.com', { ids })
    const { PATCH } = await import('@/app/api/v1/notifications/read/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })
})
