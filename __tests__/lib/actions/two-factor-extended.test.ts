// @vitest-environment node
import { vi } from 'vitest'
 

vi.unmock('@/lib/actions/two-factor')

import { createMockPrismaClient } from '../../utils/test-utils'
const mockBcryptCompare = vi.fn().mockResolvedValue(true)
const mockBcryptHash = vi.fn().mockResolvedValue('hashed')

const mockPrisma = createMockPrismaClient()

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('@/lib/two-factor', () => ({
  generateSecret: vi.fn().mockReturnValue('secret123'),
  generateTOTPUri: vi.fn().mockReturnValue('otpauth://...'),
  generateQRCode: vi.fn().mockResolvedValue('data:image/png;base64,...'),
  generateBackupCodes: vi.fn().mockReturnValue(['code1', 'code2', 'code3']),
  verifyTOTP: vi.fn().mockReturnValue(true),
  encryptSecret: vi.fn().mockReturnValue('encrypted'),
  decryptSecret: vi.fn().mockReturnValue('decrypted'),
  hashBackupCode: vi.fn().mockReturnValue('hashed'),
  verifyBackupCode: vi.fn().mockReturnValue(-1),
  detectCodeType: vi.fn().mockReturnValue('totp'),
  formatTOTPCode: vi.fn().mockImplementation((code: string) => code),
}))

vi.mock('bcryptjs', () => ({
  default: { compare: (...args: unknown[]) => mockBcryptCompare(...args), hash: (...args: unknown[]) => mockBcryptHash(...args) },
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
  hash: (...args: unknown[]) => mockBcryptHash(...args),
}))

vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() } }))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))

const mockRedisGet = vi.fn()
const mockRedisSet = vi.fn()
const mockRedisDel = vi.fn()
vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({
    get: mockRedisGet,
    set: mockRedisSet,
    del: mockRedisDel,
  }),
}))

// globalThis.crypto.randomUUID() を固定値に
vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: () => 'test-setup-id',
})

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

describe('two-factor actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  })

  // ============================================================
  // setup2FA
  // ============================================================
  describe('setup2FA', async () => {
    it('requires auth', async () => {
      mockAuth.mockResolvedValue(null)
      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()
      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('returns qrCode, secret, setupId and backupCodes', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'test@example.com', twoFactorEnabled: false })
      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()
      expect(result).toEqual({
        success: true,
        data: {
          qrCode: 'data:image/png;base64,...',
          secret: 'secret123',
          setupId: 'test-setup-id',
          backupCodes: ['code1', 'code2', 'code3'],
        },
      })
    })

    it('rejects if 2FA already enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ email: 'test@example.com', twoFactorEnabled: true })
      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()
      expect(result).toMatchObject({ error: '2段階認証は既に有効です' })
    })

    it('handles user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()
      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })
  })

  // ============================================================
  // enable2FA
  // ============================================================
  describe('enable2FA', async () => {
    const pendingSetupJson = JSON.stringify({
      encryptedSecret: 'encrypted',
      hashedBackupCodes: ['hashed'],
    })

    it('requires auth', async () => {
      mockAuth.mockResolvedValue(null)
      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'setupId')
      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('enables 2FA with valid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ twoFactorEnabled: false })
      mockPrisma.user.update.mockResolvedValue({})
      mockRedisGet.mockResolvedValueOnce(pendingSetupJson)
      const { verifyTOTP } = await import('@/lib/two-factor')
      verifyTOTP.mockReturnValue(true)
      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'setupId')
      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalled()
      expect(mockRedisDel).toHaveBeenCalledWith('2fa_setup:u1:setupId')
    })

    it('rejects with invalid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ twoFactorEnabled: false })
      mockRedisGet.mockResolvedValueOnce(pendingSetupJson)
      const { verifyTOTP } = await import('@/lib/two-factor')
      verifyTOTP.mockReturnValue(false)
      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('000000', 'setupId')
      expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    })

    it('rejects if already enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ twoFactorEnabled: true })
      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'setupId')
      expect(result).toMatchObject({ error: '2段階認証は既に有効です' })
    })

    it('rejects if setup expired', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ twoFactorEnabled: false })
      mockRedisGet.mockResolvedValueOnce(null)
      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'expired')
      expect(result).toMatchObject({ error: expect.stringContaining('セットアップ情報') })
    })
  })

  // ============================================================
  // disable2FA
  // ============================================================
  describe('disable2FA', async () => {
    it('requires auth', async () => {
      mockAuth.mockResolvedValue(null)
      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password')
      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('disables with correct password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ password: 'hashed', twoFactorEnabled: true })
      mockPrisma.user.update.mockResolvedValue({})
      mockBcryptCompare.mockResolvedValue(true)
      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password')
      expect(result).toEqual({ success: true })
    })

    it('rejects with wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ password: 'hashed', twoFactorEnabled: true })
      mockBcryptCompare.mockResolvedValue(false)
      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('wrong')
      expect(result).toMatchObject({ error: 'パスワードが正しくありません' })
    })

    it('rejects if 2FA not enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ password: 'hashed', twoFactorEnabled: false })
      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password')
      expect(result).toMatchObject({ error: '2段階認証が有効ではありません' })
    })

    it('rejects if no password set', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ password: null, twoFactorEnabled: true })
      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password')
      expect(result).toMatchObject({ error: 'パスワードが設定されていません' })
    })
  })

  // ============================================================
  // verify2FAToken
  // ============================================================
  describe('verify2FAToken', async () => {
    it('verifies TOTP code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        twoFactorEnabled: true,
        twoFactorSecret: 'encrypted',
        twoFactorBackupCodes: [],
      })
      const { verifyTOTP, detectCodeType } = await import('@/lib/two-factor')
      detectCodeType.mockReturnValue('totp')
      verifyTOTP.mockReturnValue(true)
      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('u1@example.com', '123456')
      expect(result).toMatchObject({ success: true, data: { ticket: expect.any(String) } })
    })

    it('verifies backup code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        twoFactorEnabled: true,
        twoFactorSecret: 'encrypted',
        twoFactorBackupCodes: ['hashed1', 'hashed2'],
      })
      mockPrisma.user.update.mockResolvedValue({})
      const { detectCodeType, verifyBackupCode } = await import('@/lib/two-factor')
      detectCodeType.mockReturnValue('backup')
      verifyBackupCode.mockReturnValue(0)
      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('u1@example.com', 'backup-code')
      expect(result).toMatchObject({ success: true, data: { ticket: expect.any(String) } })
      expect(mockPrisma.user.update).toHaveBeenCalled()
    })

    it('rejects invalid TOTP code', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        twoFactorEnabled: true,
        twoFactorSecret: 'encrypted',
        twoFactorBackupCodes: [],
      })
      const { detectCodeType, verifyTOTP } = await import('@/lib/two-factor')
      detectCodeType.mockReturnValue('totp')
      verifyTOTP.mockReturnValue(false)
      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('u1@example.com', '000000')
      expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    })

    it('rejects invalid backup code with the unified generic error (enumeration-resistant)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        twoFactorEnabled: true,
        twoFactorSecret: 'encrypted',
        twoFactorBackupCodes: ['hashed1'],
      })
      const { detectCodeType, verifyBackupCode } = await import('@/lib/two-factor')
      detectCodeType.mockReturnValue('backup')
      verifyBackupCode.mockReturnValue(-1)
      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('u1@example.com', 'wrong-code')
      // Unified with TOTP/user-state failures so the code type can't be distinguished.
      expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    })

    // ユーザー列挙対策: 該当ユーザーなし / 2FA 未設定 / コード不一致を区別できないよう
    // verify2FAToken は全て同一の汎用エラー（ERR_2FA_INVALID_CODE）を返す。
    it('returns the generic invalid-code error when user not found (enumeration-safe)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('nonexistent@example.com', '123456')
      expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    })

    it('returns the generic invalid-code error when 2FA not enabled (enumeration-safe)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      })
      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('u1@example.com', '123456')
      expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    })
  })

  // ============================================================
  // regenerateBackupCodes
  // ============================================================
  describe('regenerateBackupCodes', async () => {
    it('requires auth', async () => {
      mockAuth.mockResolvedValue(null)
      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password')
      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('regenerates codes with correct password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ password: 'hashed', twoFactorEnabled: true })
      mockPrisma.user.update.mockResolvedValue({})
      mockBcryptCompare.mockResolvedValue(true)
      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password')
      expect(result).toEqual({ success: true, data: { backupCodes: ['code1', 'code2', 'code3'] } })
    })

    it('rejects wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ password: 'hashed', twoFactorEnabled: true })
      mockBcryptCompare.mockResolvedValue(false)
      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('wrong')
      expect(result).toMatchObject({ error: 'パスワードが正しくありません' })
    })

    it('rejects if 2FA not enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ password: 'hashed', twoFactorEnabled: false })
      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password')
      expect(result).toMatchObject({ error: '2段階認証が有効ではありません' })
    })
  })

  // ============================================================
  // get2FAStatus
  // ============================================================
  describe('get2FAStatus', async () => {
    it('requires auth', async () => {
      mockAuth.mockResolvedValue(null)
      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()
      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('returns enabled status with backup codes count', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        twoFactorEnabled: true,
        twoFactorBackupCodes: ['a', 'b', 'c'],
      })
      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()
      expect(result).toEqual({ success: true, data: { enabled: true, backupCodesRemaining: 3 } })
    })

    it('returns disabled status', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
      })
      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()
      expect(result).toEqual({ success: true, data: { enabled: false } })
    })

    it('handles user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)
      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()
      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })
  })

  // check2FARequired は撤去済み（verifyCredentials へ統合）。
})
