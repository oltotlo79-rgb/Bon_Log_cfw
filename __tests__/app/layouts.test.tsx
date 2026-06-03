// @vitest-environment node
 

import { vi } from 'vitest'
// Mocks
const mockAuth = vi.fn()
const mockIsPremiumUser = vi.fn()
const mockUserCount = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}))

vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

const mockAdminUserFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      count: (...args: unknown[]) => mockUserCount(...args),
    },
    adminUser: {
      findUnique: (...args: unknown[]) => mockAdminUserFindUnique(...args),
    },
  },
}))

const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    throw new Error('NEXT_REDIRECT')
  },
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar" />,
}))

vi.mock('@/components/layout/RightSidebar', () => ({
  RightSidebar: () => <div data-testid="right-sidebar" />,
}))

vi.mock('@/components/layout/MobileNav', () => ({
  MobileNav: () => <div data-testid="mobile-nav" />,
}))

vi.mock('@/components/layout/Header', () => ({
  Header: () => <div data-testid="header" />,
}))

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => <div data-testid="toaster" />,
}))

vi.mock('@/app/providers', () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ads', () => ({
  GoogleAdSense: () => null,
  AdProvider: () => null,
}))

vi.mock('@/components/seo/JsonLd', () => ({
  OrganizationJsonLd: () => null,
  WebSiteJsonLd: () => null,
}))

vi.mock('@/components/common/SkipLink', () => ({
  SkipLink: () => null,
}))

vi.mock('@/components/analytics/WebVitals', () => ({
  WebVitalsReporter: () => null,
}))

vi.mock('next/font/google', () => ({
  Yuji_Syuku: () => ({ variable: '--font-yuji-syuku', className: 'yuji-syuku' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono', className: 'geist-mono' }),
  Shippori_Mincho: () => ({ variable: '--font-shippori-mincho', className: 'shippori-mincho' }),
}))

// next/headers は Next.js request scope 外で実行すると throw する。
// RootLayout は CSP nonce 動的化のため `await headers()` を呼ぶので、テスト用にスタブする。
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-nonce', 'test-nonce']])),
}))

describe('MainLayout', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証ユーザーでもレイアウトが表示される（公開ページ対応）', async () => {
    mockAuth.mockResolvedValue(null)

    const { default: MainLayout } = await import('@/app/(main)/layout')
    const result = await MainLayout({ children: <div>child</div> })

    // リダイレクトせずレイアウトが返される（ナビは非表示）
    expect(result).toBeDefined()
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('認証済みユーザーにレイアウトを表示', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
    mockIsPremiumUser.mockResolvedValue(false)
    mockAdminUserFindUnique.mockResolvedValue(null)

    const { default: MainLayout } = await import('@/app/(main)/layout')
    const result = await MainLayout({ children: <div>content</div> })

    expect(result).toBeTruthy()
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

describe('PublicLayout', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('DB/auth を呼ばずに静的にレイアウトを返す (CDN キャッシュ可能性のため)', async () => {
    const { default: PublicLayout } = await import('@/app/(public)/layout')
    const result = PublicLayout({ children: <div>content</div> })

    expect(result).toBeTruthy()
    expect(mockUserCount).not.toHaveBeenCalled()
    expect(mockAuth).not.toHaveBeenCalled()
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

describe('RootLayout', async () => {
  it('メタデータがエクスポートされている', async () => {
    const { metadata } = await import('@/app/layout')
    expect(metadata).toBeDefined()
    expect(metadata.title).toBeDefined()
  })

  it('alternates.canonical はルートに pin しない（子ページが継承して重複コンテンツ扱いされるのを防ぐ）', async () => {
    const { metadata } = await import('@/app/layout')
    expect(metadata.alternates?.canonical).toBeUndefined()
  })

  it('alternates.types で RSS フィードを公開する', async () => {
    const { metadata } = await import('@/app/layout')
    expect(metadata.alternates?.types).toEqual({
      'application/rss+xml': '/feed.xml',
    })
  })

  it('childrenをレンダリングする', async () => {
    const { default: RootLayout } = await import('@/app/layout')
    const result = await RootLayout({ children: <div>test</div> })

    expect(result).toBeTruthy()
  })
})
