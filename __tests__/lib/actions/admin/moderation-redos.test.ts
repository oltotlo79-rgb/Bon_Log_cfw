// @vitest-environment node

/**
 * moderation.ts ReDoS対策テスト
 *
 * NGワード正規表現の ReDoS パターン検出を検証
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}))

vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }),
}))

const mockInvalidateNgWordsCache = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/ng-word-checker', () => ({
  invalidateNgWordsCache: (...args: unknown[]) => mockInvalidateNgWordsCache(...args),
}))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

// ngWord, adminLog は createMockPrismaClient に含まれないため動的に追加
function setupExtraModels() {
  const p = mockPrisma as any
  if (!p.ngWord) {
    p.ngWord = {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    }
  }
}

const mockTransaction = vi.fn((ops: unknown) => {
  if (typeof ops === 'function') {
    return (ops as (...args: unknown[]) => unknown)(mockPrisma)
  }
  return Promise.all(ops as Promise<unknown>[])
})

const importModule = () => import('@/lib/actions/admin/moderation')

describe('Moderation ReDoS Protection Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    setupExtraModels()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction
  })

  describe('createNgWord - ReDoS検出', () => {
    it('ネスト量指定子パターン (a+)+ を拒否する', async () => {
      const { createNgWord } = await importModule()
      const result = await createNgWord({
        word: '(a+)+',
        category: 'spam',
        isRegex: true,
      })

      expect(result).toMatchObject({ success: false })
      expect(result.success === false && result.error).toContain('ReDoS')
    })

    it('ネスト量指定子パターン (a+)* を拒否する', async () => {
      const { createNgWord } = await importModule()
      const result = await createNgWord({
        word: '(a+)*',
        category: 'spam',
        isRegex: true,
      })

      expect(result).toMatchObject({ success: false })
    })

    it('ネスト量指定子パターン (a|b*)+ を拒否する', async () => {
      const { createNgWord } = await importModule()
      const result = await createNgWord({
        word: '(a|b*)+',
        category: 'spam',
        isRegex: true,
      })

      expect(result).toMatchObject({ success: false })
    })

    it('安全な正規表現パターンは許可する', async () => {
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)
      p.ngWord.create.mockResolvedValue({ id: 'ng-1' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-1' })

      const { createNgWord } = await importModule()
      const result = await createNgWord({
        word: '[あ-ん]+テスト',
        category: 'spam',
        isRegex: true,
      })

      expect(result).toMatchObject({ success: true })
    })

    it('単純な量指定子は許可する', async () => {
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)
      p.ngWord.create.mockResolvedValue({ id: 'ng-2' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-2' })

      const { createNgWord } = await importModule()
      const result = await createNgWord({
        word: 'spam\\d{3,}',
        category: 'spam',
        isRegex: true,
      })

      expect(result).toMatchObject({ success: true })
    })

    it('isRegex が false の場合は ReDoS チェックをスキップ', async () => {
      const p = mockPrisma as any
      p.ngWord.findUnique.mockResolvedValue(null)
      p.ngWord.create.mockResolvedValue({ id: 'ng-3' })
      mockPrisma.adminLog.create.mockResolvedValue({ id: 'log-3' })

      const { createNgWord } = await importModule()
      const result = await createNgWord({
        word: '(a+)+',
        category: 'spam',
        isRegex: false,
      })

      // 通常文字列としてなら許可
      expect(result).toMatchObject({ success: true })
    })

    it('構文エラーの正規表現は拒否する', async () => {
      const { createNgWord } = await importModule()
      const result = await createNgWord({
        word: '[invalid',
        category: 'spam',
        isRegex: true,
      })

      expect(result).toMatchObject({ success: false })
      expect(result.success === false && result.error).toContain('構文')
    })
  })

  describe('ERR_NG_WORD_REGEX_UNSAFE 定数', () => {
    it('エラー定数が正しく定義されている', async () => {
      const { ERR_NG_WORD_REGEX_UNSAFE } = await import('@/lib/constants/errors')
      expect(ERR_NG_WORD_REGEX_UNSAFE).toContain('ReDoS')
    })
  })
})
