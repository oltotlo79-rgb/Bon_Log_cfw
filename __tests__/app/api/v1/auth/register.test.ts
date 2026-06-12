// @vitest-environment node
/**
 * POST /api/v1/auth/register のユニットテスト
 *
 * 201 / 400 VALIDATION_ERROR / 409 CONFLICT / 429 RATE_LIMITED の全分岐と
 * セキュリティ性質（Zod 失敗時にレート制限を消費しない等）を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ============================================================================
// Mock setup
// ============================================================================

const mockRegisterUserCore = vi.fn()
vi.mock('@/lib/services/registration-service', () => ({
  registerUserCore: (...args: unknown[]) => mockRegisterUserCore(...args),
}))

const mockCheckRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}))

vi.mock('@/lib/utils/client-ip', () => ({
  getClientIpFromRequest: () => '127.0.0.1',
}))

vi.mock('@/lib/security-logger', () => ({
  logRegisterSuccess: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

// ============================================================================
// Helpers
// ============================================================================

function makeRegisterRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const validBody = {
  nickname: 'テストユーザー',
  email: 'newuser@example.com',
  password: 'ValidPass1',
  termsAccepted: true,
}

// ============================================================================
// Tests
// ============================================================================

describe('POST /api/v1/auth/register', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckRateLimit.mockResolvedValue({ success: true, remaining: 4, resetTime: Date.now() + 60000 })
    mockRegisterUserCore.mockResolvedValue({ ok: true, userId: 'user-new-1' })
  })

  // --------------------------------------------------------------------------
  // 正常系
  // --------------------------------------------------------------------------

  describe('正常系', () => {
    it('正常な入力で 201 + { success: true } を返す', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))

      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body).toEqual({ success: true })
    })

    it('registerUserCore を正しいパラメータで呼び出す', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      await POST(makeRegisterRequest(validBody))

      expect(mockRegisterUserCore).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validBody.email,
          nickname: validBody.nickname,
        }),
      )
    })
  })

  // --------------------------------------------------------------------------
  // Zod バリデーションエラー — 400 VALIDATION_ERROR
  // --------------------------------------------------------------------------

  describe('400 VALIDATION_ERROR — nickname', () => {
    it('nickname が空文字で 400 VALIDATION_ERROR', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, nickname: '' }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('nickname が 51 文字（MAX_NICKNAME_LENGTH 超過）で 400 VALIDATION_ERROR', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, nickname: 'あ'.repeat(51) }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('nickname に改行を含む場合は 400 VALIDATION_ERROR', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, nickname: 'user\nname' }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('nickname に "<" を含む場合は 400 VALIDATION_ERROR', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, nickname: '<script>' }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('nickname に ">" を含む場合は 400 VALIDATION_ERROR', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, nickname: 'user>name' }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('nickname が 50 文字（MAX_NICKNAME_LENGTH ちょうど）は通過する', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, nickname: 'あ'.repeat(50) }))

      // Zod は通過するため registerUserCore が呼ばれる（200系 or registerUserCore の結果次第）
      expect(res.status).not.toBe(400)
    })
  })

  describe('400 VALIDATION_ERROR — email', () => {
    it('email が不正な形式で 400 VALIDATION_ERROR', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, email: 'not-an-email' }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('email が 101 文字超で 400 VALIDATION_ERROR', async () => {
      const longEmail = 'a'.repeat(90) + '@example.com' // 102文字
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, email: longEmail }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('400 VALIDATION_ERROR — password', () => {
    it('password が 7 文字（8文字未満）で 400 VALIDATION_ERROR', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, password: 'Short1' }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('8文字')
    })

    it('password が英字のみで 400 VALIDATION_ERROR（数字なし）', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, password: 'onlyletters' }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('数字')
    })

    it('password が数字のみで 400 VALIDATION_ERROR（英字なし）', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, password: '12345678' }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
      expect(body.error.message).toContain('アルファベット')
    })
  })

  describe('400 VALIDATION_ERROR — termsAccepted', () => {
    it('termsAccepted が false で 400 VALIDATION_ERROR', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, termsAccepted: false }))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('termsAccepted が欠落して 400 VALIDATION_ERROR', async () => {
      const { termsAccepted: _, ...bodyWithoutTerms } = validBody
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(bodyWithoutTerms))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('400 VALIDATION_ERROR — 不正 JSON', () => {
    it('不正な JSON ボディで 400 VALIDATION_ERROR', async () => {
      const req = new NextRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        body: 'not-json',
        headers: { 'Content-Type': 'application/json' },
      })
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(req)

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  // --------------------------------------------------------------------------
  // 409 CONFLICT — メール重複
  // --------------------------------------------------------------------------

  describe('409 CONFLICT — email_already_registered', () => {
    it('メール重複で 409 CONFLICT を返す', async () => {
      mockRegisterUserCore.mockResolvedValueOnce({
        ok: false,
        reason: 'email_already_registered',
        message: 'このメールアドレスは既に登録されています',
      })

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))

      expect(res.status).toBe(409)
      const body = await res.json()
      expect(body.error.code).toBe('CONFLICT')
    })
  })

  // --------------------------------------------------------------------------
  // 400 — nickname_reserved / email_blacklisted / device_blacklisted
  // --------------------------------------------------------------------------

  describe('400 — registerUserCore の failure reason', () => {
    it('nickname_reserved で 400 VALIDATION_ERROR', async () => {
      mockRegisterUserCore.mockResolvedValueOnce({
        ok: false,
        reason: 'nickname_reserved',
        message: 'このユーザー名は利用できません。別のユーザー名をご利用ください。',
      })

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('email_blacklisted で 400 VALIDATION_ERROR', async () => {
      mockRegisterUserCore.mockResolvedValueOnce({
        ok: false,
        reason: 'email_blacklisted',
        message: 'このメールアドレスは利用できません',
      })

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('device_blacklisted で 400 VALIDATION_ERROR', async () => {
      mockRegisterUserCore.mockResolvedValueOnce({
        ok: false,
        reason: 'device_blacklisted',
        message: 'このデバイスからの登録は許可されていません',
      })

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('email_send_failed で 500 INTERNAL_ERROR', async () => {
      mockRegisterUserCore.mockResolvedValueOnce({
        ok: false,
        reason: 'email_send_failed',
        message: '確認メールの送信に失敗しました。しばらく経ってからお試しください。',
      })

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.code).toBe('INTERNAL_ERROR')
    })
  })

  // --------------------------------------------------------------------------
  // 429 RATE_LIMITED
  // --------------------------------------------------------------------------

  describe('429 RATE_LIMITED', () => {
    it('レート制限超過で 429 RATE_LIMITED + Retry-After を返す', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        success: false,
        remaining: 0,
        resetTime: Date.now() + 3_600_000,
      })

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).not.toBeNull()
      const body = await res.json()
      expect(body.error.code).toBe('RATE_LIMITED')
    })

    it('Retry-After ヘッダーは正の整数文字列である', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        success: false,
        remaining: 0,
        resetTime: Date.now() + 60_000,
      })

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))

      const retryAfter = res.headers.get('Retry-After')
      expect(retryAfter).not.toBeNull()
      expect(Number(retryAfter)).toBeGreaterThan(0)
    })
  })

  // --------------------------------------------------------------------------
  // セキュリティ性質: Zod 失敗時にレート制限を消費しない
  // --------------------------------------------------------------------------

  describe('セキュリティ: Zod 失敗時はレート制限を消費しない', () => {
    it('nickname バリデーション失敗（空）では checkRateLimit を呼ばない', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      await POST(makeRegisterRequest({ ...validBody, nickname: '' }))

      expect(mockCheckRateLimit).not.toHaveBeenCalled()
    })

    it('email バリデーション失敗では checkRateLimit を呼ばない', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      await POST(makeRegisterRequest({ ...validBody, email: 'bad-email' }))

      expect(mockCheckRateLimit).not.toHaveBeenCalled()
    })

    it('password バリデーション失敗では checkRateLimit を呼ばない', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      await POST(makeRegisterRequest({ ...validBody, password: 'short1' }))

      expect(mockCheckRateLimit).not.toHaveBeenCalled()
    })

    it('不正 JSON では checkRateLimit を呼ばない', async () => {
      const req = new NextRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        body: 'notjson',
        headers: { 'Content-Type': 'application/json' },
      })
      const { POST } = await import('@/app/api/v1/auth/register/route')
      await POST(req)

      expect(mockCheckRateLimit).not.toHaveBeenCalled()
    })
  })

  // --------------------------------------------------------------------------
  // エラーレスポンス形式
  // --------------------------------------------------------------------------

  describe('エラーレスポンス形式', () => {
    it('エラーレスポンスは { error: { code, message, status } } の形式を持つ', async () => {
      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest({ ...validBody, nickname: '' }))
      const body = await res.json()

      expect(body).toHaveProperty('error')
      expect(body.error).toHaveProperty('code')
      expect(body.error).toHaveProperty('message')
      expect(body.error).toHaveProperty('status')
      expect(typeof body.error.code).toBe('string')
      expect(typeof body.error.message).toBe('string')
      expect(typeof body.error.status).toBe('number')
    })

    it('409 エラーレスポンスの status フィールドは 409 である', async () => {
      mockRegisterUserCore.mockResolvedValueOnce({
        ok: false,
        reason: 'email_already_registered',
        message: 'このメールアドレスは既に登録されています',
      })

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))
      const body = await res.json()

      expect(body.error.status).toBe(409)
    })

    it('429 エラーレスポンスの status フィールドは 429 である', async () => {
      mockCheckRateLimit.mockResolvedValueOnce({
        success: false,
        remaining: 0,
        resetTime: Date.now() + 60_000,
      })

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))
      const body = await res.json()

      expect(body.error.status).toBe(429)
    })
  })

  // --------------------------------------------------------------------------
  // 予期せぬ例外
  // --------------------------------------------------------------------------

  describe('予期せぬ例外', () => {
    it('registerUserCore が予期せぬ例外をスローすると 500 INTERNAL_ERROR を返す', async () => {
      mockRegisterUserCore.mockRejectedValueOnce(new Error('unexpected db error'))

      const { POST } = await import('@/app/api/v1/auth/register/route')
      const res = await POST(makeRegisterRequest(validBody))

      expect(res.status).toBe(500)
      const body = await res.json()
      expect(body.error.code).toBe('INTERNAL_ERROR')
    })
  })
})
