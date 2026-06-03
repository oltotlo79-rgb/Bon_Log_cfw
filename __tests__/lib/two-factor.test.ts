import { vi } from 'vitest'
/**
 * 2段階認証ユーティリティのテスト
 */

// otplibとqrcodeをモック
vi.mock('otplib', () => ({
  OTP: vi.fn().mockImplementation(function() { return {
    generateSecret: vi.fn().mockReturnValue('MOCKSECRET123456'),
    generateURI: vi.fn().mockImplementation(({ secret, issuer, label }: { secret: string; issuer: string; label: string }) =>
      `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`
    ),
    verify: vi.fn().mockImplementation(({ token }: { token: string }) => ({
      valid: token === '123456',
    })),
  } }),
}))

vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockedQRCode'),
}))

import {
  generateSecret,
  generateTOTPUri,
  generateQRCode,
  verifyTOTP,
  generateBackupCodes,
  hashBackupCode,
  verifyBackupCode,
  encryptSecret,
  decryptSecret,
  formatTOTPCode,
  formatBackupCode,
  detectCodeType,
} from '@/lib/two-factor'

// 環境変数のモック
const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('two-factor', () => {
  beforeAll(() => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterAll(() => {
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY
  })

  // ============================================================
  // generateSecret
  // ============================================================

  describe('generateSecret', () => {
    it('シークレットを生成する', () => {
      const secret = generateSecret()
      expect(secret).toBeDefined()
      expect(typeof secret).toBe('string')
      expect(secret.length).toBeGreaterThan(0)
    })

    it('文字列形式のシークレットを生成する', () => {
      const secret = generateSecret()
      expect(typeof secret).toBe('string')
      expect(secret.length).toBeGreaterThan(0)
    })
  })

  // ============================================================
  // generateTOTPUri
  // ============================================================

  describe('generateTOTPUri', () => {
    it('TOTP URIを生成する', () => {
      const secret = 'TESTSECRET123456'
      const email = 'test@example.com'
      const uri = generateTOTPUri(secret, email)

      expect(uri).toContain('otpauth://totp/')
      expect(uri).toContain('BON-LOG')
      expect(uri).toContain(email)
      expect(uri).toContain(`secret=${secret}`)
    })

    it('異なるメールアドレスで異なるURIを生成する', () => {
      const secret = 'TESTSECRET123456'
      const uri1 = generateTOTPUri(secret, 'user1@example.com')
      const uri2 = generateTOTPUri(secret, 'user2@example.com')

      expect(uri1).not.toBe(uri2)
    })
  })

  // ============================================================
  // generateQRCode
  // ============================================================

  describe('generateQRCode', () => {
    it('QRコードのData URLを生成する', async () => {
      const uri = 'otpauth://totp/BON-LOG:test@example.com?secret=TEST&issuer=BON-LOG'
      const qrCode = await generateQRCode(uri)

      expect(qrCode).toContain('data:image/png;base64,')
    })
  })

  // ============================================================
  // verifyTOTP
  // ============================================================

  describe('verifyTOTP', () => {
    it('6桁未満のコードはfalseを返す', async () => {
      const result = await verifyTOTP('12345', 'TESTSECRET')
      expect(result).toBe(false)
    })

    it('数字以外の文字を含むコードを正規化して検証する', async () => {
      // 実際の検証は時間ベースなのでモックが必要だが、
      // ここでは正規化のテストのみ
      const result = await verifyTOTP('abc123', 'TESTSECRET')
      expect(result).toBe(false) // 3桁しかないのでfalse
    })

    it('空のコードはfalseを返す', async () => {
      const result = await verifyTOTP('', 'TESTSECRET')
      expect(result).toBe(false)
    })

    it('有効なTOTPコードはtrueを返す（モック）', async () => {
      const result = await verifyTOTP('123456', 'TESTSECRET')
      expect(result).toBe(true)
    })
  })

  // ============================================================
  // generateBackupCodes
  // ============================================================

  describe('generateBackupCodes', () => {
    it('10個のバックアップコードを生成する', () => {
      const codes = generateBackupCodes()
      expect(codes).toHaveLength(10)
    })

    it('各コードは8文字', () => {
      const codes = generateBackupCodes()
      codes.forEach(code => {
        expect(code).toHaveLength(8)
      })
    })

    it('各コードは英数字のみ', () => {
      const codes = generateBackupCodes()
      codes.forEach(code => {
        expect(code).toMatch(/^[A-Z0-9]+$/)
      })
    })

    it('毎回異なるコードセットを生成する', () => {
      const codes1 = generateBackupCodes()
      const codes2 = generateBackupCodes()
      expect(codes1).not.toEqual(codes2)
    })

    it('同じセット内で重複しないコードを生成する', () => {
      const codes = generateBackupCodes()
      const uniqueCodes = new Set(codes)
      expect(uniqueCodes.size).toBe(codes.length)
    })
  })

  // ============================================================
  // hashBackupCode
  // ============================================================

  describe('hashBackupCode', () => {
    it('バックアップコードをハッシュ化する', () => {
      const code = 'ABCD1234'
      const hash = hashBackupCode(code)

      expect(hash).toBeDefined()
      expect(hash).toHaveLength(64) // SHA-256は64文字のhex
    })

    it('同じコードは同じハッシュを返す', () => {
      const code = 'ABCD1234'
      const hash1 = hashBackupCode(code)
      const hash2 = hashBackupCode(code)

      expect(hash1).toBe(hash2)
    })

    it('小文字を大文字に正規化してからハッシュ化する', () => {
      const hash1 = hashBackupCode('abcd1234')
      const hash2 = hashBackupCode('ABCD1234')

      expect(hash1).toBe(hash2)
    })

    it('特殊文字を除去してからハッシュ化する', () => {
      const hash1 = hashBackupCode('ABCD-1234')
      const hash2 = hashBackupCode('ABCD1234')

      expect(hash1).toBe(hash2)
    })
  })

  // ============================================================
  // verifyBackupCode
  // ============================================================

  describe('verifyBackupCode', () => {
    it('正しいコードのインデックスを返す', () => {
      const codes = ['CODE1111', 'CODE2222', 'CODE3333']
      const hashedCodes = codes.map(hashBackupCode)

      const index = verifyBackupCode('CODE2222', hashedCodes)
      expect(index).toBe(1)
    })

    it('存在しないコードは-1を返す', () => {
      const codes = ['CODE1111', 'CODE2222', 'CODE3333']
      const hashedCodes = codes.map(hashBackupCode)

      const index = verifyBackupCode('INVALID1', hashedCodes)
      expect(index).toBe(-1)
    })

    it('大文字小文字を区別しない', () => {
      const hashedCodes = [hashBackupCode('ABCD1234')]

      const index = verifyBackupCode('abcd1234', hashedCodes)
      expect(index).toBe(0)
    })

    it('空のハッシュ配列で-1を返す', () => {
      const index = verifyBackupCode('CODE1111', [])
      expect(index).toBe(-1)
    })
  })

  // ============================================================
  // encryptSecret / decryptSecret
  // ============================================================

  describe('encryptSecret / decryptSecret', () => {
    it('シークレットを暗号化して復号化できる', () => {
      const original = 'TESTSECRET123456'
      const encrypted = encryptSecret(original)
      const decrypted = decryptSecret(encrypted)

      expect(decrypted).toBe(original)
    })

    it('暗号化結果はBase64形式', () => {
      const secret = 'TESTSECRET123456'
      const encrypted = encryptSecret(secret)

      // Base64形式かどうかチェック
      expect(() => Buffer.from(encrypted, 'base64')).not.toThrow()
    })

    it('同じシークレットでも異なる暗号化結果を返す（IVがランダムなため）', () => {
      const secret = 'TESTSECRET123456'
      const encrypted1 = encryptSecret(secret)
      const encrypted2 = encryptSecret(secret)

      expect(encrypted1).not.toBe(encrypted2)
    })

    it('異なるシークレットは異なる暗号化結果を返す', () => {
      const encrypted1 = encryptSecret('SECRET1')
      const encrypted2 = encryptSecret('SECRET2')

      expect(encrypted1).not.toBe(encrypted2)
    })

    it('空文字列も暗号化・復号化できる', () => {
      const original = ''
      const encrypted = encryptSecret(original)
      const decrypted = decryptSecret(encrypted)

      expect(decrypted).toBe(original)
    })

    it('日本語文字列も暗号化・復号化できる', () => {
      const original = 'テスト文字列'
      const encrypted = encryptSecret(original)
      const decrypted = decryptSecret(encrypted)

      expect(decrypted).toBe(original)
    })

    it('TWO_FACTOR_KEY_VERSION が不正な値だと暗号化時に例外を投げる', () => {
      const original = process.env.TWO_FACTOR_KEY_VERSION
      process.env.TWO_FACTOR_KEY_VERSION = 'bad-version'
      try {
        expect(() => encryptSecret('SECRET')).toThrow(/TWO_FACTOR_KEY_VERSION/)
      } finally {
        if (original === undefined) delete process.env.TWO_FACTOR_KEY_VERSION
        else process.env.TWO_FACTOR_KEY_VERSION = original
      }
    })

    it('バージョン指定の鍵 (v2) が未設定なら復号時に例外を投げる', () => {
      // v2 プレフィックス付きの暗号文だが TWO_FACTOR_ENCRYPTION_KEY_v2 が無い状況
      const v2Key = process.env.TWO_FACTOR_ENCRYPTION_KEY_v2
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v2
      try {
        expect(() => decryptSecret('v2:AAAAAAAAAAAAAAAAAAAAAA==')).toThrow(/v2/)
      } finally {
        if (v2Key !== undefined) process.env.TWO_FACTOR_ENCRYPTION_KEY_v2 = v2Key
      }
    })
  })

  // ============================================================
  // formatTOTPCode
  // ============================================================

  describe('formatTOTPCode', () => {
    it('数字のみを抽出する', () => {
      expect(formatTOTPCode('123456')).toBe('123456')
    })

    it('スペースを除去する', () => {
      expect(formatTOTPCode('123 456')).toBe('123456')
    })

    it('ハイフンを除去する', () => {
      expect(formatTOTPCode('123-456')).toBe('123456')
    })

    it('文字を除去する', () => {
      expect(formatTOTPCode('abc123def456')).toBe('123456')
    })

    it('6桁に切り詰める', () => {
      expect(formatTOTPCode('12345678')).toBe('123456')
    })

    it('空文字列を処理する', () => {
      expect(formatTOTPCode('')).toBe('')
    })
  })

  // ============================================================
  // formatBackupCode
  // ============================================================

  describe('formatBackupCode', () => {
    it('大文字に変換する', () => {
      expect(formatBackupCode('abcd1234')).toBe('ABCD1234')
    })

    it('スペースを除去する', () => {
      expect(formatBackupCode('ABCD 1234')).toBe('ABCD1234')
    })

    it('ハイフンを除去する', () => {
      expect(formatBackupCode('ABCD-1234')).toBe('ABCD1234')
    })

    it('特殊文字を除去する', () => {
      expect(formatBackupCode('ABCD!@#$1234')).toBe('ABCD1234')
    })

    it('空文字列を処理する', () => {
      expect(formatBackupCode('')).toBe('')
    })
  })

  // ============================================================
  // detectCodeType
  // ============================================================

  describe('detectCodeType', () => {
    it('6桁の数字をTOTPと判定する', () => {
      expect(detectCodeType('123456')).toBe('totp')
    })

    it('スペース区切りの6桁数字をTOTPと判定する', () => {
      expect(detectCodeType('123 456')).toBe('totp')
    })

    it('8文字の英数字をバックアップコードと判定する', () => {
      expect(detectCodeType('ABCD1234')).toBe('backup')
    })

    it('5桁の数字をバックアップコードと判定する', () => {
      expect(detectCodeType('12345')).toBe('backup')
    })

    it('7桁の数字をバックアップコードと判定する', () => {
      expect(detectCodeType('1234567')).toBe('backup')
    })

    it('英字を含む6文字をバックアップコードと判定する', () => {
      expect(detectCodeType('12345A')).toBe('backup')
    })

    it('空文字列をバックアップコードと判定する', () => {
      expect(detectCodeType('')).toBe('backup')
    })
  })

  // ============================================================
  // 暗号化キーが未設定の場合
  // ============================================================

  describe('暗号化キーが未設定の場合', () => {
    const originalKey = process.env.TWO_FACTOR_ENCRYPTION_KEY

    beforeEach(() => {
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY
    })

    afterEach(() => {
      process.env.TWO_FACTOR_ENCRYPTION_KEY = originalKey
    })

    it('encryptSecretがエラーをスローする', () => {
      // 鍵バージョン管理導入後はバージョン名が含まれる
      expect(() => encryptSecret('test')).toThrow(/TWO_FACTOR_ENCRYPTION_KEY .*is not configured/)
    })

    it('decryptSecretがエラーをスローする', () => {
      expect(() => decryptSecret('dGVzdA==')).toThrow(/TWO_FACTOR_ENCRYPTION_KEY .*is not configured/)
    })
  })

  // ============================================================
  // 鍵バージョン管理（無停止ローテーション対応）
  // ============================================================

  describe('鍵バージョン管理', () => {
    const KEY_V1 = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    const KEY_V2 = 'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210'

    beforeEach(() => {
      // 直前の describe（暗号化キーが未設定）で削除された状態で入ってくる場合があるため再注入
      process.env.TWO_FACTOR_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
      delete process.env.TWO_FACTOR_KEY_VERSION
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v1
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v2
    })

    afterEach(() => {
      delete process.env.TWO_FACTOR_KEY_VERSION
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v1
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v2
      process.env.TWO_FACTOR_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
    })

    it('暗号文に "v1:" バージョンプレフィックスが付与される', () => {
      const encrypted = encryptSecret('SECRET')
      expect(encrypted).toMatch(/^v1:/)
    })

    it('プレフィックスなし旧形式でも復号できる（後方互換）', () => {
      const encrypted = encryptSecret('SECRET')
      // プレフィックスを除去して旧形式をシミュレート
      const legacyFormat = encrypted.replace(/^v1:/, '')
      const decrypted = decryptSecret(legacyFormat)
      expect(decrypted).toBe('SECRET')
    })

    it('v2 鍵への切り替え後は v2 プレフィックスで暗号化される', () => {
      process.env.TWO_FACTOR_ENCRYPTION_KEY_v1 = KEY_V1
      process.env.TWO_FACTOR_ENCRYPTION_KEY_v2 = KEY_V2
      process.env.TWO_FACTOR_KEY_VERSION = 'v2'

      const encrypted = encryptSecret('SECRET')
      expect(encrypted).toMatch(/^v2:/)
      expect(decryptSecret(encrypted)).toBe('SECRET')
    })

    it('v1 で暗号化した文字列を v2 に切り替え後も復号できる（無停止移行）', () => {
      // v1 で暗号化
      process.env.TWO_FACTOR_ENCRYPTION_KEY_v1 = KEY_V1
      process.env.TWO_FACTOR_KEY_VERSION = 'v1'
      const encryptedV1 = encryptSecret('SECRET')

      // v2 へ切替
      process.env.TWO_FACTOR_ENCRYPTION_KEY_v2 = KEY_V2
      process.env.TWO_FACTOR_KEY_VERSION = 'v2'

      // v1 暗号文も復号できる
      expect(decryptSecret(encryptedV1)).toBe('SECRET')
    })

    it('migrateToCurrentKeyVersion: 旧バージョン暗号文を現行鍵で再暗号化する', async () => {
      const { migrateToCurrentKeyVersion } = await import('@/lib/two-factor')
      process.env.TWO_FACTOR_ENCRYPTION_KEY_v1 = KEY_V1
      process.env.TWO_FACTOR_KEY_VERSION = 'v1'
      const encryptedV1 = encryptSecret('SECRET')

      process.env.TWO_FACTOR_ENCRYPTION_KEY_v2 = KEY_V2
      process.env.TWO_FACTOR_KEY_VERSION = 'v2'

      const migrated = migrateToCurrentKeyVersion(encryptedV1)
      expect(migrated).not.toBeNull()
      expect(migrated).toMatch(/^v2:/)
      expect(decryptSecret(migrated as string)).toBe('SECRET')
    })

    it('migrateToCurrentKeyVersion: 現行バージョンと一致する場合は null を返す', async () => {
      const { migrateToCurrentKeyVersion } = await import('@/lib/two-factor')
      const encrypted = encryptSecret('SECRET')

      expect(migrateToCurrentKeyVersion(encrypted)).toBeNull()
    })
  })
})
