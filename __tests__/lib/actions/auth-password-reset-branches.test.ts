// @vitest-environment node
/**
 * lib/actions/auth-password-reset.ts の分岐カバレッジを補完するテスト。
 *
 * 既存の __tests__/lib/actions/auth*.test.ts 群は正常系・代表的なエラー系を
 * カバーしているが、以下の分岐が未検証だった:
 *   - requestPasswordReset: Zod バリデーション失敗（不正メール形式）
 *   - resetPassword: レート制限超過
 *   - resetPassword: newPassword は妥当だが email/token が不正な場合の
 *     fieldErrors フォールバック順序（newPassword → email → token）
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeInput: vi.fn((input: string) => input),
}))

const mockHeaders = { get: vi.fn().mockReturnValue('127.0.0.1') }
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(mockHeaders),
}))

const mockRequestPasswordResetCore = vi.fn()
const mockResetPasswordCore = vi.fn()
vi.mock('@/lib/services/password-reset-service', () => ({
  requestPasswordResetCore: (...args: unknown[]) => mockRequestPasswordResetCore(...args),
  resetPasswordCore: (...args: unknown[]) => mockResetPasswordCore(...args),
}))

describe('auth-password-reset: 追加分岐カバレッジ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
    mockRequestPasswordResetCore.mockResolvedValue({ ok: true })
    mockResetPasswordCore.mockResolvedValue({ ok: true })
  })

  describe('requestPasswordReset - Zod バリデーション失敗', () => {
    it('不正な形式のメールアドレスは列挙攻撃対策として success を返し、rate limit も core も呼ばれない', async () => {
      const { requestPasswordReset } = await import('@/lib/actions/auth-password-reset')

      const result = await requestPasswordReset('not-an-email')

      expect(result).toEqual({ success: true })
      expect(mockRateLimit).not.toHaveBeenCalled()
      expect(mockRequestPasswordResetCore).not.toHaveBeenCalled()
    })
  })

  describe('resetPassword - レート制限超過', () => {
    it('Zod 通過後にレート制限超過なら ERR_RESET_TOO_MANY を返し、core は呼ばれない', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { resetPassword } = await import('@/lib/actions/auth-password-reset')
      const result = await resetPassword({
        email: 'user@example.com',
        token: 'a'.repeat(20),
        newPassword: 'ValidPass123',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(
        'パスワードリセットの要求が多すぎます。しばらく経ってからお試しください。',
      )
      expect(mockResetPasswordCore).not.toHaveBeenCalled()
    })
  })

  describe('resetPassword - fieldErrors フォールバック順序', () => {
    it('newPassword が不正な場合はパスワードのエラーメッセージを優先する', async () => {
      const { resetPassword } = await import('@/lib/actions/auth-password-reset')
      const result = await resetPassword({
        email: 'user@example.com',
        token: 'a'.repeat(20),
        newPassword: 'short', // 長さ不足 + 数字なし
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('パスワードは8文字以上で入力してください')
      expect(mockResetPasswordCore).not.toHaveBeenCalled()
    })

    it('newPassword は妥当だが email が不正な場合は email のエラーメッセージにフォールバックする', async () => {
      const { resetPassword } = await import('@/lib/actions/auth-password-reset')
      const result = await resetPassword({
        email: 'not-an-email',
        token: 'a'.repeat(20),
        newPassword: 'ValidPass123',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('有効なメールアドレスを入力してください')
      expect(mockResetPasswordCore).not.toHaveBeenCalled()
      // Zod バリデーション失敗のため rate limit も消費されない
      expect(mockRateLimit).not.toHaveBeenCalled()
    })

    it('newPassword・email は妥当だが token が短すぎる場合は token のエラーメッセージにフォールバックする', async () => {
      const { resetPassword } = await import('@/lib/actions/auth-password-reset')
      const result = await resetPassword({
        email: 'user@example.com',
        token: 'short', // MIN_TOKEN_LENGTH(10) 未満
        newPassword: 'ValidPass123',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('無効なトークンです。')
      expect(mockResetPasswordCore).not.toHaveBeenCalled()
    })
  })
})
