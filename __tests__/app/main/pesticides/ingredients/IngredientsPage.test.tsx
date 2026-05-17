import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetActiveIngredients = vi.fn()

vi.mock('@/lib/actions/pesticide', () => ({
  getActiveIngredients: (params: unknown) => mockGetActiveIngredients(params),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <svg data-testid="chevron-left" />,
}))
vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="disclaimer" />,
}))
vi.mock('@/app/(main)/pesticides/ingredients/IngredientSearchForm', () => ({
  IngredientSearchForm: (props: Record<string, unknown>) => (
    <div data-testid="ingredient-search-form" data-default-search={props.defaultSearch} />
  ),
}))

function makeIngredient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ing-1',
    slug: 'thiophanate-methyl',
    name: 'チオファネートメチル',
    nameEn: 'Thiophanate-methyl',
    fracCode: '1',
    iracCode: null,
    ingredientGroup: 'ベンゾイミダゾール系',
    _count: { pesticides: 5 },
    ...overrides,
  }
}

describe('IngredientsPage', () => {
  let Page: typeof import('@/app/(main)/pesticides/ingredients/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/ingredients/page')
    Page = mod.default
  }, 20000)

  describe('基本表示', () => {
    it('ページタイトル「原体一覧」が表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({ ingredients: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByRole('heading', { name: '原体一覧' })).toBeInTheDocument()
    })

    it('説明文が表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({ ingredients: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('FRAC/IRACコード・原体グループで検索可能')).toBeInTheDocument()
    })

    it('農薬トップへのリンクが存在する', async () => {
      mockGetActiveIngredients.mockResolvedValue({ ingredients: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      const link = screen.getByRole('link', { name: /農薬・病害虫トップ/ })
      expect(link).toHaveAttribute('href', '/pesticides')
    })

    it('免責事項コンポーネントが表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({ ingredients: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
    })

    it('検索フォームが表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({ ingredients: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByTestId('ingredient-search-form')).toBeInTheDocument()
    })
  })

  describe('原体一覧表示', () => {
    it('原体名が表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [makeIngredient()],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('チオファネートメチル')).toBeInTheDocument()
    })

    it('英名が表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [makeIngredient({ nameEn: 'Thiophanate-methyl' })],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('Thiophanate-methyl')).toBeInTheDocument()
    })

    it('英名がnullの場合は表示されない', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [makeIngredient({ nameEn: null })],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.queryByText('Thiophanate-methyl')).not.toBeInTheDocument()
    })

    it('FRACコードが表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [makeIngredient({ fracCode: '1' })],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('FRAC: 1')).toBeInTheDocument()
    })

    it('IRACコードが表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [makeIngredient({ fracCode: null, iracCode: '4A' })],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('IRAC: 4A')).toBeInTheDocument()
    })

    it('原体グループが表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [makeIngredient({ ingredientGroup: 'ベンゾイミダゾール系' })],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('ベンゾイミダゾール系')).toBeInTheDocument()
    })

    it('製品数が表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [makeIngredient({ _count: { pesticides: 5 } })],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('5製品')).toBeInTheDocument()
    })

    it('製品数が0の場合は製品数テキストが表示されない', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [makeIngredient({ _count: { pesticides: 0 } })],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.queryByText(/製品/)).not.toBeInTheDocument()
    })

    it('原体リンクが正しいhrefを持つ', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [makeIngredient({ slug: 'thiophanate-methyl' })],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      const link = screen.getByRole('link', { name: /チオファネートメチル/ })
      expect(link).toHaveAttribute('href', '/pesticides/ingredients/thiophanate-methyl')
    })

    it('複数の原体が表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({
        ingredients: [
          makeIngredient({ id: 'ing-1', name: 'チオファネートメチル', slug: 'thiophanate' }),
          makeIngredient({ id: 'ing-2', name: 'マンゼブ', slug: 'mancozeb', nameEn: 'Mancozeb' }),
        ],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('チオファネートメチル')).toBeInTheDocument()
      expect(screen.getByText('マンゼブ')).toBeInTheDocument()
    })
  })

  describe('空データ', () => {
    it('原体が0件のとき空メッセージが表示される', async () => {
      mockGetActiveIngredients.mockResolvedValue({ ingredients: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('原体データが見つかりませんでした')).toBeInTheDocument()
    })
  })

  describe('検索パラメータ', () => {
    it('searchパラメータがgetActiveIngredientsに渡される', async () => {
      mockGetActiveIngredients.mockResolvedValue({ ingredients: [] })
      await Page({ searchParams: Promise.resolve({ search: 'FRAC' }) })
      expect(mockGetActiveIngredients).toHaveBeenCalledWith({ search: 'FRAC' })
    })

    it('searchパラメータが検索フォームに渡される', async () => {
      mockGetActiveIngredients.mockResolvedValue({ ingredients: [] })
      const result = await Page({ searchParams: Promise.resolve({ search: 'テスト' }) })
      render(result)
      const form = screen.getByTestId('ingredient-search-form')
      expect(form).toHaveAttribute('data-default-search', 'テスト')
    })
  })

  describe('metadata', () => {
    it('静的metadataが正しく設定されている', async () => {
      const { BASE_URL } = await import('@/lib/constants/routes')
      const mod = await import('@/app/(main)/pesticides/ingredients/page')
      expect(mod.metadata).toEqual({
        title: '原体一覧 - 農薬・病害虫 - BON-LOG',
        alternates: { canonical: `${BASE_URL}/pesticides/ingredients` },
      })
    })
  })
})
