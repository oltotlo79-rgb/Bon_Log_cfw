/**
 * DictionaryPage - branch coverage for inner components
 *
 * Tests TermCard, EmptyState, TermList, and groupByRow by mocking Suspense
 * to call async children and render their resolved result.
 * This covers lines 36-72 and 161-188 of page.tsx.
 */
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

// Mock Suspense to resolve async function components
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@/lib/actions/dictionary', () => ({
  getTerms: vi.fn(),
}))

vi.mock('@/prisma/seed/dictionary/seed-dictionary', () => ({
  DICTIONARY_CATEGORIES: ['樹形', '技術・作業', '管理・育成', '道具・用品', '盆器・鉢', '用土・肥料', '展示・鑑賞'],
}))

vi.mock('@/components/dictionary/DictionarySearch', () => ({
  DictionarySearch: () => <div data-testid="dictionary-search" />,
}))

// 広告ユニットは hooks を使う Client Component。SC walker が直接呼ぶと
// "Invalid hook call" になるため mock する (production レンダリングには影響しない)。
vi.mock('@/components/ads', () => ({
  PostDetailAdUnit: () => <div data-testid="ad-unit" />,
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: { src: string; alt: string }) => <img src={props.src} alt={props.alt} />,
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import { getTerms } from '@/lib/actions/dictionary'

const mockGetTerms = getTerms as ReturnType<typeof vi.fn>

function makeTerm(overrides: Record<string, string> = {}) {
  return {
    id: overrides.id ?? 'term-1',
    slug: overrides.slug ?? 'chokkan',
    term: overrides.term ?? '直幹',
    reading: overrides.reading ?? 'ちょっかん',
    category: overrides.category ?? '樹形',
    description: overrides.description ?? 'まっすぐな幹の樹形',
  }
}

/**
 * Helper to render a page that contains async Server Components.
 * Walks the JSX tree, finds async function components, awaits them,
 * and replaces them with their resolved output.
 */
async function resolveAsyncJsx(element: React.ReactElement): Promise<React.ReactElement> {
  if (!element || typeof element !== 'object') return element

  const { type, props } = element
  const typedProps = props as Record<string, unknown>

  // If this is an async function component, call it and await
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

  // Recursively resolve children
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

async function renderPage(searchParams: Record<string, string> = {}) {
  const { default: Page } = await import('@/app/(main)/dictionary/page')
  const pageResult = await Page({ searchParams: Promise.resolve(searchParams) })
  const resolved = await resolveAsyncJsx(pageResult)
  render(resolved)
}

describe('DictionaryPage - TermCard branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders TermCard with known category (emerald color for 樹形)', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ category: '樹形' })],
    })

    await renderPage()

    expect(screen.getByText('直幹')).toBeInTheDocument()
    const categoryBadge = screen.getByText('樹形')
    expect(categoryBadge.className).toContain('bg-emerald-100')
  })

  it('renders TermCard with unknown category (fallback stone color)', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ category: '未分類テスト' })],
    })

    await renderPage()

    const badge = screen.getByText('未分類テスト')
    expect(badge.className).toContain('bg-stone-100')
    expect(badge.className).toContain('text-stone-700')
  })

  it('renders TermCard with 技術・作業 category (blue color)', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ category: '技術・作業', reading: 'せんてい', term: '剪定' })],
    })

    await renderPage()

    expect(screen.getByText('技術・作業').className).toContain('bg-blue-100')
  })

  it('renders TermCard with 道具・用品 category (orange color)', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ category: '道具・用品', reading: 'はさみ', term: 'はさみ' })],
    })

    await renderPage()

    expect(screen.getByText('道具・用品').className).toContain('bg-orange-100')
  })

  it('renders TermCard with 展示・鑑賞 category (purple color)', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ category: '展示・鑑賞', reading: 'てんじ', term: '展示' })],
    })

    await renderPage()

    expect(screen.getByText('展示・鑑賞').className).toContain('bg-purple-100')
  })
})

describe('DictionaryPage - EmptyState branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows default empty message when no filters are active', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    await renderPage()

    expect(screen.getByText('用語が登録されていません。')).toBeInTheDocument()
  })

  it('shows filter message with search term', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    await renderPage({ search: '松' })

    expect(screen.getByText(/「松」に一致する用語が見つかりませんでした。/)).toBeInTheDocument()
  })

  it('shows filter message with category only', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    await renderPage({ category: '樹形' })

    expect(screen.getByText(/「樹形」に一致する用語が見つかりませんでした。/)).toBeInTheDocument()
  })

  it('shows filter message with row only', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    await renderPage({ row: 'あ行' })

    expect(screen.getByText(/「あ行」に一致する用語が見つかりませんでした。/)).toBeInTheDocument()
  })

  it('shows filter message with row + category + search combined', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    await renderPage({ row: 'か行', category: '道具・用品', search: 'はさみ' })

    expect(screen.getByText(/「か行 \/ 道具・用品 \/ はさみ」に一致する用語が見つかりませんでした。/)).toBeInTheDocument()
  })

  it('shows empty state when row filter excludes all returned terms', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ reading: 'かぶだち' })],
    })

    await renderPage({ row: 'さ行' })

    expect(screen.getByText(/「さ行」に一致する用語が見つかりませんでした。/)).toBeInTheDocument()
  })
})

describe('DictionaryPage - groupByRow / row filter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('groups terms by kana row in あいうえお order', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [
        makeTerm({ id: '1', reading: 'さしき', term: '挿し木', slug: 'sashiki' }),
        makeTerm({ id: '2', reading: 'あらき', term: '荒木', slug: 'araki' }),
        makeTerm({ id: '3', reading: 'かぶだち', term: '株立', slug: 'kabudachi' }),
      ],
    })

    await renderPage()

    expect(screen.getByText('あ行')).toBeInTheDocument()
    expect(screen.getByText('か行')).toBeInTheDocument()
    expect(screen.getByText('さ行')).toBeInTheDocument()

    expect(screen.getByText('荒木')).toBeInTheDocument()
    expect(screen.getByText('株立')).toBeInTheDocument()
    expect(screen.getByText('挿し木')).toBeInTheDocument()
  })

  it('places non-kana readings in その他 group', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ id: '1', reading: 'XYZ', term: 'XYZ用語', slug: 'xyz' })],
    })

    await renderPage()

    expect(screen.getByText('その他')).toBeInTheDocument()
    expect(screen.getByText('XYZ用語')).toBeInTheDocument()
  })

  it('filters terms by row and shows only matching terms', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [
        makeTerm({ id: '1', reading: 'あらき', term: '荒木' }),
        makeTerm({ id: '2', reading: 'いしづき', term: '石付き' }),
        makeTerm({ id: '3', reading: 'かぶだち', term: '株立' }),
      ],
    })

    await renderPage({ row: 'あ行' })

    expect(screen.getByText('荒木')).toBeInTheDocument()
    expect(screen.getByText('石付き')).toBeInTheDocument()
    expect(screen.queryByText('株立')).not.toBeInTheDocument()
  })

  it('handles dakuten kana correctly (ご -> か行)', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ id: '1', reading: 'ごぼうね', term: '牛蒡根', slug: 'goboune' })],
    })

    await renderPage({ row: 'か行' })

    expect(screen.getByText('牛蒡根')).toBeInTheDocument()
  })

  it('renders term count', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [
        makeTerm({ id: '1', reading: 'あ' }),
        makeTerm({ id: '2', reading: 'い' }),
        makeTerm({ id: '3', reading: 'う' }),
      ],
    })

    await renderPage()

    expect(screen.getByText('3件')).toBeInTheDocument()
  })

  it('renders term description and reading in TermCard', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ reading: 'ちょっかん', description: 'まっすぐな幹の樹形' })],
    })

    await renderPage()

    expect(screen.getByText('ちょっかん')).toBeInTheDocument()
    expect(screen.getByText('まっすぐな幹の樹形')).toBeInTheDocument()
  })

  it('renders link to term detail page', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm({ slug: 'chokkan' })],
    })

    await renderPage()

    const link = screen.getByText('直幹').closest('a')
    expect(link).toHaveAttribute('href', '/dictionary/chokkan')
  })
})
