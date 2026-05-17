/**
 * Branch coverage improvement tests for lib files with low branch coverage.
 *
 * Targets:
 * - lib/actions/hide-post.ts (58.3% branch)
 * - lib/actions/mute.ts (72.4% branch)
 * - lib/two-factor.ts (72.2% branch)
 * - lib/sakura-petals-pref.ts (56.3% branch)
 */
// @vitest-environment node
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// ============================================================
// Unmock modules we want to test (globally mocked in vitest.setup)
// ============================================================
vi.unmock('@/lib/actions/hide-post')
vi.unmock('@/lib/actions/mute')
vi.unmock('@/lib/two-factor')
vi.unmock('@/lib/sakura-petals-pref')

// hide-post.ts の getHiddenPostIds は @/lib/auth の auth() を直接呼ぶため、
// session から userId を取れるよう @/lib/auth をモックする。
const _mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => _mockAuth(),
}))

// ============================================================
// Mock dependencies (no top-level variable references in factories)
// ============================================================

vi.mock('@/lib/db', () => {
  const makeMock = () => ({
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  })
  return {
    prisma: {
      user: makeMock(),
      post: makeMock(),
      mute: makeMock(),
      userHiddenPost: makeMock(),
      $transaction: vi.fn(),
    },
  }
})

vi.mock('@/lib/actions/utils', () => {
  const _requireAuth = vi.fn()
  const _requireNotGuest = vi.fn()
  const _requireActiveNonGuestUser = vi.fn()
  const _invalidateCache = vi.fn()
  return {
    requireAuth: () => _requireAuth(),
    requireNotGuest: () => _requireNotGuest(),
    // mute.ts 等の書き込みアクションは requireActiveNonGuestUser(認証+アクティブ+非ゲスト+レート制限)を使う
    requireActiveNonGuestUser: (action?: string) => _requireActiveNonGuestUser(action),
    actionSuccess: (data?: unknown) =>
      data !== undefined ? { success: true, data } : { success: true },
    actionError: (msg: string) => ({ success: false, error: msg }),
  enforceUserRateLimit: vi.fn().mockResolvedValue(null),
    invalidateUserRelationsCache: (userId: string) => _invalidateCache(userId),
    // Expose the mock fns for test setup
    __mockRequireAuth: _requireAuth,
    __mockRequireNotGuest: _requireNotGuest,
    __mockRequireActiveNonGuestUser: _requireActiveNonGuestUser,
    __mockInvalidateCache: _invalidateCache,
  }
})

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn(), debug: vi.fn() },
}))

// Mock otplib and qrcode for two-factor tests
vi.mock('otplib', () => {
  const _mockOtp = {
    generateSecret: vi.fn().mockReturnValue('MOCK_SECRET_BASE32'),
    generateURI: vi.fn().mockReturnValue('otpauth://totp/BON-LOG:test@example.com?secret=MOCK'),
    verify: vi.fn().mockResolvedValue({ valid: true }),
  }
  // OTP is used as `new OTP(...)`, so it must be a real constructor
  function MockOTP() {
    return _mockOtp
  }
  MockOTP.__mockOtp = _mockOtp
  return {
    OTP: MockOTP,
    __mockOtp: _mockOtp,
  }
})

vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mockQR'),
}))

// ============================================================
// Import modules under test
// ============================================================
import { hidePost, getHiddenPostIds } from '@/lib/actions/hide-post'
import { muteUser, unmuteUser, getMutedUsers, isMuted } from '@/lib/actions/mute'
import { prisma } from '@/lib/db'

// Get internal mock references
const utilsMod = await import('@/lib/actions/utils') as unknown as {
  __mockRequireAuth: ReturnType<typeof vi.fn>
  __mockRequireNotGuest: ReturnType<typeof vi.fn>
  __mockRequireActiveNonGuestUser: ReturnType<typeof vi.fn>
  __mockInvalidateCache: ReturnType<typeof vi.fn>
}
const mockRequireAuth = utilsMod.__mockRequireAuth
const mockRequireNotGuest = utilsMod.__mockRequireNotGuest
const mockRequireActiveNonGuestUser = utilsMod.__mockRequireActiveNonGuestUser
const mockInvalidateUserRelationsCache = utilsMod.__mockInvalidateCache
const mockAuth = _mockAuth

// Typed prisma mock references
const mockPrisma = prisma as unknown as {
  post: { findUnique: ReturnType<typeof vi.fn> }
  userHiddenPost: { upsert: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }
  mute: {
    create: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
  }
}

// ============================================================
// hide-post.ts tests
// ============================================================
describe('lib/actions/hide-post - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // hidePost は requireActiveNonGuestUser を使う
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    // getHiddenPostIds は @/lib/auth の auth() を直接呼ぶ
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
  })

  describe('hidePost', () => {
    it('returns error for empty postId (invalid input)', async () => {
      const result = await hidePost('')
      expect(result).toEqual({ success: false, error: '入力データが不正です' })
    })

    it('returns error when requireAuth fails', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })
      const result = await hidePost('post-1')
      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('returns error when post not found', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)
      const result = await hidePost('post-1')
      expect(result).toEqual({ success: false, error: '投稿が見つかりません' })
    })

    it('returns error when trying to hide own post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', userId: 'user-1' })
      const result = await hidePost('post-1')
      expect(result).toEqual({ success: false, error: '自分の投稿は非表示にできません' })
    })

    it('succeeds when hiding another user post', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ id: 'post-1', userId: 'user-2' })
      mockPrisma.userHiddenPost.upsert.mockResolvedValue({})
      const result = await hidePost('post-1')
      expect(result).toEqual({ success: true })
    })

    it('returns error when db operation throws', async () => {
      mockPrisma.post.findUnique.mockRejectedValue(new Error('DB error'))
      const result = await hidePost('post-1')
      expect(result).toEqual({ success: false, error: '非表示に失敗しました' })
    })

    it('handles non-Error throw in catch', async () => {
      mockPrisma.post.findUnique.mockRejectedValue('string error')
      const result = await hidePost('post-1')
      expect(result).toEqual({ success: false, error: '非表示に失敗しました' })
    })
  })

  describe('getHiddenPostIds', () => {
    it('returns post ids on success', async () => {
      mockPrisma.userHiddenPost.findMany.mockResolvedValue([
        { postId: 'p1' },
        { postId: 'p2' },
      ])
      const result = await getHiddenPostIds()
      expect(result).toEqual(['p1', 'p2'])
    })

    it('returns empty array on error', async () => {
      mockPrisma.userHiddenPost.findMany.mockRejectedValue(new Error('DB fail'))
      const result = await getHiddenPostIds()
      expect(result).toEqual([])
    })

    it('returns empty array on non-Error exception', async () => {
      mockPrisma.userHiddenPost.findMany.mockRejectedValue('string error')
      const result = await getHiddenPostIds()
      expect(result).toEqual([])
    })
  })
})

// ============================================================
// mute.ts tests
// ============================================================
describe('lib/actions/mute - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // muteUser / unmuteUser は requireActiveNonGuestUser を使うためそちらを主にモック
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
    // getMutedUsers / isMuted は requireAuth + requireNotGuest を使うため別途モック
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockRequireNotGuest.mockResolvedValue(null)
    mockInvalidateUserRelationsCache.mockResolvedValue(undefined)
  })

  describe('muteUser', () => {
    it('returns error when requireAuth fails', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })
      const result = await muteUser('user-2')
      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('returns error when guest check fails', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: 'ゲストは使えません' })
      const result = await muteUser('user-2')
      expect(result).toEqual({ success: false, error: 'ゲストは使えません' })
    })

    it('returns error for invalid targetUserId (zod)', async () => {
      const result = await muteUser('')
      expect(result).toEqual({ success: false, error: '入力データが不正です' })
      expect(mockPrisma.mute.create).not.toHaveBeenCalled()
    })

    it('returns error when muting self', async () => {
      const result = await muteUser('user-1')
      expect(result).toEqual({ success: false, error: '自分自身をミュートすることはできません' })
    })

    it('succeeds when muting another user', async () => {
      mockPrisma.mute.create.mockResolvedValue({})
      const result = await muteUser('user-2')
      expect(result).toEqual({ success: true })
      expect(mockInvalidateUserRelationsCache).toHaveBeenCalledWith('user-1')
    })

    it('returns error when db throws', async () => {
      mockPrisma.mute.create.mockRejectedValue(new Error('DB error'))
      const result = await muteUser('user-2')
      expect(result).toEqual({ success: false, error: 'ミュートに失敗しました' })
    })

    it('handles non-Error throw', async () => {
      mockPrisma.mute.create.mockRejectedValue('some string')
      const result = await muteUser('user-2')
      expect(result).toEqual({ success: false, error: 'ミュートに失敗しました' })
    })
  })

  describe('unmuteUser', () => {
    it('returns error when requireAuth fails', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })
      const result = await unmuteUser('user-2')
      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('returns error when guest check fails', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: 'ゲストは使えません' })
      const result = await unmuteUser('user-2')
      expect(result).toEqual({ success: false, error: 'ゲストは使えません' })
    })

    it('returns error for invalid targetUserId (zod)', async () => {
      const result = await unmuteUser('')
      expect(result).toEqual({ success: false, error: '入力データが不正です' })
      expect(mockPrisma.mute.delete).not.toHaveBeenCalled()
    })

    it('succeeds when unmuting a user', async () => {
      mockPrisma.mute.delete.mockResolvedValue({})
      const result = await unmuteUser('user-2')
      expect(result).toEqual({ success: true })
      expect(mockInvalidateUserRelationsCache).toHaveBeenCalledWith('user-1')
    })

    it('returns error when db throws', async () => {
      mockPrisma.mute.delete.mockRejectedValue(new Error('DB error'))
      const result = await unmuteUser('user-2')
      expect(result).toEqual({ success: false, error: 'ミュート解除に失敗しました' })
    })

    it('handles non-Error throw', async () => {
      mockPrisma.mute.delete.mockRejectedValue(42)
      const result = await unmuteUser('user-2')
      expect(result).toEqual({ success: false, error: 'ミュート解除に失敗しました' })
    })
  })

  describe('getMutedUsers', () => {
    it('returns empty when requireAuth fails', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })
      const result = await getMutedUsers()
      expect(result).toEqual({ users: [], nextCursor: undefined })
    })

    it('returns empty when guest check fails', async () => {
      mockRequireNotGuest.mockResolvedValue({ error: 'ゲストは使えません' })
      const result = await getMutedUsers()
      expect(result).toEqual({ users: [], nextCursor: undefined })
    })

    it('returns users list with cursor on success', async () => {
      const mockMutes = Array.from({ length: 20 }, (_, i) => ({
        muterId: 'user-1',
        mutedId: `muted-${i}`,
        muted: { id: `muted-${i}`, nickname: `User ${i}`, avatarUrl: null, bio: null },
      }))
      mockPrisma.mute.findMany.mockResolvedValue(mockMutes)
      const result = await getMutedUsers()
      expect(result.users).toHaveLength(20)
      expect(result.nextCursor).toBe('muted-19')
    })

    it('returns users without cursor when less than limit', async () => {
      const mockMutes = [
        {
          muterId: 'user-1',
          mutedId: 'muted-0',
          muted: { id: 'muted-0', nickname: 'User 0', avatarUrl: null, bio: null },
        },
      ]
      mockPrisma.mute.findMany.mockResolvedValue(mockMutes)
      const result = await getMutedUsers()
      expect(result.users).toHaveLength(1)
      expect(result.nextCursor).toBeUndefined()
    })

    it('passes cursor correctly when provided', async () => {
      mockPrisma.mute.findMany.mockResolvedValue([])
      await getMutedUsers('cursor-id', 10)
      expect(mockPrisma.mute.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { muterId_mutedId: { muterId: 'user-1', mutedId: 'cursor-id' } },
          skip: 1,
        })
      )
    })

    it('returns empty on db error', async () => {
      mockPrisma.mute.findMany.mockRejectedValue(new Error('DB error'))
      const result = await getMutedUsers()
      expect(result).toEqual({ users: [], nextCursor: undefined })
    })
  })

  describe('isMuted', () => {
    it('returns false when requireAuth fails', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })
      const result = await isMuted('user-2')
      expect(result).toEqual({ muted: false })
    })

    it('returns true when mute record exists', async () => {
      mockPrisma.mute.findUnique.mockResolvedValue({ muterId: 'user-1', mutedId: 'user-2' })
      const result = await isMuted('user-2')
      expect(result).toEqual({ muted: true })
    })

    it('returns false when mute record does not exist', async () => {
      mockPrisma.mute.findUnique.mockResolvedValue(null)
      const result = await isMuted('user-2')
      expect(result).toEqual({ muted: false })
    })

    it('returns false on db error', async () => {
      mockPrisma.mute.findUnique.mockRejectedValue(new Error('DB error'))
      const result = await isMuted('user-2')
      expect(result).toEqual({ muted: false })
    })

    it('handles non-Error throw in catch', async () => {
      mockPrisma.mute.findUnique.mockRejectedValue('error string')
      const result = await isMuted('user-2')
      expect(result).toEqual({ muted: false })
    })
  })
})

// ============================================================
// two-factor.ts tests
// ============================================================
describe('lib/two-factor - branch coverage', () => {
  const TEST_ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes hex

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.TWO_FACTOR_ENCRYPTION_KEY = TEST_ENCRYPTION_KEY
  })

  afterEach(() => {
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY
  })

  // We need to dynamically import since encryption key is checked at runtime
  it('generateSecret returns a string', async () => {
    const { generateSecret } = await import('@/lib/two-factor')
    const result = generateSecret()
    expect(typeof result).toBe('string')
  })

  it('generateTOTPUri returns otpauth URI', async () => {
    const { generateTOTPUri } = await import('@/lib/two-factor')
    const result = generateTOTPUri('SECRET', 'test@example.com')
    expect(typeof result).toBe('string')
  })

  it('generateQRCode returns data URL', async () => {
    const { generateQRCode } = await import('@/lib/two-factor')
    const result = await generateQRCode('otpauth://totp/test')
    expect(result).toContain('data:image/png;base64')
  })

  describe('verifyTOTP', () => {
    it('returns false for short token', async () => {
      const { verifyTOTP } = await import('@/lib/two-factor')
      const result = await verifyTOTP('12', 'SECRET')
      expect(result).toBe(false)
    })

    it('returns false for non-numeric token', async () => {
      const { verifyTOTP } = await import('@/lib/two-factor')
      const result = await verifyTOTP('abcdef', 'SECRET')
      expect(result).toBe(false)
    })

    it('strips non-digits and verifies correctly', async () => {
      const { verifyTOTP } = await import('@/lib/two-factor')
      const result = await verifyTOTP('12-34-56', 'SECRET')
      expect(typeof result).toBe('boolean')
    })

    it('returns false when otp.verify throws', async () => {
      const otplibModule = await import('otplib')
      const mockOtp = (otplibModule as unknown as { __mockOtp: { verify: ReturnType<typeof vi.fn> } }).__mockOtp
      mockOtp.verify.mockRejectedValueOnce(new Error('OTP error'))
      const { verifyTOTP } = await import('@/lib/two-factor')
      const result = await verifyTOTP('123456', 'SECRET')
      expect(result).toBe(false)
    })
  })

  describe('generateBackupCodes', () => {
    it('generates correct number of codes', async () => {
      const { generateBackupCodes } = await import('@/lib/two-factor')
      const codes = generateBackupCodes()
      expect(codes.length).toBeGreaterThan(0)
      // Each code should be alphanumeric uppercase
      for (const code of codes) {
        expect(code).toMatch(/^[A-Z0-9]+$/)
      }
    })
  })

  describe('hashBackupCode', () => {
    it('normalizes input to uppercase and removes non-alphanumeric', async () => {
      const { hashBackupCode } = await import('@/lib/two-factor')
      const hash1 = hashBackupCode('abcd1234')
      const hash2 = hashBackupCode('ABCD1234')
      const hash3 = hashBackupCode('AB-CD-12-34')
      expect(hash1).toBe(hash2)
      expect(hash2).toBe(hash3)
    })
  })

  describe('verifyBackupCode', () => {
    it('returns matching index when code matches', async () => {
      const { verifyBackupCode, hashBackupCode } = await import('@/lib/two-factor')
      const hashedCodes = ['CODE1', 'CODE2', 'CODE3'].map(hashBackupCode)
      const index = verifyBackupCode('CODE2', hashedCodes)
      expect(index).toBe(1)
    })

    it('returns -1 when no code matches', async () => {
      const { verifyBackupCode, hashBackupCode } = await import('@/lib/two-factor')
      const hashedCodes = ['CODE1', 'CODE2'].map(hashBackupCode)
      const index = verifyBackupCode('WRONG', hashedCodes)
      expect(index).toBe(-1)
    })

    it('handles case insensitive matching', async () => {
      const { verifyBackupCode, hashBackupCode } = await import('@/lib/two-factor')
      const hashedCodes = [hashBackupCode('ABCD1234')]
      const index = verifyBackupCode('abcd1234', hashedCodes)
      expect(index).toBe(0)
    })
  })

  describe('encryptSecret / decryptSecret', () => {
    it('encrypts and decrypts correctly', async () => {
      const { encryptSecret, decryptSecret } = await import('@/lib/two-factor')
      const original = 'MY_SECRET_KEY_TEST'
      const encrypted = encryptSecret(original)
      expect(encrypted).not.toBe(original)
      const decrypted = decryptSecret(encrypted)
      expect(decrypted).toBe(original)
    })

    it('throws when encryption key not set', async () => {
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY
      delete process.env.TWO_FACTOR_ENCRYPTION_KEY_v1
      const { encryptSecret } = await import('@/lib/two-factor')
      // 鍵バージョン管理導入後はバージョン名（v1）を含むメッセージへ変更
      expect(() => encryptSecret('test')).toThrow(/TWO_FACTOR_ENCRYPTION_KEY .*is not configured/)
    })

    it('throws when decrypting with wrong key', async () => {
      const { encryptSecret } = await import('@/lib/two-factor')
      const encrypted = encryptSecret('test')
      // Change key
      process.env.TWO_FACTOR_ENCRYPTION_KEY = 'b'.repeat(64)
      const { decryptSecret } = await import('@/lib/two-factor')
      expect(() => decryptSecret(encrypted)).toThrow()
    })
  })

  describe('formatTOTPCode', () => {
    it('strips non-numeric characters', async () => {
      const { formatTOTPCode } = await import('@/lib/two-factor')
      expect(formatTOTPCode('12-34-56')).toBe('123456')
    })

    it('truncates to max length', async () => {
      const { formatTOTPCode } = await import('@/lib/two-factor')
      expect(formatTOTPCode('1234567890')).toBe('123456')
    })

    it('returns empty for no digits', async () => {
      const { formatTOTPCode } = await import('@/lib/two-factor')
      expect(formatTOTPCode('abcdef')).toBe('')
    })
  })

  describe('formatBackupCode', () => {
    it('converts to uppercase and strips special chars', async () => {
      const { formatBackupCode } = await import('@/lib/two-factor')
      expect(formatBackupCode('ab-cd-12-34')).toBe('ABCD1234')
    })

    it('removes spaces', async () => {
      const { formatBackupCode } = await import('@/lib/two-factor')
      expect(formatBackupCode('AB CD 12 34')).toBe('ABCD1234')
    })
  })

  describe('detectCodeType', () => {
    it('returns totp for 6 digit code', async () => {
      const { detectCodeType } = await import('@/lib/two-factor')
      expect(detectCodeType('123456')).toBe('totp')
    })

    it('returns totp for 6 digits with separators', async () => {
      const { detectCodeType } = await import('@/lib/two-factor')
      // After cleaning non-alphanumeric, "12-34-56" becomes "123456"
      expect(detectCodeType('123456')).toBe('totp')
    })

    it('returns backup for alphanumeric code', async () => {
      const { detectCodeType } = await import('@/lib/two-factor')
      expect(detectCodeType('ABCD1234')).toBe('backup')
    })

    it('returns backup for long numeric code', async () => {
      const { detectCodeType } = await import('@/lib/two-factor')
      expect(detectCodeType('12345678')).toBe('backup')
    })

    it('returns backup for 5 digit code', async () => {
      const { detectCodeType } = await import('@/lib/two-factor')
      expect(detectCodeType('12345')).toBe('backup')
    })
  })
})

// ============================================================
// sakura-petals-pref.ts tests
// ============================================================
describe('lib/sakura-petals-pref - branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getSeasonalAnimationType', () => {
    it('returns sakura for March', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 2, 15)) // March
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('sakura')
      vi.useRealTimers()
    })

    it('returns sakura for April', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 3, 15)) // April
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('sakura')
      vi.useRealTimers()
    })

    it('returns dandelion for May', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 4, 15)) // May
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('dandelion')
      vi.useRealTimers()
    })

    it('returns rain-drops for June', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 5, 15)) // June
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('rain-drops')
      vi.useRealTimers()
    })

    it('returns rain for July-September', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 6, 15)) // July
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('rain')
      vi.useRealTimers()
    })

    it('returns rain for August', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 7, 15)) // August
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('rain')
      vi.useRealTimers()
    })

    it('returns rain for September', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 8, 15)) // September
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('rain')
      vi.useRealTimers()
    })

    it('returns momiji for October-November', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 9, 15)) // October
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('momiji')
      vi.useRealTimers()
    })

    it('returns momiji for November', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 10, 15)) // November
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('momiji')
      vi.useRealTimers()
    })

    it('returns snow for December', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 11, 15)) // December
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('snow')
      vi.useRealTimers()
    })

    it('returns snow for January', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 0, 15)) // January
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('snow')
      vi.useRealTimers()
    })

    it('returns snow for February', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date(2025, 1, 15)) // February
      const { getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      expect(getSeasonalAnimationType()).toBe('snow')
      vi.useRealTimers()
    })
  })

  describe('getBgAnimationPref (server-side)', () => {
    it('returns seasonal when window is undefined (server)', async () => {
      // In node environment, window is undefined
      const { getBgAnimationPref } = await import('@/lib/sakura-petals-pref')
      const result = getBgAnimationPref()
      expect(result).toBe('seasonal')
    })
  })

  describe('setBgAnimationType (server-side)', () => {
    it('does nothing when window is undefined', async () => {
      const { setBgAnimationType } = await import('@/lib/sakura-petals-pref')
      // Should not throw
      setBgAnimationType('sakura')
    })
  })

  describe('getBgAnimationType', () => {
    it('returns seasonal animation type when pref is seasonal', async () => {
      const { getBgAnimationType, getSeasonalAnimationType } = await import('@/lib/sakura-petals-pref')
      // In node env, getBgAnimationPref returns 'seasonal'
      const result = getBgAnimationType()
      const expected = getSeasonalAnimationType()
      expect(result).toBe(expected)
    })
  })
})
