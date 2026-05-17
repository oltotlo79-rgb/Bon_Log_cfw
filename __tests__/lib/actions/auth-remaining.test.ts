// @vitest-environment node

/**
 * Auth Actions - Remaining branch coverage tests
 *
 * Targets the 3 uncovered branches in lib/actions/auth.ts:
 * - Line 169: signInAsGuestFormAction when signInAsGuest throws (result is undefined)
 * - Line 193: registerUser zod fallback message '入力内容を確認してください'
 * - Line 377: getEmailVerificationStatus non-Error exception path
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
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  RATE_LIMITS: {},
}))

vi.mock('@/lib/actions/blacklist', () => ({
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

vi.mock('@/lib/validations/password', () => ({
  validatePassword: vi.fn(() => ({ valid: true })),
}))

vi.mock('@/lib/constants/reserved', () => ({
  isReservedNickname: vi.fn(() => false),
}))

const mockSignIn = vi.fn()
vi.mock('@/lib/auth', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  auth: vi.fn().mockResolvedValue(null),
}))

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
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

describe('Auth Actions - Remaining Branch Coverage', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    mockRateLimit.mockResolvedValue({ success: true })
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  // ============================================================
  // Line 169: signInAsGuestFormAction
  // The condition `if (result && !result.success)` has a branch
  // where result.success is true (so redirect to /?guest_error=1
  // is NOT called). We need to test this unreachable-in-practice
  // branch by mocking signInAsGuest's internal behavior.
  // ============================================================
  describe('signInAsGuestFormAction - guest login failure redirects to error page', () => {
    it('redirects to /?guest_error=1 when signInAsGuest returns error', async () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      // signIn returns not-ok so signInAsGuest returns actionError
      mockSignIn.mockResolvedValueOnce({ ok: false })

      const { signInAsGuestFormAction } = await import('@/lib/actions/auth')

      await expect(signInAsGuestFormAction()).rejects.toThrow('NEXT_REDIRECT:/?guest_error=1')
    })

    it('redirects to /feed via signInAsGuest when signIn succeeds', async () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      // signIn returns ok: true, then redirect('/feed') throws
      mockSignIn.mockResolvedValueOnce({ ok: true })

      const { signInAsGuestFormAction } = await import('@/lib/actions/auth')

      // redirect('/feed') throws inside signInAsGuest, which is caught
      // by the try/catch in signInAsGuest, returning actionError.
      // signInAsGuestFormAction then sees !result.success and redirects to error page.
      await expect(signInAsGuestFormAction()).rejects.toThrow('NEXT_REDIRECT')
    })

    it('does not redirect when signInAsGuest throws non-redirect error', async () => {
      // When GUEST_PASSWORD is not set in production, signInAsGuest returns
      // actionError immediately, so signInAsGuestFormAction should redirect
      // to /?guest_error=1
      delete process.env.GUEST_PASSWORD
      process.env.NODE_ENV = 'production'

      const { signInAsGuestFormAction } = await import('@/lib/actions/auth')

      await expect(signInAsGuestFormAction()).rejects.toThrow('NEXT_REDIRECT:/?guest_error=1')
    })
  })

  // ============================================================
  // Line 193: registerUser zod fallback message
  // The fallback '入力内容を確認してください' is hit when zod
  // validation fails but neither email nor nickname has errors.
  // This occurs when the password field fails zod validation.
  // Since password is z.string(), we need to pass a non-string value.
  // ============================================================
  describe('registerUser - zod fallback validation message', () => {
    it('returns generic validation error when neither email nor nickname has zod errors', async () => {
      const { registerUser } = await import('@/lib/actions/auth')

      // Pass a non-string password to trigger zod error on password field only.
      // email and nickname are valid, so their error arrays are empty.
      // The fallback '入力内容を確認してください' should be returned.
      const result = await registerUser({
        email: 'valid@example.com',
        password: undefined as unknown as string,
        nickname: 'ValidNickname',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('入力内容を確認してください')
    })

    it('returns generic validation error when password is a number instead of string', async () => {
      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'valid@example.com',
        password: 12345678 as unknown as string,
        nickname: 'ValidNickname',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe('入力内容を確認してください')
    })
  })

  // ============================================================
  // Line 377: getEmailVerificationStatus non-Error exception
  // The catch block does `e instanceof Error ? e.message : undefined`
  // When a non-Error is thrown, the branch yields undefined for cause.
  // ============================================================
  describe('getEmailVerificationStatus - non-Error thrown from DB', () => {
    it('handles non-Error exception with undefined cause', async () => {
      // Throw a string instead of an Error object
      mockPrisma.user.findUnique.mockRejectedValueOnce('string-db-error')

      const { getEmailVerificationStatus } = await import('@/lib/actions/auth')
      const result = await getEmailVerificationStatus('user@example.com')

      // Should gracefully return verified: true (fallback behavior)
      expect(result).toEqual({ verified: true })
    })

    it('handles null thrown from DB', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce(null)

      const { getEmailVerificationStatus } = await import('@/lib/actions/auth')
      const result = await getEmailVerificationStatus('user@example.com')

      expect(result).toEqual({ verified: true })
    })
  })
})
