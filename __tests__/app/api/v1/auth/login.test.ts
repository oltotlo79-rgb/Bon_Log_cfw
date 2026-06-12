// @vitest-environment node
/**
 * POST /api/v1/auth/login のユニットテスト
 *
 * 200 / 202(2FA) / 400 / 401 / 403 / 429 / 503 の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

const mockPrisma = {
  refreshToken: { create: vi.fn().mockResolvedValue({}) },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockVerifyCredentials = vi.fn()
vi.mock('@/lib/services/credential-verification', () => ({
  verifyCredentials: (...args: unknown[]) => mockVerifyCredentials(...args),
}))

const mockIssueMobile2FATicket = vi.fn()
vi.mock('@/lib/api/v1/mobile-2fa-ticket', () => ({
  issueMobile2FATicket: (...args: unknown[]) => mockIssueMobile2FATicket(...args),
}))

const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

function makeLoginRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/v1/auth/login', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockPrisma.refreshToken.create.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常なログインで 200 とトークンペアを返す', async () => {
    mockVerifyCredentials.mockResolvedValueOnce({
      ok: true,
      user: { id: 'user-1', email: 'test@example.com', nickname: 'Test', avatarUrl: null, twoFactorEnabled: false },
    })

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'test@example.com', password: 'password123' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
    expect(body.expiresIn).toBe(900)
  })

  it('2FA 有効ユーザーで 202 + requires2FA:true + ticket を返す', async () => {
    mockVerifyCredentials.mockResolvedValueOnce({
      ok: true,
      user: { id: 'user-2fa', email: '2fa@example.com', nickname: '2FA User', avatarUrl: null, twoFactorEnabled: true },
    })
    mockIssueMobile2FATicket.mockResolvedValueOnce('test-ticket-uuid')

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: '2fa@example.com', password: 'password123' }))

    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.requires2FA).toBe(true)
    expect(body.ticket).toBe('test-ticket-uuid')
  })

  it('不正な JSON ボディで 400 VALIDATION_ERROR', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/login', {
      method: 'POST',
      body: 'notjson',
      headers: { 'Content-Type': 'application/json' },
    })
    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('email フィールド欠落で 400 VALIDATION_ERROR', async () => {
    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ password: 'password123' }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('password フィールド欠落で 400 VALIDATION_ERROR', async () => {
    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'test@example.com' }))
    expect(res.status).toBe(400)
  })

  it('ゲストメールで 403 GUEST_NOT_ALLOWED', async () => {
    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'guest@example.com', password: 'password' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('credentials 失敗（invalid）で 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockVerifyCredentials.mockResolvedValueOnce({ ok: false, reason: 'invalid' })

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'bad@example.com', password: 'wrongpass' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('throttled で 401 AUTH_INVALID_CREDENTIALS（列挙攻撃対策で suspended と区別しない）', async () => {
    mockVerifyCredentials.mockResolvedValueOnce({ ok: false, reason: 'throttled' })

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'throttled@example.com', password: 'pass' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('unverified で 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockVerifyCredentials.mockResolvedValueOnce({ ok: false, reason: 'unverified' })

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'unverified@example.com', password: 'pass' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('no_password で 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockVerifyCredentials.mockResolvedValueOnce({ ok: false, reason: 'no_password' })

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'oauth@example.com', password: 'pass' }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('アカウント停止で 403 ACCOUNT_SUSPENDED', async () => {
    mockVerifyCredentials.mockResolvedValueOnce({ ok: false, reason: 'suspended' })

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'suspended@example.com', password: 'pass' }))
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 900_000,
    })

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'test@example.com', password: 'pass' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('Redis 障害（failOpen:false）で login が 429 を返す', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
    })

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'test@example.com', password: 'pass' }))
    expect(res.status).toBe(429)
  })

  it('MOBILE_JWT_SECRET 未設定で 503 SERVER_MISCONFIGURED', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('MOBILE_JWT_SECRET', '')
    mockVerifyCredentials.mockResolvedValueOnce({
      ok: true,
      user: { id: 'u1', email: 'test@example.com', nickname: 'T', avatarUrl: null, twoFactorEnabled: false },
    })

    const { POST } = await import('@/app/api/v1/auth/login/route')
    const res = await POST(makeLoginRequest({ email: 'test@example.com', password: 'pass' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVER_MISCONFIGURED')
  })
})
