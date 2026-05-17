// @vitest-environment node

import { vi } from 'vitest'
// Prismaモック（auth.extended固有）
const authExtMockPrisma = {
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

vi.mock('@/lib/db', () => ({
  prisma: authExtMockPrisma,
}))

// bcryptjsモック（auth.extended固有）
const authExtMockBcrypt = {
  hash: vi.fn(),
  compare: vi.fn(),
}

vi.mock('bcryptjs', () => ({ default: authExtMockBcrypt, ...authExtMockBcrypt }))

// headersモック
vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({
    get: vi.fn((name: string) => {
      if (name === 'x-forwarded-for') return '192.168.1.1'
      return null
    }),
  })),
}))

// メール送信モック
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: vi.fn(),
  sendVerificationEmail: vi.fn().mockResolvedValue({ success: true }),
}))

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// セキュリティロガーモック
vi.mock('@/lib/security-logger', () => ({
  logLoginFailure: vi.fn(),
  logLoginLockout: vi.fn(),
  logRegisterSuccess: vi.fn(),
  logPasswordResetRequest: vi.fn(),
  logPasswordResetSuccess: vi.fn(),
}))

// ログイントラッカーモック
vi.mock('@/lib/login-tracker', () => ({
  checkLoginAttempt: vi.fn(() => ({ allowed: true, remainingAttempts: 5 })),
  recordFailedLogin: vi.fn(() => ({ allowed: true, remainingAttempts: 4 })),
  resetLoginAttempts: vi.fn(),
  getLoginKey: vi.fn((ip, email) => `${ip}:${email}`),
}))

// パスワードバリデーションモック
vi.mock('@/lib/validations/password', () => ({
  validatePassword: vi.fn(() => ({ valid: true })),
}))

// サニタイズモック
vi.mock('@/lib/sanitize', () => ({
  sanitizeInput: vi.fn((input) => input),
}))

// レート制限モック
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(() => ({ success: true })),
  RATE_LIMITS: {},
}))

// ブラックリストモック
vi.mock('@/lib/actions/blacklist', () => ({
  isEmailBlacklisted: vi.fn(() => false),
  isDeviceBlacklisted: vi.fn(() => false),
}))

describe('auth actions extended tests', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  // ============================================================
  // checkLoginAllowed
  // ============================================================

  describe('checkLoginAllowed', async () => {
    it('ログインが許可されている場合', async () => {
      const { checkLoginAllowed } = await import('@/lib/actions/auth')

      const result = await checkLoginAllowed('test@example.com')

      expect(result.allowed).toBe(true)
      expect(result.remainingAttempts).toBe(5)
    })

    it('メールアドレスをサニタイズする', async () => {
      const { sanitizeInput } = await import('@/lib/sanitize')
      const { checkLoginAllowed } = await import('@/lib/actions/auth')

      await checkLoginAllowed('<script>test@example.com</script>')

      expect(sanitizeInput).toHaveBeenCalled()
    })

    it('IPアドレスとメールでキーを生成する', async () => {
      const { getLoginKey } = await import('@/lib/login-tracker')
      const { checkLoginAllowed } = await import('@/lib/actions/auth')

      await checkLoginAllowed('test@example.com')

      expect(getLoginKey).toHaveBeenCalledWith('192.168.1.1', 'test@example.com')
    })
  })

  // ============================================================
  // recordLoginFailure
  // ============================================================

  describe('recordLoginFailure', async () => {
    it('ログイン失敗を記録する', async () => {
      const { recordLoginFailure } = await import('@/lib/actions/auth')

      const result = await recordLoginFailure('test@example.com')

      expect(result.locked).toBe(false)
      expect(result.remainingAttempts).toBe(4)
    })

    it('セキュリティログに記録する', async () => {
      const { logLoginFailure } = await import('@/lib/security-logger')
      const { recordLoginFailure } = await import('@/lib/actions/auth')

      await recordLoginFailure('test@example.com')

      expect(logLoginFailure).toHaveBeenCalledWith(
        'test@example.com',
        '192.168.1.1',
        'invalid_credentials'
      )
    })

    it('ロックアウト時に追加ログを記録する', async () => {
      const { recordFailedLogin } = await import('@/lib/login-tracker')
      const { logLoginLockout } = await import('@/lib/security-logger')
      ;(recordFailedLogin as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        allowed: false,
        remainingAttempts: 0,
        message: 'Account locked',
      })

      const { recordLoginFailure } = await import('@/lib/actions/auth')

      const result = await recordLoginFailure('test@example.com')

      expect(result.locked).toBe(true)
      expect(logLoginLockout).toHaveBeenCalledWith('test@example.com', '192.168.1.1')
    })
  })

  // ============================================================
  // clearLoginAttempts
  // ============================================================

  describe('clearLoginAttempts', async () => {
    it('ログイン試行回数をリセットする', async () => {
      const { resetLoginAttempts } = await import('@/lib/login-tracker')
      const { clearLoginAttempts } = await import('@/lib/actions/auth')

      await clearLoginAttempts('test@example.com')

      expect(resetLoginAttempts).toHaveBeenCalled()
    })

    it('returns void (no value to await on)', async () => {
      const { clearLoginAttempts } = await import('@/lib/actions/auth')
      const result = await clearLoginAttempts('test@example.com')
      // 戻り値の型が void なので undefined であること
      expect(result).toBeUndefined()
    })
  })

  // ============================================================
  // 型契約: LoginAllowedResult / LoginFailureResult
  // ----------------------------------------------------------------
  // 元の login-tracker の戻り値（allowed/message?/remainingAttempts）が
  // checkLoginAllowed/recordLoginFailure を通じて忠実に伝搬し、
  // かつ recordLoginFailure では allowed が反転して `locked` に対応していること
  // ============================================================

  describe('LoginAllowedResult / LoginFailureResult contract', async () => {
    it('checkLoginAllowed: tracker からの message を素通しで渡す（許可時に message 無し）', async () => {
      const { checkLoginAttempt } = await import('@/lib/login-tracker')
      ;(checkLoginAttempt as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        allowed: true,
        remainingAttempts: 3,
      })

      const { checkLoginAllowed } = await import('@/lib/actions/auth')
      const result = await checkLoginAllowed('user@example.com')

      expect(result).toEqual({
        allowed: true,
        message: undefined,
        remainingAttempts: 3,
      })
    })

    it('checkLoginAllowed: ロック時には message が伝搬される', async () => {
      const { checkLoginAttempt } = await import('@/lib/login-tracker')
      ;(checkLoginAttempt as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        allowed: false,
        remainingAttempts: 0,
        message: 'ロック中',
      })

      const { checkLoginAllowed } = await import('@/lib/actions/auth')
      const result = await checkLoginAllowed('user@example.com')

      expect(result).toEqual({
        allowed: false,
        message: 'ロック中',
        remainingAttempts: 0,
      })
    })

    it('recordLoginFailure: allowed=true のとき locked=false を返す', async () => {
      const { recordFailedLogin } = await import('@/lib/login-tracker')
      ;(recordFailedLogin as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        allowed: true,
        remainingAttempts: 3,
      })

      const { recordLoginFailure } = await import('@/lib/actions/auth')
      const result = await recordLoginFailure('user@example.com')

      expect(result).toEqual({
        locked: false,
        message: undefined,
        remainingAttempts: 3,
      })
    })

    it('recordLoginFailure: 直近のロックでは locked=true、message 付き、ロックアウトログが書かれる', async () => {
      const { recordFailedLogin } = await import('@/lib/login-tracker')
      const { logLoginLockout, logLoginFailure } = await import('@/lib/security-logger')
      ;(recordFailedLogin as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        allowed: false,
        remainingAttempts: 0,
        message: 'アカウントがロックされました',
      })

      const { recordLoginFailure } = await import('@/lib/actions/auth')
      const result = await recordLoginFailure('user@example.com')

      expect(result).toEqual({
        locked: true,
        message: 'アカウントがロックされました',
        remainingAttempts: 0,
      })
      // 失敗とロックアウトのログがどちらも書かれること
      expect(logLoginFailure).toHaveBeenCalledTimes(1)
      expect(logLoginLockout).toHaveBeenCalledTimes(1)
    })

    it('recordLoginFailure: allowed=true でもログイン失敗ログだけは必ず書かれる（ロックアウトログは書かれない）', async () => {
      const { recordFailedLogin } = await import('@/lib/login-tracker')
      const { logLoginLockout, logLoginFailure } = await import('@/lib/security-logger')
      ;(recordFailedLogin as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        allowed: true,
        remainingAttempts: 4,
      })

      const { recordLoginFailure } = await import('@/lib/actions/auth')
      await recordLoginFailure('user@example.com')

      expect(logLoginFailure).toHaveBeenCalledTimes(1)
      expect(logLoginLockout).not.toHaveBeenCalled()
    })
  })

  // ============================================================
  // registerUser
  // ============================================================

  describe('registerUser', async () => {
    it('新規ユーザーを登録する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)
      authExtMockPrisma.user.create.mockResolvedValue({ id: 'user-123' })
      authExtMockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 })
      authExtMockPrisma.emailVerificationToken.create.mockResolvedValue({})
      authExtMockBcrypt.hash.mockResolvedValue('hashedPassword')

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'new@example.com',
        password: 'SecurePass123',
        nickname: 'NewUser',
      })

      expect(result.success).toBe(true)
      expect('data' in result && result.data?.userId).toBe('user-123')
    })

    it('メールアドレスが既に登録されている場合はエラー', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({ id: 'existing-user' })

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'existing@example.com',
        password: 'SecurePass123',
        nickname: 'User',
      })

      expect(result.error).toBe('このメールアドレスは既に登録されています')
    })

    it('パスワードが弱い場合はエラー', async () => {
      const { validatePassword } = await import('@/lib/validations/password')
      ;(validatePassword as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        valid: false,
        error: 'パスワードは8文字以上で入力してください',
      })

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'test@example.com',
        password: 'weak',
        nickname: 'User',
      })

      expect(result.error).toBe('パスワードは8文字以上で入力してください')
    })

    it('メールがブラックリストに登録されている場合はエラー', async () => {
      const { isEmailBlacklisted } = await import('@/lib/actions/blacklist')
      ;(isEmailBlacklisted as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'blacklisted@example.com',
        password: 'SecurePass123',
        nickname: 'User',
      })

      expect(result.error).toBe('このメールアドレスは利用できません')
    })

    it('デバイスがブラックリストに登録されている場合はエラー', async () => {
      const { isDeviceBlacklisted } = await import('@/lib/actions/blacklist')
      ;(isDeviceBlacklisted as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)

      const { registerUser } = await import('@/lib/actions/auth')

      const result = await registerUser({
        email: 'test@example.com',
        password: 'SecurePass123',
        nickname: 'User',
        fingerprint: 'blacklisted-fingerprint',
      })

      expect(result.error).toBe('このデバイスからの登録は許可されていません')
    })

    it('パスワードをハッシュ化する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)
      authExtMockPrisma.user.create.mockResolvedValue({ id: 'user-123' })
      authExtMockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 })
      authExtMockPrisma.emailVerificationToken.create.mockResolvedValue({})
      authExtMockBcrypt.hash.mockResolvedValue('$2a$10$hashedpassword')

      const { registerUser } = await import('@/lib/actions/auth')

      await registerUser({
        email: 'test@example.com',
        password: 'SecurePass123',
        nickname: 'User',
      })

      expect(authExtMockBcrypt.hash).toHaveBeenCalledWith('SecurePass123', 12)
    })

    it('登録成功をセキュリティログに記録する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)
      authExtMockPrisma.user.create.mockResolvedValue({ id: 'user-123' })
      authExtMockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 })
      authExtMockPrisma.emailVerificationToken.create.mockResolvedValue({})
      authExtMockBcrypt.hash.mockResolvedValue('hashedPassword')

      const { logRegisterSuccess } = await import('@/lib/security-logger')
      const { registerUser } = await import('@/lib/actions/auth')

      await registerUser({
        email: 'test@example.com',
        password: 'SecurePass123',
        nickname: 'User',
      })

      expect(logRegisterSuccess).toHaveBeenCalledWith('user-123', '192.168.1.1')
    })
  })

  // ============================================================
  // verifyEmailToken
  // ============================================================
  describe('verifyEmailToken', () => {
    it('有効なトークンでメール確認を完了する', async () => {
      authExtMockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'ev-1',
        email: 'user@example.com',
        token: 'hashedToken',
        expires: new Date(Date.now() + 86400000),
        created_at: new Date(),
      })
      authExtMockPrisma.$transaction.mockResolvedValue([{}, {}])

      const { verifyEmailToken } = await import('@/lib/actions/auth')
      const result = await verifyEmailToken('plain-token')

      expect(result).toEqual({ success: true })
    })

    it('無効なトークンでエラーを返す', async () => {
      authExtMockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null)

      const { verifyEmailToken } = await import('@/lib/actions/auth')
      const result = await verifyEmailToken('invalid-token-long-enough')

      expect(result.error).toContain('無効または期限切れ')
    })
  })

  // ============================================================
  // resendVerificationEmail
  // ============================================================
  describe('resendVerificationEmail', () => {
    it('未確認ユーザーに確認メールを再送する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        emailVerified: null,
      })
      authExtMockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 })
      authExtMockPrisma.emailVerificationToken.create.mockResolvedValue({})
      const { sendVerificationEmail } = await import('@/lib/email')
      ;(sendVerificationEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('user@example.com')

      expect(result).toEqual({ success: true })
    })

    it('レート制限に達した場合はエラー', async () => {
      const { rateLimit } = await import('@/lib/rate-limit')
      ;(rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false })

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('user@example.com')

      expect(result.error).toContain('再送の要求が多すぎます')
    })

    it('確認メール送信に失敗した場合はエラー', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        emailVerified: null,
      })
      authExtMockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 })
      authExtMockPrisma.emailVerificationToken.create.mockResolvedValue({})
      const { sendVerificationEmail } = await import('@/lib/email')
      ;(sendVerificationEmail as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false })

      const { resendVerificationEmail } = await import('@/lib/actions/auth')
      const result = await resendVerificationEmail('user@example.com')

      expect(result.error).toBeDefined()
      expect(result.error).toContain('送信に失敗')
    })
  })

  // ============================================================
  // getEmailVerificationStatus
  // ============================================================
  describe('getEmailVerificationStatus', () => {
    it('確認済みの場合は verified: true を返す', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({ emailVerified: new Date() })

      const { getEmailVerificationStatus } = await import('@/lib/actions/auth')
      const result = await getEmailVerificationStatus('user@example.com')

      expect(result).toEqual({ verified: true })
    })

    it('未確認の場合は verified: false を返す', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({ emailVerified: null })

      const { getEmailVerificationStatus } = await import('@/lib/actions/auth')
      const result = await getEmailVerificationStatus('user@example.com')

      expect(result).toEqual({ verified: false })
    })

    it('DBエラー時は verified: true を返してログインフォームを壊さない', async () => {
      authExtMockPrisma.user.findUnique.mockRejectedValue(new Error('DB error'))

      const { getEmailVerificationStatus } = await import('@/lib/actions/auth')
      const result = await getEmailVerificationStatus('user@example.com')

      expect(result).toEqual({ verified: true })
    })
  })

  // ============================================================
  // requestPasswordReset
  // ============================================================

  describe('requestPasswordReset', async () => {
    it('パスワードリセットメールを送信する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.create.mockResolvedValue({})

      const { sendPasswordResetEmail } = await import('@/lib/email')
      ;(sendPasswordResetEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      const result = await requestPasswordReset('test@example.com')

      expect(result.success).toBe(true)
      expect(sendPasswordResetEmail).toHaveBeenCalled()
    })

    it('ユーザーが存在しない場合も成功を返す（列挙攻撃防止）', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      const result = await requestPasswordReset('nonexistent@example.com')

      expect(result.success).toBe(true)
    })

    it('レート制限に達した場合はエラー', async () => {
      const { rateLimit } = await import('@/lib/rate-limit')
      ;(rateLimit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false })

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      const result = await requestPasswordReset('test@example.com')

      expect(result.error).toContain('パスワードリセットの要求が多すぎます')
    })

    it('メール送信に失敗した場合はエラー', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.create.mockResolvedValue({})

      const { sendPasswordResetEmail } = await import('@/lib/email')
      ;(sendPasswordResetEmail as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        error: 'SMTP error',
      })

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      const result = await requestPasswordReset('test@example.com')

      expect(result.error).toContain('メールの送信に失敗しました')
    })

    it('既存のトークンを削除する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.create.mockResolvedValue({})

      const { sendPasswordResetEmail } = await import('@/lib/email')
      ;(sendPasswordResetEmail as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true })

      const { requestPasswordReset } = await import('@/lib/actions/auth')

      await requestPasswordReset('test@example.com')

      expect(authExtMockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    it('セキュリティログに記録する', async () => {
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)

      const { logPasswordResetRequest } = await import('@/lib/security-logger')
      const { requestPasswordReset } = await import('@/lib/actions/auth')

      await requestPasswordReset('test@example.com')

      expect(logPasswordResetRequest).toHaveBeenCalledWith('test@example.com', '192.168.1.1')
    })
  })

  // ============================================================
  // resetPassword
  // ============================================================

  describe('resetPassword', async () => {
    it('パスワードをリセットする', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.user.update.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockBcrypt.hash.mockResolvedValue('newHashedPassword')

      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'NewSecure123',
      })

      expect(result.success).toBe(true)
    })

    it('パスワードが短すぎる場合はエラー', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'short',
      })

      expect(result.error).toContain('8文字以上')
    })

    it('パスワードにアルファベットがない場合はエラー', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: '12345678',
      })

      expect(result.error).toContain('アルファベットと数字を両方含めて')
    })

    it('パスワードに数字がない場合はエラー', async () => {
      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'abcdefgh',
      })

      expect(result.error).toContain('アルファベットと数字を両方含めて')
    })

    it('トークンが無効または期限切れの場合はエラー', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue(null)

      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'invalidToken',
        newPassword: 'NewSecure123',
      })

      expect(result.error).toContain('リセットリンクが無効または期限切れ')
    })

    it('ユーザーが見つからない場合はエラー', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })
      authExtMockPrisma.user.findUnique.mockResolvedValue(null)

      const { resetPassword } = await import('@/lib/actions/auth')

      const result = await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'NewSecure123',
      })

      expect(result.error).toBe('ユーザーが見つかりません')
    })

    it('使用済みトークンを削除する', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.user.update.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockBcrypt.hash.mockResolvedValue('newHashedPassword')

      const { resetPassword } = await import('@/lib/actions/auth')

      await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'NewSecure123',
      })

      expect(authExtMockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })

    it('成功をセキュリティログに記録する', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })
      authExtMockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      })
      authExtMockPrisma.user.update.mockResolvedValue({})
      authExtMockPrisma.passwordResetToken.deleteMany.mockResolvedValue({})
      authExtMockBcrypt.hash.mockResolvedValue('newHashedPassword')

      const { logPasswordResetSuccess } = await import('@/lib/security-logger')
      const { resetPassword } = await import('@/lib/actions/auth')

      await resetPassword({
        email: 'test@example.com',
        token: 'validToken',
        newPassword: 'NewSecure123',
      })

      expect(logPasswordResetSuccess).toHaveBeenCalledWith('user-123')
    })
  })

  // ============================================================
  // verifyPasswordResetToken
  // ============================================================

  describe('verifyPasswordResetToken', async () => {
    it('有効なトークンの場合はtrueを返す', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue({
        email: 'test@example.com',
        token: 'hashedToken',
      })

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')

      const result = await verifyPasswordResetToken('test@example.com', 'validToken')

      expect(result.valid).toBe(true)
    })

    it('無効なトークンの場合はfalseを返す', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue(null)

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')

      const result = await verifyPasswordResetToken('test@example.com', 'invalidToken')

      expect(result.valid).toBe(false)
    })

    it('有効期限が過ぎたトークンを検索しない', async () => {
      authExtMockPrisma.passwordResetToken.findFirst.mockResolvedValue(null)

      const { verifyPasswordResetToken } = await import('@/lib/actions/auth')

      await verifyPasswordResetToken('test@example.com', 'expiredToken')

      expect(authExtMockPrisma.passwordResetToken.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'test@example.com',
          token: expect.any(String), // ハッシュ化されたトークン
          expires: { gt: expect.any(Date) }, // 現在時刻より後
        },
      })
    })
  })
})
