import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

/**
 * 盆栽園マップページのテスト
 * - 検索パラメータの各パターン
 * - ゲストユーザー判定
 * - 空の結果表示
 * - ソートオプション
 */

/**
 * Helper to render a page that contains async Server Components.
 * Walks the JSX tree, finds async function components, awaits them,
 * and replaces them with their resolved output.
 */
async function resolveAsyncJsx(element: React.ReactElement): Promise<React.ReactElement> {
  if (!element || typeof element !== 'object') return element

  const { type, props } = element
  const typedProps = props as Record<string, unknown>

  if (typeof type === 'function') {
    try {
      const result = (type as (props: Record<string, unknown>) => Promise<React.ReactElement>)(typedProps)
      if (result && typeof result === 'object' && 'then' in result) {
        const resolved = await result
        return resolveAsyncJsx(resolved)
      }
      return resolveAsyncJsx(result as React.ReactElement)
    } catch {
      return element
    }
  }

  if (typedProps?.children) {
    const children = Array.isArray(typedProps.children)
      ? await Promise.all((typedProps.children as React.ReactNode[]).map(async (child: React.ReactNode, i: number) => {
          if (!React.isValidElement(child)) return child
          const resolved = await resolveAsyncJsx(child)
          // cloneElement で静的 children を明示配列にすると React が key を要求するため、
          // key の無い要素には index ベースの key を補う (test 専用 render で reconcile しない)
          return React.isValidElement(resolved) && resolved.key == null
            ? React.cloneElement(resolved, { key: `__rk${i}` })
            : resolved
        }))
      : React.isValidElement(typedProps.children)
        ? await resolveAsyncJsx(typedProps.children as React.ReactElement)
        : typedProps.children

    return React.cloneElement(element, { ...typedProps, children } as React.Attributes)
  }

  return element
}

// モック定義
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockGetShops = vi.fn()
const mockGetShopGenres = vi.fn()
vi.mock('@/lib/actions/shop', () => ({
  getShops: (...args: unknown[]) => mockGetShops(...args),
  getShopGenres: () => mockGetShopGenres(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/components/common/GuestRestrictionOverlay', () => ({
  GuestRestrictionOverlay: ({ children, isGuest, contentName }: { children: React.ReactNode; isGuest: boolean; contentName: string }) => (
    <div data-testid="guest-overlay" data-is-guest={isGuest} data-content-name={contentName}>
      {children}
    </div>
  ),
}))

vi.mock('@/components/shop/ShopList', () => ({
  ShopList: ({ shops }: { shops: unknown[] }) => (
    <div data-testid="shop-list" data-count={shops.length} />
  ),
}))

vi.mock('@/app/(main)/shops/ShopSearchForm', () => ({
  ShopSearchForm: ({ genres, initialSearch, initialGenre, initialRegion, initialPrefecture, initialSort }: Record<string, unknown>) => (
    <div
      data-testid="shop-search-form"
      data-genres={JSON.stringify(genres)}
      data-search={initialSearch as string}
      data-genre={initialGenre as string}
      data-region={initialRegion as string}
      data-prefecture={initialPrefecture as string}
      data-sort={initialSort as string}
    />
  ),
}))

vi.mock('@/components/shop/MapWrapper', () => ({
  MapWrapper: ({ shops }: { shops: unknown[] }) => (
    <div data-testid="map-wrapper" data-count={shops.length} />
  ),
}))

const mockShops = [
  { id: 'shop-1', name: '盆栽園A', address: '東京都', latitude: 35.6, longitude: 139.7 },
  { id: 'shop-2', name: '盆栽園B', address: '大阪府', latitude: 34.7, longitude: 135.5 },
]

const mockGenres = [
  { id: 'g1', name: '松柏類' },
  { id: 'g2', name: '雑木類' },
]

async function renderPage(searchParams: Record<string, string> = {}) {
  const mod = await import('@/app/(main)/shops/page')
  const Page = mod.default
  const result = await Page({ searchParams: Promise.resolve(searchParams) })
  const resolved = await resolveAsyncJsx(result)
  render(resolved)
}

describe('ShopsPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(null)
    mockGetShops.mockResolvedValue({ shops: mockShops })
    mockGetShopGenres.mockResolvedValue({ genres: mockGenres })
  }, 20000)

  it('基本レンダリング: 盆栽園一覧が表示される', async () => {
    await renderPage()

    expect(screen.getByText('盆栽園マップ')).toBeInTheDocument()
    expect(screen.getByText('盆栽園を登録')).toBeInTheDocument()
    expect(screen.getByTestId('shop-list')).toHaveAttribute('data-count', '2')
    expect(screen.getByTestId('map-wrapper')).toHaveAttribute('data-count', '2')
    expect(screen.getByText('(2件)')).toBeInTheDocument()
  })

  it('空の結果: 0件表示', async () => {
    mockGetShops.mockResolvedValue({ shops: [] })

    await renderPage()

    expect(screen.getByTestId('shop-list')).toHaveAttribute('data-count', '0')
    expect(screen.getByText('(0件)')).toBeInTheDocument()
  })

  it('検索パラメータがgetShopsに渡される', async () => {
    await renderPage({
      search: '松',
      genre: 'g1',
      region: '関東',
      prefecture: '東京都',
      sort: 'rating',
    })

    expect(mockGetShops).toHaveBeenCalledWith({
      search: '松',
      genreId: 'g1',
      region: '関東',
      prefecture: '東京都',
      sortBy: 'rating',
    })
  })

  it('ソート: nameでソートが渡される', async () => {
    await renderPage({ sort: 'name' })

    expect(mockGetShops).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'name' })
    )
  })

  it('ソート: newestでソートが渡される', async () => {
    await renderPage({ sort: 'newest' })

    expect(mockGetShops).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'newest' })
    )
  })

  it('ソート: locationでソートが渡される', async () => {
    await renderPage({ sort: 'location' })

    expect(mockGetShops).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'location' })
    )
  })

  it('ソート未指定の場合: undefinedが渡される', async () => {
    await renderPage()

    expect(mockGetShops).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: undefined })
    )
  })

  it('不正なソート値: isShopSortOption が false を返し undefined にフォールバックする', async () => {
    await renderPage({ sort: 'invalid-sort-value' })

    expect(mockGetShops).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: undefined })
    )
  })

  it('検索フォームに初期値が渡される', async () => {
    await renderPage({
      search: 'テスト',
      genre: 'g2',
      region: '近畿',
      prefecture: '大阪府',
      sort: 'name',
    })

    const form = screen.getByTestId('shop-search-form')
    expect(form).toHaveAttribute('data-search', 'テスト')
    expect(form).toHaveAttribute('data-genre', 'g2')
    expect(form).toHaveAttribute('data-region', '近畿')
    expect(form).toHaveAttribute('data-prefecture', '大阪府')
    expect(form).toHaveAttribute('data-sort', 'name')
  })

  it('ゲストユーザーでもページが表示される（公開ページ）', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
      expires: '',
    })

    await renderPage()

    // GuestRestrictionOverlay は削除されたため、コンテンツが直接表示される
    expect(screen.getByTestId('shop-search-form')).toBeInTheDocument()
  })

  it('認証済みユーザーでページが表示される', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'user@example.com' },
      expires: '',
    })

    await renderPage()

    expect(screen.getByTestId('shop-search-form')).toBeInTheDocument()
  })

  it('未ログインでもページが表示される（公開ページ）', async () => {
    mockAuth.mockResolvedValue(null)

    await renderPage()

    expect(screen.getByTestId('shop-search-form')).toBeInTheDocument()
  })

  it('新規登録リンクが正しいhrefを持つ', async () => {
    await renderPage()

    const link = screen.getByText('盆栽園を登録').closest('a')
    expect(link).toHaveAttribute('href', '/shops/new')
  })

  it('ジャンルデータが検索フォームに渡される', async () => {
    await renderPage()

    const form = screen.getByTestId('shop-search-form')
    expect(form).toHaveAttribute('data-genres', JSON.stringify(mockGenres))
  })

  it('getShopsとgetShopGenresが呼ばれる', async () => {
    await renderPage()

    expect(mockGetShops).toHaveBeenCalledTimes(1)
    expect(mockGetShopGenres).toHaveBeenCalledTimes(1)
  })

  it('部分的な検索パラメータ: searchのみ', async () => {
    await renderPage({ search: '盆栽' })

    expect(mockGetShops).toHaveBeenCalledWith({
      search: '盆栽',
      genreId: undefined,
      region: undefined,
      prefecture: undefined,
      sortBy: undefined,
    })
  })

  it('部分的な検索パラメータ: regionのみ', async () => {
    await renderPage({ region: '関東' })

    expect(mockGetShops).toHaveBeenCalledWith(
      expect.objectContaining({ region: '関東' })
    )
  })
})

/**
 * JSX ツリーを再帰的に探索し、`<Suspense fallback={<Target />}>` の
 * fallback 要素を返す。ShopContentSkeleton は Suspense fallback 経由でのみ
 * 使われるローカル関数のため、実際に React が suspend するのを待たずに
 * fallback の型（関数）を直接見つけて描画検証する。
 */
function findFallbackByChildName(node: unknown, targetName: string): React.ReactElement | null {
  if (!node || typeof node !== 'object') return null
  const el = node as { props?: { fallback?: unknown; children?: unknown } }
  const fallback = el.props?.fallback
  if (fallback && typeof fallback === 'object') {
    const fb = fallback as { type?: unknown }
    if (typeof fb.type === 'function' && (fb.type as { name?: string }).name === targetName) {
      return fallback as React.ReactElement
    }
  }
  const children = el.props?.children
  if (Array.isArray(children)) {
    for (const child of children) {
      const found = findFallbackByChildName(child, targetName)
      if (found) return found
    }
  } else if (children && typeof children === 'object') {
    return findFallbackByChildName(children, targetName)
  }
  return null
}

describe('ShopsPage ShopContentSkeleton (Suspense fallback)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(null)
    mockGetShops.mockResolvedValue({ shops: mockShops })
    mockGetShopGenres.mockResolvedValue({ genres: mockGenres })
  })

  it('ShopContentSection の Suspense fallback として描画される', async () => {
    const mod = await import('@/app/(main)/shops/page')
    const Page = mod.default
    const result = await Page({ searchParams: Promise.resolve({}) })

    const fallbackEl = findFallbackByChildName(result, 'ShopContentSkeleton')
    expect(fallbackEl).not.toBeNull()

    const { container } = render(fallbackEl as React.ReactElement)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })
})

describe('ShopsPage metadata', async () => {
  it('正しいメタデータがエクスポートされる', async () => {
    const mod = await import('@/app/(main)/shops/page')
    expect(mod.metadata).toMatchObject({
      title: '盆栽園マップ | BON-LOG',
      description: '全国の盆栽園を地図で検索。地域・ジャンル・評価でフィルタリングし、営業時間や口コミを確認できます。',
    })
    // canonical は SEO 用に追加: 絶対 URL であることを確認
    expect(mod.metadata.alternates?.canonical).toMatch(/\/shops$/)
  })
})
