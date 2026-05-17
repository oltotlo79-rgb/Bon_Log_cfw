import { vi } from 'vitest'
/**
 * 2段階認証ユーティリティ - ブランチカバレッジ向上テスト
 * 主にverifyTOTPのcatchブランチ、generateBackupCodesのバッファ再生成パスをカバー
 */

// vi.hoisted でモック関数を先に定義
const { mockVerify } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
}))

vi.mock('otplib', () => ({
  OTP: vi.fn().mockImplementation(function() { return {
    generateSecret: vi.fn().mockReturnValue('MOCKSECRET123456'),
    generateURI: vi.fn().mockImplementation(({ secret, issuer, label }: { secret: string; issuer: string; label: string }) =>
      `otpauth://totp/${issuer}:${label}?secret=${secret}&issuer=${issuer}`
    ),
    verify: mockVerify,
  } }),
}))

vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockedQRCode'),
}))

import {
  verifyTOTP,
  generateBackupCodes,
  verifyBackupCode,
  hashBackupCode,
} from '@/lib/two-factor'

const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('two-factor ブランチカバレッジ向上', () => {
  beforeAll(() => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterAll(() => {
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // verifyTOTP - catchブランチ
  // ============================================================

  describe('verifyTOTP - 例外パス', () => {
    it('OTP検証で例外がスローされた場合falseを返す', async () => {
      mockVerify.mockRejectedValue(new Error('OTP internal error'))

      const result = await verifyTOTP('123456', 'TESTSECRET')
      expect(result).toBe(false)
    })

    it('OTP検証で同期例外がスローされた場合falseを返す', async () => {
      mockVerify.mockImplementation(() => {
        throw new Error('Sync error')
      })

      const result = await verifyTOTP('654321', 'TESTSECRET')
      expect(result).toBe(false)
    })
  })

  // ============================================================
  // generateBackupCodes - バッファ再生成パス
  // ============================================================

  describe('generateBackupCodes - エッジケース', () => {
    it('バックアップコードが全て正しい長さと形式で生成される（大量生成テスト）', () => {
      for (let i = 0; i < 5; i++) {
        const codes = generateBackupCodes()
        expect(codes).toHaveLength(10)
        codes.forEach(code => {
          expect(code).toHaveLength(8)
          expect(code).toMatch(/^[A-Z0-9]+$/)
        })
      }
    })

    it('生成されたバックアップコードのハッシュ検証が正常に動作する', () => {
      const codes = generateBackupCodes()
      const hashedCodes = codes.map(hashBackupCode)

      codes.forEach((code, i) => {
        expect(verifyBackupCode(code, hashedCodes)).toBe(i)
      })
    })

    it('バックアップコードの小文字入力でも検証が成功する', () => {
      const codes = generateBackupCodes()
      const hashedCodes = codes.map(hashBackupCode)

      const lowerCode = codes[0].toLowerCase()
      expect(verifyBackupCode(lowerCode, hashedCodes)).toBe(0)
    })
  })

  // ============================================================
  // verifyBackupCode - ハッシュ長不一致のパス
  // ============================================================

  describe('verifyBackupCode - エッジケース', () => {
    it('ハッシュ長が異なる場合は-1を返す', () => {
      const invalidHashedCodes = ['abc123']
      const result = verifyBackupCode('TESTCODE', invalidHashedCodes)
      expect(result).toBe(-1)
    })

    it('空文字のハッシュ配列でも安全に処理する', () => {
      const result = verifyBackupCode('CODE1234', [])
      expect(result).toBe(-1)
    })

    it('ハイフン付きコードでも正しく検証する', () => {
      const codes = ['ABCD1234']
      const hashedCodes = codes.map(hashBackupCode)
      const result = verifyBackupCode('ABCD-1234', hashedCodes)
      expect(result).toBe(0)
    })
  })
})
