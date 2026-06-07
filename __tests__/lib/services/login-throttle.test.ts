// @vitest-environment node
/**
 * lib/services/login-throttle のテスト。
 *
 * 旧 `lib/actions/auth` の checkLoginAllowed / recordLoginFailure / clearLoginAttempts が
 * 担っていた「IP 解決 + login-tracker 委譲 + セキュリティログ」のロジックを
 * server-only サービスへ移設したもの。挙動の同等性をここで担保する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockCheckLoginAttempt = vi.fn()
const mockRecordFailedLogin = vi.fn()
const mockResetLoginAttempts = vi.fn()
vi.mock('@/lib/login-tracker', () => ({
  checkLoginAttempt: (...args: unknown[]) => mockCheckLoginAttempt(...args),
  recordFailedLogin: (...args: unknown[]) => mockRecordFailedLogin(...args),
  resetLoginAttempts: (...args: unknown[]) => mockResetLoginAttempts(...args),
  getLoginKey: (ip: string, email: string) => `${ip}:${email.toLowerCase()}`,
}))

const mockGetClientIp = vi.fn().mockResolvedValue('203.0.113.7')
vi.mock('@/lib/utils/request-ip', () => ({
  getClientIp: () => mockGetClientIp(),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeInput: (input: string) => input,
}))

const mockLogLoginFailure = vi.fn()
const mockLogLoginLockout = vi.fn()
vi.mock('@/lib/security-logger', () => ({
  logLoginFailure: (...args: unknown[]) => mockLogLoginFailure(...args),
  logLoginLockout: (...args: unknown[]) => mockLogLoginLockout(...args),
}))

describe('login-throttle service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetClientIp.mockResolvedValue('203.0.113.7')
  })

  describe('checkLoginThrottleForRequest', () => {
    it('tracker の状態をそのまま伝搬する（許可時は message なし）', async () => {
      mockCheckLoginAttempt.mockResolvedValue({ allowed: true, message: undefined, remainingAttempts: 5 })
      const { checkLoginThrottleForRequest } = await import('@/lib/services/login-throttle')

      const result = await checkLoginThrottleForRequest('User@Example.com')

      expect(result).toEqual({ allowed: true, message: undefined, remainingAttempts: 5 })
      // IP + 小文字 email でキーが組まれる
      expect(mockCheckLoginAttempt).toHaveBeenCalledWith('203.0.113.7:user@example.com')
    })

    it('ロック時は message を伝搬する', async () => {
      mockCheckLoginAttempt.mockResolvedValue({
        allowed: false,
        message: 'ログイン試行回数の上限に達しました。30分後に再試行してください。',
        remainingAttempts: 0,
      })
      const { checkLoginThrottleForRequest } = await import('@/lib/services/login-throttle')

      const result = await checkLoginThrottleForRequest('user@example.com')

      expect(result.allowed).toBe(false)
      expect(result.message).toContain('上限に達しました')
    })
  })

  describe('recordLoginFailureForRequest', () => {
    it('allowed=true のとき LOGIN_FAILURE のみ記録する', async () => {
      mockRecordFailedLogin.mockResolvedValue({ allowed: true, message: undefined, remainingAttempts: 4 })
      const { recordLoginFailureForRequest } = await import('@/lib/services/login-throttle')

      const result = await recordLoginFailureForRequest('user@example.com')

      expect(result).toEqual({ allowed: true, message: undefined, remainingAttempts: 4 })
      expect(mockLogLoginFailure).toHaveBeenCalledWith('user@example.com', '203.0.113.7', 'invalid_credentials')
      expect(mockLogLoginLockout).not.toHaveBeenCalled()
    })

    it('allowed=false（ロック到達）のとき LOGIN_LOCKOUT も記録する', async () => {
      mockRecordFailedLogin.mockResolvedValue({
        allowed: false,
        message: 'ログイン試行回数の上限に達しました。30分後に再試行してください。',
        remainingAttempts: 0,
      })
      const { recordLoginFailureForRequest } = await import('@/lib/services/login-throttle')

      const result = await recordLoginFailureForRequest('user@example.com')

      expect(result.allowed).toBe(false)
      expect(mockLogLoginFailure).toHaveBeenCalledTimes(1)
      expect(mockLogLoginLockout).toHaveBeenCalledWith('user@example.com', '203.0.113.7')
    })
  })

  describe('resetLoginThrottleForRequest', () => {
    it('IP + email キーで resetLoginAttempts を呼ぶ', async () => {
      mockResetLoginAttempts.mockResolvedValue(undefined)
      const { resetLoginThrottleForRequest } = await import('@/lib/services/login-throttle')

      await resetLoginThrottleForRequest('User@Example.com')

      expect(mockResetLoginAttempts).toHaveBeenCalledWith('203.0.113.7:user@example.com')
    })
  })
})
