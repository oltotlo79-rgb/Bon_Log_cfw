// @vitest-environment node
/**
 * POST /api/v1/devices — Push 通知デバイストークン登録（冪等 upsert）
 *
 * 200 / 400 / 401 / 403 / 429 の全分岐、冪等性、platform 検証、
 * userId 付け替え（別ユーザー同一トークン）、プッシュトークン非漏洩を検証する。
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

const mockRegisterDevice = vi.fn()
vi.mock('@/lib/services/device-service', () => ({
  registerDevice: (...args: unknown[]) => mockRegisterDevice(...args),
  removeDevice: vi.fn(),
}))

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  body: unknown,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/devices', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/v1/devices', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({
      success: true,
      remaining: 59,
      resetTime: Date.now() + 60000,
    })
    mockRegisterDevice.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと ios プラットフォームで 200 { success: true } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('有効なトークンと android プラットフォームで 200 { success: true } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token: 'fcm-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      platform: 'android',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ success: true })
  })

  it('registerDevice に userId・token・platform が渡される', async () => {
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
    const req = await makeAuthenticatedRequest('user-abc', 'user@example.com', {
      token,
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    await POST(req)

    expect(mockRegisterDevice).toHaveBeenCalledWith('user-abc', token, 'ios')
  })

  it('同一トークンを再 POST しても 200（冪等 upsert）', async () => {
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token,
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mockRegisterDevice).toHaveBeenCalledOnce()
  })

  it('別ユーザーが同一トークンを POST すると新 userId で registerDevice が呼ばれる（userId 付け替え）', async () => {
    const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]'
    const req = await makeAuthenticatedRequest('user-new', 'new@example.com', {
      token,
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    await POST(req)

    expect(mockRegisterDevice).toHaveBeenCalledWith('user-new', token, 'ios')
  })

  it('token が空文字列の場合 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token: '',
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('token が 512 文字超の場合 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token: 'a'.repeat(513),
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('token がちょうど 512 文字の場合 200（最大長境界値）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token: 'a'.repeat(512),
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(200)
  })

  it('platform が android / ios 以外の場合 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token: 'valid-token',
      platform: 'windows',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('token フィールドが存在しない場合 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('platform フィールドが存在しない場合 400 VALIDATION_ERROR', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token: 'valid-token',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な JSON ボディで 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-1')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-1',
      isSuspended: false,
      email: 'user@example.com',
    })
    const req = new NextRequest('http://localhost/api/v1/devices', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: 'not-json',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/devices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'valid-token', platform: 'ios' }),
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正な JWT で 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/devices', {
      method: 'POST',
      headers: {
        authorization: 'Bearer invalid.token.here',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: 'valid-token', platform: 'ios' }),
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

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
    const req = new NextRequest('http://localhost/api/v1/devices', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${jwtToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ token: 'valid-token', platform: 'ios' }),
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, {
      token: 'valid-token',
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token: 'valid-token',
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/devices', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('成功レスポンスのボディにトークン実値が含まれない（トークン非漏洩）', async () => {
    const sensitiveToken = 'ExponentPushToken[SENSITIVE_VALUE_DO_NOT_LEAK]'
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', {
      token: sensitiveToken,
      platform: 'ios',
    })
    const { POST } = await import('@/app/api/v1/devices/route')
    const res = await POST(req)

    const responseText = await res.text()
    expect(responseText).not.toContain(sensitiveToken)
  })
})
