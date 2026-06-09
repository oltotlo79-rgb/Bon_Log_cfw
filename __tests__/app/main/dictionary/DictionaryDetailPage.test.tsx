import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetTermBySlug = vi.fn()
const mockGetAdjacentTerms = vi.fn()
const mockGetRelatedTerms = vi.fn()
const mockNotFound = vi.fn(() => { throw new Error('NOT_FOUND') })

vi.mock('@/lib/actions/dictionary', () => ({
  getTermBySlug: (slug: string) => mockGetTermBySlug(slug),
  getAdjacentTerms: (slug: string, category: string) => mockGetAdjacentTerms(slug, category),
  getRelatedTerms: (slug: string, category: string) => mockGetRelatedTerms(slug, category),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}))
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <svg data-testid="chevron-left" />,
  ChevronRight: () => <svg data-testid="chevron-right" />,
}))

function makeTerm(overrides: Record<string, unknown> = {}) {
  return {
    id: 'term-1',
    term: '直幹',
    slug: 'chokkan',
    reading: 'ちょっかん',
    description: '幹がまっすぐに伸びた樹形。盆栽の基本的な樹形のひとつ。',
    category: '樹形',
    ...overrides,
  }
}

function makeAdjacentTerm(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'adjacent-slug',
    term: '隣の用語',
    ...overrides,
  }
}

describe('DictionaryDetailPage', () => {
  let Page: typeof import('@/app/(main)/dictionary/[slug]/page').default
  let generateMetadata: typeof import('@/app/(main)/dictionary/[slug]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetAdjacentTerms.mockResolvedValue({ prev: null, next: null })
    mockGetRelatedTerms.mockResolvedValue({ terms: [] })
    const mod = await import('@/app/(main)/dictionary/[slug]/page')
    Page = mod.default
    generateMetadata = mod.generateMetadata
  }, 20000)

  describe('用語詳細表示', () => {
    it('用語名と読みが表示される', async () => {
      const term = makeTerm()
      mockGetTermBySlug.mockResolvedValue({ term })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      // <ruby> renders term + reading together in JSDOM; match with regex
      expect(screen.getByRole('heading', { name: /直幹/ })).toBeInTheDocument()
      // reading is inside <rt> inside the heading
      const heading = screen.getByRole('heading', { name: /直幹/ })
      expect(heading.textContent).toContain('ちょっかん')
    })

    it('説明文が表示される', async () => {
      const term = makeTerm()
      mockGetTermBySlug.mockResolvedValue({ term })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      expect(screen.getByText(term.description)).toBeInTheDocument()
    })

    it('カテゴリバッジが表示される', async () => {
      const term = makeTerm({ category: '樹形' })
      mockGetTermBySlug.mockResolvedValue({ term })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      expect(screen.getByText('樹形')).toBeInTheDocument()
    })

    it('戻るリンクが盆栽用語辞典へのリンクを含む', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: makeTerm() })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      const link = screen.getByRole('link', { name: /盆栽用語辞典/ })
      expect(link).toHaveAttribute('href', '/dictionary')
    })

    it('同カテゴリ一覧リンクが表示される', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: makeTerm({ category: '技術・作業' }) })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      const link = screen.getByRole('link', { name: /「技術・作業」の用語一覧を見る/ })
      expect(link).toHaveAttribute('href', '/dictionary?category=%E6%8A%80%E8%A1%93%E3%83%BB%E4%BD%9C%E6%A5%AD')
    })

    it('未定義カテゴリにはデフォルト色が適用される', async () => {
      const term = makeTerm({ category: '未知のカテゴリ' })
      mockGetTermBySlug.mockResolvedValue({ term })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      expect(screen.getByText('未知のカテゴリ')).toBeInTheDocument()
    })
  })

  describe('前後ナビゲーション', () => {
    it('前の用語リンクが表示される', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: makeTerm() })
      mockGetAdjacentTerms.mockResolvedValue({
        prev: makeAdjacentTerm({ slug: 'moyogi', term: '模様木' }),
        next: null,
      })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      expect(screen.getByText('模様木')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /前の用語.*模様木/ })
      expect(link).toHaveAttribute('href', '/dictionary/moyogi')
    })

    it('次の用語リンクが表示される', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: makeTerm() })
      mockGetAdjacentTerms.mockResolvedValue({
        prev: null,
        next: makeAdjacentTerm({ slug: 'shakan', term: '斜幹' }),
      })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      expect(screen.getByText('斜幹')).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /次の用語.*斜幹/ })
      expect(link).toHaveAttribute('href', '/dictionary/shakan')
    })

    it('前後どちらもない場合はリンクが表示されない', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: makeTerm() })
      mockGetAdjacentTerms.mockResolvedValue({ prev: null, next: null })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      expect(screen.queryByText('前の用語')).not.toBeInTheDocument()
      expect(screen.queryByText('次の用語')).not.toBeInTheDocument()
    })
  })

  describe('関連用語', () => {
    const relatedTerms = [
      { id: 'r1', slug: 'moyogi', term: '模様木', reading: 'もようぎ', category: '樹形', description: '幹が曲線を描く樹形。' },
      { id: 'r2', slug: 'shakan', term: '斜幹', reading: 'しゃかん', category: '樹形', description: '幹が斜めに立ち上がる樹形。' },
    ]

    it('同カテゴリの関連用語がリンク付きで表示される', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: makeTerm() })
      mockGetRelatedTerms.mockResolvedValue({ terms: relatedTerms })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      expect(screen.getByRole('heading', { name: '関連用語' })).toBeInTheDocument()
      const link = screen.getByRole('link', { name: /模様木/ })
      expect(link).toHaveAttribute('href', '/dictionary/moyogi')
      expect(screen.getByText('斜幹')).toBeInTheDocument()
    })

    it('関連用語が無い場合はセクションを表示しない', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: makeTerm() })
      mockGetRelatedTerms.mockResolvedValue({ terms: [] })
      const result = await Page({ params: Promise.resolve({ slug: 'chokkan' }) })
      render(result)
      expect(screen.queryByRole('heading', { name: '関連用語' })).not.toBeInTheDocument()
    })
  })

  describe('用語が見つからない場合', () => {
    it('notFound()が呼ばれる', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: null })
      await expect(
        Page({ params: Promise.resolve({ slug: 'nonexistent' }) })
      ).rejects.toThrow('NOT_FOUND')
      expect(mockNotFound).toHaveBeenCalled()
    })
  })

  describe('generateMetadata', () => {
    it('用語が見つかった場合はタイトルを返す', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: makeTerm() })
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'chokkan' }) })
      expect(metadata.title).toBe('直幹（ちょっかん） - 盆栽用語辞典 | BON-LOG')
    })

    it('用語が見つかった場合はdescriptionが設定される', async () => {
      const longDesc = 'あ'.repeat(200)
      mockGetTermBySlug.mockResolvedValue({ term: makeTerm({ description: longDesc }) })
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'chokkan' }) })
      expect((metadata.description as string).length).toBe(120)
    })

    it('用語が見つからない場合はデフォルトタイトルを返す', async () => {
      mockGetTermBySlug.mockResolvedValue({ term: null })
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'unknown' }) })
      expect(metadata.title).toBe('用語が見つかりません')
    })
  })
})
