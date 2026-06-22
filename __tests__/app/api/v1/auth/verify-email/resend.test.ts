// @vitest-environment node
/**
 * POST /api/v1/auth/verify-email/resend
 *
 * 列挙攻撃対策（常に 200）・レート制限・コアロジック委譲を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ──────────────────────────────────────────────────
// モック: resendVerificationEmailCore
// ──────────────────────────────────────────────────
const mockResendVerificationEmailCore = vi.fn()
vi.mock('@/lib/services/email-verify-core', () => ({
  resendVerificationEmailCore: (...args: unknown[]) => mockResendVerificationEmailCore(...args),
}))

// ──────────────────────────────────────────────────
// モック: rate-limit
// ──────────────────────────────────────────────────
const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

// ──────────────────────────────────────────────────
// モック: apiRateLimited（verify-email/resend のルートは apiRateLimited を使う）
// ──────────────────────────────────────────────────
vi.mock('@/lib/api/v1', () => ({
  apiRateLimited: (rl: { resetTime: number }) => {
    const retryAfter = Math.max(Math.ceil((rl.resetTime - Date.now()) / 1000), 1)
    return new Response(JSON.stringify({ error: { code: 'RATE_LIMITED' } }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfter),
      },
    })
  },
}))

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/verify-email/resend', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function makeInvalidJsonRequest(): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/verify-email/resend', {
    method: 'POST',
    body: 'not-json{{{',
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/v1/auth/verify-email/resend', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 3, resetTime: Date.now() + 60_000 })
    mockResendVerificationEmailCore.mockResolvedValue({ ok: true })
  })

  // ──────────────────────────────────────────────────
  // 正常系
  // ──────────────────────────────────────────────────

  it('有効なメールで 200 { success: true }', async () => {
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('resendVerificationEmailCore がメールアドレスを渡して呼ばれる', async () => {
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    await POST(makeRequest({ email: 'user@example.com' }))
    expect(mockResendVerificationEmailCore).toHaveBeenCalledWith('user@example.com')
  })

  // ──────────────────────────────────────────────────
  // 列挙攻撃対策: すべて 200
  // ──────────────────────────────────────────────────

  it('存在しないメールでも 200（列挙攻撃対策）', async () => {
    mockResendVerificationEmailCore.mockResolvedValueOnce({ ok: true })
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    const res = await POST(makeRequest({ email: 'notexist@example.com' }))
    expect(res.status).toBe(200)
  })

  it('確認済みメールでも 200（列挙攻撃対策）', async () => {
    mockResendVerificationEmailCore.mockResolvedValueOnce({ ok: true })
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    const res = await POST(makeRequest({ email: 'verified@example.com' }))
    expect(res.status).toBe(200)
  })

  it('Zod 不合格（不正メール形式）でも 200', async () => {
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    const res = await POST(makeRequest({ email: 'not-an-email' }))
    expect(res.status).toBe(200)
    expect(mockResendVerificationEmailCore).not.toHaveBeenCalled()
  })

  it('JSON パース失敗でも 200', async () => {
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    const res = await POST(makeInvalidJsonRequest())
    expect(res.status).toBe(200)
    expect(mockResendVerificationEmailCore).not.toHaveBeenCalled()
  })

  it('email フィールドなし でも 200', async () => {
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(200)
  })

  // ──────────────────────────────────────────────────
  // レート制限
  // ──────────────────────────────────────────────────

  it('レート制限超過で 429 + Retry-After ヘッダー', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 30_000 })
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    expect(mockResendVerificationEmailCore).not.toHaveBeenCalled()
  })

  it('レート制限超過でも resendVerificationEmailCore を呼ばない', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 10_000 })
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    await POST(makeRequest({ email: 'user@example.com' }))
    expect(mockResendVerificationEmailCore).not.toHaveBeenCalled()
  })

  it('Redis 障害（failOpen:false）→ 429', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ success: false, remaining: 0, resetTime: Date.now() + 5_000 })
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(429)
  })

  // ──────────────────────────────────────────────────
  // core からのエラーも 200（列挙攻撃対策）
  // ──────────────────────────────────────────────────

  it('resendVerificationEmailCore がエラーを返しても 200', async () => {
    mockResendVerificationEmailCore.mockResolvedValueOnce({ ok: false, reason: 'email_send_failed' })
    const { POST } = await import('@/app/api/v1/auth/verify-email/resend/route')
    const res = await POST(makeRequest({ email: 'user@example.com' }))
    expect(res.status).toBe(200)
  })
})
