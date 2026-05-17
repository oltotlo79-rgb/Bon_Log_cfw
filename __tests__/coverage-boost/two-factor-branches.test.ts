// @vitest-environment node
/**
 * two-factor.ts 不足ブランチカバレッジテスト
 *
 * verifyTOTPのcatchブランチとgenerateBackupCodesのバッファリフィルパスをテスト
 */
import { vi } from 'vitest'

// OTP verifyがエラーをスローするモック
const mockVerify = vi.fn()
vi.mock('otplib', () => ({
  OTP: vi.fn().mockImplementation(function() { return {
    generateSecret: vi.fn().mockReturnValue('MOCKSECRET123456'),
    generateURI: vi.fn().mockReturnValue('otpauth://totp/BON-LOG:test?secret=TEST'),
    verify: mockVerify,
  } }),
}))

vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockedQRCode'),
}))

describe('two-factor.ts 追加ブランチテスト', () => {
  const TEST_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

  beforeAll(() => {
    process.env.TWO_FACTOR_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterAll(() => {
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY
  })

  describe('verifyTOTP - catchブランチ', () => {
    it('OTP検証でエラーが発生した場合falseを返す', async () => {
      mockVerify.mockRejectedValue(new Error('OTP verification error'))

      const { verifyTOTP } = await import('@/lib/two-factor')
      const result = await verifyTOTP('123456', 'INVALID_SECRET')
      expect(result).toBe(false)
    })

    it('OTP検証で例外が発生しても安全にfalseを返す', async () => {
      mockVerify.mockImplementation(() => { throw new TypeError('unexpected') })

      const { verifyTOTP } = await import('@/lib/two-factor')
      const result = await verifyTOTP('654321', 'BAD_SECRET')
      expect(result).toBe(false)
    })
  })

  describe('verifyTOTP - トークン長バリデーション', () => {
    it('正規化後に6桁未満のトークンはfalseを返す（数字のみ3桁）', async () => {
      const { verifyTOTP } = await import('@/lib/two-factor')
      const result = await verifyTOTP('abc', 'SECRET')
      expect(result).toBe(false)
    })

    it('空トークンはfalseを返す', async () => {
      const { verifyTOTP } = await import('@/lib/two-factor')
      const result = await verifyTOTP('', 'SECRET')
      expect(result).toBe(false)
    })

    it('数字以外の文字列のみはfalseを返す', async () => {
      const { verifyTOTP } = await import('@/lib/two-factor')
      const result = await verifyTOTP('abcdef', 'SECRET')
      expect(result).toBe(false)
    })
  })

  describe('generateBackupCodes - バッファリフィルパス', () => {
    it('バックアップコードが正しい数と長さで生成される', async () => {
      const { generateBackupCodes } = await import('@/lib/two-factor')
      const codes = generateBackupCodes()

      expect(codes).toHaveLength(10)
      codes.forEach(code => {
        expect(code).toHaveLength(8)
        expect(code).toMatch(/^[A-Z0-9]+$/)
      })
    })

    it('全てのコードがユニークである', async () => {
      const { generateBackupCodes } = await import('@/lib/two-factor')

      // 複数回実行してユニーク性を確認
      for (let i = 0; i < 5; i++) {
        const codes = generateBackupCodes()
        const unique = new Set(codes)
        expect(unique.size).toBe(codes.length)
      }
    })

    // Note: バッファリフィルパス(L233-239)のテストは、
    // Node.js組み込みcryptoモジュールのESMモック制約により困難
  })
})
