// @vitest-environment node

import { vi } from 'vitest'
import { expectError } from '../../helpers/action-result'

// ============================================================================
// Mock setup
// ============================================================================

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
  rateLimit: mockRateLimit,
  RATE_LIMITS: {},
}))

const mockIsEmailBlacklisted = vi.fn().mockResolvedValue(false)
const mockIsDeviceBlacklisted = vi.fn().mockResolvedValue(false)
vi.mock('@/lib/services/blacklist-check', () => ({
  isEmailBlacklisted: mockIsEmailBlacklisted,
  isDeviceBlacklisted: mockIsDeviceBlacklisted,
}))

vi.mock('@/lib/security-logger', () => ({
  logLoginFailure: vi.fn(),
  logLoginLockout: vi.fn(),
  logRegisterSuccess: vi.fn(),
  logPasswordResetRequest: vi.fn(),
  logPasswordResetSuccess: vi.fn(),
}))

vi.mock('@/lib/validations/password', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/validations/password')>()
  return { ...actual }
})

const mockIsReservedNickname = vi.fn(() => false)
vi.mock('@/lib/constants/reserved', () => ({
  isReservedNickname: mockIsReservedNickname,
}))

const mockSignIn = vi.fn()
vi.mock('@/lib/auth', () => ({
  signIn: mockSignIn,
  auth: vi.fn().mockResolvedValue(null),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({ get: vi.fn(), set: vi.fn(), del: vi.fn() }),
}))

vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20, maxVideos: 1 }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

// ============================================================================
// Tests
// ============================================================================

describe('Auth Actions - Quality Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsReservedNickname.mockReturnValue(false)
    mockIsEmailBlacklisted.mockResolvedValue(false)
    mockIsDeviceBlacklisted.mockResolvedValue(false)
    mockRateLimit.mockResolvedValue({ success: true })
  })

  // ============================================================
  // registerUser - blacklist and validation branches
  // ============================================================
  describe('registerUser', () => {
    it('rejects blacklisted email addresses', async () => {
      mockIsEmailBlacklisted.mockResolvedValueOnce(true)

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'banned@evil.com',
        password: 'Password123',
        nickname: 'BannedUser',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('このメールアドレスは利用できません')
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('rejects blacklisted device fingerprint', async () => {
      mockIsDeviceBlacklisted.mockResolvedValueOnce(true)

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'user@example.com',
        password: 'Password123',
        nickname: 'UserWithBadDevice',
        fingerprint: 'bad-device-fp',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('このデバイスからの登録は許可されていません')
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('skips device blacklist check when no fingerprint provided', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      mockPrisma.user.create.mockResolvedValueOnce({ id: 'user-new' })
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailVerificationToken.create.mockResolvedValueOnce({})
      mockSendVerificationEmail.mockResolvedValueOnce({ success: true })

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'no-fp@example.com',
        password: 'Password123',
        nickname: 'NoFingerprint',
      })

      expect(result.success).toBe(true)
      expect(mockIsDeviceBlacklisted).not.toHaveBeenCalled()
    })

    it('rejects password that is too short', async () => {
      const {
        ERR_PASSWORD_MIN_LENGTH,
      } = await import('@/lib/constants/errors/auth')

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'user@example.com',
        password: 'Abc1',
        nickname: 'WeakPwUser',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(ERR_PASSWORD_MIN_LENGTH)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('rejects password with no letters', async () => {
      const {
        ERR_PASSWORD_REQUIRE_LETTER,
      } = await import('@/lib/constants/errors/auth')

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'user@example.com',
        password: '12345678',
        nickname: 'WeakPwUser',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(ERR_PASSWORD_REQUIRE_LETTER)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('rejects password with no numbers', async () => {
      const {
        ERR_PASSWORD_REQUIRE_NUMBER,
      } = await import('@/lib/constants/errors/auth')

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'user@example.com',
        password: 'abcdefgh',
        nickname: 'WeakPwUser',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(ERR_PASSWORD_REQUIRE_NUMBER)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('rejects reserved nicknames', async () => {
      mockIsReservedNickname.mockReturnValueOnce(true)

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'user@example.com',
        password: 'Password123',
        nickname: 'admin',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(
        'このユーザー名は利用できません。別のユーザー名をご利用ください。'
      )
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('succeeds with a valid fingerprint that is not blacklisted', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      mockPrisma.user.create.mockResolvedValueOnce({ id: 'user-fp' })
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailVerificationToken.create.mockResolvedValueOnce({})
      mockSendVerificationEmail.mockResolvedValueOnce({ success: true })

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'fp-user@example.com',
        password: 'Password123',
        nickname: 'FpUser',
        fingerprint: 'clean-device-fp',
      })

      expect(result.success).toBe(true)
      expect(mockIsDeviceBlacklisted).toHaveBeenCalledWith('clean-device-fp')
    })
  })

  // ============================================================
  // resendVerificationEmail - rate limit and email failure
  // ============================================================
  describe('resendVerificationEmail', () => {
    it('returns error when rate limited', async () => {
      mockRateLimit.mockResolvedValueOnce({ success: false })

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('user@example.com')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(
        '再送の要求が多すぎます。1時間後に再度お試しください。'
      )
    })

    it('returns error when email send fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        emailVerified: null,
      })
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailVerificationToken.create.mockResolvedValueOnce({})
      mockSendVerificationEmail.mockResolvedValueOnce({ success: false, error: 'SMTP failure' })

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('user@example.com')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(
        'メールの送信に失敗しました。しばらく経ってからお試しください。'
      )
    })
  })

  // getEmailVerificationStatus は撤去済み（verifyCredentials に統合）。

  // ============================================================
  // signInAsGuestFormAction - success path redirects to /feed
  // ============================================================
  describe('signInAsGuestFormAction', () => {
    it('redirects to /feed on successful guest login', async () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      mockSignIn.mockResolvedValueOnce({ ok: true })

      const { signInAsGuestFormAction } = await import('@/lib/actions/auth')

      // signInAsGuest calls redirect('/feed') which throws NEXT_REDIRECT
      // signInAsGuestFormAction catches the signInAsGuest result:
      // if signInAsGuest throws due to redirect, signInAsGuestFormAction
      // should propagate the redirect exception
      await expect(signInAsGuestFormAction()).rejects.toThrow('NEXT_REDIRECT')
    })
  })

  // ============================================================
  // verifyCredentials - non-Error exception
  // ============================================================
  describe('verifyCredentials', () => {
    it('handles non-Error throw from DB gracefully', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce('string-error')

      const { verifyCredentials } = await import('@/lib/actions/auth')
      const result = await verifyCredentials('user@example.com', 'Password123')

      expectError(result)
      expect(result.error).toBe('ログイン中にエラーが発生しました')
    })
  })

  // ============================================================
  // requestPasswordReset - email send failure path
  // ============================================================
  describe('requestPasswordReset', () => {
    it('returns error when email send fails', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@example.com',
      })
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce({
        id: 'prt-1',
        email: 'user@example.com',
        token: 'hashed-token-hex',
        expires: new Date(Date.now() + 3600000),
      })
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: false, error: 'Mail server down' })

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('user@example.com')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(
        'メールの送信に失敗しました。しばらく経ってからお試しください。'
      )
    })

    it('returns success even when user not found (enumeration prevention)', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('nobody@example.com')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled()
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // signInAsGuest - development fallback password
  // ============================================================
  describe('signInAsGuest', () => {
    const originalEnv = { ...process.env }

    afterEach(() => {
      process.env = { ...originalEnv }
    })

    it('uses GUEST_PASSWORD env var when set', async () => {
      process.env.GUEST_PASSWORD = 'EnvGuestPass1!'
      mockSignIn.mockResolvedValueOnce({ ok: false })

      const { signInAsGuest } = await import('@/lib/actions/auth')
      await signInAsGuest()

      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: expect.any(String),
        password: 'EnvGuestPass1!',
        redirect: false,
      })
    })
  })
})
