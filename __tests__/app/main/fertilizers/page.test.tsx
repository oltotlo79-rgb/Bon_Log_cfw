// @vitest-environment node
import { vi } from 'vitest'

const mockGetNutrients = vi.fn()
const mockGetTreeSpecies = vi.fn()
const mockGetFertilizerColumns = vi.fn()

vi.mock('@/lib/actions/fertilizer', () => ({
  getNutrients: (...args: unknown[]) => mockGetNutrients(...args),
  getTreeSpecies: (...args: unknown[]) => mockGetTreeSpecies(...args),
  getFertilizerColumns: (...args: unknown[]) => mockGetFertilizerColumns(...args),
}))

vi.mock('@/lib/utils/season', () => ({
  getCurrentSeason: () => 'spring',
}))

vi.mock('@/components/fertilizer/FertilizerDisclaimer', () => ({
  FertilizerDisclaimer: () => <div data-testid="fertilizer-disclaimer" />,
}))

vi.mock('@/components/fertilizer/NutrientCard', () => ({
  NutrientCard: ({ nutrient }: { nutrient: { id: string; name: string } }) => (
    <div data-testid={`nutrient-card-${nutrient.id}`}>{nutrient.name}</div>
  ),
}))

function setupDefaultMocks() {
  mockGetNutrients.mockResolvedValue({ nutrients: [] })
  mockGetTreeSpecies.mockResolvedValue({ treeSpecies: [] })
  mockGetFertilizerColumns.mockResolvedValue({ columns: [] })
}

describe('FertilizerTopPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ページが正常にレンダリングされる', async () => {
    mockGetNutrients.mockResolvedValue({
      nutrients: [
        { id: 'n1', name: '窒素', slug: 'nitrogen', symbol: 'N', category: 'primary' },
        { id: 'n2', name: 'リン酸', slug: 'phosphorus', symbol: 'P', category: 'primary' },
        { id: 'n3', name: 'カリウム', slug: 'potassium', symbol: 'K', category: 'primary' },
      ],
    })
    mockGetTreeSpecies.mockResolvedValue({ treeSpecies: [] })
    mockGetFertilizerColumns.mockResolvedValue({ columns: [] })

    const { default: FertilizerTopPage } = await import('@/app/(main)/fertilizers/page')
    const result = await FertilizerTopPage()

    expect(result).toBeTruthy()
    expect(mockGetNutrients).toHaveBeenCalled()
    expect(mockGetTreeSpecies).toHaveBeenCalled()
    expect(mockGetFertilizerColumns).toHaveBeenCalled()
  })

  it('getNutrientsが引数なしで呼ばれる（全栄養素取得）', async () => {
    setupDefaultMocks()

    const { default: FertilizerTopPage } = await import('@/app/(main)/fertilizers/page')
    await FertilizerTopPage()

    expect(mockGetNutrients).toHaveBeenCalledWith()
  })

  it('栄養素が空でもエラーにならない', async () => {
    setupDefaultMocks()

    const { default: FertilizerTopPage } = await import('@/app/(main)/fertilizers/page')
    const result = await FertilizerTopPage()

    expect(result).toBeTruthy()
  })

  it('二次要素がある場合も正常にレンダリングされる', async () => {
    mockGetNutrients.mockResolvedValue({
      nutrients: [
        { id: 'n1', name: '窒素', slug: 'nitrogen', symbol: 'N', category: 'primary' },
        { id: 'n4', name: 'カルシウム', slug: 'calcium', symbol: 'Ca', category: 'secondary' },
      ],
    })
    mockGetTreeSpecies.mockResolvedValue({ treeSpecies: [{ id: 's1', name: '黒松' }] })
    mockGetFertilizerColumns.mockResolvedValue({ columns: [{ id: 'c1', title: 'テスト' }] })

    const { default: FertilizerTopPage } = await import('@/app/(main)/fertilizers/page')
    const result = await FertilizerTopPage()

    expect(result).toBeTruthy()
  })
})
