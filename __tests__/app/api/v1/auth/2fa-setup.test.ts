// @vitest-environment node
/**
 * GET /api/v1/auth/2fa/setup のユニットテスト
 *
 * 200 + { secret, otpAuthUrl, setupId, backupCodes[] } / 401 / 403 ゲスト /
 * 409 既に有効 / 429 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'
const AUTHOR_ID = 'user-2fa-setup'

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

const mockSetup2FAForUser = vi.fn()
vi.mock('@/lib/services/two-factor-service', () => ({
  setup2FAForUser: (...args: unknown[]) => mockSetup2FAForUser(...args),
}))

async function makeAuthenticatedRequest(userId: string, email: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/auth/2fa/setup', {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/auth/2fa/setup', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockSetup2FAForUser.mockResolvedValue({
      ok: true,
      qrCode: 'data:image/png;base64,mockQRCode',
      otpAuthUrl: 'otpauth://totp/BON-LOG:test@example.com?secret=SECRET123',
      secret: 'SECRET123',
      setupId: 'setup-id-1',
      backupCodes: ['CODE1', 'CODE2'],
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常系: 200 + { secret, otpAuthUrl, setupId, backupCodes } を返す', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({
      secret: 'SECRET123',
      otpAuthUrl: expect.stringContaining('otpauth://'),
      setupId: 'setup-id-1',
      backupCodes: ['CODE1', 'CODE2'],
    })
  })

  it('レスポンスに qrCode（画面表示専用の base64 PNG）を含まない（Native は otpAuthUrl から自前描画）', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body).not.toHaveProperty('qrCode')
  })

  it('Bearer ヘッダーなし → 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/setup')
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストアカウント → 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウント → 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('susp-user')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'susp-user', isSuspended: true, email: 'susp@example.com' })
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/setup', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('既に2FAが有効な場合 → 409 CONFLICT', async () => {
    mockSetup2FAForUser.mockResolvedValueOnce({ ok: false, error: '2段階認証は既に有効です' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    const res = await GET(req)

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error.code).toBe('CONFLICT')
  })

  it('setup2FAForUser がユーザー不存在エラーを返す → 404 NOT_FOUND', async () => {
    mockSetup2FAForUser.mockResolvedValueOnce({ ok: false, error: 'ユーザーが見つかりません' })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    const res = await GET(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('レート制限超過 → 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30000 })
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('レート制限は two_factor_setup カテゴリで実施される', async () => {
    const req = await makeAuthenticatedRequest(AUTHOR_ID, 'author@example.com')
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    await GET(req)

    expect(mockCheckUserRateLimit).toHaveBeenCalledWith(AUTHOR_ID, 'two_factor_setup')
  })

  it('エラーレスポンスが { error: { code, message, status } } 形式', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/setup')
    const { GET } = await import('@/app/api/v1/auth/2fa/setup/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
