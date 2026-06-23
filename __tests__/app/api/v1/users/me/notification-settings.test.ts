// @vitest-environment node
/**
 * GET  /api/v1/users/me/notification-settings
 * PATCH /api/v1/users/me/notification-settings
 *
 * Bearer 認証・ゲスト拒否・取得・部分更新・system/subscription_expiring strip・
 * レート制限を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

// ──────────────────────────────────────────────────
// モック: DB
// ──────────────────────────────────────────────────
const mockUserFindUnique = vi.fn()
const mockUserUpdate = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
}))

// ──────────────────────────────────────────────────
// モック: rate-limit
// ──────────────────────────────────────────────────
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// モック: revalidatePath
// ──────────────────────────────────────────────────
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

// ──────────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────────

async function makeAuthToken(userId: string, email: string): Promise<string> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  if (!token) throw new Error('Failed to sign access token')
  // auth-guard は user.findUnique を 1 回呼ぶ
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return token
}

function makeGetRequest(token: string): NextRequest {
  return new NextRequest('http://localhost/api/v1/users/me/notification-settings', {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

function makePatchRequest(token: string, body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/users/me/notification-settings', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
  })
}

// ──────────────────────────────────────────────────
// GET /api/v1/users/me/notification-settings
// ──────────────────────────────────────────────────

describe('GET /api/v1/users/me/notification-settings', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60_000 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常: 200 { preferences }', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    // GET は auth-guard 後に user.findUnique を再度呼ぶ
    mockUserFindUnique.mockResolvedValueOnce({
      notificationPreferences: { like: true, comment: false },
    })
    const req = makeGetRequest(token)
    const { GET } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('preferences')
    expect(body.preferences.like).toBe(true)
    expect(body.preferences.comment).toBe(false)
  })

  it('notificationPreferences が null でも空オブジェクトを返す', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    mockUserFindUnique.mockResolvedValueOnce({ notificationPreferences: null })
    const req = makeGetRequest(token)
    const { GET } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.preferences).toEqual({})
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const token = await makeAuthToken('guest-id', GUEST_EMAIL)
    const req = makeGetRequest(token)
    const { GET } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me/notification-settings', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })
})

// ──────────────────────────────────────────────────
// PATCH /api/v1/users/me/notification-settings
// ──────────────────────────────────────────────────

describe('PATCH /api/v1/users/me/notification-settings', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60_000 })
    mockUserUpdate.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常部分更新: 200 { success: true }', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePatchRequest(token, { like: false, comment: true })
    const { PATCH } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('user.update が呼ばれる', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePatchRequest(token, { like: false })
    const { PATCH } = await import('@/app/api/v1/users/me/notification-settings/route')
    await PATCH(req)

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-me' },
        data: { notificationPreferences: expect.objectContaining({ like: false }) },
      }),
    )
  })

  it('system キーは Zod の strip() で除外される', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePatchRequest(token, { like: true, system: true })
    const { PATCH } = await import('@/app/api/v1/users/me/notification-settings/route')
    await PATCH(req)

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { notificationPreferences: { like: true } },
      }),
    )
  })

  it('subscription_expiring キーは Zod の strip() で除外される', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePatchRequest(token, { follow: true, subscription_expiring: false })
    const { PATCH } = await import('@/app/api/v1/users/me/notification-settings/route')
    await PATCH(req)

    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { notificationPreferences: { follow: true } },
      }),
    )
  })

  it('空オブジェクト（{}）でも 200', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePatchRequest(token, {})
    const { PATCH } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await PATCH(req)

    expect(res.status).toBe(200)
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const token = await makeAuthToken('guest-id', GUEST_EMAIL)
    const req = makePatchRequest(token, { like: true })
    const { PATCH } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await PATCH(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me/notification-settings', {
      method: 'PATCH',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    })
    const { PATCH } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await PATCH(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30_000,
    })
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePatchRequest(token, { like: true })
    const { PATCH } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await PATCH(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正な値の型（like が文字列）→ 400 VALIDATION_ERROR', async () => {
    const token = await makeAuthToken('user-me', 'me@example.com')
    const req = makePatchRequest(token, { like: 'yes' })
    const { PATCH } = await import('@/app/api/v1/users/me/notification-settings/route')
    const res = await PATCH(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
