// @vitest-environment node
/**
 * lib/services/email-change-service のユニットテスト
 *
 * requestEmailChangeCore / confirmEmailChangeCore の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

// ============================================================================
// Mock setup
// ============================================================================

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockSendEmailChangeConfirmation = vi.fn().mockResolvedValue({ success: true })
const mockSendEmailChangeNotification = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/email', () => ({
  sendEmailChangeConfirmation: (...args: unknown[]) => mockSendEmailChangeConfirmation(...args),
  sendEmailChangeNotification: (...args: unknown[]) => mockSendEmailChangeNotification(...args),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/env', () => ({
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}))

const mockLogEmailChangeRequest = vi.fn()
const mockLogEmailChangeSuccess = vi.fn()
vi.mock('@/lib/security-logger', () => ({
  logEmailChangeRequest: (...args: unknown[]) => mockLogEmailChangeRequest(...args),
  logEmailChangeSuccess: (...args: unknown[]) => mockLogEmailChangeSuccess(...args),
}))

// Stable crypto mock: raw token is never asserted directly to avoid log leakage.
const MOCK_RAW_TOKEN_HEX = 'b'.repeat(64)
const MOCK_HASHED_TOKEN = 'hashed:' + 'b'.repeat(64)

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

const mockBcryptCompare = vi.fn()
vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: { compare: (...args: unknown[]) => mockBcryptCompare(...args) },
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
}))

// ============================================================================
// Test data
// ============================================================================

const baseUser = {
  id: 'user-1',
  email: 'old@example.com',
  password: '$2b$12$oldhashed',
}

const NEW_EMAIL = 'new@example.com'

// ============================================================================
// Tests: requestEmailChangeCore
// ============================================================================

describe('lib/services/email-change-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requestEmailChangeCore', () => {
    it('正常系: 既存トークンを無効化し新規トークンを SHA-256 ハッシュで保存し確認メール・通知メールを送信する', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(baseUser) // 認証用ユーザー取得
        .mockResolvedValueOnce(null) // newEmail 未使用チェック
      mockBcryptCompare.mockResolvedValueOnce(true)
      mockPrisma.emailChangeToken.deleteMany.mockResolvedValueOnce({ count: 1 })
      mockPrisma.emailChangeToken.create.mockResolvedValueOnce({
        id: 'ect-1',
        userId: baseUser.id,
        newEmail: NEW_EMAIL,
        tokenHash: MOCK_HASHED_TOKEN,
        expiresAt: new Date(Date.now() + 3600000),
      })
      mockSendEmailChangeConfirmation.mockResolvedValueOnce({ success: true })
      mockSendEmailChangeNotification.mockResolvedValueOnce({ success: true })

      const { requestEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await requestEmailChangeCore(baseUser.id, 'correctPass1', NEW_EMAIL, '127.0.0.1')

      expect(result).toEqual({ ok: true })

      // 既存の未使用トークンが無効化されてから新規作成されること
      expect(mockPrisma.emailChangeToken.deleteMany).toHaveBeenCalledWith({ where: { userId: baseUser.id } })
      expect(mockPrisma.emailChangeToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: baseUser.id,
            newEmail: NEW_EMAIL,
            tokenHash: MOCK_HASHED_TOKEN,
          }),
        }),
      )

      // 確認メールは新アドレス宛、通知メールは旧アドレス宛
      const [confirmTo, confirmUrl] = mockSendEmailChangeConfirmation.mock.calls[0] as [string, string]
      expect(confirmTo).toBe(NEW_EMAIL)
      expect(confirmUrl).toContain(MOCK_RAW_TOKEN_HEX)
      expect(mockSendEmailChangeNotification).toHaveBeenCalledWith(baseUser.email)

      // セキュリティログが記録されること
      expect(mockLogEmailChangeRequest).toHaveBeenCalledWith(baseUser.id, '127.0.0.1')
    })

    it('現パスワード不一致の場合は ERR_INCORRECT_PASSWORD を返しトークンを発行しない', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(baseUser)
      mockBcryptCompare.mockResolvedValueOnce(false)

      const { requestEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await requestEmailChangeCore(baseUser.id, 'wrongPass1', NEW_EMAIL, '127.0.0.1')

      expect(result).toEqual({ ok: false, error: 'パスワードが正しくありません' })
      expect(mockPrisma.emailChangeToken.create).not.toHaveBeenCalled()
      expect(mockSendEmailChangeConfirmation).not.toHaveBeenCalled()
      expect(mockLogEmailChangeRequest).not.toHaveBeenCalled()
    })

    it('OAuth 専用アカウント（passwordHash null）の場合は ERR_NO_PASSWORD_SET を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ ...baseUser, password: null })

      const { requestEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await requestEmailChangeCore(baseUser.id, 'anyPass1', NEW_EMAIL, '127.0.0.1')

      expect(result).toEqual({ ok: false, error: 'パスワードが設定されていません' })
      expect(mockBcryptCompare).not.toHaveBeenCalled()
      expect(mockPrisma.emailChangeToken.create).not.toHaveBeenCalled()
    })

    it('ユーザーが見つからない場合は ERR_USER_NOT_FOUND を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { requestEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await requestEmailChangeCore('ghost-id', 'anyPass1', NEW_EMAIL, '127.0.0.1')

      expect(result).toEqual({ ok: false, error: 'ユーザーが見つかりません' })
    })

    it('列挙攻撃対策: newEmail が既に他ユーザーに使われている場合は ok:true を返すがメールもトークンも作られない', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(baseUser)
        .mockResolvedValueOnce({ id: 'other-user-id' })
      mockBcryptCompare.mockResolvedValueOnce(true)

      const { requestEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await requestEmailChangeCore(baseUser.id, 'correctPass1', NEW_EMAIL, '127.0.0.1')

      expect(result).toEqual({ ok: true })
      expect(mockPrisma.emailChangeToken.deleteMany).not.toHaveBeenCalled()
      expect(mockPrisma.emailChangeToken.create).not.toHaveBeenCalled()
      expect(mockSendEmailChangeConfirmation).not.toHaveBeenCalled()
      expect(mockSendEmailChangeNotification).not.toHaveBeenCalled()

      // 本人確認（現パスワード）が完了した時点でリクエストログは記録される
      expect(mockLogEmailChangeRequest).toHaveBeenCalledWith(baseUser.id, '127.0.0.1')
    })

    it('確認メール送信失敗の場合は ERR_EMAIL_SEND_FAILED を返す', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(baseUser)
        .mockResolvedValueOnce(null)
      mockBcryptCompare.mockResolvedValueOnce(true)
      mockPrisma.emailChangeToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailChangeToken.create.mockResolvedValueOnce({})
      mockSendEmailChangeConfirmation.mockResolvedValueOnce({ success: false, error: 'SMTP down' })

      const { requestEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await requestEmailChangeCore(baseUser.id, 'correctPass1', NEW_EMAIL, '127.0.0.1')

      expect(result).toEqual({ ok: false, error: 'メールの送信に失敗しました。しばらく経ってからお試しください。' })
      expect(mockSendEmailChangeNotification).not.toHaveBeenCalled()
    })

    it('旧アドレスへの通知メール送信が失敗しても変更フロー自体は成功として継続する', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(baseUser)
        .mockResolvedValueOnce(null)
      mockBcryptCompare.mockResolvedValueOnce(true)
      mockPrisma.emailChangeToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailChangeToken.create.mockResolvedValueOnce({})
      mockSendEmailChangeConfirmation.mockResolvedValueOnce({ success: true })
      mockSendEmailChangeNotification.mockResolvedValueOnce({ success: false, error: 'SMTP down' })

      const { requestEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await requestEmailChangeCore(baseUser.id, 'correctPass1', NEW_EMAIL, '127.0.0.1')

      expect(result).toEqual({ ok: true })
    })

    it('ip 未指定でも動作する（オプショナル引数）', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(baseUser)
        .mockResolvedValueOnce(null)
      mockBcryptCompare.mockResolvedValueOnce(true)
      mockPrisma.emailChangeToken.deleteMany.mockResolvedValueOnce({ count: 0 })
      mockPrisma.emailChangeToken.create.mockResolvedValueOnce({})

      const { requestEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await requestEmailChangeCore(baseUser.id, 'correctPass1', NEW_EMAIL)

      expect(result).toEqual({ ok: true })
      expect(mockLogEmailChangeRequest).toHaveBeenCalledWith(baseUser.id, undefined)
    })
  })

  // ============================================================================
  // Tests: confirmEmailChangeCore
  // ============================================================================

  describe('confirmEmailChangeCore', () => {
    const tokenRecord = {
      id: 'ect-1',
      userId: baseUser.id,
      newEmail: NEW_EMAIL,
      tokenHash: MOCK_HASHED_TOKEN,
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
    }

    it('正常系: user.email を更新しトークンを消費する', async () => {
      mockPrisma.emailChangeToken.findUnique.mockResolvedValueOnce(tokenRecord)
      mockPrisma.user.findUnique.mockResolvedValueOnce(null) // newEmail 未使用の再チェック
      mockPrisma.user.update.mockResolvedValueOnce({ id: baseUser.id, email: NEW_EMAIL })
      mockPrisma.emailChangeToken.update.mockResolvedValueOnce({ ...tokenRecord, usedAt: new Date() })

      const { confirmEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await confirmEmailChangeCore('raw-token-value')

      expect(result).toEqual({ ok: true })

      // トークンはハッシュ化して検索されること（平文で検索していないこと）
      expect(mockPrisma.emailChangeToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: MOCK_HASHED_TOKEN },
      })
      expect(mockPrisma.emailChangeToken.findUnique).not.toHaveBeenCalledWith({
        where: { tokenHash: 'raw-token-value' },
      })

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: baseUser.id },
          data: expect.objectContaining({ email: NEW_EMAIL }),
        }),
      )
      expect(mockPrisma.emailChangeToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: tokenRecord.id },
          data: expect.objectContaining({ usedAt: expect.any(Date) }),
        }),
      )
      expect(mockLogEmailChangeSuccess).toHaveBeenCalledWith(baseUser.id)
    })

    it('無効/未知トークン: findUnique が null を返すと invalid_token を返す', async () => {
      mockPrisma.emailChangeToken.findUnique.mockResolvedValueOnce(null)

      const { confirmEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await confirmEmailChangeCore('unknown-token')

      expect(result).toEqual({ ok: false, reason: 'invalid_token' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('期限切れトークン: expiresAt が過去の場合は invalid_token を返す', async () => {
      mockPrisma.emailChangeToken.findUnique.mockResolvedValueOnce({
        ...tokenRecord,
        expiresAt: new Date(Date.now() - 1000),
      })

      const { confirmEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await confirmEmailChangeCore('expired-token')

      expect(result).toEqual({ ok: false, reason: 'invalid_token' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('使用済みトークン: usedAt が設定されている場合は invalid_token を返す', async () => {
      mockPrisma.emailChangeToken.findUnique.mockResolvedValueOnce({
        ...tokenRecord,
        usedAt: new Date(),
      })

      const { confirmEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await confirmEmailChangeCore('used-token')

      expect(result).toEqual({ ok: false, reason: 'invalid_token' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('事前チェック: request 後に newEmail が別ユーザーに取得されていた場合は email_taken を返す', async () => {
      mockPrisma.emailChangeToken.findUnique.mockResolvedValueOnce(tokenRecord)
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'other-user-id' })

      const { confirmEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await confirmEmailChangeCore('raw-token-value')

      expect(result).toEqual({ ok: false, reason: 'email_taken' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
      expect(mockPrisma.emailChangeToken.update).not.toHaveBeenCalled()
    })

    it('事前チェック: newEmail が同一ユーザー自身に既に紐づく場合は許可する（同一 ID なら email_taken にしない）', async () => {
      mockPrisma.emailChangeToken.findUnique.mockResolvedValueOnce(tokenRecord)
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: baseUser.id })
      mockPrisma.user.update.mockResolvedValueOnce({ id: baseUser.id, email: NEW_EMAIL })
      mockPrisma.emailChangeToken.update.mockResolvedValueOnce({ ...tokenRecord, usedAt: new Date() })

      const { confirmEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await confirmEmailChangeCore('raw-token-value')

      expect(result).toEqual({ ok: true })
    })

    it('TOCTOU: 事前チェック通過後に update が P2002 で失敗した場合は email_taken にフォールバックする', async () => {
      const { Prisma } = await import('@prisma/client')
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['email'] },
      })
      mockPrisma.emailChangeToken.findUnique.mockResolvedValueOnce(tokenRecord)
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      mockPrisma.user.update.mockRejectedValueOnce(p2002Error)

      const { confirmEmailChangeCore } = await import('@/lib/services/email-change-service')
      const result = await confirmEmailChangeCore('raw-token-value')

      expect(result).toEqual({ ok: false, reason: 'email_taken' })
      expect(mockLogEmailChangeSuccess).not.toHaveBeenCalled()
    })

    it('P2002 以外の Prisma エラーは再スローする', async () => {
      const { Prisma } = await import('@prisma/client')
      const p2025Error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '6.0.0',
        meta: {},
      })
      mockPrisma.emailChangeToken.findUnique.mockResolvedValueOnce(tokenRecord)
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)
      mockPrisma.user.update.mockRejectedValueOnce(p2025Error)

      const { confirmEmailChangeCore } = await import('@/lib/services/email-change-service')
      await expect(confirmEmailChangeCore('raw-token-value')).rejects.toThrow('Record not found')
    })
  })
})
