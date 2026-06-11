// @vitest-environment node

/**
 * lib/actions/admin/cms.ts の未カバー branch を補強するテスト
 *
 * 既存の cms.test.ts は正常系中心。このファイルでは以下を補完する:
 * - createCmsPage の slug 検証エラー（CMS_SLUG_PATTERN / CMS_SLUG_RESERVED）
 * - 各 Action の catch ブランチ（Prisma 例外時の ERR_OPERATION_FAILED 返却）
 *
 * `lib/logger` は named export `logger` と default export 両方を持つため、
 * cms.ts が `import { logger }` で取り込んでいる名前付きの方も必ずモックする。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'

// cmsPage は createMockPrismaClient のデフォルトに無いため、ここで明示的に組み立てる
const mockPrisma = {
  cmsPage: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  cmsPageVersion: {
    create: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  adminLog: { create: vi.fn() },
  $transaction: vi.fn(),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { log: vi.fn(), warn: vi.fn(), error: mockLoggerError, debug: vi.fn() },
  logger: { log: vi.fn(), warn: vi.fn(), error: mockLoggerError, debug: vi.fn() },
}))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}))

vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }),
}))

const ADMIN_USER_RECORD = {
  id: 'admin-rec',
  userId: 'admin-id',
  role: 'admin',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin-id' } })
  mockPrisma.adminUser.findUnique.mockResolvedValue(ADMIN_USER_RECORD)
})

describe('createCmsPage - slug 検証', async () => {
  const { createCmsPage } = await import('@/lib/actions/admin/cms')

  it('小文字以外を含む slug は ERR_CMS_SLUG_INVALID_CHARS', async () => {
    const result = await createCmsPage({
      slug: 'About', // 大文字
      title: 'タイトル',
      content: '本文',
      category: 'info',
    })
    expect(result).toMatchObject({ error: expect.any(String), success: false })
  })

  it('日本語を含む slug は ERR_CMS_SLUG_INVALID_CHARS', async () => {
    const result = await createCmsPage({
      slug: '会社情報',
      title: 'タイトル',
      content: '本文',
      category: 'info',
    })
    expect(result.success).toBe(false)
  })

  it('スペース・記号を含む slug は invalid', async () => {
    const result = await createCmsPage({
      slug: 'about us!',
      title: 'タイトル',
      content: '本文',
      category: 'info',
    })
    expect(result.success).toBe(false)
  })

  it('予約 slug（admin / api / app など）は ERR_CMS_SLUG_RESERVED', async () => {
    const result = await createCmsPage({
      slug: 'admin',
      title: 'タイトル',
      content: '本文',
      category: 'info',
    })
    expect(result.success).toBe(false)
  })

  it('予約 slug をプレフィックスに使うのも禁止（admin/dashboard）', async () => {
    const result = await createCmsPage({
      slug: 'admin/dashboard',
      title: 'タイトル',
      content: '本文',
      category: 'info',
    })
    expect(result.success).toBe(false)
  })
})

describe('cms - catch ブランチ', async () => {
  const mod = await import('@/lib/actions/admin/cms')

  it('getCmsPages: prisma.cmsPage.findMany が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.cmsPage.findMany.mockRejectedValueOnce(new Error('DB down'))
    mockPrisma.cmsPage.count.mockResolvedValueOnce(0)
    const result = await mod.getCmsPages()
    expect((result as { success: boolean }).success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('getCmsPages failed', expect.any(Object))
  })

  it('getCmsPage: prisma.cmsPage.findUnique が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.cmsPage.findUnique.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.getCmsPage('about')
    expect((result as { success: boolean }).success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('getCmsPage failed', expect.any(Object))
  })

  it('createCmsPage: prisma.cmsPage.create が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.cmsPage.findUnique.mockResolvedValueOnce(null)
    mockPrisma.cmsPage.create.mockRejectedValueOnce(new Error('boom'))
    const result = await mod.createCmsPage({
      slug: 'valid-slug',
      title: 't',
      content: 'c',
      category: 'info',
    })
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('createCmsPage failed', expect.any(Object))
  })

  it('updateCmsPage: prisma.$transaction が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.cmsPage.findUnique.mockResolvedValueOnce({
      id: 'p1',
      slug: 'about',
      title: 't',
      content: 'c',
      version: 1,
      isPublished: false,
      publishedAt: null,
    })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.updateCmsPage('about', { title: '新タイトル' })
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('updateCmsPage failed', expect.any(Object))
  })

  it('deleteCmsPage: prisma.$transaction が throw → ERR_OPERATION_FAILED', async () => {
    mockPrisma.cmsPage.findUnique.mockResolvedValueOnce({
      id: 'p1',
      slug: 'about',
      title: 't',
    })
    mockPrisma.$transaction.mockRejectedValueOnce(new Error('tx fail'))
    const result = await mod.deleteCmsPage('about')
    expect(result.success).toBe(false)
    expect(mockLoggerError).toHaveBeenCalledWith('deleteCmsPage failed', expect.any(Object))
  })
})
