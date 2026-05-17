import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/fertilizer/NutrientCategoryBadge', () => ({
  NutrientCategoryBadge: ({ category }: { category: string }) => (
    <span data-testid={`category-badge-${category}`}>{category}</span>
  ),
}))

vi.mock('@/lib/utils/fertilizer', () => ({
  TREE_CATEGORY_BADGE: {
    conifer: { label: '松柏類', className: 'bg-emerald-100' },
    deciduous: { label: '雑木類', className: 'bg-sky-100' },
    flowering: { label: '花物', className: 'bg-rose-100' },
    fruiting: { label: '実物', className: 'bg-orange-100' },
    grass: { label: '草物', className: 'bg-lime-100' },
    evergreen: { label: '常緑広葉樹', className: 'bg-teal-100' },
  },
  NUTRIENT_CATEGORY_BADGE: {
    primary: { label: '三大要素', className: 'bg-emerald-100' },
    secondary: { label: '二次要素', className: 'bg-sky-100' },
    trace: { label: '微量要素', className: 'bg-amber-100' },
  },
}))

// ── CategoryComparisonTable ─────────────────────────────────────────

describe('CategoryComparisonTable', () => {
  it('renders cards with categories', async () => {
    const { CategoryComparisonTable } = await import('@/components/fertilizer/CategoryComparisonTable')
    const categories = [
      { name: '有機肥料', description: '天然素材由来', merit: '土壌改良効果', demerit: '遅効性', bonsaiUsage: '元肥として使用' },
      { name: '化成肥料', description: '化学的に合成', merit: '即効性がある', demerit: '土壌劣化', bonsaiUsage: '追肥として使用' },
    ]

    render(<CategoryComparisonTable categories={categories} />)

    // Category names render
    expect(screen.getByText('有機肥料')).toBeInTheDocument()
    expect(screen.getByText('化成肥料')).toBeInTheDocument()

    // Content renders
    expect(screen.getByText('天然素材由来')).toBeInTheDocument()
    expect(screen.getByText('即効性がある')).toBeInTheDocument()
  })

  it('renders empty state with no categories', async () => {
    const { CategoryComparisonTable } = await import('@/components/fertilizer/CategoryComparisonTable')
    const { container } = render(<CategoryComparisonTable categories={[]} />)

    // No category cards should be present
    expect(container.querySelectorAll('[class*="rounded-lg border"]')).toHaveLength(0)
  })

  it('renders merit/demerit/bonsaiUsage labels', async () => {
    const { CategoryComparisonTable } = await import('@/components/fertilizer/CategoryComparisonTable')
    const categories = [
      { name: 'テスト肥料', description: 'テスト説明', merit: 'テストメリット', demerit: 'テストデメリット', bonsaiUsage: 'テスト使い方' },
    ]

    render(<CategoryComparisonTable categories={categories} />)

    expect(screen.getByText('メリット')).toBeInTheDocument()
    expect(screen.getByText('デメリット')).toBeInTheDocument()
    expect(screen.getByText('盆栽での使い方')).toBeInTheDocument()
  })

  it('renders with null fields and hides merit/demerit/bonsaiUsage sections', async () => {
    const { CategoryComparisonTable } = await import('@/components/fertilizer/CategoryComparisonTable')
    const categories = [
      { name: 'テスト', description: null, merit: null, demerit: null, bonsaiUsage: null },
    ]

    render(<CategoryComparisonTable categories={categories} />)

    // Category name should still render
    expect(screen.getByText('テスト')).toBeInTheDocument()

    // Labels should not appear when values are null
    expect(screen.queryByText('メリット')).not.toBeInTheDocument()
    expect(screen.queryByText('デメリット')).not.toBeInTheDocument()
    expect(screen.queryByText('盆栽での使い方')).not.toBeInTheDocument()
  })
})

// ── NutrientCard ─────────────────────────────────────────────────────

describe('NutrientCard', () => {
  it('renders nutrient info with link', async () => {
    const { NutrientCard } = await import('@/components/fertilizer/NutrientCard')
    const nutrient = {
      symbol: 'N',
      name: '窒素',
      category: 'primary' as const,
      bonsaiRole: '葉の成長を促進',
      slug: 'nitrogen',
    }

    render(<NutrientCard nutrient={nutrient} />)

    expect(screen.getByText('N')).toBeInTheDocument()
    expect(screen.getByText('窒素')).toBeInTheDocument()
    expect(screen.getByText('葉の成長を促進')).toBeInTheDocument()

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/fertilizers/nutrients/nitrogen')
  })

  it('renders with null bonsaiRole', async () => {
    const { NutrientCard } = await import('@/components/fertilizer/NutrientCard')
    const nutrient = {
      symbol: 'Fe',
      name: '鉄',
      category: 'trace' as const,
      bonsaiRole: null,
      slug: 'iron',
    }

    render(<NutrientCard nutrient={nutrient} />)
    expect(screen.getByText('Fe')).toBeInTheDocument()
    expect(screen.getByText('鉄')).toBeInTheDocument()

    // bonsaiRole text should not appear when null
    // The link should still work
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/fertilizers/nutrients/iron')
  })

  it('renders NutrientCategoryBadge with correct category', async () => {
    const { NutrientCard } = await import('@/components/fertilizer/NutrientCard')
    const nutrient = {
      symbol: 'Ca',
      name: 'カルシウム',
      category: 'secondary' as const,
      bonsaiRole: '細胞壁強化',
      slug: 'calcium',
    }

    render(<NutrientCard nutrient={nutrient} />)
    expect(screen.getByTestId('category-badge-secondary')).toBeInTheDocument()
  })
})

// ── TreeSpeciesCard ─────────────────────────────────────────────────

describe('TreeSpeciesCard', () => {
  it('renders species info with link', async () => {
    const { TreeSpeciesCard } = await import('@/components/fertilizer/TreeSpeciesCard')
    const species = {
      name: '黒松',
      category: 'conifer' as const,
      examples: '黒松、赤松、五葉松',
      fertilizingPolicy: '春と秋にしっかり施肥',
      slug: 'kuromatsu',
    }

    render(<TreeSpeciesCard species={species} />)

    expect(screen.getByText('黒松')).toBeInTheDocument()
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('黒松、赤松、五葉松')).toBeInTheDocument()
    expect(screen.getByText('春と秋にしっかり施肥')).toBeInTheDocument()

    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/fertilizers/schedules/kuromatsu')
  })

  it('renders with null optional fields', async () => {
    const { TreeSpeciesCard } = await import('@/components/fertilizer/TreeSpeciesCard')
    const species = {
      name: 'もみじ',
      category: 'deciduous' as const,
      examples: null,
      fertilizingPolicy: null,
      slug: 'momiji',
    }

    render(<TreeSpeciesCard species={species} />)
    expect(screen.getByText('もみじ')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()

    // Null fields should not render any text content
    expect(screen.queryByText('黒松、赤松、五葉松')).not.toBeInTheDocument()
    expect(screen.queryByText('春と秋にしっかり施肥')).not.toBeInTheDocument()

    // Link should still work
    const link = screen.getByRole('link')
    expect(link.getAttribute('href')).toBe('/fertilizers/schedules/momiji')
  })

  it('renders different category badges', async () => {
    const { TreeSpeciesCard } = await import('@/components/fertilizer/TreeSpeciesCard')
    const species = {
      name: '梅',
      category: 'flowering' as const,
      examples: '紅梅、白梅',
      fertilizingPolicy: '花後に施肥',
      slug: 'ume',
    }

    render(<TreeSpeciesCard species={species} />)
    expect(screen.getByText('花物')).toBeInTheDocument()
  })
})
