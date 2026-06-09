// @vitest-environment node

/**
 * verify2FAToken の Zod バリデーション前 return テスト
 *
 * 不正入力（無効 email / 短い code）はレート制限を消費せずに
 * ERR_2FA_INVALID_CODE を返すことを検証する。
 */

import { vi } from 'vitest'

const mockAuth = vi.fn()

const mockEnforceUserRateLimit = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/utils')>('@/lib/actions/utils')
  return {
    ...actual,
    requireActiveNonGuestUser: async () => {
      const session = await mockAuth()
      if (!session?.user?.id) return { error: '認証が必要です' }
      return { userId: session.user.id }
    },
    enforceUserRateLimit: (...args: unknown[]) => mockEnforceUserRateLimit(...args),
    getClientIp: vi.fn().mockResolvedValue('127.0.0.1'),
  }
})

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  }),
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}))

vi.mock('@/lib/two-factor', () => ({
  generateSecret: vi.fn(),
  generateTOTPUri: vi.fn(),
  generateQRCode: vi.fn(),
  verifyTOTP: vi.fn(),
  generateBackupCodes: vi.fn(),
  hashBackupCode: vi.fn(),
  verifyBackupCode: vi.fn(),
  encryptSecret: vi.fn(),
  decryptSecret: vi.fn(),
  detectCodeType: vi.fn().mockReturnValue('totp'),
  formatTOTPCode: vi.fn().mockImplementation((code: string) => code),
}))

vi.stubGlobal('crypto', {
  randomUUID: () => 'test-uuid',
})

describe('verify2FAToken - Zod validation before rate-limit', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockEnforceUserRateLimit.mockResolvedValue(null)
  })

  it('無効な email は Zod 検証失敗 → ERR_2FA_INVALID_CODE を返し、レート制限を消費しない', async () => {
    const { verify2FAToken } = await import('@/lib/actions/two-factor')
    const result = await verify2FAToken('not-an-email', '123456')

    expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    expect(mockEnforceUserRateLimit).not.toHaveBeenCalled()
  })

  it('1文字の短すぎる code は Zod 検証失敗 → ERR_2FA_INVALID_CODE を返し、レート制限を消費しない', async () => {
    const { verify2FAToken } = await import('@/lib/actions/two-factor')
    const result = await verify2FAToken('user@example.com', 'x')

    expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    expect(mockEnforceUserRateLimit).not.toHaveBeenCalled()
  })

  it('空の email は Zod 検証失敗 → ERR_2FA_INVALID_CODE を返し、レート制限を消費しない', async () => {
    const { verify2FAToken } = await import('@/lib/actions/two-factor')
    const result = await verify2FAToken('', '123456')

    expect(result).toMatchObject({ error: '認証コードが正しくありません' })
    expect(mockEnforceUserRateLimit).not.toHaveBeenCalled()
  })

  it('大文字 email が lowercase に正規化されて DB lookup される', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)

    const { verify2FAToken } = await import('@/lib/actions/two-factor')
    await verify2FAToken('USER@EXAMPLE.COM', '123456')

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'user@example.com' },
      })
    )
  })

  it('正しい入力でレート制限が呼ばれる（Zod 通過後）', async () => {
    mockPrisma.user.findUnique.mockResolvedValueOnce(null)

    const { verify2FAToken } = await import('@/lib/actions/two-factor')
    await verify2FAToken('user@example.com', '123456')

    expect(mockEnforceUserRateLimit).toHaveBeenCalled()
  })
})
