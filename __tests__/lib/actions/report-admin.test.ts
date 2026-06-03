// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

// 店舗評価キャッシュ無効化を spy（review 削除時のみ呼ばれることを検証）
const mockRevalidateShopRatingsCache = vi.fn()
vi.mock('@/lib/cache', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/cache')>()
  return { ...actual, revalidateShopRatingsCache: mockRevalidateShopRatingsCache }
})

const mockAdminUser = {
  id: 'admin-user-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

describe('report-admin: deleteReportedContent', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUser)
  })

  it('未認証ならエラーを返す', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteReportedContent } = await import('@/lib/actions/report-admin')
    const result = await deleteReportedContent('review', 'review-1')
    expect(result).toMatchObject({ error: expect.any(String) })
    expect(result.success).not.toBe(true)
  })

  it('review 削除時は店舗評価キャッシュを無効化する', async () => {
    mockPrisma.shopReview.delete.mockResolvedValue({ id: 'review-1' })
    mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
    mockPrisma.adminLog.create.mockResolvedValue({})

    const { deleteReportedContent } = await import('@/lib/actions/report-admin')
    const result = await deleteReportedContent('review', 'review-1')

    expect(result).toEqual({ success: true })
    expect(mockPrisma.shopReview.delete).toHaveBeenCalledWith({ where: { id: 'review-1' } })
    expect(mockRevalidateShopRatingsCache).toHaveBeenCalled()
  })

  it('post 削除時は店舗評価キャッシュを無効化しない', async () => {
    mockPrisma.post.delete.mockResolvedValue({ id: 'post-1' })
    mockPrisma.report.deleteMany.mockResolvedValue({ count: 1 })
    mockPrisma.adminLog.create.mockResolvedValue({})

    const { deleteReportedContent } = await import('@/lib/actions/report-admin')
    const result = await deleteReportedContent('post', 'post-1')

    expect(result).toEqual({ success: true })
    expect(mockRevalidateShopRatingsCache).not.toHaveBeenCalled()
  })

  it('DB 失敗時は ERR_DELETE_FAILED を返す', async () => {
    mockPrisma.shopReview.delete.mockRejectedValue(new Error('db fail'))
    const { deleteReportedContent } = await import('@/lib/actions/report-admin')
    const result = await deleteReportedContent('review', 'review-1')
    expect(result.success).not.toBe(true)
  })
})
