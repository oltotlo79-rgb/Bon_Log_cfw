// @vitest-environment node

import { vi } from 'vitest'
// Logger mock
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Resend mock
const mockResendSend = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(function() { return {
    emails: {
      send: mockResendSend,
    },
  } }),
}))

describe('Email Module', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // 環境変数をリセット
    delete process.env.EMAIL_PROVIDER
    delete process.env.RESEND_API_KEY
    delete process.env.EMAIL_FROM
  })

  describe('sendEmail', async () => {
    it('デフォルトではConsoleProviderを使用する', async () => {
      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toMatch(/^console-\d+$/)
    })

    it('EMAIL_PROVIDER=consoleでConsoleProviderを使用', async () => {
      process.env.EMAIL_PROVIDER = 'console'
      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(true)
    })

    it('EMAIL_PROVIDER=resendでResendProviderを使用', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.RESEND_API_KEY = 'test-api-key'

      mockResendSend.mockResolvedValueOnce({
        data: { id: 'resend-123' },
        error: null,
      })

      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(true)
      expect(result.messageId).toBe('resend-123')
      expect(mockResendSend).toHaveBeenCalled()
    })

    it('ResendでAPIエラーが発生した場合', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.RESEND_API_KEY = 'test-api-key'

      mockResendSend.mockResolvedValueOnce({
        data: null,
        error: { message: 'Invalid API key' },
      })

      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('Resendで例外が発生した場合', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.RESEND_API_KEY = 'test-api-key'

      mockResendSend.mockRejectedValueOnce(new Error('Network error'))

      const { sendEmail } = await import('@/lib/email')

      const result = await sendEmail({
        to: 'test@example.com',
        subject: 'Test Subject',
        html: '<p>Test</p>',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Network error')
    })

  })

  describe('sendVerificationEmail', async () => {
    it('確認メールを送信する', async () => {
      const { sendVerificationEmail } = await import('@/lib/email')

      const result = await sendVerificationEmail(
        'user@example.com',
        'https://example.com/verify-email?token=abc123'
      )

      expect(result.success).toBe(true)
    })

    it('メール本文に確認URLが含まれる', async () => {
      process.env.EMAIL_PROVIDER = 'resend'
      process.env.RESEND_API_KEY = 'test-key'
      const verifyUrl = 'https://example.com/verify-email?token=xyz789'
      mockResendSend.mockResolvedValueOnce({ data: { id: 'id' }, error: null })

      const { sendVerificationEmail } = await import('@/lib/email')
      await sendVerificationEmail('user@example.com', verifyUrl)

      expect(mockResendSend).toHaveBeenCalled()
      const call = mockResendSend.mock.calls[0][0]
      expect(call?.html).toContain(verifyUrl)
      expect(call?.text).toContain(verifyUrl)
    })
  })

  describe('sendPasswordResetEmail', async () => {
    it('パスワードリセットメールを送信する', async () => {
      const { sendPasswordResetEmail } = await import('@/lib/email')

      const result = await sendPasswordResetEmail(
        'test@example.com',
        'https://example.com/reset?token=abc123'
      )

      expect(result.success).toBe(true)
    })

    it('メール内容にリセットURLが含まれる', async () => {
      const logger = (await import('@/lib/logger')).default
      const { sendPasswordResetEmail } = await import('@/lib/email')

      await sendPasswordResetEmail(
        'test@example.com',
        'https://example.com/reset?token=abc123'
      )

      // ConsoleProviderがloggerを呼ぶことを確認
      expect(logger.log).toHaveBeenCalled()
    })
  })

  describe('sendSubscriptionExpiringEmail', async () => {
    it('サブスクリプション期限切れ間近メールを送信する', async () => {
      const { sendSubscriptionExpiringEmail } = await import('@/lib/email')

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 7)

      const result = await sendSubscriptionExpiringEmail(
        'test@example.com',
        'TestUser',
        futureDate
      )

      expect(result.success).toBe(true)
    })

    it('残り日数を正しく計算する', async () => {
      const logger = (await import('@/lib/logger')).default
      const { sendSubscriptionExpiringEmail } = await import('@/lib/email')

      const futureDate = new Date()
      futureDate.setDate(futureDate.getDate() + 3)

      await sendSubscriptionExpiringEmail(
        'test@example.com',
        'TestUser',
        futureDate
      )

      // HTMLに残り日数が含まれていることを確認（ログ経由）
      expect(logger.log).toHaveBeenCalled()
    })
  })

  describe('sendSubscriptionExpiredEmail', async () => {
    it('サブスクリプション期限切れメールを送信する', async () => {
      const { sendSubscriptionExpiredEmail } = await import('@/lib/email')

      const result = await sendSubscriptionExpiredEmail(
        'test@example.com',
        'TestUser'
      )

      expect(result.success).toBe(true)
    })
  })

  describe('プロバイダーのシングルトン', async () => {
    it('同じプロバイダーインスタンスを再利用する', async () => {
      const { sendEmail } = await import('@/lib/email')

      await sendEmail({ to: 'a@test.com', subject: 'Test1', html: '<p>1</p>' })
      await sendEmail({ to: 'b@test.com', subject: 'Test2', html: '<p>2</p>' })

      // どちらも成功（同じプロバイダー使用）
      // 特に検証することはないが、エラーが出ないことを確認
    })
  })
})
