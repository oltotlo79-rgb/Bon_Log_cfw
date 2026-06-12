// @vitest-environment node
/**
 * lib/services/registration-service のユニットテスト
 *
 * registerUserCore の正常系・全 failure reason 分岐・セキュリティ性質を検証する。
 * Web Server Action（lib/actions/auth.ts）の既存テストと重複しない未カバー分岐を中心に扱う。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

// ============================================================================
// Mock setup
// ============================================================================

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockSendVerificationEmail = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/email', () => ({
  sendVerificationEmail: (...args: unknown[]) => mockSendVerificationEmail(...args),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/env', () => ({
  getAppUrl: vi.fn().mockReturnValue('http://localhost:3000'),
}))

// isReservedNickname — 実装依存（RESERVED_NICKNAMES を使う）のでそのまま使う
// isEmailBlacklisted / isDeviceBlacklisted はサービス層から分離してモック
const mockIsEmailBlacklisted = vi.fn().mockResolvedValue(false)
const mockIsDeviceBlacklisted = vi.fn().mockResolvedValue(false)
vi.mock('@/lib/services/blacklist-check', () => ({
  isEmailBlacklisted: (...args: unknown[]) => mockIsEmailBlacklisted(...args),
  isDeviceBlacklisted: (...args: unknown[]) => mockIsDeviceBlacklisted(...args),
}))

// crypto — 生トークンをスナップショットに残さないためモック
const MOCK_RAW_TOKEN_HEX = 'b'.repeat(64)
const MOCK_HASHED_TOKEN = 'sha256:' + 'b'.repeat(64)

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

const mockBcryptHash = vi.fn().mockResolvedValue('$2b$12$mockedhashvalue')
vi.mock('bcryptjs', () => ({
  __esModule: true,
  default: { hash: (...args: unknown[]) => mockBcryptHash(...args) },
  hash: (...args: unknown[]) => mockBcryptHash(...args),
}))

// ============================================================================
// Test data
// ============================================================================

const validInput = {
  email: 'newuser@example.com',
  password: 'SecurePass1',
  nickname: '新規ユーザー',
}

const createdUser = {
  id: 'user-new-1',
  email: validInput.email,
  nickname: validInput.nickname,
  password: '$2b$12$mockedhashvalue',
}

// ============================================================================
// Tests
// ============================================================================

describe('lib/services/registration-service — registerUserCore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルト: ブラックリスト未登録、ユーザー不在
    mockIsEmailBlacklisted.mockResolvedValue(false)
    mockIsDeviceBlacklisted.mockResolvedValue(false)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue(createdUser)
    mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 })
    mockPrisma.emailVerificationToken.create.mockResolvedValue({
      id: 'evtoken-1',
      email: validInput.email,
      token: MOCK_HASHED_TOKEN,
      expires: new Date(Date.now() + 86400000),
    })
    mockSendVerificationEmail.mockResolvedValue({ success: true })
  })

  describe('正常系', () => {
    it('ユーザー作成 + メール確認トークン生成 + 確認メール送信で ok:true を返す', async () => {
      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore(validInput)

      expect(result).toEqual({ ok: true, userId: createdUser.id })
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledTimes(1)
      expect(mockSendVerificationEmail).toHaveBeenCalledTimes(1)
    })

    it('パスワードはハッシュ化してから user.create に渡す（平文保存禁止）', async () => {
      const PLAINTEXT = 'PlainTextPass1'
      const { registerUserCore } = await import('@/lib/services/registration-service')
      await registerUserCore({ ...validInput, password: PLAINTEXT })

      const createCall = mockPrisma.user.create.mock.calls[0] as [{ data: { password: string } }]
      expect(createCall[0].data.password).not.toBe(PLAINTEXT)
      expect(createCall[0].data.password).toBe('$2b$12$mockedhashvalue')
    })

    it('emailVerificationToken を先に deleteMany してから create する（古いトークン削除）', async () => {
      const { registerUserCore } = await import('@/lib/services/registration-service')
      await registerUserCore(validInput)

      expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { email: validInput.email },
      })
      // deleteMany → create の順
      const deleteOrder = mockPrisma.emailVerificationToken.deleteMany.mock.invocationCallOrder[0]
      const createOrder = mockPrisma.emailVerificationToken.create.mock.invocationCallOrder[0]
      expect(deleteOrder).toBeLessThan(createOrder as number)
    })

    it('メール送信 URL にはハッシュ前の生トークンが含まれる（ハッシュ値は含まれない）', async () => {
      const { registerUserCore } = await import('@/lib/services/registration-service')
      await registerUserCore(validInput)

      const [calledEmail, calledUrl] = mockSendVerificationEmail.mock.calls[0] as [string, string]
      expect(calledEmail).toBe(validInput.email)
      expect(calledUrl).toContain(MOCK_RAW_TOKEN_HEX)
      expect(calledUrl).not.toContain(MOCK_HASHED_TOKEN)
    })

    it('emailVerificationToken.create にはハッシュ済みトークンが保存される（生トークン禁止）', async () => {
      const { registerUserCore } = await import('@/lib/services/registration-service')
      await registerUserCore(validInput)

      const createCall = mockPrisma.emailVerificationToken.create.mock.calls[0] as [{ data: { token: string } }]
      expect(createCall[0].data.token).toBe(MOCK_HASHED_TOKEN)
      expect(createCall[0].data.token).not.toBe(MOCK_RAW_TOKEN_HEX)
    })

    it('fingerprint を渡さない場合は isDeviceBlacklisted を呼ばない', async () => {
      const { registerUserCore } = await import('@/lib/services/registration-service')
      await registerUserCore(validInput)

      expect(mockIsDeviceBlacklisted).not.toHaveBeenCalled()
    })

    it('fingerprint を渡した場合は isDeviceBlacklisted を呼ぶ', async () => {
      const { registerUserCore } = await import('@/lib/services/registration-service')
      await registerUserCore({ ...validInput, fingerprint: 'fp-abc-123' })

      expect(mockIsDeviceBlacklisted).toHaveBeenCalledWith('fp-abc-123')
    })
  })

  describe('failure: email_already_registered', () => {
    it('既存ユーザーが存在すると email_already_registered を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'existing-user' })

      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore(validInput)

      expect(result).toMatchObject({ ok: false, reason: 'email_already_registered' })
      expect(result.ok).toBe(false)
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('TOCTOU: user.create で P2002 が発生した場合も email_already_registered を返す', async () => {
      const { Prisma } = await import('@prisma/client')
      const p2002Error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.0.0',
        meta: { target: ['email'] },
      })
      mockPrisma.user.create.mockRejectedValueOnce(p2002Error)

      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore(validInput)

      expect(result).toMatchObject({ ok: false, reason: 'email_already_registered' })
    })

    it('P2002 以外の Prisma エラーは再スローする', async () => {
      const { Prisma } = await import('@prisma/client')
      const p2025Error = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '6.0.0',
        meta: {},
      })
      mockPrisma.user.create.mockRejectedValueOnce(p2025Error)

      const { registerUserCore } = await import('@/lib/services/registration-service')
      await expect(registerUserCore(validInput)).rejects.toThrow()
    })
  })

  describe('failure: nickname_reserved', () => {
    it('予約済みニックネームは nickname_reserved を返す（DB チェック前に早期リターン）', async () => {
      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore({ ...validInput, nickname: 'E2Eテストユーザー' })

      expect(result).toMatchObject({ ok: false, reason: 'nickname_reserved' })
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
      expect(mockIsEmailBlacklisted).not.toHaveBeenCalled()
    })

    it('大文字小文字・前後空白は正規化して予約チェックする', async () => {
      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore({ ...validInput, nickname: '  e2eテストユーザー  ' })

      expect(result).toMatchObject({ ok: false, reason: 'nickname_reserved' })
    })
  })

  describe('failure: email_blacklisted', () => {
    it('ブラックリスト登録済みメールは email_blacklisted を返す', async () => {
      mockIsEmailBlacklisted.mockResolvedValueOnce(true)

      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore(validInput)

      expect(result).toMatchObject({ ok: false, reason: 'email_blacklisted' })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('email_blacklisted の message は ERR_EMAIL_BLACKLISTED と一致する', async () => {
      mockIsEmailBlacklisted.mockResolvedValueOnce(true)

      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore(validInput)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toBe('このメールアドレスは利用できません')
      }
    })
  })

  describe('failure: device_blacklisted', () => {
    it('ブラックリスト登録済みデバイスは device_blacklisted を返す', async () => {
      mockIsDeviceBlacklisted.mockResolvedValueOnce(true)

      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore({ ...validInput, fingerprint: 'banned-fp' })

      expect(result).toMatchObject({ ok: false, reason: 'device_blacklisted' })
      expect(mockPrisma.user.create).not.toHaveBeenCalled()
    })

    it('fingerprint 未指定なら device_blacklisted は発生しない', async () => {
      mockIsDeviceBlacklisted.mockResolvedValueOnce(true)

      const { registerUserCore } = await import('@/lib/services/registration-service')
      // fingerprint を渡さない → isDeviceBlacklisted は呼ばれないため通過する
      const result = await registerUserCore(validInput)

      expect(result).toMatchObject({ ok: true })
    })
  })

  describe('failure: email_send_failed', () => {
    it('確認メール送信失敗は email_send_failed を返す', async () => {
      mockSendVerificationEmail.mockResolvedValueOnce({ success: false, error: 'SMTP timeout' })

      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore(validInput)

      expect(result).toMatchObject({ ok: false, reason: 'email_send_failed' })
    })

    it('email_send_failed の message は ERR_VERIFICATION_EMAIL_FAILED と一致する', async () => {
      mockSendVerificationEmail.mockResolvedValueOnce({ success: false, error: 'network error' })

      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore(validInput)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toContain('確認メール')
      }
    })

    it('email_send_failed でもユーザー・トークンは作成済みである（ロールバックしない）', async () => {
      mockSendVerificationEmail.mockResolvedValueOnce({ success: false, error: 'SMTP error' })

      const { registerUserCore } = await import('@/lib/services/registration-service')
      await registerUserCore(validInput)

      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1)
      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('チェック順序', () => {
    it('nickname_reserved → email_blacklisted → device_blacklisted → 既存ユーザー の順に検査する', async () => {
      // nickname が予約済みなら最初に弾かれ、後続のチェックは実行されない
      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore({ ...validInput, nickname: 'E2E Test User' })

      expect(result).toMatchObject({ ok: false, reason: 'nickname_reserved' })
      expect(mockIsEmailBlacklisted).not.toHaveBeenCalled()
      expect(mockIsDeviceBlacklisted).not.toHaveBeenCalled()
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('email_blacklisted チェックは nickname_reserved 通過後に実行される', async () => {
      mockIsEmailBlacklisted.mockResolvedValueOnce(true)

      const { registerUserCore } = await import('@/lib/services/registration-service')
      const result = await registerUserCore({ ...validInput, fingerprint: 'fp-1' })

      expect(result).toMatchObject({ ok: false, reason: 'email_blacklisted' })
      // fingerprint チェック（device_blacklisted）は email_blacklisted より後のため未実行
      expect(mockIsDeviceBlacklisted).not.toHaveBeenCalled()
    })
  })
})
