// @vitest-environment node
/**
 * POST /api/v1/auth/password/change のユニットテスト
 *
 * body: { currentPassword, newPassword } — 200 成功 / 400 バリデーション /
 * 401 未認証 / 403 ゲスト・停止 / 409 OAuth専用アカウント / 401 誤パスワード /
 * 404 ユーザー不在 / 429 レート制限の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const AUTHOR_ID = 'user-password-change'

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

const mockChangeUserPasswordCore = vi.fn()
vi.mock('@/lib/services/password-change-service', () => ({
  changeUserPasswordCore: (...args: unknown[]) => mockChangeUserPasswordCore(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/auth/password/change', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/auth/password/change', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockChangeUserPasswordCore.mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { success: true } を返す', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      currentPassword: 'currentPass1',
      newPassword: 'newPassword1',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('changeUserPasswordCore に userId・currentPassword・newPassword が渡される', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      currentPassword: 'myCurrentPass1',
      newPassword: 'myNewPassword1',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    await POST(req)

    expect(mockChangeUserPasswordCore).toHaveBeenCalledWith(AUTHOR_ID, 'myCurrentPass1', 'myNewPassword1', 'unknown')
  })

  it('changeUserPasswordCore に x-forwarded-for から抽出したクライアント IP が渡される', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(AUTHOR_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: AUTHOR_ID, isSuspended: false, email: 'author@example.com' })
    const req = new NextRequest('http://localhost/api/v1/auth/password/change', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-forwarded-for': '198.51.100.7',
      },
      body: JSON.stringify({ currentPassword: 'myCurrentPass1', newPassword: 'myNewPassword1' }),
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    await POST(req)

    expect(mockChangeUserPasswordCore).toHaveBeenCalledWith(AUTHOR_ID, 'myCurrentPass1', 'myNewPassword1', '198.51.100.7')
  })

  it('currentPassword 欠落で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', { newPassword: 'newPassword1' })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('newPassword が強度不足（数字なし）で 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      currentPassword: 'currentPass1',
      newPassword: 'nonumberpass',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(AUTHOR_ID)
    mockUserFindUnique.mockResolvedValueOnce({ id: AUTHOR_ID, isSuspended: false, email: 'author@example.com' })
    const req = new NextRequest('http://localhost/api/v1/auth/password/change', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: 'not-json{',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/password/change', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'currentPass1', newPassword: 'newPassword1' }),
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, {
      currentPassword: 'currentPass1',
      newPassword: 'newPassword1',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウント → 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest('http://localhost/api/v1/auth/password/change', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ currentPassword: 'currentPass1', newPassword: 'newPassword1' }),
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('現パスワードが間違っている場合 → 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockChangeUserPasswordCore.mockResolvedValueOnce({ ok: false, error: 'パスワードが正しくありません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      currentPassword: 'wrongCurrentPass1',
      newPassword: 'newPassword1',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('OAuth専用アカウント（パスワード未設定）の場合 → 409 CONFLICT', async () => {
    mockChangeUserPasswordCore.mockResolvedValueOnce({ ok: false, error: 'パスワードが設定されていません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      currentPassword: 'currentPass1',
      newPassword: 'newPassword1',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('ユーザーが見つからない場合 → 404 NOT_FOUND', async () => {
    mockChangeUserPasswordCore.mockResolvedValueOnce({ ok: false, error: 'ユーザーが見つかりません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      currentPassword: 'currentPass1',
      newPassword: 'newPassword1',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('未分類のエラーは 500 INTERNAL_ERROR にフォールバックする', async () => {
    mockChangeUserPasswordCore.mockResolvedValueOnce({ ok: false, error: '不明なエラー' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      currentPassword: 'currentPass1',
      newPassword: 'newPassword1',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('レート制限は Zod 検証通過後に実施される（不正入力ではレート制限を消費しない）', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {})
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    await POST(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('レート制限超過 → 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      currentPassword: 'currentPass1',
      newPassword: 'newPassword1',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    mockChangeUserPasswordCore.mockResolvedValueOnce({ ok: false, error: 'パスワードが正しくありません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com', {
      currentPassword: 'wrong',
      newPassword: 'newPassword1',
    })
    const { POST } = await import('@/app/api/v1/auth/password/change/route')
    const res = await POST(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
