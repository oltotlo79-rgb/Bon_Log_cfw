// @vitest-environment node
/**
 * POST /api/v1/auth/2fa/enable のユニットテスト
 *
 * body: { code, setupId } — 200 + { enabled: true } / 400 バリデーション /
 * 401 / 403 ゲスト / 409 既に有効 / 401 期限切れ・不正コード / 429 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const AUTHOR_ID = 'user-2fa-enable'

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

const mockEnable2FAForUser = vi.fn()
vi.mock('@/lib/services/two-factor-service', () => ({
  enable2FAForUser: (...args: unknown[]) => mockEnable2FAForUser(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/auth/2fa/enable', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/auth/2fa/enable', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockEnable2FAForUser.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { enabled: true } を返す', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      code: '123456',
      setupId: 'setup-id-1',
    })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ enabled: true })
  })

  it('enable2FAForUser に userId, code, setupId が渡される', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      code: '654321',
      setupId: 'setup-xyz',
    })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    await POST(req)

    expect(mockEnable2FAForUser).toHaveBeenCalledWith(AUTHOR_ID, '654321', 'setup-xyz')
  })

  it('code 欠落で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { setupId: 'setup-id-1' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('setupId 欠落で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { code: '123456' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(AUTHOR_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: AUTHOR_ID, isSuspended: false, email: 'author@example.com' })
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/enable', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'not-json{',
    })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/enable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: '123456', setupId: 'setup-id-1' }),
    })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, { code: '123456', setupId: 'setup-id-1' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('既に2FAが有効な場合 → 409 CONFLICT', async () => {
    mockEnable2FAForUser.mockResolvedValueOnce({ ok: false, error: '2段階認証は既に有効です' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { code: '123456', setupId: 'setup-id-1' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('setupId が期限切れの場合 → 401 AUTH_2FA_TICKET_EXPIRED', async () => {
    mockEnable2FAForUser.mockResolvedValueOnce({
      ok: false,
      error: '2段階認証のセットアップ情報が見つからないか期限切れです。最初からやり直してください',
    })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { code: '123456', setupId: 'expired' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_2FA_TICKET_EXPIRED')
  })

  it('コードが不正な場合 → 401 AUTH_2FA_INVALID_CODE', async () => {
    mockEnable2FAForUser.mockResolvedValueOnce({ ok: false, error: '認証コードが正しくありません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { code: '000000', setupId: 'setup-id-1' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_2FA_INVALID_CODE')
  })

  it('未分類のエラーは 404 NOT_FOUND にフォールバックする', async () => {
    mockEnable2FAForUser.mockResolvedValueOnce({ ok: false, error: 'ユーザーが見つかりません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { code: '123456', setupId: 'setup-id-1' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('停止アカウント → 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/enable', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ code: '123456', setupId: 'setup-id-1' }),
    })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限は Zod 検証通過後に実施される（不正入力ではレート制限を消費しない）', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { setupId: 'setup-id-1' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    await POST(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('レート制限超過 → 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { code: '123456', setupId: 'setup-id-1' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    mockEnable2FAForUser.mockResolvedValueOnce({ ok: false, error: '認証コードが正しくありません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { code: '000000', setupId: 'setup-id-1' })
    const { POST } = await import('@/app/api/v1/auth/2fa/enable/route')
    const res = await POST(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
