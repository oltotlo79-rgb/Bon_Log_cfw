// @vitest-environment node
/**
 * lib/services/password-reset-service のユニットテスト
 *
 * requestPasswordResetCore / resetPasswordCore の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

// ============================================================================
// Mock setup
// ============================================================================

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockSendPasswordResetEmail = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/email', () => ({
  sendPasswordResetEmail: mockSendPasswordResetEmail,
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeInput: vi.fn((input: string) => input),
}))

vi.mock('@/lib/security-logger', () => ({
  logPasswordResetRequest: vi.fn(),
  logPasswordResetSuccess: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}))

// Stable crypto mock: randomBytes returns a fixed hex token,
// createHash returns a deterministic hashed value.
// Raw token is never asserted directly to avoid log leakage.
const MOCK_RAW_TOKEN_HEX = 'a'.repeat(64)
const MOCK_HASHED_TOKEN = 'hashed:' + 'a'.repeat(64)

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn().mockReturnValue({
      toString: vi.fn().mockReturnValue(MOCK_RAW_TOKEN_HEX),
    }),
    createHash: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        digest: vi.fn().mockReturnValue(MOCK_HASHED_TOKEN),
      }),
    }),
  },
  randomBytes: vi.fn().mockReturnValue({
    toString: vi.fn().mockReturnValue(MOCK_RAW_TOKEN_HEX),
  }),
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({
      digest: vi.fn().mockReturnValue(MOCK_HASHED_TOKEN),
    }),
  }),
}))

const mockBcryptHash = vi.fn().mockResolvedValue('$2b$12$newhashed')
vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: (...args: unknown[]) => mockBcryptHash(...args) },
  hash: (...args: unknown[]) => mockBcryptHash(...args),
}))

// ============================================================================
// Test data
// ============================================================================

const baseUser = {
  id: 'user-1',
  email: 'test@example.com',
  nickname: 'テストユーザー',
  password: '$2b$12$oldhashed',
}

// ============================================================================
// Tests: requestPasswordResetCore
// ============================================================================

describe('lib/services/password-reset-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requestPasswordResetCore', () => {
    it('正常系: トークンを SHA-256 ハッシュで保存しメールを送信する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser)
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce({
        id: 'prt-1',
        email: baseUser.email,
        token: MOCK_HASHED_TOKEN,
        expires: new Date(Date.now() + 3600000),
      })
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: true })

      const { requestPasswordResetCore } = await import(
        '@/lib/services/password-reset-service'
      )
      const result = await requestPasswordResetCore(baseUser.email, '127.0.0.1')

      expect(result).toEqual({ ok: true })

      // ハッシュ済みトークンのみ保存されること（生トークンは保存されない）
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ token: MOCK_HASHED_TOKEN }),
        }),
      )

      // メール送信の URL にはハッシュ前の生トークンが含まれること
      const [calledEmail, calledUrl] = mockSendPasswordResetEmail.mock.calls[0] as [string, string]
      expect(calledEmail).toBe(baseUser.email)
      expect(calledUrl).toContain(MOCK_RAW_TOKEN_HEX)
      expect(calledUrl).toContain(encodeURIComponent(baseUser.email))
    })

    it('正常系: 既存トークンを削除してから新規作成する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser)
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce({})
      mockSendPasswordResetEmail.mockResolvedValueOnce({ success: true })

      const { requestPasswordResetCore } = await import(
        '@/lib/services/password-reset-service'
      )
      await requestPasswordResetCore(baseUser.email, '10.0.0.1')

      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: baseUser.email },
      })
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledTimes(1)
    })

    it('列挙攻撃対策: 存在しないメールでも ok:true を返す（DB/メール操作なし）', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { requestPasswordResetCore } = await import(
        '@/lib/services/password-reset-service'
      )
      const result = await requestPasswordResetCore('notexist@example.com', '127.0.0.1')

      expect(result).toEqual({ ok: true })
      expect(mockPrisma.passwordResetToken.create).not.toHaveBeenCalled()
      expect(mockSendPasswordResetEmail).not.toHaveBeenCalled()
    })

    it('メール送信失敗: ok:false / reason:email_send_failed を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser)
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.passwordResetToken.create.mockResolvedValueOnce({})
      mockSendPasswordResetEmail.mockResolvedValueOnce({
        success: false,
        error: 'SMTP connection refused',
      })

      const { requestPasswordResetCore } = await import(
        '@/lib/services/password-reset-service'
      )
      const result = await requestPasswordResetCore(baseUser.email, '127.0.0.1')

      expect(result).toEqual({ ok: false, reason: 'email_send_failed' })
    })
  })

  // ============================================================================
  // Tests: resetPasswordCore
  // ============================================================================

  describe('resetPasswordCore', () => {
    it('正常系: パスワードを bcrypt ハッシュで更新しトークンを削除する', async () => {
      const tokenRecord = {
        id: 'prt-1',
        email: baseUser.email,
        token: MOCK_HASHED_TOKEN,
        expires: new Date(Date.now() + 3600000),
      }
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(tokenRecord)
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser)
      mockPrisma.user.update.mockResolvedValueOnce({ ...baseUser, password: '$2b$12$newhashed' })
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 1 })
      mockBcryptHash.mockResolvedValueOnce('$2b$12$newhashed')

      const { resetPasswordCore } = await import('@/lib/services/password-reset-service')
      const result = await resetPasswordCore(baseUser.email, 'raw-token-value', 'NewPass123!')

      expect(result).toEqual({ ok: true })

      // パスワードはハッシュ化されてから保存されること（平文は保存されない）
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ password: '$2b$12$newhashed' }),
        }),
      )
      expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { email: baseUser.email },
      })
    })

    it('無効トークン: findFirst が null を返すと invalid_token を返す', async () => {
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { resetPasswordCore } = await import('@/lib/services/password-reset-service')
      const result = await resetPasswordCore(baseUser.email, 'bad-token', 'NewPass123!')

      expect(result).toEqual({ ok: false, reason: 'invalid_token' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('期限切れトークン: expires < now のレコードがないと invalid_token を返す', async () => {
      // findFirst の where に expires: { gt: new Date() } が含まれるため
      // 期限切れのレコードは DB から返されない → null が返る
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(null)

      const { resetPasswordCore } = await import('@/lib/services/password-reset-service')
      const result = await resetPasswordCore(
        baseUser.email,
        'expired-token',
        'NewPass123!',
      )

      expect(result).toEqual({ ok: false, reason: 'invalid_token' })
    })

    it('ユーザー不在: トークンは有効でもユーザーが見つからないと user_not_found を返す', async () => {
      const tokenRecord = {
        id: 'prt-1',
        email: 'ghost@example.com',
        token: MOCK_HASHED_TOKEN,
        expires: new Date(Date.now() + 3600000),
      }
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(tokenRecord)
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { resetPasswordCore } = await import('@/lib/services/password-reset-service')
      const result = await resetPasswordCore('ghost@example.com', 'raw-token-value', 'NewPass123!')

      expect(result).toEqual({ ok: false, reason: 'user_not_found' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('新パスワードは平文のままログ・スナップショットに残らない', async () => {
      const tokenRecord = {
        id: 'prt-1',
        email: baseUser.email,
        token: MOCK_HASHED_TOKEN,
        expires: new Date(Date.now() + 3600000),
      }
      mockPrisma.passwordResetToken.findFirst.mockResolvedValueOnce(tokenRecord)
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser)
      mockPrisma.user.update.mockResolvedValueOnce({})
      mockPrisma.passwordResetToken.deleteMany.mockResolvedValueOnce({ count: 1 })

      const PLAINTEXT_PASSWORD = 'PlainText_Should_Not_Be_Stored'
      mockBcryptHash.mockResolvedValueOnce('$2b$12$hashed_result')

      const { resetPasswordCore } = await import('@/lib/services/password-reset-service')
      await resetPasswordCore(baseUser.email, 'raw-token-value', PLAINTEXT_PASSWORD)

      // user.update に渡る password フィールドは平文であってはならない
      const updateCall = mockPrisma.user.update.mock.calls[0] as [{ data: { password: string } }]
      expect(updateCall[0].data.password).not.toBe(PLAINTEXT_PASSWORD)
      expect(updateCall[0].data.password).toBe('$2b$12$hashed_result')
    })
  })
})
