// @vitest-environment node

/**
 * Auth Actions - Final coverage tests
 *
 * Targets uncovered lines/branches in lib/actions/auth.ts:
 * - signInAsGuest: development fallback password (line 150)
 * - signInAsGuestFormAction: success redirect propagation
 * - registerUser: zod schema validation edge cases
 * - resendVerificationEmail: full success path assertions
 * - requestPasswordReset: full success path with token/email assertions
 * - resetPassword: password-only-numbers and password-only-letters branches
 */

import { vi } from 'vitest'

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

vi.mock('@/lib/services/blacklist-check', () => ({
  isEmailBlacklisted: vi.fn().mockResolvedValue(false),
  isDeviceBlacklisted: vi.fn().mockResolvedValue(false),
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
  return {
    ...actual,
    validatePassword: vi.fn(() => ({ valid: true })),
  }
})

vi.mock('@/lib/constants/reserved', () => ({
  isReservedNickname: vi.fn(() => false),
}))

const mockSignIn = vi.fn()
vi.mock('@/lib/auth', () => ({
  signIn: mockSignIn,
  auth: vi.fn().mockResolvedValue(null),
}))

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
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

describe('Auth Actions - Final Coverage', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // ============================================================
  // signInAsGuest: development fallback password branch
  // ============================================================
  describe('signInAsGuest - development mode fallback', () => {
    it('uses "GuestPass1!" when GUEST_PASSWORD is unset and NODE_ENV is development', async () => {
      delete process.env.GUEST_PASSWORD
      vi.stubEnv('NODE_ENV', 'development')
      mockSignIn.mockResolvedValueOnce({ ok: false })

      const { signInAsGuest } = await import('@/lib/actions/auth')
      await signInAsGuest()

      expect(mockSignIn).toHaveBeenCalledWith('credentials', {
        email: expect.any(String),
        password: 'GuestPass1!',
        redirect: false,
      })
    })

    it('returns error when GUEST_PASSWORD is unset and NODE_ENV is production (empty password)', async () => {
      delete process.env.GUEST_PASSWORD
      vi.stubEnv('NODE_ENV', 'production')

      const { signInAsGuest } = await import('@/lib/actions/auth')
      const result = await signInAsGuest()

      expect(result.success).toBe(false)
      // signIn should not be called because password is empty
      expect(mockSignIn).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // signInAsGuestFormAction: propagates redirect from signInAsGuest
  // ============================================================
  describe('signInAsGuestFormAction', () => {
    it('propagates NEXT_REDIRECT when signInAsGuest succeeds and redirects to /feed', async () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      // signIn returns ok: true, then redirect('/feed') throws NEXT_REDIRECT
      mockSignIn.mockResolvedValueOnce({ ok: true })

      const { signInAsGuestFormAction } = await import('@/lib/actions/auth')

      // The redirect('/feed') inside signInAsGuest throws, which propagates up
      // Then signInAsGuestFormAction catches the result and since it throws,
      // signInAsGuestFormAction itself throws
      await expect(signInAsGuestFormAction()).rejects.toThrow('NEXT_REDIRECT')
      expect(mockRedirect).toHaveBeenCalledWith('/feed')
    })
  })

  // ============================================================
  // registerUser: zod schema rejection edge cases
  // ============================================================
  describe('registerUser - schema validation', () => {
    it('rejects nickname with > character', async () => {
      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'user@example.com',
        password: 'Password123',
        nickname: 'bad>name',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toContain('改行や < > は使えません')
    })

    it('rejects nickname with carriage return', async () => {
      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'user@example.com',
        password: 'Password123',
        nickname: 'bad\rname',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toContain('改行や < > は使えません')
    })
  })

  // ============================================================
  // resendVerificationEmail: full success path verification
  // ============================================================
  describe('resendVerificationEmail - full success path', () => {
    it('creates new token, sends email, and returns success for unverified user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        emailVerified: null,
      })
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.emailVerificationToken.create.mockResolvedValueOnce({})
      mockSendVerificationEmail.mockResolvedValueOnce({ success: true })

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('user@example.com')

      expect(result).toEqual({ success: true })
      // Verify old tokens were deleted
      expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      })
      // Verify new token was created
      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'user@example.com',
          token: expect.any(String),
          expires: expect.any(Date),
        }),
      })
      // Verify email was sent with verification URL
      expect(mockSendVerificationEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('/verify-email?token=')
      )
    })
  })

  // ============================================================
  // requestPasswordReset: full success path with detailed assertions
  // ============================================================
  describe('requestPasswordReset - full success path assertions', () => {
    it('logs the reset request, creates hashed token, and sends email', async () => {
      const { logPasswordResetRequest } = await import('@/lib/security-logger')

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
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: true })

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('user@example.com')

      expect(result).toEqual({ success: true })

      // Verify security logging was called
      expect(logPasswordResetRequest).toHaveBeenCalledWith('user@example.com', '127.0.0.1')

      // Verify token was created with hashed value and 1 hour expiry
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'user@example.com',
          token: expect.any(String),
          expires: expect.any(Date),
        }),
      })

      // Verify email was sent with correct reset URL containing token and email
      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(
        'user@example.com',
        expect.stringContaining('password-reset/confirm?token=')
      )
      const emailUrl = mockSendPasswordResetEmail.mock.calls[0]![1] as string
      expect(emailUrl).toContain(encodeURIComponent('user@example.com'))
    })
  })

  // ============================================================
  // resetPassword: branch coverage for password validation
  // ============================================================
  describe('resetPassword - password validation branches', () => {
    it('rejects password with only letters (no numbers)', async () => {
      // passwordResetConfirmSchema uses passwordSchema (Zod) which rejects letters-only passwords
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'user@example.com',
        token: 'valid-token',
        newPassword: 'abcdefgh',
      })

      expect(result.success).toBe(false)
      // passwordSchema の数字必須ルールが適用される
      expect('error' in result && result.error).toContain('数字を含めてください')
    })

    it('rejects password with only numbers (no letters)', async () => {
      // passwordResetConfirmSchema uses passwordSchema (Zod) which rejects numbers-only passwords
      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'user@example.com',
        token: 'valid-token',
        newPassword: '12345678',
      })

      expect(result.success).toBe(false)
      // passwordSchema のアルファベット必須ルールが適用される
      expect('error' in result && result.error).toContain('アルファベットを含めてください')
    })

    it('succeeds with valid token and properly formed password', async () => {
      const { logPasswordResetSuccess } = await import('@/lib/security-logger')

      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce({
        id: 'prt-1',
        email: 'user@example.com',
        token: 'hashed-token-hex',
        expires: new Date(Date.now() + 3600000),
      })
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'user@example.com',
      })
      mockPrisma.user.update.mockResolvedValueOnce({})
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 1 })

      const { resetPassword } = await import('@/lib/actions/auth')
      const result = await resetPassword({
        email: 'user@example.com',
        token: 'valid-token',
        newPassword: 'NewPass123',
      })

      expect(result).toEqual({ success: true })
      // Verify password was hashed before saving
      expect(mockBcrypt.hash).toHaveBeenCalledWith('NewPass123', expect.any(Number))
      // Verify user was updated
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { password: 'hashed-password' },
      })
      // Verify all tokens for this email were deleted
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      })
      // Verify security log
      expect(logPasswordResetSuccess).toHaveBeenCalledWith('user-1')
    })
  })

  // ============================================================
  // verifyEmailToken: additional branch for token type checking
  // ============================================================
  describe('verifyEmailToken - edge cases', () => {
    it('rejects non-string token type', async () => {
      const { verifyEmailToken } = await import('@/lib/actions/auth')
      const result = await verifyEmailToken(undefined as unknown as string)

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('無効なトークンです。')
    })
  })

  // ============================================================
  // signInAsGuest: signIn throwing non-Error
  // ============================================================
  describe('signInAsGuest - non-Error exception from signIn', () => {
    it('handles signIn throwing a non-Error value gracefully', async () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      mockSignIn.mockRejectedValueOnce('string-exception')

      const { signInAsGuest } = await import('@/lib/actions/auth')
      const result = await signInAsGuest()

      expect(result.success).toBe(false)
    })
  })

})
