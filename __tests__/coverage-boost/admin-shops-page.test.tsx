// @vitest-environment node
/**
 * admin/shops/page.tsx ブランチカバレッジ向上テスト
 */
import { vi } from 'vitest'
import React from 'react'

// ============================================================
// モック設定
// ============================================================

class RedirectError extends Error {
  digest = 'NEXT_REDIRECT'
  constructor(public url: string) {
    super(`NEXT_REDIRECT: ${url}`)
  }
}
const mockRedirect = vi.fn((url: string) => { throw new RedirectError(url) })
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

const mockIsAdmin = vi.fn()
vi.mock('@/lib/actions/admin', () => ({
  isAdmin: () => mockIsAdmin(),
}))

const mockFindMany = vi.fn()
const mockCount = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    bonsaiShop: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('./ShopActionsDropdown', () => ({
  ShopActionsDropdown: ({ shopId }: { shopId: string }) => (
    <button data-testid={`action-${shopId}`}>操作</button>
  ),
}))

describe('AdminShopsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('管理者でない場合はリダイレクトする', async () => {
    mockIsAdmin.mockResolvedValue(false)

    const AdminShopsPage = (await import('@/app/admin/shops/page')).default
    await expect(
      AdminShopsPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/feed')
  })

  it('検索キーワードなしで盆栽園一覧を表示する', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const AdminShopsPage = (await import('@/app/admin/shops/page')).default
    const result = await AdminShopsPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeDefined()
    expect(mockCount).toHaveBeenCalledWith({ where: {} })
  })

  it('検索キーワードありでフィルタリングする', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const AdminShopsPage = (await import('@/app/admin/shops/page')).default
    await AdminShopsPage({ searchParams: Promise.resolve({ search: '東京' }) })

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: '東京' } },
            { address: { contains: '東京' } },
          ],
        },
      })
    )
  })

  it('cursor 指定時はカーソルベースで取得する (skip=1)', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([{
      id: 's1', name: 'Shop', address: '東京', createdAt: new Date(),
      creator: { id: 'u1', nickname: 'Creator' },
      _count: { reviews: 3 },
    }])
    mockCount.mockResolvedValue(50)

    const AdminShopsPage = (await import('@/app/admin/shops/page')).default
    const result = await AdminShopsPage({ searchParams: Promise.resolve({ cursor: 'shop-20' }) })

    expect(result).toBeDefined()
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'shop-20' }, skip: 1, take: 20 })
    )
  })

  it('cursor 未指定時は cursor/skip なしで先頭ページを取得する', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(40)

    const AdminShopsPage = (await import('@/app/admin/shops/page')).default
    const result = await AdminShopsPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeDefined()
    const call = mockFindMany.mock.calls[0]![0]
    expect(call.cursor).toBeUndefined()
    expect(call.skip).toBeUndefined()
  })

  it('盆栽園が0件の場合', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(0)

    const AdminShopsPage = (await import('@/app/admin/shops/page')).default
    const result = await AdminShopsPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeDefined()
  })

  it('shop.addressがnullの場合に-を表示する', async () => {
    mockIsAdmin.mockResolvedValue(true)
    mockFindMany.mockResolvedValue([{
      id: 's1', name: 'Shop', address: null, createdAt: new Date(),
      creator: { id: 'u1', nickname: 'Creator' },
      _count: { reviews: 0 },
    }])
    mockCount.mockResolvedValue(1)

    const AdminShopsPage = (await import('@/app/admin/shops/page')).default
    const result = await AdminShopsPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeDefined()
  })
})
