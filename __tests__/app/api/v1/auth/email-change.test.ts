// @vitest-environment node
/**
 * POST /api/v1/auth/email/change/request および confirm のユニットテスト
 *
 * request: Bearer 認証必須。newEmail 重複・メール送信失敗も含め常に 200
 * （列挙攻撃対策）。現パスワード不一致は 401、OAuth 専用アカウントは 409。
 * confirm: Bearer 認証不要。200 / 401 invalid_token / 409 email_taken / 429。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const AUTHOR_ID = 'user-email-change'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

const mockRequestEmailChangeCore = vi.fn()
const mockConfirmEmailChangeCore = vi.fn()
vi.mock('@/lib/services/email-change-service', () => ({
  requestEmailChangeCore: (...args: unknown[]) => mockRequestEmailChangeCore(...args),
  confirmEmailChangeCore: (...args: unknown[]) => mockConfirmEmailChangeCore(...args),
}))

vi.mock('@/lib/utils/client-ip', () => ({
  getClientIpFromRequest: () => '127.0.0.1',
}))

async function makeAuthenticatedRequest(
  url: string,
  userId: string,
  email: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/v1/auth/email/change/request', () => {
  const REQUEST_URL = 'http://localhost/api/v1/auth/email/change/request'

  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockRequestEmailChangeCore.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { success: true } を返す', async () => {
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {
      newEmail: 'new@example.com',
      currentPassword: 'currentPass1',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('requestEmailChangeCore に userId・currentPassword・newEmail・IP が渡される', async () => {
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {
      newEmail: 'new@example.com',
      currentPassword: 'myCurrentPass1',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    await POST(req)

    expect(mockRequestEmailChangeCore).toHaveBeenCalledWith(
      AUTHOR_ID,
      'myCurrentPass1',
      'new@example.com',
      '127.0.0.1',
    )
  })

  it('列挙攻撃対策: newEmail が既に使用中でも 200 { success: true } を返す', async () => {
    mockRequestEmailChangeCore.mockResolvedValueOnce({ ok: true })
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {
      newEmail: 'taken@example.com',
      currentPassword: 'currentPass1',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it('メール送信失敗等の内部エラーでも 200 を返す（列挙攻撃対策と一貫したレスポンス）', async () => {
    mockRequestEmailChangeCore.mockResolvedValueOnce({
      ok: false,
      error: 'メールの送信に失敗しました。しばらく経ってからお試しください。',
    })
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {
      newEmail: 'new@example.com',
      currentPassword: 'currentPass1',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('newEmail が不正な形式で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {
      newEmail: 'not-an-email',
      currentPassword: 'currentPass1',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('currentPassword 欠落で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {
      newEmail: 'new@example.com',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(AUTHOR_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: AUTHOR_ID, isSuspended: false, email: 'author@example.com' })
    const req = new NextRequest(REQUEST_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'not-json{',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest(REQUEST_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ newEmail: 'new@example.com', currentPassword: 'currentPass1' }),
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest(REQUEST_URL, 'guest-id', GUEST_EMAIL, {
      newEmail: 'new@example.com',
      currentPassword: 'currentPass1',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウント → 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest(REQUEST_URL, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ newEmail: 'new@example.com', currentPassword: 'currentPass1' }),
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('現パスワードが間違っている場合 → 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockRequestEmailChangeCore.mockResolvedValueOnce({ ok: false, error: 'パスワードが正しくありません' })
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {
      newEmail: 'new@example.com',
      currentPassword: 'wrongCurrentPass1',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('OAuth専用アカウント（パスワード未設定）の場合 → 409 CONFLICT', async () => {
    mockRequestEmailChangeCore.mockResolvedValueOnce({ ok: false, error: 'パスワードが設定されていません' })
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {
      newEmail: 'new@example.com',
      currentPassword: 'currentPass1',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('レート制限は Zod 検証通過後に実施される（不正入力ではレート制限を消費しない）', async () => {
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {})
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    await POST(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('レート制限超過 → 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest(REQUEST_URL, AUTHOR_ID, 'author@example.com', {
      newEmail: 'new@example.com',
      currentPassword: 'currentPass1',
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/request/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

describe('POST /api/v1/auth/email/change/confirm', () => {
  const CONFIRM_URL = 'http://localhost/api/v1/auth/email/change/confirm'
  const VALID_TOKEN = 'a'.repeat(64)

  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockConfirmEmailChangeCore.mockResolvedValue({ ok: true })
  })

  it('正常系: 200 + { success: true } を返す（Bearer 不要）', async () => {
    const { POST } = await import('@/app/api/v1/auth/email/change/confirm/route')
    const res = await POST(makeRequest(CONFIRM_URL, { token: VALID_TOKEN }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
    expect(mockConfirmEmailChangeCore).toHaveBeenCalledWith(VALID_TOKEN)
  })

  it('無効トークンで 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockConfirmEmailChangeCore.mockResolvedValueOnce({ ok: false, reason: 'invalid_token' })
    const { POST } = await import('@/app/api/v1/auth/email/change/confirm/route')
    const res = await POST(makeRequest(CONFIRM_URL, { token: VALID_TOKEN }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('email_taken（TOCTOU）で 409 CONFLICT', async () => {
    mockConfirmEmailChangeCore.mockResolvedValueOnce({ ok: false, reason: 'email_taken' })
    const { POST } = await import('@/app/api/v1/auth/email/change/confirm/route')
    const res = await POST(makeRequest(CONFIRM_URL, { token: VALID_TOKEN }))

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('token が短すぎる場合 400 VALIDATION_ERROR — confirmEmailChangeCore は呼ばれない', async () => {
    const { POST } = await import('@/app/api/v1/auth/email/change/confirm/route')
    const res = await POST(makeRequest(CONFIRM_URL, { token: 'short' }))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(mockConfirmEmailChangeCore).not.toHaveBeenCalled()
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })

  it('token フィールド欠落で 400 VALIDATION_ERROR', async () => {
    const { POST } = await import('@/app/api/v1/auth/email/change/confirm/route')
    const res = await POST(makeRequest(CONFIRM_URL, {}))

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const req = new NextRequest(CONFIRM_URL, {
      method: 'POST',
      body: 'notjson',
      headers: { 'Content-Type': 'application/json' },
    })
    const { POST } = await import('@/app/api/v1/auth/email/change/confirm/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 3_600_000 })

    const { POST } = await import('@/app/api/v1/auth/email/change/confirm/route')
    const res = await POST(makeRequest(CONFIRM_URL, { token: VALID_TOKEN }))

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
