// @vitest-environment node
/**
 * POST /api/v1/auth/2fa/verify のユニットテスト
 *
 * チケット消費・TOTP/バックアップコード検証・単回消費・停止の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

const mockConsumeMobile2FATicket = vi.fn()
vi.mock('@/lib/api/v1/mobile-2fa-ticket', () => ({
  consumeMobile2FATicket: (...args: unknown[]) => mockConsumeMobile2FATicket(...args),
}))

const mockUserFindUnique = vi.fn()
const mockUserUpdate = vi.fn().mockResolvedValue({})
const mockRefreshTokenCreate = vi.fn().mockResolvedValue({})
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
    refreshToken: {
      create: (...args: unknown[]) => mockRefreshTokenCreate(...args),
    },
  },
}))

const mockVerifyTOTP = vi.fn()
const mockVerifyBackupCode = vi.fn()
const mockDecryptSecret = vi.fn()
const mockDetectCodeType = vi.fn()
const mockFormatTOTPCode = vi.fn()
vi.mock('@/lib/two-factor', () => ({
  verifyTOTP: (...args: unknown[]) => mockVerifyTOTP(...args),
  verifyBackupCode: (...args: unknown[]) => mockVerifyBackupCode(...args),
  decryptSecret: (...args: unknown[]) => mockDecryptSecret(...args),
  detectCodeType: (...args: unknown[]) => mockDetectCodeType(...args),
  formatTOTPCode: (...args: unknown[]) => mockFormatTOTPCode(...args),
}))

const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

function make2FARequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/v1/auth/2fa/verify', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockRefreshTokenCreate.mockResolvedValue({})
    mockFormatTOTPCode.mockImplementation((code: string) => code)
    mockDecryptSecret.mockReturnValue('decrypted-secret')
    mockDetectCodeType.mockReturnValue('totp')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('TOTP コード正常で 200 とトークンペアを返す', async () => {
    mockConsumeMobile2FATicket.mockResolvedValueOnce('user-2fa')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-2fa',
      isSuspended: false,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted-secret',
      twoFactorBackupCodes: [],
    })
    mockVerifyTOTP.mockResolvedValueOnce(true)

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'valid-ticket', code: '123456' }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.accessToken).toBe('string')
    expect(typeof body.refreshToken).toBe('string')
  })

  it('バックアップコード正常で 200 とトークンペアを返す', async () => {
    mockDetectCodeType.mockReturnValue('backup')
    mockConsumeMobile2FATicket.mockResolvedValueOnce('user-backup')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-backup',
      isSuspended: false,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted-secret',
      twoFactorBackupCodes: ['code-hash-1', 'code-hash-2'],
    })
    mockVerifyBackupCode.mockReturnValueOnce(0)

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'valid-ticket', code: 'backup-code-12345678' }))

    expect(res.status).toBe(200)
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-backup' },
        data: { twoFactorBackupCodes: ['code-hash-2'] },
      })
    )
  })

  it('チケット不在で 401 AUTH_2FA_TICKET_EXPIRED（チケット消費済み）', async () => {
    mockConsumeMobile2FATicket.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'expired-ticket', code: '123456' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_2FA_TICKET_EXPIRED')
  })

  it('不正 TOTP コードで 401 AUTH_2FA_INVALID_CODE（チケット消費済み）', async () => {
    mockConsumeMobile2FATicket.mockResolvedValueOnce('user-2fa')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-2fa',
      isSuspended: false,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted-secret',
      twoFactorBackupCodes: [],
    })
    mockVerifyTOTP.mockResolvedValueOnce(false)

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'valid-ticket', code: '000000' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_2FA_INVALID_CODE')
  })

  it('不正バックアップコードで 401 AUTH_2FA_INVALID_CODE', async () => {
    mockDetectCodeType.mockReturnValue('backup')
    mockConsumeMobile2FATicket.mockResolvedValueOnce('user-2fa')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-2fa',
      isSuspended: false,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted-secret',
      twoFactorBackupCodes: ['hash1'],
    })
    mockVerifyBackupCode.mockReturnValueOnce(-1)

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'valid-ticket', code: 'wrong-backup-code' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_2FA_INVALID_CODE')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockConsumeMobile2FATicket.mockResolvedValueOnce('suspended-user')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'suspended-user',
      isSuspended: true,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted-secret',
      twoFactorBackupCodes: [],
    })

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'valid-ticket', code: '123456' }))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ユーザー不存在で 401 AUTH_2FA_INVALID_CODE', async () => {
    mockConsumeMobile2FATicket.mockResolvedValueOnce('ghost-user')
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'valid-ticket', code: '123456' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_2FA_INVALID_CODE')
  })

  it('twoFactorEnabled=false のユーザーで 401 AUTH_2FA_INVALID_CODE', async () => {
    mockConsumeMobile2FATicket.mockResolvedValueOnce('no-2fa-user')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'no-2fa-user',
      isSuspended: false,
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    })

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'valid-ticket', code: '123456' }))

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_2FA_INVALID_CODE')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 900_000,
    })

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'valid-ticket', code: '123456' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/2fa/verify', {
      method: 'POST',
      body: 'notjson',
      headers: { 'Content-Type': 'application/json' },
    })
    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('ticket フィールド欠落で 400 VALIDATION_ERROR', async () => {
    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ code: '123456' }))
    expect(res.status).toBe(400)
  })

  it('MOBILE_JWT_SECRET 未設定で 503 SERVER_MISCONFIGURED', async () => {
    vi.unstubAllEnvs()
    vi.stubEnv('MOBILE_JWT_SECRET', '')
    mockConsumeMobile2FATicket.mockResolvedValueOnce('user-2fa')
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'user-2fa',
      isSuspended: false,
      twoFactorEnabled: true,
      twoFactorSecret: 'encrypted-secret',
      twoFactorBackupCodes: [],
    })
    mockVerifyTOTP.mockResolvedValueOnce(true)

    const { POST } = await import('@/app/api/v1/auth/2fa/verify/route')
    const res = await POST(make2FARequest({ ticket: 'valid-ticket', code: '123456' }))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error.code).toBe('SERVER_MISCONFIGURED')
  })
})
