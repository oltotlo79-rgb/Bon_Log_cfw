/**
 * app/admin/shops/page.tsx
 *
 * __tests__/coverage-boost/admin-shops-page.test.tsx は node 環境指定
 * のため DOM 描画を伴う検証ができない。ここでは jsdom 環境で実際に render し、
 * 以下の未カバー分岐を検証する:
 * - creator が null の場合は「削除済みユーザー」を表示する
 * - shops.length === limit の場合、nextHref（検索語を含む）で「次のページ」リンクを表示する
 */
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

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

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/app/admin/shops/ShopActionsDropdown', () => ({
  ShopActionsDropdown: ({ shopId }: { shopId: string }) => (
    <button data-testid={`action-${shopId}`}>操作</button>
  ),
}))

import AdminShopsPage from '@/app/admin/shops/page'

describe('AdminShopsPage - 未カバー分岐（DOM描画あり）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAdmin.mockResolvedValue(true)
  })

  it('creatorがnullの場合は「削除済みユーザー」を表示する', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 's1',
        name: 'テスト盆栽園',
        address: '東京',
        createdAt: new Date(),
        creator: null,
        _count: { reviews: 0 },
      },
    ])
    mockCount.mockResolvedValue(1)

    const result = await AdminShopsPage({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('削除済みユーザー')).toBeInTheDocument()
  })

  it('shops.lengthがDEFAULT_PAGE_LIMITと一致する場合、検索語を含むnextHrefで「次のページ」リンクを表示する', async () => {
    const shops = Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`,
      name: `Shop ${i}`,
      address: '東京',
      createdAt: new Date(),
      creator: { id: 'u1', nickname: 'Creator' },
      _count: { reviews: 0 },
    }))
    mockFindMany.mockResolvedValue(shops)
    mockCount.mockResolvedValue(100)

    const result = await AdminShopsPage({
      searchParams: Promise.resolve({ search: '東京' }),
    })
    render(result)

    const link = screen.getByText('次のページ').closest('a')
    expect(link).not.toBeNull()
    const href = link!.getAttribute('href')!
    expect(decodeURIComponent(href)).toContain('search=東京')
    expect(href).toContain('cursor=s19')
  })

  it('shops.lengthがlimit未満の場合は「次のページ」リンクを表示しない', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 's1',
        name: 'Shop',
        address: '東京',
        createdAt: new Date(),
        creator: { id: 'u1', nickname: 'Creator' },
        _count: { reviews: 0 },
      },
    ])
    mockCount.mockResolvedValue(1)

    const result = await AdminShopsPage({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.queryByText('次のページ')).not.toBeInTheDocument()
  })
})
