// @vitest-environment node

/**
 * Auth Actions - 新機能テスト
 *
 * メール正規化・verifyPasswordResetToken の新 ActionResult 形式・
 * resendVerificationEmail の Zod-first・verify2FAToken の Zod 前 return をカバー。
 */

import { vi } from 'vitest'

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  passwordResetToken: {
    findFirst: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  emailVerificationToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn().mockImplementation((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg as Promise<unknown>[]) : Promise.resolve(arg)
  ),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockBcrypt = {
  hash: vi.fn().mockResolvedValue('hashed-password'),
  compare: vi.fn().mockResolvedValue(true),
}
vi.mock('bcryptjs', () => ({ default: mockBcrypt, ...mockBcrypt }))

const mockCrypto = {
  randomBytes: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue('random-token-hex-string-long-enough'),
  }),
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({
      digest: vi.fn().mockReturnValue('hashed-token-hex'),
    }),
  }),
}
vi.mock('crypto', () => ({ default: mockCrypto, ...mockCrypto }))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

const mockSendPasswordResetEmail = vi.fn().mockResolvedValue({ success: true })
const mockSendVerificationEmail = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  sendVerificationEmail: mockSendVerificationEmail,
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/security-logger', () => ({
  logLoginFailure: vi.fn(),
  logLoginLockout: vi.fn(),
  logRegisterSuccess: vi.fn(),
  logPasswordResetRequest: vi.fn(),
  logPasswordResetSuccess: vi.fn(),
}))

vi.mock('@/lib/login-tracker', () => ({
  checkLoginAttempt: vi.fn().mockResolvedValue({ allowed: true, message: '', remainingAttempts: 5 }),
  recordFailedLogin: vi.fn().mockResolvedValue({ allowed: true, message: '', remainingAttempts: 4 }),
  resetLoginAttempts: vi.fn().mockResolvedValue(undefined),
  getLoginKey: vi.fn().mockReturnValue('login-key'),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeInput: vi.fn((input: string) => input),
}))

const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  RATE_LIMITS: {},
}))

vi.mock('@/lib/services/blacklist-check', () => ({
  isEmailBlacklisted: vi.fn().mockResolvedValue(false),
  isDeviceBlacklisted: vi.fn().mockResolvedValue(false),
}))

vi.mock('@/lib/validations/password', () => ({
  validatePassword: vi.fn(() => ({ valid: true })),
}))

vi.mock('@/lib/services/login-throttle', () => ({
  checkLoginThrottleForRequest: vi.fn().mockResolvedValue({ allowed: true }),
  recordLoginFailureForRequest: vi.fn(),
}))

describe('Auth - email normalization & new ActionResult shapes', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockRateLimit.mockResolvedValue({ success: true })
  })

  // ============================================================
  // verifyPasswordResetToken - 新 ActionResult 形式
  // ============================================================
  describe('verifyPasswordResetToken ActionResult', () => {
    it('不正 email は Zod バリデーション失敗 → { success:true, data:{valid:false} } を返す（レート制限未消費）', async () => {
      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('not-an-email', 'valid-token-long-enough')

      expect(result).toEqual({ success: true, data: { valid: false } })
      expect(mockRateLimit).not.toHaveBeenCalled()
    })

    it('短すぎる token は Zod バリデーション失敗 → valid:false を返す（レート制限未消費）', async () => {
      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'short')

      expect(result).toEqual({ success: true, data: { valid: false } })
      expect(mockRateLimit).not.toHaveBeenCalled()
    })

    it('レート超過時は { success:false, error: ERR_RESET_TOO_MANY } を返す', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const { ERR_RESET_TOO_MANY } = await import('@/lib/constants/errors/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'valid-token-long-enough')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(ERR_RESET_TOO_MANY)
    })

    it('有効なトークン照合成功 → { success:true, data:{valid:true} }', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        email: 'test@example.com',
        token: 'hashed-token-hex',
        expires: new Date(Date.now() + 3600000),
      })

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'valid-token-long-enough')

      expect(result).toEqual({ success: true, data: { valid: true } })
    })

    it('照合失敗（token not found） → { success:true, data:{valid:false} }', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      const result = await verifyPasswordResetToken('test@example.com', 'valid-token-long-enough')

      expect(result).toEqual({ success: true, data: { valid: false } })
    })

    it('大文字 email が lowercase に正規化されて DB lookup される', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')
      await verifyPasswordResetToken('TEST@EXAMPLE.COM', 'valid-token-long-enough')

      expect(mockPrisma.passwordResetToken.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ email: 'test@example.com' }),
        })
      )
    })
  })

  // ============================================================
  // resendVerificationEmail - Zod before rate limit
  // ============================================================
  describe('resendVerificationEmail Zod-first', () => {
    it('不正 email は Zod 検証失敗 → actionSuccess()（列挙対策） かつレート制限未消費', async () => {
      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('not-an-email')

      expect(result).toEqual({ success: true })
      expect(mockRateLimit).not.toHaveBeenCalled()
    })

    it('大文字 email が lowercase で DB lookup される', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      await resendVerificationEmail('USER@EXAMPLE.COM')

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { email: 'user@example.com' },
        })
      )
    })
  })

  // ============================================================
  // registerUser - email normalization
  // ============================================================
  describe('registerUser email normalization', () => {
    it('大文字の email が lowercase で保存される', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      mockPrisma.user.create.mockResolvedValueOnce({ id: 'user-id-1', email: 'user@example.com' })
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailVerificationToken.create.mockResolvedValueOnce({})

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'USER@EXAMPLE.COM',
        password: 'Password123',
        nickname: 'テストユーザー',
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ email: 'user@example.com' }),
        })
      )
    })

    it('空白のみの email は無効と判定され createが呼ばれない', async () => {
      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: '   ',
        password: 'Password123',
        nickname: 'テストユーザー',
      })

      expect(result.success).toBe(false)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // requestPasswordReset - email normalization
  // ============================================================
  describe('requestPasswordReset email normalization', () => {
    it('大文字 email が lowercase に正規化されて既存トークン削除が呼ばれる', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@example.com',
      })
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({})
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce({})

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      await requestPasswordReset('USER@EXAMPLE.COM')

      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      })
    })
  })
})
