import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetDiseasePests = vi.fn()
const mockGetPesticides = vi.fn()
const mockGetSpreaderProducts = vi.fn()

vi.mock('@/lib/actions/pesticide', () => ({
  getDiseasePests: () => mockGetDiseasePests(),
  getPesticides: (opts: unknown) => mockGetPesticides(opts),
  getSpreaderProducts: () => mockGetSpreaderProducts(),
}))
vi.mock('@/lib/utils/pesticide', () => ({
  normalizePesticideType: (type: string | undefined) => {
    if (!type) return undefined
    if (type === 'herbicide') return 'other'
    if (['fungicide', 'insecticide', 'acaricide', 'compound', 'other'].includes(type)) return type
    return undefined
  },
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('lucide-react', () => ({
  ChevronRight: () => <svg data-testid="chevron-right" />,
  Bug: () => <svg data-testid="icon-bug" />,
  Beaker: () => <svg data-testid="icon-beaker" />,
  FlaskConical: () => <svg data-testid="icon-flask" />,
  Droplets: () => <svg data-testid="icon-droplets" />,
  BookOpen: () => <svg data-testid="icon-book" />,
  SprayCan: () => <svg data-testid="icon-spray-can" />,
  FlaskRound: () => <svg data-testid="icon-flask-round" />,
  Calculator: () => <svg data-testid="icon-calculator" />,
}))
vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="disclaimer" />,
}))
vi.mock('@/app/(main)/pesticides/PesticideSearchForm', () => ({
  PesticideSearchForm: (props: Record<string, unknown>) => (
    <div data-testid="search-form" data-default-search={props.defaultSearch} data-default-type={props.defaultType} />
  ),
}))
vi.mock('@/app/(main)/pesticides/DiseasePestGrid', () => ({
  DiseasePestGrid: (props: Record<string, unknown>) => (
    <div data-testid="disease-pest-grid" data-filter={props.filterByCategory} />
  ),
}))
vi.mock('@/app/(main)/pesticides/PesticideAllList', () => ({
  PesticideAllList: () => <div data-testid="pesticide-all-list" />,
}))
vi.mock('@/app/(main)/pesticides/PesticideResults', () => ({
  PesticideResults: (props: Record<string, unknown>) => (
    <div data-testid="pesticide-results" data-count={Array.isArray(props.pesticides) ? props.pesticides.length : 0} />
  ),
}))
vi.mock('@/app/(main)/pesticides/SpreaderResults', () => ({
  SpreaderResults: (props: Record<string, unknown>) => (
    <div data-testid="spreader-results" data-count={Array.isArray(props.pesticides) ? props.pesticides.length : 0} />
  ),
}))

describe('PesticideTopPage', () => {
  let Page: typeof import('@/app/(main)/pesticides/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetDiseasePests.mockResolvedValue({ diseasePests: [] })
    mockGetPesticides.mockResolvedValue({ pesticides: [] })
    mockGetSpreaderProducts.mockResolvedValue({ pesticides: [] })
    const mod = await import('@/app/(main)/pesticides/page')
    Page = mod.default
  }, 20000)

  describe('基本表示', () => {
    it('ページタイトルが表示される', async () => {
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByRole('heading', { name: '農薬・病害虫' })).toBeInTheDocument()
    })

    it('説明文が表示される', async () => {
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText(/病害虫を選んで効く薬剤を検索/)).toBeInTheDocument()
    })

    it('免責事項コンポーネントが表示される', async () => {
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
    })

    it('検索フォームが表示される', async () => {
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByTestId('search-form')).toBeInTheDocument()
    })

    it('ナビゲーションリンクが8つ表示される', async () => {
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByRole('link', { name: /病害虫・益虫図鑑/ })).toHaveAttribute('href', '/pesticides/diseases-pests')
      expect(screen.getByRole('link', { name: /有効成分（原体）一覧/ })).toHaveAttribute('href', '/pesticides/ingredients')
      expect(screen.getByRole('link', { name: /剤型の違い/ })).toHaveAttribute('href', '/pesticides/formulations')
      expect(screen.getByRole('link', { name: /展着剤/ })).toHaveAttribute('href', '/pesticides/spreaders')
      expect(screen.getByRole('link', { name: /コラム・読みもの/ })).toHaveAttribute('href', '/pesticides/columns')
      expect(screen.getByRole('link', { name: /散布方法ガイド/ })).toHaveAttribute('href', '/pesticides/spray-guide')
      expect(screen.getByRole('link', { name: /混用チェッカー/ })).toHaveAttribute('href', '/pesticides/mixing-checker')
      expect(screen.getByRole('link', { name: /希釈計算ツール/ })).toHaveAttribute('href', '/pesticides/dilution-calculator')
    })
  })

  describe('検索パラメータなし（一覧表示）', () => {
    it('PesticideAllListが表示される', async () => {
      mockGetPesticides.mockResolvedValue({ pesticides: [] })
      mockGetSpreaderProducts.mockResolvedValue({ pesticides: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByTestId('pesticide-all-list')).toBeInTheDocument()
      expect(screen.getByText('一覧（あいうえお順）')).toBeInTheDocument()
    })
  })

  describe('カテゴリフィルター', () => {
    it('category=pestのときDiseasePestGridが表示される', async () => {
      const result = await Page({ searchParams: Promise.resolve({ category: 'pest' }) })
      render(result)
      expect(screen.getByTestId('disease-pest-grid')).toBeInTheDocument()
      expect(screen.getByText('病害虫から探す')).toBeInTheDocument()
    })

    it('category=diseaseのときDiseasePestGridが表示される', async () => {
      const result = await Page({ searchParams: Promise.resolve({ category: 'disease' }) })
      render(result)
      expect(screen.getByTestId('disease-pest-grid')).toBeInTheDocument()
    })

    it('category=beneficial_insectのときDiseasePestGridが表示される', async () => {
      const result = await Page({ searchParams: Promise.resolve({ category: 'beneficial_insect' }) })
      render(result)
      expect(screen.getByTestId('disease-pest-grid')).toBeInTheDocument()
    })

    it('不正なcategoryは無視されPesticideAllListが表示される', async () => {
      mockGetPesticides.mockResolvedValue({ pesticides: [] })
      mockGetSpreaderProducts.mockResolvedValue({ pesticides: [] })
      const result = await Page({ searchParams: Promise.resolve({ category: 'invalid' }) })
      render(result)
      expect(screen.getByTestId('pesticide-all-list')).toBeInTheDocument()
    })
  })

  describe('検索結果表示', () => {
    it('diseasePest指定でPesticideResultsが表示される', async () => {
      mockGetPesticides.mockResolvedValue({ pesticides: [{ id: 'p-1', name: 'テスト農薬', slug: 'test', pesticideType: 'fungicide' }] })
      const result = await Page({ searchParams: Promise.resolve({ diseasePest: 'dp-1' }) })
      render(result)
      expect(screen.getByTestId('pesticide-results')).toBeInTheDocument()
    })

    it('search指定でPesticideResultsが表示される', async () => {
      mockGetPesticides.mockResolvedValue({ pesticides: [] })
      const result = await Page({ searchParams: Promise.resolve({ search: 'テスト' }) })
      render(result)
      expect(screen.getByTestId('pesticide-results')).toBeInTheDocument()
    })

    it('type=fungicideでPesticideResultsが表示される', async () => {
      mockGetPesticides.mockResolvedValue({ pesticides: [] })
      const result = await Page({ searchParams: Promise.resolve({ type: 'fungicide' }) })
      render(result)
      expect(screen.getByTestId('pesticide-results')).toBeInTheDocument()
    })

    it('type=spreaderでSpreaderResultsが表示される', async () => {
      mockGetSpreaderProducts.mockResolvedValue({ pesticides: [{ id: 's-1', name: '展着剤A' }] })
      const result = await Page({ searchParams: Promise.resolve({ type: 'spreader' }) })
      render(result)
      expect(screen.getByTestId('spreader-results')).toBeInTheDocument()
    })
  })

  describe('metadata', () => {
    it('静的metadataが正しく設定されている', async () => {
      const { BASE_URL } = await import('@/lib/constants/routes')
      const mod = await import('@/app/(main)/pesticides/page')
      expect(mod.metadata).toEqual({
        title: '農薬・病害虫',
        description: '病害虫から効く薬剤を検索。農薬の成分・FRAC/IRACコード・剤型情報を確認できます。',
        alternates: { canonical: `${BASE_URL}/pesticides` },
      })
    })
  })

  // ============================================================
  // map / filter 内のコールバックを実行し、function カバレッジを上げる
  // ============================================================
  describe('一覧モードの map/filter カバレッジ', () => {
    it('disease/pest/beneficial の filter コールバックが各カウントを返し、allProducts/spreaderIds の map が走る', async () => {
      mockGetDiseasePests.mockResolvedValue({
        diseasePests: [
          { id: 'd-1', category: 'disease', name: 'うどんこ病' },
          { id: 'd-2', category: 'disease', name: '黒星病' },
          { id: 'p-1', category: 'pest', name: 'カイガラムシ' },
          { id: 'b-1', category: 'beneficial_insect', name: 'テントウムシ' },
        ],
      })
      // allProducts 用 (1 回目) と spreaderIds 用 (2 回目) で異なる結果を返す
      mockGetPesticides.mockResolvedValueOnce({
        pesticides: [
          { id: 'pe-1', name: '農薬A', slug: 'a', pesticideType: 'fungicide' },
          { id: 'pe-2', name: '農薬B', slug: 'b', pesticideType: 'insecticide' },
        ],
      })
      mockGetSpreaderProducts.mockResolvedValueOnce({
        pesticides: [{ id: 'sp-1', name: '展着剤X' }],
      })

      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      // 病害2件・害虫1件・益虫1件 が navCards.description に展開される
      expect(screen.getByText(/病害2件・害虫1件・益虫1件/)).toBeInTheDocument()
      expect(screen.getByTestId('pesticide-all-list')).toBeInTheDocument()
    })

    it('allProductsRes[0] が null のとき (showResults true) でも spreaderIds がフォールバック [] になる', async () => {
      mockGetPesticides.mockResolvedValueOnce({
        pesticides: [{ id: 'pe-1', name: '農薬A', slug: 'a', pesticideType: 'fungicide' }],
      })
      const result = await Page({ searchParams: Promise.resolve({ search: 'something' }) })
      render(result)
      expect(screen.getByTestId('pesticide-results')).toHaveAttribute('data-count', '1')
    })
  })
})
