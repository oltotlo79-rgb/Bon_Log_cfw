// @vitest-environment node
/**
 * POST /api/v1/auth/password-reset/request および confirm のユニットテスト
 *
 * request: 常に 200（列挙攻撃対策） / 429 / Redis 障害は 429
 * confirm: 200 / 400 VALIDATION_ERROR / 401 AUTH_INVALID_CREDENTIALS / 429
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockRequestPasswordResetCore = vi.fn()
const mockResetPasswordCore = vi.fn()
vi.mock('@/lib/services/password-reset-service', () => ({
  requestPasswordResetCore: (...args: unknown[]) => mockRequestPasswordResetCore(...args),
  resetPasswordCore: (...args: unknown[]) => mockResetPasswordCore(...args),
}))

const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('@/lib/utils/client-ip', () => ({
  getClientIpFromRequest: () => '127.0.0.1',
}))

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/v1/auth/password-reset/request', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 2, resetTime: Date.now() + 60000 })
    mockRequestPasswordResetCore.mockResolvedValue({ ok: true })
  })

  it('正常なメールアドレスで 200 { success: true } を返す', async () => {
    const { POST } = await import('@/app/api/v1/auth/password-reset/request/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/request', { email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('存在しないメールでも 200 を返す（列挙攻撃対策）', async () => {
    mockRequestPasswordResetCore.mockResolvedValueOnce({ ok: true })
    const { POST } = await import('@/app/api/v1/auth/password-reset/request/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/request', { email: 'notexist@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('メール送信失敗でも 200 を返す（列挙攻撃対策と一貫したレスポンス）', async () => {
    mockRequestPasswordResetCore.mockResolvedValueOnce({ ok: false, reason: 'email_send_failed' })
    const { POST } = await import('@/app/api/v1/auth/password-reset/request/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/request', { email: 'user@example.com' }))
    expect(res.status).toBe(200)
  })

  it('不正メール形式でも 200 を返す（列挙攻撃対策）', async () => {
    const { POST } = await import('@/app/api/v1/auth/password-reset/request/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/request', { email: 'bad-email' }))
    expect(res.status).toBe(200)
  })

  it('不正 JSON でも 200 を返す（列挙攻撃対策）', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/password-reset/request', {
      method: 'POST',
      body: 'notjson',
      headers: { 'Content-Type': 'application/json' },
    })
    const { POST } = await import('@/app/api/v1/auth/password-reset/request/route')
    const res = await POST(req)
    expect(res.status).toBe(200)
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 3_600_000,
    })

    const { POST } = await import('@/app/api/v1/auth/password-reset/request/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/request', { email: 'user@example.com' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})

describe('POST /api/v1/auth/password-reset/confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 2, resetTime: Date.now() + 60000 })
    mockResetPasswordCore.mockResolvedValue({ ok: true })
  })

  it('正常なリセットで 200 { success: true } を返す', async () => {
    const { POST } = await import('@/app/api/v1/auth/password-reset/confirm/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/confirm', {
      email: 'user@example.com',
      token: 'a'.repeat(64),
      newPassword: 'NewPassword123!',
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('invalid_token で 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockResetPasswordCore.mockResolvedValueOnce({ ok: false, reason: 'invalid_token' })
    const { POST } = await import('@/app/api/v1/auth/password-reset/confirm/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/confirm', {
      email: 'user@example.com',
      token: 'a'.repeat(64),
      newPassword: 'NewPassword123!',
    }))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_CREDENTIALS')
  })

  it('user_not_found で 401 AUTH_INVALID_CREDENTIALS', async () => {
    mockResetPasswordCore.mockResolvedValueOnce({ ok: false, reason: 'user_not_found' })
    const { POST } = await import('@/app/api/v1/auth/password-reset/confirm/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/confirm', {
      email: 'ghost@example.com',
      token: 'a'.repeat(64),
      newPassword: 'NewPassword123!',
    }))
    expect(res.status).toBe(401)
  })

  it('弱いパスワード（数字なし）は passwordSchema で 400 VALIDATION_ERROR — resetPasswordCore は呼ばれない', async () => {
    const { POST } = await import('@/app/api/v1/auth/password-reset/confirm/route')
    // 'passwordonly' は文字数 OK だが数字が含まれないため passwordSchema が Zod 段階で拒否する
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/confirm', {
      email: 'user@example.com',
      token: 'a'.repeat(64),
      newPassword: 'passwordonly',
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.message).toContain('数字を含めてください')
    // Zod バリデーション失敗でレート制限前に返るため resetPasswordCore は呼ばれない
    expect(mockResetPasswordCore).not.toHaveBeenCalled()
    // レート制限も消費されない
    expect(mockCheckRateLimit).not.toHaveBeenCalled()
  })

  it('email フィールド欠落で 400 VALIDATION_ERROR', async () => {
    const { POST } = await import('@/app/api/v1/auth/password-reset/confirm/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/confirm', {
      token: 'a'.repeat(64),
      newPassword: 'NewPassword123!',
    }))
    expect(res.status).toBe(400)
  })

  it('不正 JSON で 400 VALIDATION_ERROR', async () => {
    const req = new NextRequest('http://localhost/api/v1/auth/password-reset/confirm', {
      method: 'POST',
      body: 'notjson',
      headers: { 'Content-Type': 'application/json' },
    })
    const { POST } = await import('@/app/api/v1/auth/password-reset/confirm/route')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 3_600_000,
    })

    const { POST } = await import('@/app/api/v1/auth/password-reset/confirm/route')
    const res = await POST(makeRequest('http://localhost/api/v1/auth/password-reset/confirm', {
      email: 'user@example.com',
      token: 'a'.repeat(64),
      newPassword: 'NewPassword123!',
    }))
    expect(res.status).toBe(429)
  })
})
