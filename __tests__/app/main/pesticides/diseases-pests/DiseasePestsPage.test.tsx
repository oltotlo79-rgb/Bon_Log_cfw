import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/pesticide', () => ({
  getDiseasePests: vi.fn(),
}))
vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="disclaimer" />,
}))
vi.mock('../../../app/main/pesticides/diseases-pests/DiseasePestList', () => ({
  DiseasePestList: (props: Record<string, unknown>) => (
    <div data-testid="disease-pest-list" data-count={String((props.diseasePests as unknown[])?.length ?? 0)} />
  ),
}))
// Mock the actual relative import path used by the page
vi.mock('@/app/(main)/pesticides/diseases-pests/DiseasePestList', () => ({
  DiseasePestList: (props: Record<string, unknown>) => (
    <div data-testid="disease-pest-list" data-count={String((props.diseasePests as unknown[])?.length ?? 0)} />
  ),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

import { getDiseasePests } from '@/lib/actions/pesticide'

const mockGetDiseasePests = getDiseasePests as ReturnType<typeof vi.fn>

describe('DiseasePestsPage', async () => {
  let Page: typeof import('@/app/(main)/pesticides/diseases-pests/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/diseases-pests/page')
    Page = mod.default
  }, 20000)

  it('病害虫一覧ページを表示する', async () => {
    mockGetDiseasePests.mockResolvedValue({ diseasePests: [{ id: 'dp-1', name: 'うどんこ病' }] })

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('病害虫・益虫図鑑')).toBeInTheDocument()
    expect(screen.getByText('1件')).toBeInTheDocument()
    expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
  }, 20000)

  it('カテゴリとsearchパラメータを渡す', async () => {
    mockGetDiseasePests.mockResolvedValue({ diseasePests: [] })

    await Page({ searchParams: Promise.resolve({ category: 'disease', search: 'うどんこ' }) })

    expect(mockGetDiseasePests).toHaveBeenCalledWith({
      category: 'disease',
      search: 'うどんこ',
      bodySizeMm: undefined,
    })
  }, 20000)

  it('bodySizeMmパラメータをパースする', async () => {
    mockGetDiseasePests.mockResolvedValue({ diseasePests: [] })

    await Page({ searchParams: Promise.resolve({ bodySizeMm: '3.5' }) })

    expect(mockGetDiseasePests).toHaveBeenCalledWith(
      expect.objectContaining({ bodySizeMm: 3.5 })
    )
  }, 20000)

  it('農薬トップへのリンクがある', async () => {
    mockGetDiseasePests.mockResolvedValue({ diseasePests: [] })

    const result = await Page({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByText('農薬・病害虫トップ')).toBeInTheDocument()
  }, 20000)
})
