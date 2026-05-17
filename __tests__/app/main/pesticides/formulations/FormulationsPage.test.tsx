import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetFormulationTypes = vi.fn()
const mockGetFormulationTypeByCode = vi.fn()
const mockGetPesticides = vi.fn()

vi.mock('@/lib/actions/pesticide', () => ({
  getFormulationTypes: () => mockGetFormulationTypes(),
  getFormulationTypeByCode: (code: string) => mockGetFormulationTypeByCode(code),
  getPesticides: (opts: unknown) => mockGetPesticides(opts),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <svg data-testid="chevron-left" />,
  ChevronRight: () => <svg data-testid="chevron-right" />,
}))
vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="disclaimer" />,
}))

function makeFormulation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ft-1',
    name: '水和剤',
    code: 'WP',
    description: '水に懸濁して散布するタイプ。',
    _count: { pesticides: 1 },
    ...overrides,
  }
}

function makePesticide(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    name: 'テスト農薬',
    slug: 'test-pesticide',
    type: 'fungicide' as const,
    ...overrides,
  }
}

describe('FormulationsPage', () => {
  let Page: typeof import('@/app/(main)/pesticides/formulations/page').default
  let generateMetadata: typeof import('@/app/(main)/pesticides/formulations/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetPesticides.mockResolvedValue({ pesticides: [] })
    const mod = await import('@/app/(main)/pesticides/formulations/page')
    Page = mod.default
    generateMetadata = mod.generateMetadata
  })

  describe('剤型一覧表示（formulationなし）', () => {
    it('ページタイトル「剤型の違い」が表示される', async () => {
      mockGetFormulationTypes.mockResolvedValue({ formulations: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByRole('heading', { name: '剤型の違い' })).toBeInTheDocument()
    })

    it('農薬トップへのリンクが存在する', async () => {
      mockGetFormulationTypes.mockResolvedValue({ formulations: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      const link = screen.getByRole('link', { name: /農薬・病害虫トップ/ })
      expect(link).toHaveAttribute('href', '/pesticides')
    })

    it('免責事項コンポーネントが表示される', async () => {
      mockGetFormulationTypes.mockResolvedValue({ formulations: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
    })

    it('剤型一覧が表示される', async () => {
      mockGetFormulationTypes.mockResolvedValue({
        formulations: [
          makeFormulation({ id: 'ft-1', name: '水和剤', code: 'WP' }),
          makeFormulation({ id: 'ft-2', name: '乳剤', code: 'EC' }),
        ],
      })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('水和剤')).toBeInTheDocument()
      expect(screen.getByText('乳剤')).toBeInTheDocument()
    })

    it('剤型が0件のとき空メッセージが表示される', async () => {
      mockGetFormulationTypes.mockResolvedValue({ formulations: [] })
      const result = await Page({ searchParams: Promise.resolve({}) })
      render(result)
      expect(screen.getByText('剤型データはまだ登録されていません')).toBeInTheDocument()
    })
  })

  describe('剤型フィルター時（formulation指定あり）', () => {
    it('剤型名を含むタイトルが表示される', async () => {
      mockGetFormulationTypes.mockResolvedValue({ formulations: [makeFormulation()] })
      mockGetFormulationTypeByCode.mockResolvedValue(makeFormulation({ name: '水和剤' }))
      mockGetPesticides.mockResolvedValue({ pesticides: [makePesticide()] })

      const result = await Page({ searchParams: Promise.resolve({ formulation: 'WP' }) })
      render(result)
      expect(screen.getByRole('heading', { name: '水和剤の薬剤一覧' })).toBeInTheDocument()
    })

    it('薬剤件数が表示される', async () => {
      mockGetFormulationTypes.mockResolvedValue({ formulations: [] })
      mockGetFormulationTypeByCode.mockResolvedValue(makeFormulation())
      mockGetPesticides.mockResolvedValue({ pesticides: [makePesticide(), makePesticide({ id: 'p-2' })] })

      const result = await Page({ searchParams: Promise.resolve({ formulation: 'WP' }) })
      render(result)
      expect(screen.getByText('2件の薬剤')).toBeInTheDocument()
    })

    it('剤型詳細情報が表示される', async () => {
      mockGetFormulationTypes.mockResolvedValue({ formulations: [] })
      mockGetFormulationTypeByCode.mockResolvedValue(makeFormulation({ description: '水に懸濁して散布するタイプ。' }))
      mockGetPesticides.mockResolvedValue({ pesticides: [] })

      const result = await Page({ searchParams: Promise.resolve({ formulation: 'WP' }) })
      render(result)
      expect(screen.getByText('水に懸濁して散布するタイプ。')).toBeInTheDocument()
    })
  })

  describe('generateMetadata', () => {
    it('formulationなしの場合はデフォルトタイトルを返す', async () => {
      const metadata = await generateMetadata({ searchParams: Promise.resolve({}) })
      expect(metadata.title).toBe('剤型の違い - 農薬・病害虫 - BON-LOG')
    })

    it('formulation指定で剤型が見つかった場合はタイトルを返す', async () => {
      mockGetFormulationTypeByCode.mockResolvedValue(makeFormulation({ name: '水和剤' }))
      const metadata = await generateMetadata({ searchParams: Promise.resolve({ formulation: 'WP' }) })
      expect(metadata.title).toBe('水和剤の薬剤一覧 - 剤型 - 農薬・病害虫 - BON-LOG')
    })

    it('formulation指定で剤型が見つからない場合はデフォルトタイトルを返す', async () => {
      mockGetFormulationTypeByCode.mockResolvedValue(null)
      const metadata = await generateMetadata({ searchParams: Promise.resolve({ formulation: 'UNKNOWN' }) })
      expect(metadata.title).toBe('剤型の違い - 農薬・病害虫 - BON-LOG')
    })
  })
})
