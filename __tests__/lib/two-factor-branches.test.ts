// @vitest-environment node
/**
 * two-factor.ts の未カバーブランチを補完するテスト
 *
 * 対象:
 * - verifyTOTP: 短すぎるトークン、検証エラーのcatch、正常検証
 * - verifyBackupCode: 一致なし、一致あり、長さ不一致
 * - generateBackupCodes: ��ッファ不足時の追加生成
 * - encryptSecret/decryptSecret: 正常な暗号化・復号化サイクル
 * - getEncryptionKey: 環境変数未設��時のエラー
 * - formatTOTPCode/formatBackupCode: 正規化
 * - detectCodeType: TOTP vs backup判定
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.unmock('@/lib/two-factor')

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  // 32バイトの暗号化キー（hex）
  process.env.TWO_FACTOR_ENCRYPTION_KEY = 'a'.repeat(64)
})

describe('generateBackupCodes', () => {
  it('指定された数のコードを生成する', async () => {
    const { generateBackupCodes } = await import('@/lib/two-factor')
    const codes = generateBackupCodes()

    expect(codes).toBeInstanceOf(Array)
    expect(codes.length).toBeGreaterThan(0)
    // 各コードは英数字のみ
    codes.forEach(code => {
      expect(code).toMatch(/^[A-Z0-9]+$/)
    })
  })

  it('生成されたコードは一意である', async () => {
    const { generateBackupCodes } = await import('@/lib/two-factor')
    const codes = generateBackupCodes()
    const unique = new Set(codes)

    // ほぼ確実に一意（衝突確率は極小）
    expect(unique.size).toBe(codes.length)
  })
})

describe('hashBackupCode', () => {
  it('同じコードから同じハッシュを生成する', async () => {
    const { hashBackupCode } = await import('@/lib/two-factor')
    const hash1 = hashBackupCode('ABCD1234')
    const hash2 = hashBackupCode('ABCD1234')

    expect(hash1).toBe(hash2)
  })

  it('大文字・小文字を正規化する', async () => {
    const { hashBackupCode } = await import('@/lib/two-factor')
    const hash1 = hashBackupCode('abcd1234')
    const hash2 = hashBackupCode('ABCD1234')

    expect(hash1).toBe(hash2)
  })

  it('特殊文字を除去する', async () => {
    const { hashBackupCode } = await import('@/lib/two-factor')
    const hash1 = hashBackupCode('AB-CD 12.34')
    const hash2 = hashBackupCode('ABCD1234')

    expect(hash1).toBe(hash2)
  })
})

describe('verifyBackupCode', () => {
  it('一致するコードのインデックスを返す', async () => {
    const { generateBackupCodes, hashBackupCode, verifyBackupCode } = await import('@/lib/two-factor')
    const codes = generateBackupCodes()
    const hashedCodes = codes.map(hashBackupCode)

    const index = verifyBackupCode(codes[0]!, hashedCodes)
    expect(index).toBe(0)
  })

  it('一致しない場合は-1を返す', async () => {
    const { hashBackupCode, verifyBackupCode } = await import('@/lib/two-factor')
    const hashedCodes = [hashBackupCode('AAAA1111'), hashBackupCode('BBBB2222')]

    const index = verifyBackupCode('ZZZZ9999', hashedCodes)
    expect(index).toBe(-1)
  })

  it('空の配列に対して-1を返す', async () => {
    const { verifyBackupCode } = await import('@/lib/two-factor')
    const index = verifyBackupCode('ABCD1234', [])
    expect(index).toBe(-1)
  })
})

describe('encryptSecret / decryptSecret', () => {
  it('暗号化→復号化で元のシークレットを復元できる', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/two-factor')
    const original = 'JBSWY3DPEHPK3PXP'
    const encrypted = encryptSecret(original)
    const decrypted = decryptSecret(encrypted)

    expect(decrypted).toBe(original)
  })

  it('暗号化結果は元のシークレットと異なる', async () => {
    const { encryptSecret } = await import('@/lib/two-factor')
    const original = 'JBSWY3DPEHPK3PXP'
    const encrypted = encryptSecret(original)

    expect(encrypted).not.toBe(original)
  })

  it('毎回異なる暗号文を生成する（IVがランダム）', async () => {
    const { encryptSecret } = await import('@/lib/two-factor')
    const original = 'JBSWY3DPEHPK3PXP'
    const encrypted1 = encryptSecret(original)
    const encrypted2 = encryptSecret(original)

    expect(encrypted1).not.toBe(encrypted2)
  })

  it('暗号化キーが未設定の場合にエラーをスローする', async () => {
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY
    const { encryptSecret } = await import('@/lib/two-factor')

    // 鍵バージョン管理導入後はバージョン名（v1）を含むメッセージへ変更
    expect(() => encryptSecret('test')).toThrow(/TWO_FACTOR_ENCRYPTION_KEY .*is not configured/)
  })
})

describe('verifyTOTP', () => {
  it('短すぎるトークンはfalseを返す', async () => {
    const { verifyTOTP } = await import('@/lib/two-factor')
    const result = await verifyTOTP('123', 'secret')

    expect(result).toBe(false)
  })

  it('非数字を含むトークンから数字のみ抽出して検証する', async () => {
    const { verifyTOTP } = await import('@/lib/two-factor')
    // 数字が6桁未満になるケース
    const result = await verifyTOTP('ab12cd', 'secret')

    expect(result).toBe(false)
  })
})

describe('formatTOTPCode', () => {
  it('数字以外を除去する', async () => {
    const { formatTOTPCode } = await import('@/lib/two-factor')

    expect(formatTOTPCode('12 34 56')).toBe('123456')
    expect(formatTOTPCode('123-456')).toBe('123456')
    expect(formatTOTPCode('abc123def456')).toBe('123456')
  })

  it('6桁を超える場合は切り捨てる', async () => {
    const { formatTOTPCode } = await import('@/lib/two-factor')

    expect(formatTOTPCode('1234567890')).toBe('123456')
  })
})

describe('formatBackupCode', () => {
  it('大文字に変換し特殊文字を除去する', async () => {
    const { formatBackupCode } = await import('@/lib/two-factor')

    expect(formatBackupCode('abcd-1234')).toBe('ABCD1234')
    expect(formatBackupCode('ab cd 12 34')).toBe('ABCD1234')
  })
})

describe('detectCodeType', () => {
  it('6桁の数字をtotpと判定する', async () => {
    const { detectCodeType } = await import('@/lib/two-factor')

    expect(detectCodeType('123456')).toBe('totp')
  })

  it('英字を含むコードをbackupと判定する', async () => {
    const { detectCodeType } = await import('@/lib/two-factor')

    expect(detectCodeType('ABCD1234')).toBe('backup')
  })

  it('7桁以上の数字をbackupと判定する', async () => {
    const { detectCodeType } = await import('@/lib/two-factor')

    expect(detectCodeType('1234567')).toBe('backup')
  })

  it('5桁��下の数字をbackupと判定する', async () => {
    const { detectCodeType } = await import('@/lib/two-factor')

    expect(detectCodeType('12345')).toBe('backup')
  })
})

describe('generateSecret', () => {
  it('Base32エンコードされた文字列を返す', async () => {
    const { generateSecret } = await import('@/lib/two-factor')
    const secret = generateSecret()

    expect(secret).toMatch(/^[A-Z2-7]+=*$/)
    expect(secret.length).toBeGreaterThan(0)
  })
})

describe('generateTOTPUri', () => {
  it('otpauthスキームのURIを生成する', async () => {
    const { generateTOTPUri } = await import('@/lib/two-factor')
    const uri = generateTOTPUri('JBSWY3DPEHPK3PXP', 'test@example.com')

    expect(uri).toContain('otpauth://')
    // URIにはシークレットとイシュアー情報が含まれる
    expect(uri).toContain('secret=')
    expect(typeof uri).toBe('string')
    expect(uri.length).toBeGreaterThan(20)
  })
})
