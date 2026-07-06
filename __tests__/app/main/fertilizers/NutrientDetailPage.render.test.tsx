import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * NutrientDetailPage の実描画テスト。
 * fertilizer-pages.test.tsx (node 環境で実行) は `result` を検証するのみで
 * 実際に render() しないため、子コンポーネント InfoSection（warning/danger variant含む）と
 * 関連栄養素の filter/map コールバックが一度も呼ばれない。ここでは jsdom で実際に描画し、
 * その分岐を検証する。
 */

const mockGetNutrientBySlug = vi.fn()
const mockGetNutrients = vi.fn()
vi.mock('@/lib/actions/fertilizer', () => ({
  getNutrientBySlug: (...args: unknown[]) => mockGetNutrientBySlug(...args),
  getNutrients: (...args: unknown[]) => mockGetNutrients(...args),
}))

vi.mock('next/navigation', () => ({
  notFound: () => { throw new Error('NOT_FOUND') },
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/fertilizer/NutrientCategoryBadge', () => ({
  NutrientCategoryBadge: ({ category }: { category: string }) => (
    <span data-testid={`category-badge-${category}`} />
  ),
}))

vi.mock('@/components/fertilizer/NutrientCard', () => ({
  NutrientCard: ({ nutrient }: { nutrient: { id: string; name: string } }) => (
    <div data-testid={`related-nutrient-${nutrient.id}`}>{nutrient.name}</div>
  ),
}))

const fullNutrient = {
  id: 'n1',
  name: '窒素',
  nameEn: 'Nitrogen',
  slug: 'nitrogen',
  symbol: 'N',
  category: 'primary' as const,
  description: '植物の成長に欠かせない三大要素の一つ',
  bonsaiRole: '葉の成長を促進する',
  deficiencySymptoms: '葉が黄色くなる',
  excessSymptoms: '徒長する',
  foodSources: '油かす、魚粉',
}

describe('NutrientDetailPage (rendered)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetNutrients.mockResolvedValue({ nutrients: [] })
  })

  it('概要・役割・欠乏症状(warning)・過剰症状(danger)・供給源をすべて描画する', async () => {
    mockGetNutrientBySlug.mockResolvedValue(fullNutrient)

    const { default: NutrientDetailPage } = await import('@/app/(main)/fertilizers/nutrients/[slug]/page')
    const result = await NutrientDetailPage({ params: Promise.resolve({ slug: 'nitrogen' }) })
    render(result)

    expect(screen.getByText('概要')).toBeInTheDocument()
    expect(screen.getByText('植物の成長に欠かせない三大要素の一つ')).toBeInTheDocument()
    expect(screen.getByText('盆栽での役割')).toBeInTheDocument()
    expect(screen.getByText('欠乏症状')).toBeInTheDocument()
    expect(screen.getByText('葉が黄色くなる')).toBeInTheDocument()
    expect(screen.getByText('過剰症状')).toBeInTheDocument()
    expect(screen.getByText('徒長する')).toBeInTheDocument()
    expect(screen.getByText('主な供給源')).toBeInTheDocument()
  })

  it('同カテゴリの関連栄養素を自分を除いて最大3件描画する', async () => {
    mockGetNutrientBySlug.mockResolvedValue(fullNutrient)
    mockGetNutrients.mockResolvedValue({
      nutrients: [
        fullNutrient, // 自分自身は除外される
        { id: 'n2', name: 'リン', category: 'primary' },
        { id: 'n3', name: 'カリウム', category: 'primary' },
        { id: 'n4', name: 'カルシウム', category: 'secondary' }, // 別カテゴリなので除外
        { id: 'n5', name: 'マグネシウム', category: 'primary' },
        { id: 'n6', name: '硫黄', category: 'primary' }, // 3件超過分は切り捨て
      ],
    })

    const { default: NutrientDetailPage } = await import('@/app/(main)/fertilizers/nutrients/[slug]/page')
    const result = await NutrientDetailPage({ params: Promise.resolve({ slug: 'nitrogen' }) })
    render(result)

    expect(screen.getByText('同じカテゴリの栄養素')).toBeInTheDocument()
    expect(screen.getByTestId('related-nutrient-n2')).toBeInTheDocument()
    expect(screen.getByTestId('related-nutrient-n3')).toBeInTheDocument()
    expect(screen.getByTestId('related-nutrient-n5')).toBeInTheDocument()
    expect(screen.queryByTestId('related-nutrient-n4')).not.toBeInTheDocument()
    expect(screen.queryByTestId('related-nutrient-n6')).not.toBeInTheDocument()
    expect(screen.queryByTestId('related-nutrient-n1')).not.toBeInTheDocument()
  })

  it('関連栄養素が無い場合はセクション自体を描画しない', async () => {
    mockGetNutrientBySlug.mockResolvedValue(fullNutrient)
    mockGetNutrients.mockResolvedValue({ nutrients: [fullNutrient] })

    const { default: NutrientDetailPage } = await import('@/app/(main)/fertilizers/nutrients/[slug]/page')
    const result = await NutrientDetailPage({ params: Promise.resolve({ slug: 'nitrogen' }) })
    render(result)

    expect(screen.queryByText('同じカテゴリの栄養素')).not.toBeInTheDocument()
  })
})
