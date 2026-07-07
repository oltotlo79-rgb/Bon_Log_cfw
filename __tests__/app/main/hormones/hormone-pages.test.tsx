// @vitest-environment node
import { vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────

const mockGetHormones = vi.fn()
const mockGetHormoneBySlug = vi.fn()
const mockGetHormoneColumns = vi.fn()
const mockGetHormoneColumnBySlug = vi.fn()
const mockGetHormoneTechniques = vi.fn()
const mockGetHormoneTechniquesBySlug = vi.fn()
const mockGetHormoneInteractions = vi.fn()
const mockGetHormonesWithSeasonalLevels = vi.fn()
const mockGetSimulatorData = vi.fn()

vi.mock('@/lib/actions/hormone', () => ({
  getHormones: (...args: unknown[]) => mockGetHormones(...args),
  getHormoneBySlug: (...args: unknown[]) => mockGetHormoneBySlug(...args),
  getHormoneColumns: (...args: unknown[]) => mockGetHormoneColumns(...args),
  getHormoneColumnBySlug: (...args: unknown[]) => mockGetHormoneColumnBySlug(...args),
  getHormoneTechniques: (...args: unknown[]) => mockGetHormoneTechniques(...args),
  getHormoneTechniquesBySlug: (...args: unknown[]) => mockGetHormoneTechniquesBySlug(...args),
  getHormoneInteractions: (...args: unknown[]) => mockGetHormoneInteractions(...args),
  getHormonesWithSeasonalLevels: (...args: unknown[]) => mockGetHormonesWithSeasonalLevels(...args),
  getSimulatorData: (...args: unknown[]) => mockGetSimulatorData(...args),
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

vi.mock('@/components/hormone/HormoneDisclaimer', () => ({
  HormoneDisclaimer: () => <div data-testid="hormone-disclaimer" />,
}))

vi.mock('@/components/hormone/HormoneCard', () => ({
  HormoneCard: ({ hormone }: { hormone: { id: string; name: string } }) => (
    <div data-testid={`hormone-card-${hormone.id}`}>{hormone.name}</div>
  ),
}))

vi.mock('@/components/hormone/HormoneCategoryBadge', () => ({
  HormoneCategoryBadge: ({ category }: { category: string }) => (
    <span data-testid={`category-badge-${category}`}>{category}</span>
  ),
}))

vi.mock('@/components/hormone/HormoneEffectList', () => ({
  HormoneEffectList: ({ effects }: { effects: unknown[] }) => (
    <div data-testid="effect-list" data-count={effects.length} />
  ),
}))

vi.mock('@/components/hormone/HormoneSeasonalChart', () => ({
  HormoneSeasonalChart: ({ seasonalLevels }: { seasonalLevels: unknown[] }) => (
    <div data-testid="seasonal-chart" data-count={seasonalLevels.length} />
  ),
}))

vi.mock('@/components/hormone/HormoneInteractionCard', () => ({
  HormoneInteractionCard: ({ hormoneAName, hormoneBName, type }: { hormoneAName: string; hormoneBName: string; type: string }) => (
    <div data-testid="interaction-card" data-a={hormoneAName} data-b={hormoneBName} data-type={type} />
  ),
}))

vi.mock('@/components/hormone/HormoneTechniqueCard', () => ({
  HormoneTechniqueCard: ({ techniqueName }: { techniqueName: string }) => (
    <div data-testid="technique-card">{techniqueName}</div>
  ),
}))

vi.mock('@/components/hormone/HormoneAnnualCalendar', () => ({
  HormoneAnnualCalendar: ({ hormones }: { hormones: unknown[] }) => (
    <div data-testid="annual-calendar" data-count={hormones.length} />
  ),
}))

vi.mock('@/app/(main)/hormones/calendar/CalendarWithNavigation', () => ({
  CalendarWithNavigation: ({ hormones }: { hormones: unknown[] }) => (
    <div data-testid="calendar-with-navigation" data-count={hormones.length} />
  ),
}))

vi.mock('@/components/hormone/HormoneInteractionDiagram', () => ({
  HormoneInteractionDiagram: ({ hormones, interactions }: { hormones: unknown[]; interactions: unknown[] }) => (
    <div data-testid="interaction-diagram" data-hormones={hormones.length} data-interactions={interactions.length} />
  ),
}))

vi.mock('@/components/hormone/HormoneBalanceSimulator', () => ({
  HormoneBalanceSimulator: ({ hormones }: { hormones: unknown[] }) => (
    <div data-testid="balance-simulator" data-hormones={hormones.length} />
  ),
}))

vi.mock('@/components/seo/BreadcrumbJsonLd', () => ({
  BreadcrumbJsonLd: () => null,
}))

vi.mock('@/components/seo/ArticleJsonLd', () => ({
  ArticleJsonLd: ({ headline }: { headline: string }) => (
    <script data-testid="article-jsonld" data-headline={headline} />
  ),
}))

// ── Test Data ──────────────────────────────────────────────────────

const makeMajorHormone = (id: string, name: string) => ({
  id,
  name,
  slug: id,
  category: 'major',
  nameEn: `${name} EN`,
  chemicalFormula: 'C10H10',
  description: `${name}の概要`,
  bonsaiRole: `${name}の盆栽での役割`,
  productionSite: '茎頂',
  activationMethod: '光照射',
  practicalTips: 'ヒント',
  // schema.prisma の `HormoneType` には createdAt / updatedAt が含まれるため、
  // ArticleJsonLd (`hormone.createdAt.toISOString()`) のために mock にも必須。
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  effects: [],
  seasonalLevels: [],
  interactionsA: [],
  interactionsB: [],
})

const makeSecondaryHormone = (id: string, name: string) => ({
  ...makeMajorHormone(id, name),
  category: 'secondary',
})

// ── Tests: Top Page ───────────────────────────────────────────────

describe('Hormone top page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders major and secondary hormone sections', async () => {
    const majorHormones = [
      makeMajorHormone('auxin', 'オーキシン'),
      makeMajorHormone('ga', 'ジベレリン'),
    ]
    const secondaryHormones = [
      makeSecondaryHormone('ja', 'ジャスモン酸'),
    ]
    mockGetHormones.mockResolvedValue({ hormones: [...majorHormones, ...secondaryHormones] })
    mockGetHormoneColumns.mockResolvedValue({ columns: [{ id: 'c1' }, { id: 'c2' }] })

    const { default: HormoneTopPage } = await import('@/app/(main)/hormones/page')
    const result = await HormoneTopPage()

    expect(result).toBeTruthy()
    expect(mockGetHormones).toHaveBeenCalled()
    expect(mockGetHormoneColumns).toHaveBeenCalled()
    // Verify structure: the page should contain sections for both major and secondary
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('五大ホルモン')
    expect(rendered).toContain('二次ホルモン')
  })

  it('renders navigation cards with column count', async () => {
    mockGetHormones.mockResolvedValue({ hormones: [] })
    mockGetHormoneColumns.mockResolvedValue({ columns: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] })

    const { default: HormoneTopPage } = await import('@/app/(main)/hormones/page')
    const result = await HormoneTopPage()

    const rendered = JSON.stringify(result)
    expect(rendered).toContain('ホルモン相互作用')
    expect(rendered).toContain('コラム・読みもの')
    expect(rendered).toContain('3件の記事')
  })

  it('renders with empty hormones (no secondary section)', async () => {
    mockGetHormones.mockResolvedValue({ hormones: [] })
    mockGetHormoneColumns.mockResolvedValue({ columns: [] })

    const { default: HormoneTopPage } = await import('@/app/(main)/hormones/page')
    const result = await HormoneTopPage()

    expect(result).toBeTruthy()
    // Secondary section should not render when empty (conditional rendering)
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('五大ホルモン')
    expect(rendered).not.toContain('二次ホルモン')
  })

  it('renders HormoneCard for each hormone', async () => {
    const hormones = [
      makeMajorHormone('auxin', 'オーキシン'),
      makeMajorHormone('cytokinin', 'サイトカイニン'),
    ]
    mockGetHormones.mockResolvedValue({ hormones })
    mockGetHormoneColumns.mockResolvedValue({ columns: [] })

    const { default: HormoneTopPage } = await import('@/app/(main)/hormones/page')
    const result = await HormoneTopPage()

    const rendered = JSON.stringify(result)
    // HormoneCard mock renders the hormone name as children
    expect(rendered).toContain('オーキシン')
    expect(rendered).toContain('サイトカイニン')
  })

  it('shows fallback description when columns are empty', async () => {
    mockGetHormones.mockResolvedValue({ hormones: [] })
    mockGetHormoneColumns.mockResolvedValue({ columns: [] })

    const { default: HormoneTopPage } = await import('@/app/(main)/hormones/page')
    const result = await HormoneTopPage()

    const rendered = JSON.stringify(result)
    expect(rendered).toContain('植物ホルモンの基礎知識')
  })
})

// ── Tests: Detail Page [slug] ─────────────────────────────────────

describe('Hormone detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetHormoneTechniquesBySlug.mockResolvedValue({ techniques: [] })
  })

  const fullHormone = {
    ...makeMajorHormone('auxin', 'オーキシン'),
    effects: [{ id: 'e1', effect: '伸長成長', category: 'growth' }],
    seasonalLevels: [{ month: 4, level: 'high' }],
    interactionsA: [
      {
        hormoneB: { name: 'サイトカイニン' },
        type: 'antagonistic',
        description: '拮抗関係',
        bonsaiRelevance: '頂芽優勢の制御',
      },
    ],
    interactionsB: [
      {
        hormoneA: { name: 'ジベレリン' },
        type: 'synergistic',
        description: '相乗効果',
        bonsaiRelevance: '茎の伸長',
      },
    ],
  }

  it('renders hormone detail with all sections', async () => {
    mockGetHormoneBySlug.mockResolvedValue(fullHormone)

    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const result = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })

    expect(result).toBeTruthy()
    expect(mockGetHormoneBySlug).toHaveBeenCalledWith('auxin')
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('オーキシン')
    expect(rendered).toContain('オーキシン EN')
    expect(rendered).toContain('C10H10')
    expect(rendered).toContain('概要')
    expect(rendered).toContain('盆栽での役割')
    expect(rendered).toContain('生成部位')
    expect(rendered).toContain('活性化・調節方法')
    expect(rendered).toContain('実践的なヒント')
  })

  it('renders effects section when effects exist', async () => {
    mockGetHormoneBySlug.mockResolvedValue(fullHormone)

    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const result = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })

    const rendered = JSON.stringify(result)
    expect(rendered).toContain('効果')
    // The effects data is passed to HormoneEffectList
    expect(rendered).toContain('伸長成長')
  })

  it('renders seasonal chart section when seasonal levels exist', async () => {
    mockGetHormoneBySlug.mockResolvedValue(fullHormone)

    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const result = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })

    const rendered = JSON.stringify(result)
    expect(rendered).toContain('月別活性レベル')
    expect(rendered).toContain('"month":4')
  })

  it('combines interactions from both directions', async () => {
    mockGetHormoneBySlug.mockResolvedValue(fullHormone)

    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const result = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })

    const rendered = JSON.stringify(result)
    // Should have 2 interaction cards (one from A, one from B)
    expect(rendered).toContain('サイトカイニン')
    expect(rendered).toContain('ジベレリン')
  })

  it('renders without optional fields', async () => {
    const minHormone = {
      id: 'auxin',
      name: 'オーキシン',
      slug: 'auxin',
      category: 'major',
      nameEn: null,
      chemicalFormula: null,
      description: null,
      bonsaiRole: null,
      productionSite: null,
      activationMethod: null,
      practicalTips: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      effects: [],
      seasonalLevels: [],
      interactionsA: [],
      interactionsB: [],
    }
    mockGetHormoneBySlug.mockResolvedValue(minHormone)

    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const result = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })

    expect(result).toBeTruthy()
    const rendered = JSON.stringify(result)
    // Optional sections should not appear
    expect(rendered).not.toContain('概要')
    expect(rendered).not.toContain('盆栽での役割')
    expect(rendered).not.toContain('生成部位')
    expect(rendered).not.toContain('effect-list')
    expect(rendered).not.toContain('seasonal-chart')
    expect(rendered).not.toContain('interaction-card')
  })

  it('calls notFound when hormone not found', async () => {
    mockGetHormoneBySlug.mockResolvedValue(null)

    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    await expect(
      HormoneDetailPage({ params: Promise.resolve({ slug: 'nonexistent' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('generateMetadata returns hormone title with English name', async () => {
    mockGetHormoneBySlug.mockResolvedValue({ name: 'オーキシン', nameEn: 'Auxin' })
    const { generateMetadata } = await import('@/app/(main)/hormones/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'auxin' }) })
    expect(metadata.title).toBe('オーキシン（Auxin） - 植物ホルモン')
  })

  it('generateMetadata returns title without English name when absent', async () => {
    mockGetHormoneBySlug.mockResolvedValue({ name: 'オーキシン', nameEn: null })
    const { generateMetadata } = await import('@/app/(main)/hormones/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'auxin' }) })
    expect(metadata.title).toBe('オーキシン - 植物ホルモン')
  })

  it('generateMetadata returns fallback when not found', async () => {
    mockGetHormoneBySlug.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/(main)/hormones/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'missing' }) })
    expect(metadata.title).toBe('ホルモンが見つかりません')
  })

  it('renders related bonsai techniques (with effectColors + magnitude + mechanism)', async () => {
    mockGetHormoneBySlug.mockResolvedValue(fullHormone)
    mockGetHormoneTechniquesBySlug.mockResolvedValueOnce({
      techniques: [
        {
          id: 'th-1',
          // 既知 slug — BONSAI_TECHNIQUES.find が hit して technique.name が使われる
          techniqueSlug: 'pruning',
          techniqueName: 'バックアップ表示名',
          // 既知 effectType — TECHNIQUE_EFFECT_TYPE_LABELS / COLORS が hit
          effectType: 'promote',
          // 既知 magnitude
          magnitude: 'strong',
          mechanism: '芽の頂芽優勢を解除する',
        },
      ],
    })
    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const result = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('関連する盆栽技法')
    expect(rendered).toContain('芽の頂芽優勢を解除する')
  })

  it('falls back to t.techniqueName when slug is unknown, and to raw enum for magnitude when table misses', async () => {
    mockGetHormoneBySlug.mockResolvedValue(fullHormone)
    mockGetHormoneTechniquesBySlug.mockResolvedValueOnce({
      techniques: [
        {
          id: 'th-2',
          // 未知 slug → BONSAI_TECHNIQUES.find は undefined → techniqueName を表示
          techniqueSlug: 'totally-unknown-technique-xyz',
          techniqueName: '謎の技法',
          // 未知 effectType → effectColors は undefined だが、バッジ自体は
          // ニュートラル色クラスで描画され、ラベルは raw 値にフォールバックする
          effectType: 'unknown_effect_xyz',
          // 未知 magnitude → ?? の右辺で raw 値が表示される
          magnitude: 'unknown_mag_xyz',
          // mechanism が null → mechanism && 分岐の falsy 側（mechanism 行非表示）
          mechanism: null,
        },
      ],
    })
    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const result = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('謎の技法')
    // 未知 effectType でもバッジは表示され、ラベルは raw 値にフォールバックする
    expect(rendered).toContain('unknown_effect_xyz')
    // ニュートラル色クラス（未知値用）が使われる
    expect(rendered).toContain('bg-muted-foreground/20')
    expect(rendered).toContain('text-muted-foreground')
    // magnitude は ?? の右辺で raw 値が出る
    expect(rendered).toContain('unknown_mag_xyz')
  })

  it('combined effectType でもラベル付きバッジがニュートラル色クラスで描画される', async () => {
    mockGetHormoneBySlug.mockResolvedValue(fullHormone)
    mockGetHormoneTechniquesBySlug.mockResolvedValueOnce({
      techniques: [
        {
          id: 'th-3',
          techniqueSlug: 'pruning',
          techniqueName: '剪定',
          // combined は TECHNIQUE_EFFECT_TYPE_LABELS にラベルはあるが
          // TECHNIQUE_EFFECT_TYPE_COLORS に色定義が無い既知の特殊値
          effectType: 'combined',
          magnitude: 'moderate',
          mechanism: '複数の作用が組み合わさる',
        },
      ],
    })
    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const result = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })
    const rendered = JSON.stringify(result)
    // ラベルは日本語表記に変換される
    expect(rendered).toContain('複合効果')
    // 色未定義のためニュートラル色クラスが使われる
    expect(rendered).toContain('bg-muted-foreground/20')
    expect(rendered).toContain('text-muted-foreground')
  })

  it('既知の effectType (increase/decrease/redistribute) は従来色クラスで描画される', async () => {
    mockGetHormoneBySlug.mockResolvedValue(fullHormone)
    mockGetHormoneTechniquesBySlug.mockResolvedValueOnce({
      techniques: [
        {
          id: 'th-4',
          techniqueSlug: 'pinching',
          techniqueName: '摘芯',
          effectType: 'increase',
          magnitude: 'strong',
          mechanism: '促進する',
        },
      ],
    })
    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const result = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('増加')
    expect(rendered).toContain('bg-green-100')
    expect(rendered).toContain('text-green-800')
    // ニュートラル色クラスは使われない
    expect(rendered).not.toContain('bg-muted-foreground/20')
  })

  it('Breadcrumb の url に BASE_URL + ROUTE_HORMONES が組み込まれる', async () => {
    // BASE_URL は `lib/constants/routes.ts` でモジュール読み込み時に確定する。
    // 本テスト時点では NEXT_PUBLIC_APP_URL が未設定で APP_URL_DEFAULT
    // (`http://localhost:3000`) が使われる前提のためそれを期待値にする。
    mockGetHormoneBySlug.mockResolvedValue(fullHormone)
    const { default: HormoneDetailPage } = await import('@/app/(main)/hormones/[slug]/page')
    const rendered = await HormoneDetailPage({ params: Promise.resolve({ slug: 'auxin' }) })
    const json = JSON.stringify(rendered)
    expect(json).toContain('/hormones')
    expect(json).toContain('/hormones/auxin')
  })
})

// ── Tests: Columns List Page ──────────────────────────────────────

describe('Hormone columns page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders column list with category labels and dates', async () => {
    const mockColumns = [
      { id: 'col1', slug: 'basics-intro', title: 'ホルモンの基礎', category: 'basics', publishedAt: new Date('2024-06-01') },
      { id: 'col2', slug: 'app-pruning', title: '剪定とホルモン', category: 'application', publishedAt: null },
    ]
    mockGetHormoneColumns.mockResolvedValue({ columns: mockColumns })

    const { default: HormoneColumnsPage } = await import('@/app/(main)/hormones/columns/page')
    const result = await HormoneColumnsPage()

    expect(result).toBeTruthy()
    expect(mockGetHormoneColumns).toHaveBeenCalled()
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('ホルモンの基礎')
    expect(rendered).toContain('剪定とホルモン')
    expect(rendered).toContain('基礎知識')
    expect(rendered).toContain('応用テクニック')
  })

  it('shows empty state when no columns exist', async () => {
    mockGetHormoneColumns.mockResolvedValue({ columns: [] })

    const { default: HormoneColumnsPage } = await import('@/app/(main)/hormones/columns/page')
    const result = await HormoneColumnsPage()

    expect(result).toBeTruthy()
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('コラム記事はまだ公開されていません')
  })

  it('renders back link to hormone top page', async () => {
    mockGetHormoneColumns.mockResolvedValue({ columns: [] })

    const { default: HormoneColumnsPage } = await import('@/app/(main)/hormones/columns/page')
    const result = await HormoneColumnsPage()

    const rendered = JSON.stringify(result)
    expect(rendered).toContain('/hormones')
    expect(rendered).toContain('植物ホルモントップ')
  })
})

// ── Tests: Column Detail Page [slug] ──────────────────────────────

describe('Hormone column detail page', () => {
  beforeEach(() => vi.clearAllMocks())

  const mockColumn = {
    id: 'col1',
    slug: 'basics-intro',
    title: 'ホルモンの基礎知識',
    content: 'ここに本文が入ります。植物ホルモンとは...',
    category: 'basics',
    publishedAt: new Date('2024-06-01'),
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-06-15'),
  }

  it('renders column content and title', async () => {
    mockGetHormoneColumnBySlug.mockResolvedValue(mockColumn)

    const { default: ColumnDetailPage } = await import('@/app/(main)/hormones/columns/[slug]/page')
    const result = await ColumnDetailPage({ params: Promise.resolve({ slug: 'basics-intro' }) })

    expect(result).toBeTruthy()
    expect(mockGetHormoneColumnBySlug).toHaveBeenCalledWith('basics-intro')
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('ホルモンの基礎知識')
    expect(rendered).toContain('ここに本文が入ります')
  })

  it('renders ArticleJsonLd with correct headline', async () => {
    mockGetHormoneColumnBySlug.mockResolvedValue(mockColumn)

    const { default: ColumnDetailPage } = await import('@/app/(main)/hormones/columns/[slug]/page')
    const result = await ColumnDetailPage({ params: Promise.resolve({ slug: 'basics-intro' }) })

    const rendered = JSON.stringify(result)
    // ArticleJsonLd receives headline prop
    expect(rendered).toContain('"headline":"ホルモンの基礎知識"')
    expect(rendered).toContain('"datePublished"')
    expect(rendered).toContain('"author"')
  })

  it('renders published date when available', async () => {
    mockGetHormoneColumnBySlug.mockResolvedValue(mockColumn)

    const { default: ColumnDetailPage } = await import('@/app/(main)/hormones/columns/[slug]/page')
    const result = await ColumnDetailPage({ params: Promise.resolve({ slug: 'basics-intro' }) })

    const rendered = JSON.stringify(result)
    // Date is formatted with ja-JP locale
    expect(rendered).toContain('2024')
  })

  it('renders without publishedAt date', async () => {
    const colWithoutDate = { ...mockColumn, publishedAt: null }
    mockGetHormoneColumnBySlug.mockResolvedValue(colWithoutDate)

    const { default: ColumnDetailPage } = await import('@/app/(main)/hormones/columns/[slug]/page')
    const result = await ColumnDetailPage({ params: Promise.resolve({ slug: 'basics-intro' }) })

    expect(result).toBeTruthy()
  })

  it('calls notFound when column not found', async () => {
    mockGetHormoneColumnBySlug.mockResolvedValue(null)

    const { default: ColumnDetailPage } = await import('@/app/(main)/hormones/columns/[slug]/page')
    await expect(
      ColumnDetailPage({ params: Promise.resolve({ slug: 'nonexistent' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('generateMetadata returns column title', async () => {
    mockGetHormoneColumnBySlug.mockResolvedValue({ title: 'テストコラム' })
    const { generateMetadata } = await import('@/app/(main)/hormones/columns/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'test' }) })
    expect(metadata.title).toBe('テストコラム - コラム')
  })

  it('generateMetadata returns fallback when not found', async () => {
    mockGetHormoneColumnBySlug.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/(main)/hormones/columns/[slug]/page')
    const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'missing' }) })
    expect(metadata.title).toBe('コラムが見つかりません')
  })
})

// ── Tests: Techniques Page ──────────────────────────────────────────

describe('Hormone techniques page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders technique cards from grouped data', async () => {
    mockGetHormoneTechniques.mockResolvedValue({
      techniques: [
        {
          id: 't1', techniqueSlug: 'pinching', effectType: 'decrease', magnitude: 'strong', mechanism: 'mech',
          hormone: { id: 'h1', name: 'オーキシン', nameEn: 'Auxin', slug: 'auxin', category: 'major' },
        },
      ],
    })

    const { default: TechniquesPage } = await import('@/app/(main)/hormones/techniques/page')
    const result = await TechniquesPage()

    expect(result).toBeTruthy()
    expect(mockGetHormoneTechniques).toHaveBeenCalled()
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('技法とホルモン')
  })

  it('renders with empty techniques data', async () => {
    mockGetHormoneTechniques.mockResolvedValue({ techniques: [] })

    const { default: TechniquesPage } = await import('@/app/(main)/hormones/techniques/page')
    const result = await TechniquesPage()

    expect(result).toBeTruthy()
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('技法とホルモン')
  })

  it('renders back link to hormones top', async () => {
    mockGetHormoneTechniques.mockResolvedValue({ techniques: [] })

    const { default: TechniquesPage } = await import('@/app/(main)/hormones/techniques/page')
    const result = await TechniquesPage()

    const rendered = JSON.stringify(result)
    expect(rendered).toContain('/hormones')
    expect(rendered).toContain('植物ホルモン一覧')
  })
})

// ── Tests: Calendar Page ────────────────────────────────────────────

describe('Hormone calendar page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders annual calendar with hormones data', async () => {
    mockGetHormonesWithSeasonalLevels.mockResolvedValue({
      hormones: [
        { id: 'h1', name: 'オーキシン', slug: 'auxin', seasonalLevels: [{ month: 1, level: 'minimal' }] },
      ],
    })

    const { default: CalendarPage } = await import('@/app/(main)/hormones/calendar/page')
    const result = await CalendarPage()

    expect(result).toBeTruthy()
    expect(mockGetHormonesWithSeasonalLevels).toHaveBeenCalled()
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('年間ホルモン活性カレンダー')
  })

  it('renders with empty data', async () => {
    mockGetHormonesWithSeasonalLevels.mockResolvedValue({ hormones: [] })

    const { default: CalendarPage } = await import('@/app/(main)/hormones/calendar/page')
    const result = await CalendarPage()

    expect(result).toBeTruthy()
  })

  it('renders back link', async () => {
    mockGetHormonesWithSeasonalLevels.mockResolvedValue({ hormones: [] })

    const { default: CalendarPage } = await import('@/app/(main)/hormones/calendar/page')
    const result = await CalendarPage()

    const rendered = JSON.stringify(result)
    expect(rendered).toContain('/hormones')
  })
})

// ── Tests: Diagram Page ─────────────────────────────────────────────

describe('Hormone diagram page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders interaction diagram with hormones and interactions', async () => {
    mockGetHormones.mockResolvedValue({
      hormones: [
        { id: 'h1', name: 'オーキシン', slug: 'auxin', category: 'major' },
        { id: 'h2', name: 'サイトカイニン', slug: 'cytokinin', category: 'major' },
      ],
    })
    mockGetHormoneInteractions.mockResolvedValue({
      interactions: [
        {
          id: 'i1', type: 'antagonistic', description: '拮抗',
          hormoneA: { id: 'h1', name: 'オーキシン' },
          hormoneB: { id: 'h2', name: 'サイトカイニン' },
        },
      ],
    })

    const { default: DiagramPage } = await import('@/app/(main)/hormones/diagram/page')
    const result = await DiagramPage()

    expect(result).toBeTruthy()
    expect(mockGetHormones).toHaveBeenCalled()
    expect(mockGetHormoneInteractions).toHaveBeenCalled()
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('相互作用ダイアグラム')
  })

  it('renders link to text-based interactions page', async () => {
    mockGetHormones.mockResolvedValue({ hormones: [] })
    mockGetHormoneInteractions.mockResolvedValue({ interactions: [] })

    const { default: DiagramPage } = await import('@/app/(main)/hormones/diagram/page')
    const result = await DiagramPage()

    const rendered = JSON.stringify(result)
    expect(rendered).toContain('/hormones/interactions')
    expect(rendered).toContain('テキスト版')
  })

  it('renders with empty data', async () => {
    mockGetHormones.mockResolvedValue({ hormones: [] })
    mockGetHormoneInteractions.mockResolvedValue({ interactions: [] })

    const { default: DiagramPage } = await import('@/app/(main)/hormones/diagram/page')
    const result = await DiagramPage()

    expect(result).toBeTruthy()
  })
})

// ── Tests: Simulator Page ───────────────────────────────────────────

describe('Hormone simulator page', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders simulator with data', async () => {
    mockGetSimulatorData.mockResolvedValue({
      hormones: [{ id: 'h1', name: 'オーキシン', slug: 'auxin' }],
      techniques: [{ id: 't1', techniqueSlug: 'pinching', hormone: { slug: 'auxin' } }],
      seasonalLevels: [{ hormoneId: 'h1', month: 4, level: 'high' }],
    })

    const { default: SimulatorPage } = await import('@/app/(main)/hormones/simulator/page')
    const result = await SimulatorPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeTruthy()
    expect(mockGetSimulatorData).toHaveBeenCalled()
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('ホルモンバランスシミュレーター')
  })

  it('renders with empty data', async () => {
    mockGetSimulatorData.mockResolvedValue({ hormones: [], techniques: [], seasonalLevels: [] })

    const { default: SimulatorPage } = await import('@/app/(main)/hormones/simulator/page')
    const result = await SimulatorPage({ searchParams: Promise.resolve({}) })

    expect(result).toBeTruthy()
  })

  it('renders back link', async () => {
    mockGetSimulatorData.mockResolvedValue({ hormones: [], techniques: [], seasonalLevels: [] })

    const { default: SimulatorPage } = await import('@/app/(main)/hormones/simulator/page')
    const result = await SimulatorPage({ searchParams: Promise.resolve({}) })

    const rendered = JSON.stringify(result)
    expect(rendered).toContain('/hormones')
    expect(rendered).toContain('植物ホルモン一覧')
  })

  it('passes initialMonth from searchParams', async () => {
    mockGetSimulatorData.mockResolvedValue({
      hormones: [{ id: 'h1', name: 'オーキシン', slug: 'auxin' }],
      techniques: [],
      seasonalLevels: [],
    })

    const { default: SimulatorPage } = await import('@/app/(main)/hormones/simulator/page')
    const result = await SimulatorPage({ searchParams: Promise.resolve({ month: '7' }) })

    expect(result).toBeTruthy()
    const rendered = JSON.stringify(result)
    expect(rendered).toContain('"initialMonth":7')
  })

  it('ignores invalid month from searchParams', async () => {
    mockGetSimulatorData.mockResolvedValue({
      hormones: [],
      techniques: [],
      seasonalLevels: [],
    })

    const { default: SimulatorPage } = await import('@/app/(main)/hormones/simulator/page')
    const result = await SimulatorPage({ searchParams: Promise.resolve({ month: '13' }) })

    expect(result).toBeTruthy()
    const rendered = JSON.stringify(result)
    expect(rendered).not.toContain('"initialMonth"')
  })
})
