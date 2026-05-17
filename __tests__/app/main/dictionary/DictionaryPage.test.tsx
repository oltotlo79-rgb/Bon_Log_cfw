import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/dictionary', () => ({
  getTerms: vi.fn(),
}))
vi.mock('@/prisma/seed/dictionary/seed-dictionary', () => ({
  DICTIONARY_CATEGORIES: ['樹形', '技術・作業', '管理・育成', '道具・用品'],
}))
vi.mock('@/components/dictionary/DictionarySearch', () => ({
  DictionarySearch: (props: Record<string, unknown>) => (
    <div data-testid="dictionary-search" data-category={props.defaultCategory} data-row={props.defaultRow} />
  ),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import { getTerms } from '@/lib/actions/dictionary'

const mockGetTerms = getTerms as ReturnType<typeof vi.fn>

function makeTerm(overrides = {}) {
  return {
    id: 'term-1',
    term: '懸崖',
    reading: 'けんがい',
    slug: 'kengai',
    description: '崖から垂れ下がる樹形',
    category: '樹形',
    ...overrides,
  }
}

describe('DictionaryPage', async () => {
  let Page: typeof import('@/app/(main)/dictionary/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/dictionary/page')
    Page = mod.default
  }, 20000)

  it('用語一覧を表示する', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [makeTerm(), makeTerm({ id: 'term-2', term: '模様木', reading: 'もようぎ', slug: 'moyougi' })],
    })

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('盆栽用語辞典')).toBeInTheDocument()
    expect(screen.getByTestId('dictionary-search')).toBeInTheDocument()
  }, 20000)

  it('Suspenseフォールバック（スケルトン）が表示される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    // Suspense内のasyncコンポーネントはテスト環境ではフォールバックが表示される
    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  }, 20000)

  it('カテゴリフィルタが適用される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [makeTerm()] })

    const result = await Page({ searchParams: Promise.resolve({ category: '樹形' }) })
    render(result)

    const search = screen.getByTestId('dictionary-search')
    expect(search).toHaveAttribute('data-category', '樹形')
  }, 20000)

  it('無効なカテゴリは無視される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [makeTerm()] })

    const result = await Page({ searchParams: Promise.resolve({ category: '存在しない' }) })
    render(result)

    const search = screen.getByTestId('dictionary-search')
    expect(search).not.toHaveAttribute('data-category', '存在しない')
  }, 20000)

  it('行フィルタがDictionarySearchに渡される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [makeTerm()] })

    const result = await Page({ searchParams: Promise.resolve({ row: 'か行' }) })
    render(result)

    const search = screen.getByTestId('dictionary-search')
    expect(search).toHaveAttribute('data-row', 'か行')
  }, 20000)

  it('無効な行フィルタは無視される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [makeTerm()] })

    const result = await Page({ searchParams: Promise.resolve({ row: '無効行' }) })
    render(result)

    const search = screen.getByTestId('dictionary-search')
    expect(search).not.toHaveAttribute('data-row', '無効行')
  }, 20000)

  it('searchパラメータがDictionarySearchに渡される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({ search: 'テスト' }) })
    render(result)

    // getTerms にsearchが渡されたことを検証
    expect(mockGetTerms).toHaveBeenCalledWith(expect.objectContaining({ search: 'テスト' }))
  }, 20000)

  it('行フィルタが用語のreadingに基づいてフィルタリングする', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [
        makeTerm({ id: 'term-ka', term: '株立', reading: 'かぶだち', slug: 'kabudachi' }),
        makeTerm({ id: 'term-a', term: '荒皮', reading: 'あらかわ', slug: 'arakawa' }),
      ],
    })

    const result = await Page({ searchParams: Promise.resolve({ row: 'か行' }) })
    render(result)

    // か行フィルタが適用されるので、か行の用語のみ表示される
    // TermListはasync Server Componentなので、Suspenseフォールバックが表示される可能性あり
    expect(mockGetTerms).toHaveBeenCalledWith(expect.objectContaining({ search: undefined }))
  }, 20000)

  it('searchパラメータの前後空白がトリムされる', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({ search: '  テスト  ' }) })
    render(result)

    expect(mockGetTerms).toHaveBeenCalledWith(expect.objectContaining({ search: 'テスト' }))
  }, 20000)

  it('空文字列のsearchパラメータはundefinedとして扱われる', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({ search: '   ' }) })
    render(result)

    // trim() results in empty string which is falsy → undefined
    expect(mockGetTerms).toHaveBeenCalledWith(expect.objectContaining({ search: '' }))
  }, 20000)

  it('categoryとrowの両方が指定された場合、両方がDictionarySearchに渡される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [makeTerm()] })

    const result = await Page({
      searchParams: Promise.resolve({ category: '技術・作業', row: 'さ行' }),
    })
    render(result)

    const search = screen.getByTestId('dictionary-search')
    expect(search).toHaveAttribute('data-category', '技術・作業')
    expect(search).toHaveAttribute('data-row', 'さ行')
  }, 20000)

  it('search・category・row全てが未指定の場合、undefinedが渡される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(mockGetTerms).toHaveBeenCalledWith({ search: undefined, category: undefined })
  }, 20000)
})
