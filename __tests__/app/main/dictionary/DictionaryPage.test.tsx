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

// TermList は Suspense 内の async Server Component。テスト環境でこの async 関数が
// suspend すると "A component suspended inside an act scope" 警告が出るため、
// 外部ファイルのコンポーネントとしてモック化して解消する。
// props を data-* 属性に記録することでページからの props 受け渡しを検証できる。
vi.mock('@/app/(main)/dictionary/TermList', () => ({
  TermList: (props: Record<string, unknown>) => (
    <div
      data-testid="term-list"
      data-search={props.search ?? ''}
      data-category={props.category ?? ''}
      data-row={props.row ?? ''}
    />
  ),
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

  it('Suspense境界内のTermListが表示される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    // TermListはモック化されているため同期的に解決される。
    // Suspense境界内にTermListコンポーネントが配置されていることを確認する。
    expect(screen.getByTestId('term-list')).toBeInTheDocument()
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

  it('searchパラメータがTermListに渡される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({ search: 'テスト' }) })
    render(result)

    // TermList へ search が渡されることを検証（TermListはモック化されているため
    // getTerms の呼び出しではなく props 受け渡しで確認する）
    const termList = screen.getByTestId('term-list')
    expect(termList).toHaveAttribute('data-search', 'テスト')
  }, 20000)

  it('行フィルタがTermListに渡される', async () => {
    mockGetTerms.mockResolvedValue({
      terms: [
        makeTerm({ id: 'term-ka', term: '株立', reading: 'かぶだち', slug: 'kabudachi' }),
        makeTerm({ id: 'term-a', term: '荒皮', reading: 'あらかわ', slug: 'arakawa' }),
      ],
    })

    const result = await Page({ searchParams: Promise.resolve({ row: 'か行' }) })
    render(result)

    // TermList に row が渡されることを検証
    const termList = screen.getByTestId('term-list')
    expect(termList).toHaveAttribute('data-row', 'か行')
  }, 20000)

  it('searchパラメータの前後空白がトリムされてTermListに渡される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({ search: '  テスト  ' }) })
    render(result)

    // DictionaryPage で trim() された値が TermList に渡されることを検証
    const termList = screen.getByTestId('term-list')
    expect(termList).toHaveAttribute('data-search', 'テスト')
  }, 20000)

  it('空白のみのsearchパラメータはtrimmingされてTermListに渡される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({ search: '   ' }) })
    render(result)

    // trim() 後に空文字列 → TermList に data-search="" が渡される
    const termList = screen.getByTestId('term-list')
    expect(termList).toHaveAttribute('data-search', '')
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

  it('search・category・row全てが未指定の場合、TermListに空props が渡される', async () => {
    mockGetTerms.mockResolvedValue({ terms: [] })

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    // search/category/row が未指定の場合、TermList の各 data-* 属性が空になる
    const termList = screen.getByTestId('term-list')
    expect(termList).toHaveAttribute('data-search', '')
    expect(termList).toHaveAttribute('data-category', '')
    expect(termList).toHaveAttribute('data-row', '')
  }, 20000)
})
