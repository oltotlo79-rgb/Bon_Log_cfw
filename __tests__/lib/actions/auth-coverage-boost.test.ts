// @vitest-environment node

import { vi } from 'vitest'

// Prismaモック
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
    toString: vi.fn().mockReturnValue('random-token-123'),
  }),
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({
      digest: vi.fn().mockReturnValue('hashed-token-123'),
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
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
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

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
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

describe('Auth Actions - Coverage Boost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // verifyCredentials
  // ============================================================
  describe('verifyCredentials', () => {
    it('ユーザーが存在しない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { verifyCredentials } = await import('@/lib/actions/auth')
      const result = await verifyCredentials('notfound@example.com', 'Password123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('メールアドレスまたはパスワードが間違っています')
    })

    it('パスワードが設定されていないユーザーはエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        password: null,
        emailVerified: new Date(),
        isSuspended: false,
      })

      const { verifyCredentials } = await import('@/lib/actions/auth')
      const result = await verifyCredentials('user@example.com', 'Password123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('メールアドレスまたはパスワードが間違っています')
    })

    it('停止されたアカウントはエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        password: 'hashed-password',
        emailVerified: new Date(),
        isSuspended: true,
      })

      const { verifyCredentials } = await import('@/lib/actions/auth')
      const result = await verifyCredentials('suspended@example.com', 'Password123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('アカウントが停止されています')
    })

    it('メール未確認のユーザーは ERR_EMAIL_NOT_VERIFIED を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        password: 'hashed-password',
        emailVerified: null,
        isSuspended: false,
      })

      const { verifyCredentials } = await import('@/lib/actions/auth')
      const { ERR_EMAIL_NOT_VERIFIED } = await import('@/lib/constants/errors')
      const result = await verifyCredentials('unverified@example.com', 'Password123')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toBe(ERR_EMAIL_NOT_VERIFIED)
    })

    it('パスワードが一致しない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        password: 'hashed-password',
        emailVerified: new Date(),
        isSuspended: false,
      })
      mockBcrypt.compare.mockResolvedValueOnce(false)

      const { verifyCredentials } = await import('@/lib/actions/auth')
      const result = await verifyCredentials('user@example.com', 'WrongPassword123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('メールアドレスまたはパスワードが間違っています')
    })

    it('パスワードが正しい場合は成功を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-1',
        password: 'hashed-password',
        emailVerified: new Date(),
        isSuspended: false,
      })
      mockBcrypt.compare.mockResolvedValueOnce(true)

      const { verifyCredentials } = await import('@/lib/actions/auth')
      const result = await verifyCredentials('user@example.com', 'Password123')

      expect(result.success).toBe(true)
    })

    it('DB例外時はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('DB error'))

      const { verifyCredentials } = await import('@/lib/actions/auth')
      const result = await verifyCredentials('user@example.com', 'Password123')

      expect(result.success).toBe(false)
      expect(result.error).toBe('ログイン中にエラーが発生しました')
    })
  })

  // ============================================================
  // signInAsGuest
  // ============================================================
  describe('signInAsGuest', () => {
    const originalEnv = process.env

    afterEach(() => {
      process.env = { ...originalEnv }
    })

    it('GUEST_PASSWORDが未設定の場合はエラーを返す', async () => {
      delete process.env.GUEST_PASSWORD
      process.env.NODE_ENV = 'production'

      const { signInAsGuest } = await import('@/lib/actions/auth')
      const result = await signInAsGuest()

      expect(result).toMatchObject({ success: false })
    })

    it('signInが失敗した場合はエラーを返す', async () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      mockSignIn.mockResolvedValueOnce({ ok: false })

      const { signInAsGuest } = await import('@/lib/actions/auth')
      const result = await signInAsGuest()

      expect(result.success).toBe(false)
    })

    it('signInが例外をスローした場合はエラーを返す', async () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      mockSignIn.mockRejectedValueOnce(new Error('Auth error'))

      const { signInAsGuest } = await import('@/lib/actions/auth')
      const result = await signInAsGuest()

      expect(result.success).toBe(false)
    })

    it('signInが成功した場合は redirect を呼ぶ', async () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      mockSignIn.mockResolvedValueOnce({ ok: true })

      const { redirect } = await import('next/navigation')
      const { signInAsGuest } = await import('@/lib/actions/auth')

      // redirect throws in our mock, which gets caught by the try/catch in signInAsGuest
      // So the function returns actionError instead
      await signInAsGuest()
      // redirect was called with '/feed'
      expect(redirect).toHaveBeenCalledWith('/feed')
    })
  })

  // ============================================================
  // signInAsGuestFormAction
  // ============================================================
  describe('signInAsGuestFormAction', () => {
    it('ゲストログイン失敗時に /?guest_error=1 にリダイレクトする', async () => {
      process.env.GUEST_PASSWORD = 'GuestPass1!'
      mockSignIn.mockResolvedValueOnce({ ok: false })

      const { signInAsGuestFormAction } = await import('@/lib/actions/auth')

      await expect(signInAsGuestFormAction()).rejects.toThrow('NEXT_REDIRECT:/?guest_error=1')
    })
  })

  // ============================================================
  // registerUser - verification email failure
  // ============================================================
  describe('registerUser - email send failure', () => {
    it('確認メール送信に失敗した場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      mockPrisma.user.create.mockResolvedValueOnce({ id: 'new-user-id' })
      mockPrisma.emailVerificationToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailVerificationToken.create.mockResolvedValueOnce({})
      mockSendVerificationEmail.mockResolvedValueOnce({ success: false, error: 'SMTP error' })

      const { registerUser } = await import('@/lib/actions/auth')
      const result = await registerUser({
        email: 'new@example.com',
        password: 'Password123',
        nickname: 'NewUser',
      })

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toContain('確認メールの送信に失敗')
    })
  })

  // ============================================================
  // requestPasswordReset - rate limit
  // ============================================================
  describe('requestPasswordReset - rate limit', () => {
    it('レート制限に達した場合はエラーを返す', async () => {
      const { rateLimit } = await import('@/lib/rate-limit')
      ;(rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false })

      const { requestPasswordReset } = await import('@/lib/actions/auth')
      const result = await requestPasswordReset('test@example.com')

      expect(result.success).toBe(false)
      expect('error' in result && result.error).toContain('パスワードリセットの要求が多すぎます')
    })
  })
})
