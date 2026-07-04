// @vitest-environment node
/**
 * lib/services/two-factor-service のユニットテスト
 *
 * setup2FAForUser / enable2FAForUser / disable2FAForUser /
 * regenerateBackupCodesForUser / get2FAStatusForUser の
 * 正常系・エラー分岐（不正コード・期限切れ setupId・誤パスワード）を検証する。
 * Web の lib/actions/two-factor.ts はこのサービスに委譲するため、
 * 呼び出し元（Web action / v1 route）の薄いラッパはそれぞれ別テストで検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockUserFindUnique = vi.fn()
const mockUserUpdate = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
    },
  },
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

const mockGenerateSecret = vi.fn()
const mockGenerateTOTPUri = vi.fn()
const mockGenerateQRCode = vi.fn()
const mockVerifyTOTP = vi.fn()
const mockGenerateBackupCodes = vi.fn()
const mockHashBackupCode = vi.fn()
const mockEncryptSecret = vi.fn()
const mockDecryptSecret = vi.fn()
vi.mock('@/lib/two-factor', () => ({
  generateSecret: () => mockGenerateSecret(),
  generateTOTPUri: (secret: string, email: string) => mockGenerateTOTPUri(secret, email),
  generateQRCode: (uri: string) => mockGenerateQRCode(uri),
  verifyTOTP: (token: string, secret: string) => mockVerifyTOTP(token, secret),
  generateBackupCodes: () => mockGenerateBackupCodes(),
  hashBackupCode: (code: string) => mockHashBackupCode(code),
  encryptSecret: (secret: string) => mockEncryptSecret(secret),
  decryptSecret: (encrypted: string) => mockDecryptSecret(encrypted),
}))

vi.mock('bcryptjs', () => ({
  default: { compare: vi.fn() },
  compare: vi.fn(),
}))

vi.stubGlobal('crypto', {
  ...globalThis.crypto,
  randomUUID: () => 'test-setup-id',
})

import bcrypt from 'bcryptjs'

describe('setup2FAForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateSecret.mockReturnValue('TESTSECRET123456')
    mockGenerateTOTPUri.mockReturnValue('otpauth://totp/BON-LOG:test@example.com?secret=TESTSECRET123456')
    mockGenerateQRCode.mockResolvedValue('data:image/png;base64,mockQRCode')
    mockGenerateBackupCodes.mockReturnValue(['CODE1', 'CODE2'])
    mockEncryptSecret.mockReturnValue('encryptedSecret')
    mockHashBackupCode.mockImplementation((code: string) => `hash_${code}`)
  })

  it('ユーザーが見つからない場合 ok:false + ERR_USER_NOT_FOUND を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { setup2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await setup2FAForUser('user-123')

    expect(result).toMatchObject({ ok: false, error: 'ユーザーが見つかりません' })
  })

  it('既に2FAが有効な場合 ok:false + ERR_2FA_ALREADY_ENABLED を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ email: 'test@example.com', twoFactorEnabled: true })

    const { setup2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await setup2FAForUser('user-123')

    expect(result).toMatchObject({ ok: false, error: '2段階認証は既に有効です' })
  })

  it('正常系: セットアップ情報を返し Redis に一時保存する', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ email: 'test@example.com', twoFactorEnabled: false })

    const { setup2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await setup2FAForUser('user-123')

    expect(result).toMatchObject({
      ok: true,
      qrCode: 'data:image/png;base64,mockQRCode',
      otpAuthUrl: 'otpauth://totp/BON-LOG:test@example.com?secret=TESTSECRET123456',
      secret: 'TESTSECRET123456',
      setupId: 'test-setup-id',
      backupCodes: ['CODE1', 'CODE2'],
    })
    expect(mockRedisSet).toHaveBeenCalledWith(
      '2fa_setup:user-123:test-setup-id',
      expect.stringContaining('encryptedSecret'),
      expect.objectContaining({ ex: expect.any(Number) }),
    )
  })
})

describe('enable2FAForUser', () => {
  const pendingSetup = {
    encryptedSecret: 'encryptedSecret',
    hashedBackupCodes: ['hash_CODE1', 'hash_CODE2'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyTOTP.mockResolvedValue(true)
    mockDecryptSecret.mockReturnValue('decryptedSecret')
    mockRedisGet.mockResolvedValue(JSON.stringify(pendingSetup))
  })

  it('ユーザーが見つからない場合 ok:false + ERR_USER_NOT_FOUND', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { enable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await enable2FAForUser('user-123', '123456', 'setup-id')

    expect(result).toMatchObject({ ok: false, error: 'ユーザーが見つかりません' })
  })

  it('既に2FAが有効な場合 ok:false + ERR_2FA_ALREADY_ENABLED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ twoFactorEnabled: true })

    const { enable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await enable2FAForUser('user-123', '123456', 'setup-id')

    expect(result).toMatchObject({ ok: false, error: '2段階認証は既に有効です' })
  })

  it('setupId が Redis に存在しない（期限切れ）場合 ok:false + ERR_2FA_SETUP_EXPIRED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
    mockRedisGet.mockResolvedValueOnce(null)

    const { enable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await enable2FAForUser('user-123', '123456', 'expired-setup')

    expect(result).toMatchObject({ ok: false, error: '2段階認証のセットアップ情報が見つからないか期限切れです。最初からやり直してください' })
  })

  it('Redis の JSON が不正な形状（zod 検証失敗）の場合 ok:false + ERR_2FA_SETUP_EXPIRED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
    mockRedisGet.mockResolvedValueOnce(JSON.stringify({ unexpected: 'shape' }))

    const { enable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await enable2FAForUser('user-123', '123456', 'setup-id')

    expect(result).toMatchObject({ ok: false, error: '2段階認証のセットアップ情報が見つからないか期限切れです。最初からやり直してください' })
  })

  it('Redis の値が JSON として不正な場合も ok:false + ERR_2FA_SETUP_EXPIRED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
    mockRedisGet.mockResolvedValueOnce('not-json{')

    const { enable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await enable2FAForUser('user-123', '123456', 'setup-id')

    expect(result).toMatchObject({ ok: false, error: '2段階認証のセットアップ情報が見つからないか期限切れです。最初からやり直してください' })
  })

  it('無効なTOTPコードの場合 ok:false + ERR_2FA_INVALID_CODE', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
    mockVerifyTOTP.mockResolvedValueOnce(false)

    const { enable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await enable2FAForUser('user-123', '000000', 'setup-id')

    expect(result).toMatchObject({ ok: false, error: '認証コードが正しくありません' })
  })

  it('正常系: 2FAを有効化し Redis の一時データを削除する（リプレイ防止）', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ twoFactorEnabled: false })
    mockUserUpdate.mockResolvedValueOnce({})

    const { enable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await enable2FAForUser('user-123', '123456', 'setup-id')

    expect(result).toEqual({ ok: true })
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: 'encryptedSecret',
        twoFactorBackupCodes: ['hash_CODE1', 'hash_CODE2'],
      },
    })
    expect(mockRedisDel).toHaveBeenCalledWith('2fa_setup:user-123:setup-id')
  })
})

describe('disable2FAForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ユーザーが見つからない場合 ok:false + ERR_USER_NOT_FOUND', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { disable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await disable2FAForUser('user-123', 'password123')

    expect(result).toMatchObject({ ok: false, error: 'ユーザーが見つかりません' })
  })

  it('2FAが有効でない場合 ok:false + ERR_2FA_NOT_ENABLED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: 'hashedPassword', twoFactorEnabled: false })

    const { disable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await disable2FAForUser('user-123', 'password123')

    expect(result).toMatchObject({ ok: false, error: '2段階認証が有効ではありません' })
  })

  it('パスワード未設定（OAuth専用アカウント）の場合 ok:false + ERR_NO_PASSWORD_SET', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: null, twoFactorEnabled: true })

    const { disable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await disable2FAForUser('user-123', 'password123')

    expect(result).toMatchObject({ ok: false, error: 'パスワードが設定されていません' })
  })

  it('パスワードが間違っている場合 ok:false + ERR_INCORRECT_PASSWORD', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: 'hashedPassword', twoFactorEnabled: true })
    ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false)

    const { disable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await disable2FAForUser('user-123', 'wrongPassword')

    expect(result).toMatchObject({ ok: false, error: 'パスワードが正しくありません' })
  })

  it('正常系: 2FAを無効化する', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: 'hashedPassword', twoFactorEnabled: true })
    ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    mockUserUpdate.mockResolvedValueOnce({})

    const { disable2FAForUser } = await import('@/lib/services/two-factor-service')
    const result = await disable2FAForUser('user-123', 'password123')

    expect(result).toEqual({ ok: true })
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
    })
  })
})

describe('regenerateBackupCodesForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateBackupCodes.mockReturnValue(['NEW1', 'NEW2'])
    mockHashBackupCode.mockImplementation((code: string) => `hash_${code}`)
  })

  it('2FAが有効でない場合 ok:false + ERR_2FA_NOT_ENABLED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: 'hashedPassword', twoFactorEnabled: false })

    const { regenerateBackupCodesForUser } = await import('@/lib/services/two-factor-service')
    const result = await regenerateBackupCodesForUser('user-123', 'password123')

    expect(result).toMatchObject({ ok: false, error: '2段階認証が有効ではありません' })
  })

  it('正常系: 新しいバックアップコードを返し DB を更新する', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ password: 'hashedPassword', twoFactorEnabled: true })
    ;(bcrypt.compare as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    mockUserUpdate.mockResolvedValueOnce({})

    const { regenerateBackupCodesForUser } = await import('@/lib/services/two-factor-service')
    const result = await regenerateBackupCodesForUser('user-123', 'password123')

    expect(result).toEqual({ ok: true, backupCodes: ['NEW1', 'NEW2'] })
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user-123' },
      data: { twoFactorBackupCodes: ['hash_NEW1', 'hash_NEW2'] },
    })
  })
})

describe('get2FAStatusForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ユーザーが見つからない場合 ok:false + ERR_USER_NOT_FOUND', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { get2FAStatusForUser } = await import('@/lib/services/two-factor-service')
    const result = await get2FAStatusForUser('user-123')

    expect(result).toMatchObject({ ok: false, error: 'ユーザーが見つかりません' })
  })

  it('2FAが有効な場合 enabled:true と残りバックアップコード数を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      twoFactorEnabled: true,
      twoFactorBackupCodes: ['hash1', 'hash2', 'hash3'],
    })

    const { get2FAStatusForUser } = await import('@/lib/services/two-factor-service')
    const result = await get2FAStatusForUser('user-123')

    expect(result).toEqual({ ok: true, enabled: true, backupCodesRemaining: 3 })
  })

  it('2FAが無効な場合 enabled:false を返す（backupCodesRemaining は含まない）', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ twoFactorEnabled: false, twoFactorBackupCodes: [] })

    const { get2FAStatusForUser } = await import('@/lib/services/two-factor-service')
    const result = await get2FAStatusForUser('user-123')

    expect(result).toEqual({ ok: true, enabled: false })
  })
})
