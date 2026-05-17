import { vi } from 'vitest'
/**
 * 2段階認証Server Actionsのテスト
 */

// モック設定
const mockAuth = vi.fn()
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

const mockRedisGet = vi.fn()
const mockRedisSet = vi.fn()
const mockRedisDel = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// requireActiveNonGuestUser を mock：内部の DB suspension チェックを回避
// （テスト側で mockAuth が null を返すと error path、ユーザーオブジェクトを
// 返すと success path となるよう自動でブリッジする）
vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/utils')>('@/lib/actions/utils')
  return {
    ...actual,
    requireActiveNonGuestUser: async () => {
      const session = await mockAuth()
      if (!session?.user?.id) return { error: '認証が必要です' }
      return { userId: session.user.id }
    },
  }
})

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

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

// レート制限モック
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))

// headersモック
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

// loggerモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}))

// bcryptのモック
vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
  compare: vi.fn(),
}))

// two-factorユーティリティのモック
const mockGenerateSecret = vi.fn()
const mockGenerateTOTPUri = vi.fn()
const mockGenerateQRCode = vi.fn()
const mockVerifyTOTP = vi.fn()
const mockGenerateBackupCodes = vi.fn()
const mockHashBackupCode = vi.fn()
const mockVerifyBackupCode = vi.fn()
const mockEncryptSecret = vi.fn()
const mockDecryptSecret = vi.fn()
const mockDetectCodeType = vi.fn()
const mockFormatTOTPCode = vi.fn()

vi.mock('@/lib/two-factor', () => ({
  generateSecret: () => mockGenerateSecret(),
  generateTOTPUri: (secret: string, email: string) => mockGenerateTOTPUri(secret, email),
  generateQRCode: (uri: string) => mockGenerateQRCode(uri),
  verifyTOTP: (token: string, secret: string) => mockVerifyTOTP(token, secret),
  generateBackupCodes: () => mockGenerateBackupCodes(),
  hashBackupCode: (code: string) => mockHashBackupCode(code),
  verifyBackupCode: (code: string, hashes: string[]) => mockVerifyBackupCode(code, hashes),
  encryptSecret: (secret: string) => mockEncryptSecret(secret),
  decryptSecret: (encrypted: string) => mockDecryptSecret(encrypted),
  detectCodeType: (code: string) => mockDetectCodeType(code),
  formatTOTPCode: (code: string) => mockFormatTOTPCode(code),
}))

import bcrypt from 'bcryptjs'

describe('Two-Factor Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // デフォルトで認証済みユーザーを設定
    mockAuth.mockResolvedValue({ user: { id: 'user-123', email: 'test@example.com' } })
  })

  // ============================================================
  // setup2FA
  // ============================================================

  describe('setup2FA', async () => {
    beforeEach(() => {
      mockGenerateSecret.mockReturnValue('TESTSECRET123456')
      mockGenerateTOTPUri.mockReturnValue('otpauth://totp/BON-LOG:test@example.com?secret=TESTSECRET123456')
      mockGenerateQRCode.mockResolvedValue('data:image/png;base64,mockQRCode')
      mockGenerateBackupCodes.mockReturnValue(['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6', 'CODE7', 'CODE8', 'CODE9', 'CODE10'])
    })

    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('既に2FAが有効な場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: 'test@example.com',
        twoFactorEnabled: true,
      })

      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()

      expect(result).toMatchObject({ error: '2段階認証は既に有効です' })
    })

    it('セットアップ情報を正常に返し Redis に一時保存する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        email: 'test@example.com',
        twoFactorEnabled: false,
      })
      mockEncryptSecret.mockReturnValue('encryptedSecret')
      mockHashBackupCode.mockImplementation((code: string) => `hash_${code}`)

      const { setup2FA } = await import('@/lib/actions/two-factor')
      const result = await setup2FA()

      expect(result).toEqual({
        success: true,
        data: {
          qrCode: 'data:image/png;base64,mockQRCode',
          secret: 'TESTSECRET123456',
          setupId: 'test-setup-id',
          backupCodes: expect.arrayContaining(['CODE1', 'CODE2']),
        },
      })
      expect(mockGenerateSecret).toHaveBeenCalled()
      expect(mockGenerateTOTPUri).toHaveBeenCalledWith('TESTSECRET123456', 'test@example.com')
      expect(mockGenerateQRCode).toHaveBeenCalled()
      expect(mockGenerateBackupCodes).toHaveBeenCalled()
      expect(mockRedisSet).toHaveBeenCalledWith(
        '2fa_setup:user-123:test-setup-id',
        expect.stringContaining('encryptedSecret'),
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })
  })

  // ============================================================
  // enable2FA
  // ============================================================

  describe('enable2FA', async () => {
    const pendingSetup = {
      encryptedSecret: 'encryptedSecret',
      hashedBackupCodes: ['hash_CODE1', 'hash_CODE2'],
    }

    beforeEach(() => {
      mockVerifyTOTP.mockResolvedValue(true)
      mockDecryptSecret.mockReturnValue('decryptedSecret')
      mockRedisGet.mockResolvedValue(JSON.stringify(pendingSetup))
    })

    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'setupId')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'setupId')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('既に2FAが有効な場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ twoFactorEnabled: true })

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'setupId')

      expect(result).toMatchObject({ error: '2段階認証は既に有効です' })
    })

    it('setupIdがRedisに存在しない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
      mockRedisGet.mockResolvedValueOnce(null)

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'missing-setup')

      expect(result).toMatchObject({ error: expect.stringContaining('セットアップ情報') })
    })

    it('無効なTOTPコードの場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
      mockVerifyTOTP.mockResolvedValueOnce(false)

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('000000', 'setupId')

      expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    })

    it('正常に2FAを有効化し Redis を削除する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { enable2FA } = await import('@/lib/actions/two-factor')
      const result = await enable2FA('123456', 'setupId')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          twoFactorEnabled: true,
          twoFactorSecret: 'encryptedSecret',
          twoFactorBackupCodes: ['hash_CODE1', 'hash_CODE2'],
        },
      })
      expect(mockRedisDel).toHaveBeenCalledWith('2fa_setup:user-123:setupId')
    })
  })

  // ============================================================
  // disable2FA
  // ============================================================

  describe('disable2FA', async () => {
    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('2FAが有効でない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: false,
      })

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toMatchObject({ error: '2段階認証が有効ではありません' })
    })

    it('パスワードが設定されていない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: null,
        twoFactorEnabled: true,
      })

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toMatchObject({ error: 'パスワードが設定されていません' })
    })

    it('パスワードが間違っている場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: true,
      })
      ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false)

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('wrongPassword')

      expect(result).toMatchObject({ error: 'パスワードが正しくありません' })
    })

    it('正常に2FAを無効化する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: true,
      })
      ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { disable2FA } = await import('@/lib/actions/two-factor')
      const result = await disable2FA('password123')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
        },
      })
    })
  })

  // ============================================================
  // verify2FAToken
  // ============================================================

  describe('verify2FAToken', async () => {
    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user@example.com', '123456')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('2FAが有効でない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorBackupCodes: [],
      })

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user@example.com', '123456')

      expect(result).toMatchObject({ error: '2段階認証が有効ではありません' })
    })

    it('TOTPコードで正常に検証する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        twoFactorEnabled: true,
        twoFactorSecret: 'encryptedSecret',
        twoFactorBackupCodes: [],
      })
      mockDetectCodeType.mockReturnValue('totp')
      mockDecryptSecret.mockReturnValue('decryptedSecret')
      mockFormatTOTPCode.mockReturnValue('123456')
      mockVerifyTOTP.mockResolvedValue(true)

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user@example.com', '123456')

      expect(result).toEqual({ success: true })
    })

    it('無効なTOTPコードの場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        twoFactorEnabled: true,
        twoFactorSecret: 'encryptedSecret',
        twoFactorBackupCodes: [],
      })
      mockDetectCodeType.mockReturnValue('totp')
      mockDecryptSecret.mockReturnValue('decryptedSecret')
      mockFormatTOTPCode.mockReturnValue('000000')
      mockVerifyTOTP.mockResolvedValue(false)

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user@example.com', '000000')

      expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    })

    it('バックアップコードで正常に検証する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        twoFactorEnabled: true,
        twoFactorSecret: 'encryptedSecret',
        twoFactorBackupCodes: ['hash1', 'hash2', 'hash3'],
      })
      mockDetectCodeType.mockReturnValue('backup')
      mockVerifyBackupCode.mockReturnValue(1)
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user@example.com', 'BACKUPCODE')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { twoFactorBackupCodes: ['hash1', 'hash3'] },
      })
    })

    it('無効なバックアップコードの場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        twoFactorEnabled: true,
        twoFactorSecret: 'encryptedSecret',
        twoFactorBackupCodes: ['hash1', 'hash2'],
      })
      mockDetectCodeType.mockReturnValue('backup')
      mockVerifyBackupCode.mockReturnValue(-1)

      const { verify2FAToken } = await import('@/lib/actions/two-factor')
      const result = await verify2FAToken('user@example.com', 'INVALIDCODE')

      expect(result).toMatchObject({ error: 'バックアップコードが正しくありません' })
    })
  })

  // ============================================================
  // regenerateBackupCodes
  // ============================================================

  describe('regenerateBackupCodes', async () => {
    beforeEach(() => {
      mockGenerateBackupCodes.mockReturnValue(['NEW1', 'NEW2', 'NEW3', 'NEW4', 'NEW5', 'NEW6', 'NEW7', 'NEW8', 'NEW9', 'NEW10'])
      mockHashBackupCode.mockImplementation((code: string) => `hash_${code}`)
    })

    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('2FAが有効でない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: false,
      })

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toMatchObject({ error: '2段階認証が有効ではありません' })
    })

    it('パスワードが設定されていない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: null,
        twoFactorEnabled: true,
      })

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toMatchObject({ error: 'パスワードが設定されていません' })
    })

    it('パスワードが間違っている場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: true,
      })
      ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false)

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('wrongPassword')

      expect(result).toMatchObject({ error: 'パスワードが正しくありません' })
    })

    it('正常にバックアップコードを再生成する', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        password: 'hashedPassword',
        twoFactorEnabled: true,
      })
      ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { regenerateBackupCodes } = await import('@/lib/actions/two-factor')
      const result = await regenerateBackupCodes('password123')

      expect(result).toEqual({
        success: true,
        data: {
          backupCodes: expect.arrayContaining(['NEW1', 'NEW2']),
        },
      })
    })
  })

  // ============================================================
  // get2FAStatus
  // ============================================================

  describe('get2FAStatus', async () => {
    it('認証されていない場合はエラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ユーザーが見つからない場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('2FAが有効な場合は状態と残りコード数を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        twoFactorEnabled: true,
        twoFactorBackupCodes: ['hash1', 'hash2', 'hash3', 'hash4', 'hash5'],
      })

      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()

      expect(result).toEqual({
        success: true,
        data: {
          enabled: true,
          backupCodesRemaining: 5,
        },
      })
    })

    it('2FAが無効な場合は無効状態を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        twoFactorEnabled: false,
        twoFactorBackupCodes: [],
      })

      const { get2FAStatus } = await import('@/lib/actions/two-factor')
      const result = await get2FAStatus()

      expect(result).toEqual({ success: true, data: { enabled: false } })
    })
  })

  // ============================================================
  // check2FARequired
  // ============================================================

  describe('check2FARequired', async () => {
    it('ユーザーが存在しない場合はrequired: falseを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { check2FARequired } = await import('@/lib/actions/two-factor')
      const result = await check2FARequired('nonexistent@example.com')

      expect(result).toEqual({ required: false })
    })

    it('2FAが有効な場合はrequired: trueを返す（userIdは漏洩防止のため返さない）', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        twoFactorEnabled: true,
      })

      const { check2FARequired } = await import('@/lib/actions/two-factor')
      const result = await check2FARequired('user@example.com')

      expect(result).toEqual({
        required: true,
      })
    })

    it('2FAが無効な場合はrequired: falseを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user-123',
        twoFactorEnabled: false,
      })

      const { check2FARequired } = await import('@/lib/actions/two-factor')
      const result = await check2FARequired('user@example.com')

      expect(result).toEqual({ required: false })
    })
  })
})
