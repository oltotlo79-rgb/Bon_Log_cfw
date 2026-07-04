// @vitest-environment node
/**
 * DELETE /api/v1/auth/2fa/disable のユニットテスト
 *
 * body: { password } — 200 + { disabled: true } / 400 バリデーション /
 * 401 / 403 ゲスト / 409 未有効・パスワード未設定 / 401 誤パスワード / 429 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const AUTHOR_ID = 'user-2fa-disable'

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

const mockDisable2FAForUser = vi.fn()
vi.mock('@/lib/services/two-factor-service', () => ({
  disable2FAForUser: (...args: unknown[]) => mockDisable2FAForUser(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/auth/2fa/disable', {
    method: 'DELETE',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/v1/auth/2fa/disable', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockDisable2FAForUser.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { disabled: true } を返す', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { password: 'password123' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ disabled: true })
  })

  it('disable2FAForUser に userId と password が渡される', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { password: 'my-password' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    await DELETE(req)

    expect(mockDisable2FAForUser).toHaveBeenCalledWith(AUTHOR_ID, 'my-password')
  })

  it('password 欠落で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {})
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('password が空文字で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { password: '' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(AUTHOR_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: AUTHOR_ID, isSuspended: false, email: 'author@example.com' })
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/disable', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'not-json{',
    })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/disable', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'password123' }),
    })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, { password: 'password123' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('2FAが有効でない場合 → 409 CONFLICT', async () => {
    mockDisable2FAForUser.mockResolvedValueOnce({ ok: false, error: '2段階認証が有効ではありません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { password: 'password123' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('パスワード未設定（OAuth専用アカウント）の場合 → 409 CONFLICT', async () => {
    mockDisable2FAForUser.mockResolvedValueOnce({ ok: false, error: 'パスワードが設定されていません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { password: 'password123' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('パスワードが間違っている場合 → 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockDisable2FAForUser.mockResolvedValueOnce({ ok: false, error: 'パスワードが正しくありません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { password: 'wrong-password' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('未分類のエラーは 404 NOT_FOUND にフォールバックする', async () => {
    mockDisable2FAForUser.mockResolvedValueOnce({ ok: false, error: 'ユーザーが見つかりません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { password: 'password123' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('停止アカウント → 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/disable', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'password123' }),
    })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限は Zod 検証通過後に実施される（不正入力ではレート制限を消費しない）', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {})
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    await DELETE(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('レート制限超過 → 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { password: 'password123' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    mockDisable2FAForUser.mockResolvedValueOnce({ ok: false, error: 'パスワードが正しくありません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { password: 'wrong' })
    const { DELETE } = await import('@/app/api/v1/auth/2fa/disable/route')
    const res = await DELETE(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
