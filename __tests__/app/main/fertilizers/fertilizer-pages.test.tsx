// @vitest-environment node
import { vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))
vi.mock('@/components/seo/ArticleJsonLd', () => ({ ArticleJsonLd: () => null }))

const mockGetNutrients = vi.fn()
const mockGetNutrientBySlug = vi.fn()
const mockGetFertilizerCategories = vi.fn()
const mockGetTreeSpecies = vi.fn()
const mockGetFertilizationSchedule = vi.fn()
const mockGetFertilizerColumns = vi.fn()
const mockGetFertilizerColumnBySlug = vi.fn()

vi.mock('@/lib/actions/fertilizer', () => ({
  getNutrients: (...args: unknown[]) => mockGetNutrients(...args),
  getNutrientBySlug: (...args: unknown[]) => mockGetNutrientBySlug(...args),
  getFertilizerCategories: (...args: unknown[]) => mockGetFertilizerCategories(...args),
  getTreeSpecies: (...args: unknown[]) => mockGetTreeSpecies(...args),
  getFertilizationSchedule: (...args: unknown[]) => mockGetFertilizationSchedule(...args),
  getFertilizerColumns: (...args: unknown[]) => mockGetFertilizerColumns(...args),
  getFertilizerColumnBySlug: (...args: unknown[]) => mockGetFertilizerColumnBySlug(...args),
}))

vi.mock('@/lib/build/static-params', () => ({
  loadStaticParams: (loader: () => Promise<unknown[]>) => loader(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    fertilizerNutrient: { findMany: vi.fn().mockResolvedValue([]) },
    fertilizerColumn: { findMany: vi.fn().mockResolvedValue([]) },
    treeSpecies: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

const mockNotFound = vi.fn()
vi.mock('next/navigation', () => ({
  notFound: () => { mockNotFound(); throw new Error('NOT_FOUND') },
  redirect: vi.fn(),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/lib/constants/guest', () => ({
  GUEST_EMAIL: 'guest@example.com',
}))

vi.mock('@/components/common/GuestRestrictionOverlay', () => ({
  GuestRestrictionOverlay: ({ children, isGuest, contentName }: { children: React.ReactNode; isGuest: boolean; contentName: string }) => (
    <div data-testid="guest-overlay" data-is-guest={isGuest} data-content-name={contentName}>{children}</div>
  ),
}))

vi.mock('@/components/fertilizer/FertilizerDisclaimer', () => ({
  FertilizerDisclaimer: () => <div data-testid="fertilizer-disclaimer" />,
}))

vi.mock('@/components/fertilizer/NutrientCard', () => ({
  NutrientCard: ({ nutrient }: { nutrient: { id: string; name: string } }) => (
    <div data-testid={`nutrient-card-${nutrient.id}`}>{nutrient.name}</div>
  ),
}))

vi.mock('@/components/fertilizer/NutrientCategoryBadge', () => ({
  NutrientCategoryBadge: ({ category }: { category: string }) => (
    <span data-testid={`category-badge-${category}`}>{category}</span>
  ),
}))

vi.mock('@/components/fertilizer/CategoryComparisonTable', () => ({
  CategoryComparisonTable: ({ categories }: { categories: unknown[] }) => (
    <div data-testid="category-comparison-table" data-count={categories.length} />
  ),
}))

vi.mock('@/components/fertilizer/TreeSpeciesCard', () => ({
  TreeSpeciesCard: ({ species }: { species: { id: string; name: string } }) => (
    <div data-testid={`tree-species-card-${species.id}`}>{species.name}</div>
  ),
}))

vi.mock('@/components/fertilizer/FertilizationCalendar', () => ({
  FertilizationCalendar: ({ plans }: { plans: unknown[] }) => (
    <div data-testid="fertilization-calendar" data-count={plans.length} />
  ),
}))

vi.mock('@/components/common/PageError', () => ({
  PageError: ({ title, reset }: { title: string; reset: () => void }) => (
    <div data-testid="page-error" data-title={title}>
      <button onClick={reset}>再試行</button>
    </div>
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
  FERTILIZER_ACTION_BADGE: {
    none: { label: '不要', icon: '—', className: 'bg-muted text-muted-foreground' },
    light: { label: '控えめ', icon: '△', className: 'bg-amber-100 text-amber-700' },
    moderate: { label: '通常', icon: '○', className: 'bg-sky-100 text-sky-700' },
    heavy: { label: 'たっぷり', icon: '◎', className: 'bg-emerald-100 text-emerald-700' },
  },
}))

// ── Tests ──────────────────────────────────────────────────────────

describe('Fertilizer layout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders children directly (public layout)', async () => {
    const { default: FertilizerLayout } = await import('@/app/(main)/fertilizers/layout')
    const result = FertilizerLayout({ children: <div>child</div> })
    expect(result).toBeTruthy()
  })
})

describe('Fertilizer error page', () => {
  it('renders with PageError component', async () => {
    const { default: FertilizersError } = await import('@/app/(main)/fertilizers/error')
    const mockReset = vi.fn()
    const error = new Error('test error')
    const result = FertilizersError({ error: error as Error & { digest?: string }, reset: mockReset })
    expect(result).toBeTruthy()
    // The component renders <PageError> which our mock renders as <div data-testid="page-error">
    // The result is <PageError title="..." ...> so we check the props passed to PageError
    expect(result.props.title).toBe('施肥ガイドを読み込めません')
    expect(result.props.reset).toBe(mockReset)
    expect(result.props.error).toBe(error)
  })
})

describe('Categories page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders category comparison table', async () => {
    const mockCategories = [
      { name: '有機肥料', description: '天然素材', merit: '土壌改良', demerit: '遅効性', bonsaiUsage: '基本肥料' },
      { name: '化成肥料', description: '化学合成', merit: '即効性', demerit: '過剰注意', bonsaiUsage: '追肥' },
    ]
    mockGetFertilizerCategories.mockResolvedValue({ categories: mockCategories })

    const { default: CategoriesPage } = await import('@/app/(main)/fertilizers/categories/page')
    const result = await CategoriesPage()
    expect(result).toBeTruthy()
    expect(mockGetFertilizerCategories).toHaveBeenCalled()
  })

  it('renders with empty categories', async () => {
    mockGetFertilizerCategories.mockResolvedValue({ categories: [] })
    const { default: CategoriesPage } = await import('@/app/(main)/fertilizers/categories/page')
    const result = await CategoriesPage()
    expect(result).toBeTruthy()
  })
})

describe('Columns list page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders columns list', async () => {
    const mockColumns = [
      { id: 'col1', slug: 'basics-intro', title: '施肥の基礎知識', category: 'basics', publishedAt: new Date('2024-01-01') },
      { id: 'col2', slug: 'seasonal-spring', title: '春の施肥', category: 'seasonal', publishedAt: null },
    ]
    mockGetFertilizerColumns.mockResolvedValue({ columns: mockColumns })

    const { default: ColumnsPage } = await import('@/app/(main)/fertilizers/columns/page')
    const result = await ColumnsPage()
    expect(result).toBeTruthy()
    expect(mockGetFertilizerColumns).toHaveBeenCalled()
  })

  it('shows empty message when no columns', async () => {
    mockGetFertilizerColumns.mockResolvedValue({ columns: [] })
    const { default: ColumnsPage } = await import('@/app/(main)/fertilizers/columns/page')
    const result = await ColumnsPage()
    expect(result).toBeTruthy()
  })
})

describe('Column detail page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders column detail', async () => {
    const mockCol = {
      id: 'col1',
      slug: 'basics-intro',
      title: '施肥の基礎知識',
      content: 'ここに本文が入ります。',
      category: 'basics',
      publishedAt: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-15'),
    }
    mockGetFertilizerColumnBySlug.mockResolvedValue(mockCol)

    const { default: ColumnDetailPage } = await import('@/app/(main)/fertilizers/columns/[slug]/page')
    const result = await ColumnDetailPage({ params: Promise.resolve({ slug: 'basics-intro' }) })
    expect(result).toBeTruthy()
    expect(mockGetFertilizerColumnBySlug).toHaveBeenCalledWith('basics-intro')
  })

  it('calls notFound when column not found', async () => {
    mockGetFertilizerColumnBySlug.mockResolvedValue(null)

    const { default: ColumnDetailPage } = await import('@/app/(main)/fertilizers/columns/[slug]/page')
    await expect(
      ColumnDetailPage({ params: Promise.resolve({ slug: 'nonexistent' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('generateMetadata returns column title', async () => {
    mockGetFertilizerColumnBySlug.mockResolvedValue({ title: 'テストコラム' })
    const { generateMetadata } = await import('@/app/(main)/fertilizers/columns/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'test' }) })
    expect(metadata.title).toBe('テストコラム - コラム')
  })

  it('generateMetadata returns fallback when not found', async () => {
    mockGetFertilizerColumnBySlug.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/(main)/fertilizers/columns/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'missing' }) })
    expect(metadata.title).toBe('コラムが見つかりません')
  })

  it('generateStaticParams returns slugs', async () => {
    const { prisma } = await import('@/lib/db')
    ;(prisma.fertilizerColumn.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: 'a' },
      { slug: 'b' },
    ])
    const { generateStaticParams } = await import('@/app/(main)/fertilizers/columns/[slug]/page')
    const result = await generateStaticParams()
    expect(result).toEqual([{ slug: 'a' }, { slug: 'b' }])
  })
})

describe('Nutrients list page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders grouped nutrients', async () => {
    const mockNutrients = [
      { id: 'n1', name: '窒素', slug: 'nitrogen', symbol: 'N', category: 'primary', bonsaiRole: '成長促進' },
      { id: 'n2', name: 'カルシウム', slug: 'calcium', symbol: 'Ca', category: 'secondary', bonsaiRole: '細胞壁強化' },
      { id: 'n3', name: '鉄', slug: 'iron', symbol: 'Fe', category: 'trace', bonsaiRole: '光合成' },
    ]
    mockGetNutrients.mockResolvedValue({ nutrients: mockNutrients })

    const { default: NutrientsPage } = await import('@/app/(main)/fertilizers/nutrients/page')
    const result = await NutrientsPage()
    expect(result).toBeTruthy()
    expect(mockGetNutrients).toHaveBeenCalledWith()
  })

  it('renders with empty nutrients', async () => {
    mockGetNutrients.mockResolvedValue({ nutrients: [] })
    const { default: NutrientsPage } = await import('@/app/(main)/fertilizers/nutrients/page')
    const result = await NutrientsPage()
    expect(result).toBeTruthy()
  })
})

describe('Nutrient detail page', () => {
  beforeEach(() => vi.clearAllMocks())

  const mockNutrient = {
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

  it('renders nutrient detail', async () => {
    mockGetNutrientBySlug.mockResolvedValue(mockNutrient)

    const { default: NutrientDetailPage } = await import('@/app/(main)/fertilizers/nutrients/[slug]/page')
    const result = await NutrientDetailPage({ params: Promise.resolve({ slug: 'nitrogen' }) })
    expect(result).toBeTruthy()
    expect(mockGetNutrientBySlug).toHaveBeenCalledWith('nitrogen')
  })

  it('calls notFound when nutrient not found', async () => {
    mockGetNutrientBySlug.mockResolvedValue(null)

    const { default: NutrientDetailPage } = await import('@/app/(main)/fertilizers/nutrients/[slug]/page')
    await expect(
      NutrientDetailPage({ params: Promise.resolve({ slug: 'nonexistent' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders without optional fields', async () => {
    const minNutrient = {
      id: 'n1',
      name: '窒素',
      nameEn: null,
      slug: 'nitrogen',
      symbol: 'N',
      category: 'primary' as const,
      description: null,
      bonsaiRole: null,
      deficiencySymptoms: null,
      excessSymptoms: null,
      foodSources: null,
    }
    mockGetNutrientBySlug.mockResolvedValue(minNutrient)

    const { default: NutrientDetailPage } = await import('@/app/(main)/fertilizers/nutrients/[slug]/page')
    const result = await NutrientDetailPage({ params: Promise.resolve({ slug: 'nitrogen' }) })
    expect(result).toBeTruthy()
  })

  it('generateMetadata returns nutrient title', async () => {
    mockGetNutrientBySlug.mockResolvedValue({ name: '窒素', symbol: 'N' })
    const { generateMetadata } = await import('@/app/(main)/fertilizers/nutrients/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'nitrogen' }) })
    expect(metadata.title).toBe('窒素（N） - 栄養素')
  })

  it('generateMetadata returns fallback when not found', async () => {
    mockGetNutrientBySlug.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/(main)/fertilizers/nutrients/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'missing' }) })
    expect(metadata.title).toBe('栄養素が見つかりません')
  })

  it('generateStaticParams returns slugs', async () => {
    const { prisma } = await import('@/lib/db')
    ;(prisma.fertilizerNutrient.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: 'nitrogen' },
      { slug: 'phosphorus' },
    ])
    const { generateStaticParams } = await import('@/app/(main)/fertilizers/nutrients/[slug]/page')
    const result = await generateStaticParams()
    expect(result).toEqual([{ slug: 'nitrogen' }, { slug: 'phosphorus' }])
  })
})

describe('Schedules list page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders grouped tree species', async () => {
    const mockTreeSpecies = [
      { id: 's1', name: '黒松', slug: 'kuromatsu', category: 'conifer', examples: '黒松、赤松', fertilizingPolicy: '春秋中心', _count: { plans: 12 } },
      { id: 's2', name: 'もみじ', slug: 'momiji', category: 'deciduous', examples: 'いろはもみじ', fertilizingPolicy: '成長期重視', _count: { plans: 12 } },
    ]
    mockGetTreeSpecies.mockResolvedValue({ treeSpecies: mockTreeSpecies })

    const { default: SchedulesPage } = await import('@/app/(main)/fertilizers/schedules/page')
    const result = await SchedulesPage()
    expect(result).toBeTruthy()
    expect(mockGetTreeSpecies).toHaveBeenCalled()
  })

  it('renders with empty tree species', async () => {
    mockGetTreeSpecies.mockResolvedValue({ treeSpecies: [] })
    const { default: SchedulesPage } = await import('@/app/(main)/fertilizers/schedules/page')
    const result = await SchedulesPage()
    expect(result).toBeTruthy()
  })
})

describe('Schedule detail page', () => {
  beforeEach(() => vi.clearAllMocks())

  const mockSpecies = {
    id: 's1',
    name: '黒松',
    nameEn: 'Japanese Black Pine',
    slug: 'kuromatsu',
    category: 'conifer' as const,
    description: '代表的な松柏盆栽',
    fertilizingPolicy: '春秋にしっかり施肥',
    examples: '黒松、赤松、五葉松',
    plans: [
      { month: 1, action: 'none' as const, nitrogenLevel: null, phosphorusLevel: null, potassiumLevel: null, description: null, cautionNote: null },
      { month: 3, action: 'moderate' as const, nitrogenLevel: 'balanced' as const, phosphorusLevel: 'balanced' as const, potassiumLevel: 'balanced' as const, description: '成長開始', cautionNote: null },
    ],
  }

  it('renders schedule detail', async () => {
    mockGetFertilizationSchedule.mockResolvedValue(mockSpecies)

    const { default: ScheduleDetailPage } = await import('@/app/(main)/fertilizers/schedules/[slug]/page')
    const result = await ScheduleDetailPage({ params: Promise.resolve({ slug: 'kuromatsu' }) })
    expect(result).toBeTruthy()
    expect(mockGetFertilizationSchedule).toHaveBeenCalledWith('kuromatsu')
  })

  it('calls notFound when species not found', async () => {
    mockGetFertilizationSchedule.mockResolvedValue(null)

    const { default: ScheduleDetailPage } = await import('@/app/(main)/fertilizers/schedules/[slug]/page')
    await expect(
      ScheduleDetailPage({ params: Promise.resolve({ slug: 'nonexistent' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders without optional fields', async () => {
    const minSpecies = {
      id: 's1',
      name: '黒松',
      nameEn: null,
      slug: 'kuromatsu',
      category: 'conifer' as const,
      description: null,
      fertilizingPolicy: null,
      examples: null,
      plans: [],
    }
    mockGetFertilizationSchedule.mockResolvedValue(minSpecies)

    const { default: ScheduleDetailPage } = await import('@/app/(main)/fertilizers/schedules/[slug]/page')
    const result = await ScheduleDetailPage({ params: Promise.resolve({ slug: 'kuromatsu' }) })
    expect(result).toBeTruthy()
  })

  it('generateMetadata returns species title', async () => {
    mockGetFertilizationSchedule.mockResolvedValue({ name: '黒松' })
    const { generateMetadata } = await import('@/app/(main)/fertilizers/schedules/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'kuromatsu' }) })
    expect(metadata.title).toBe('黒松 施肥スケジュール - 施肥ガイド')
  })

  it('generateMetadata returns fallback when not found', async () => {
    mockGetFertilizationSchedule.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/(main)/fertilizers/schedules/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'missing' }) })
    expect(metadata.title).toBe('樹種が見つかりません')
  })

  it('generateStaticParams returns slugs', async () => {
    const { prisma } = await import('@/lib/db')
    ;(prisma.treeSpecies.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { slug: 'kuromatsu' },
      { slug: 'momiji' },
    ])
    const { generateStaticParams } = await import('@/app/(main)/fertilizers/schedules/[slug]/page')
    const result = await generateStaticParams()
    expect(result).toEqual([{ slug: 'kuromatsu' }, { slug: 'momiji' }])
  })
})
