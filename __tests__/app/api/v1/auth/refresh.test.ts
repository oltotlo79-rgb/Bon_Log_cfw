// @vitest-environment node
/**
 * POST /api/v1/auth/refresh のユニットテスト
 *
 * トークンローテーション・再利用検知・全失効・期限切れ・停止の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'


const VALID_SECRET = 'a'.repeat(64)

const mockRefreshTokenFindUnique = vi.fn()
const mockRefreshTokenUpdate = vi.fn()
const mockRefreshTokenUpdateMany = vi.fn()
const mockRefreshTokenCreate = vi.fn().mockResolvedValue({})
const mockUserFindUnique = vi.fn()
const mockTransaction = vi.fn()

const mockPrisma = {
  refreshToken: {
    findUnique: (...args: unknown[]) => mockRefreshTokenFindUnique(...args),
    update: (...args: unknown[]) => mockRefreshTokenUpdate(...args),
    updateMany: (...args: unknown[]) => mockRefreshTokenUpdateMany(...args),
    create: (...args: unknown[]) => mockRefreshTokenCreate(...args),
  },
  user: {
    findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
  },
  $transaction: (...args: unknown[]) => mockTransaction(...args),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { warn: vi.fn(), error: vi.fn(), log: vi.fn() },
}))

function makeRefreshRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/refresh', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}


describe('POST /api/v1/auth/refresh', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 19, resetTime: Date.now() + 60000 })

    mockTransaction.mockImplementation((cb: (tx: typeof mockPrisma) => unknown) => {
      return cb(mockPrisma)
    })
    mockRefreshTokenCreate.mockResolvedValue({})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なリフレッシュトークンで 200 と新ペアを返す', async () => {
    const rawToken = 'valid-refresh-token-32bytes-hex-value'

    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: 'rt-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    })
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false })
    mockRefreshTokenUpdate.mockResolvedValueOnce({})

    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(makeRefreshRequest({ refreshToken: rawToken }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
    expect(body.expiresIn).toBe(900)
    expect(mockRefreshTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt-1' }, data: { revokedAt: expect.any(Date) } })
    )
  })

  it('存在しないトークンで 401 AUTH_REFRESH_TOKEN_INVALID', async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(makeRefreshRequest({ refreshToken: 'unknown-token' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REFRESH_TOKEN_INVALID')
  })

  it('revoked 済みトークン再提示で 401 AUTH_REFRESH_TOKEN_REUSE_DETECTED + 全トークン失効', async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: 'rt-revoked',
      userId: 'user-2',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: new Date(Date.now() - 60_000),
    })
    mockRefreshTokenUpdateMany.mockResolvedValueOnce({ count: 3 })

    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(makeRefreshRequest({ refreshToken: 'revoked-refresh-token' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REFRESH_TOKEN_REUSE_DETECTED')

    expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-2', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    )
  })

  it('期限切れトークンで 401 AUTH_REFRESH_TOKEN_INVALID', async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: 'rt-expired',
      userId: 'user-3',
      expiresAt: new Date(Date.now() - 1000),
      revokedAt: null,
    })

    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(makeRefreshRequest({ refreshToken: 'expired-refresh-token' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REFRESH_TOKEN_INVALID')
  })

  it('停止ユーザーで 403 ACCOUNT_SUSPENDED', async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: 'rt-2',
      userId: 'suspended-user',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    })
    mockUserFindUnique.mockResolvedValueOnce({ id: 'suspended-user', isSuspended: true })

    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(makeRefreshRequest({ refreshToken: 'suspended-user-token' }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ユーザー不存在で 401 AUTH_REFRESH_TOKEN_INVALID', async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: 'rt-3',
      userId: 'deleted-user',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    })
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(makeRefreshRequest({ refreshToken: 'deleted-user-token' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REFRESH_TOKEN_INVALID')
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/refresh', {
      method: 'POST',
      body: 'notjson',
      headers: { 'Content-Type': 'application/json' },
    })
    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('refreshToken 欠落で 400 VALIDATION_ERROR', async () => {
    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(makeRefreshRequest({}))
    expect(res.status).toBe(400)
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 900_000,
    })

    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(makeRefreshRequest({ refreshToken: 'some-token' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('MOBILE_JWT_SECRET 未設定で 503 SERVER_MISCONFIGURED', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('MOBILE_JWT_SECRET', '')

    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: 'rt-4',
      userId: 'user-4',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      revokedAt: null,
    })
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-4', isSuspended: false })
    mockRefreshTokenUpdate.mockResolvedValueOnce({})

    const { POST } = await import('@/app/api/v1/auth/refresh/route')
    const res = await POST(makeRefreshRequest({ refreshToken: 'some-token' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVER_MISCONFIGURED')
  })
})
