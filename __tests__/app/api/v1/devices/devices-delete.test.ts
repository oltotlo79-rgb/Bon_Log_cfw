// @vitest-environment node
/**
 * DELETE /api/v1/devices/{token} — Push 通知デバイストークン解除（冪等）
 *
 * 200 / 400 / 401 / 403 / 429 の全分岐、自己限定削除（他人・不存在トークンも 200）、
 * URL エンコード済み Expo トークンのデコード、プッシュトークン非漏洩を検証する。
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

const mockRemoveDevice = vi.fn()
vi.mock('@/lib/services/device-service', () => ({
  registerDevice: vi.fn(),
  removeDevice: (...args: unknown[]) => mockRemoveDevice(...args),
}))

async function makeAuthenticatedDeleteRequest(
  userId: string,
  email: string,
  pathToken: string,
): Promise<[NextRequest, { params: Promise<{ token: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const jwtToken = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(
    `http://localhost/api/v1/devices/${encodeURIComponent(pathToken)}`,
    {
      method: 'DELETE',
      headers: { authorization: `Bearer ${jwtToken}` },
    },
  )
  return [req, { params: Promise.resolve({ token: pathToken }) }]
}

describe('DELETE /api/v1/devices/[token]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({
      success: true,
      remaining: 59,
      resetTime: Date.now() + 60000,
    })
    mockRemoveDevice.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('自分のトークンを解除すると 200 { success: true } を返す', async () => {
    const [req, params] = await makeAuthenticatedDeleteRequest(
      'user-1',
      'user@example.com',
      'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    )
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('removeDevice に userId と token が渡される（自己限定）', async () => {
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
    const [req, params] = await makeAuthenticatedDeleteRequest('user-abc', 'user@example.com', token)
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    await DELETE(req, params)

    expect(mockRemoveDevice).toHaveBeenCalledWith('user-abc', token)
  })

  it('他人のトークンを指定しても 200 を返す（冪等・情報漏洩なし）', async () => {
    mockRemoveDevice.mockResolvedValueOnce(undefined)
    const [req, params] = await makeAuthenticatedDeleteRequest(
      'user-1',
      'user@example.com',
      'other-user-token',
    )
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('存在しないトークンを指定しても 200 を返す（冪等・fail-safe）', async () => {
    mockRemoveDevice.mockResolvedValueOnce(undefined)
    const [req, params] = await makeAuthenticatedDeleteRequest(
      'user-1',
      'user@example.com',
      'nonexistent-token-xyz',
    )
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
  })

  it('URL エンコード済み Expo トークン（%5B%5D 含む）がデコードされて removeDevice に渡る', async () => {
    const rawToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const jwtToken = await signAccessToken('user-1')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      isSuspended: false,
      email: 'user@example.com',
    })
    const req = new NextRequest(
      `http://localhost/api/v1/devices/${encodeURIComponent(rawToken)}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${jwtToken}` },
      },
    )
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    await DELETE(req, { params: Promise.resolve({ token: rawToken }) })

    expect(mockRemoveDevice).toHaveBeenCalledWith('user-1', rawToken)
  })

  it('token が 512 文字超の場合 400 VALIDATION_ERROR', async () => {
    const longToken = 'a'.repeat(513)
    const [req, params] = await makeAuthenticatedDeleteRequest(
      'user-1',
      'user@example.com',
      longToken,
    )
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('token がちょうど 512 文字の場合 200（最大長境界値）', async () => {
    const [req, params] = await makeAuthenticatedDeleteRequest(
      'user-1',
      'user@example.com',
      'a'.repeat(512),
    )
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/devices/some-token', {
      method: 'DELETE',
    })
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, { params: Promise.resolve({ token: 'some-token' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正な JWT で 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/devices/some-token', {
      method: 'DELETE',
      headers: { authorization: 'Bearer invalid.jwt.token' },
    })
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, { params: Promise.resolve({ token: 'some-token' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const jwtToken = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-susp',
      isSuspended: true,
      email: 'susp@example.com',
    })
    const req = new NextRequest('http://localhost/api/v1/devices/some-token', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${jwtToken}` },
    })
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, { params: Promise.resolve({ token: 'some-token' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedDeleteRequest('guest-id', GUEST_EMAIL, 'some-token')
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedDeleteRequest(
      'user-1',
      'user@example.com',
      'some-token',
    )
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/devices/some-token', {
      method: 'DELETE',
    })
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, { params: Promise.resolve({ token: 'some-token' }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('成功レスポンスのボディにトークン実値が含まれない（トークン非漏洩）', async () => {
    const sensitiveToken = 'ExponentPushToken[SENSITIVE_VALUE_DO_NOT_LEAK]'
    const [req, params] = await makeAuthenticatedDeleteRequest(
      'user-1',
      'user@example.com',
      sensitiveToken,
    )
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, params)

    const responseText = await res.text()
    expect(responseText).not.toContain(sensitiveToken)
  })

  it('token パスパラメータが空文字列の場合 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const jwtToken = await signAccessToken('user-1')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      isSuspended: false,
      email: 'user@example.com',
    })
    const req = new NextRequest('http://localhost/api/v1/devices/', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${jwtToken}` },
    })
    const { DELETE } = await import('@/app/api/v1/devices/[token]/route')
    const res = await DELETE(req, { params: Promise.resolve({ token: '' }) })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
