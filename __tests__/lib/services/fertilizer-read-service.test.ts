// @vitest-environment node
/**
 * lib/services/fertilizer-read-service のユニットテスト
 *
 * listNutrients / getNutrientBySlug / listFertilizerCategories /
 * listTreeSpecies / getFertilizationScheduleBySlug の
 * 正常系・category フィルタ・エラーハンドリングを検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockFertilizerNutrientFindMany = vi.fn()
const mockFertilizerNutrientFindUnique = vi.fn()
const mockFertilizerCategoryFindMany = vi.fn()
const mockTreeSpeciesFindMany = vi.fn()
const mockTreeSpeciesFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    fertilizerNutrient: {
      findMany: (...args: unknown[]) => mockFertilizerNutrientFindMany(...args),
      findUnique: (...args: unknown[]) => mockFertilizerNutrientFindUnique(...args),
    },
    fertilizerCategory: {
      findMany: (...args: unknown[]) => mockFertilizerCategoryFindMany(...args),
    },
    treeSpecies: {
      findMany: (...args: unknown[]) => mockTreeSpeciesFindMany(...args),
      findUnique: (...args: unknown[]) => mockTreeSpeciesFindUnique(...args),
    },
  },
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  default: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}))

const mockNutrients = [
  { id: 'n1', name: '窒素', symbol: 'N', category: 'primary', description: '葉の成長', bonsaiRole: '成長促進', slug: 'nitrogen' },
  { id: 'n2', name: 'リン', symbol: 'P', category: 'primary', description: '根の発達', bonsaiRole: '開花促進', slug: 'phosphorus' },
  { id: 'n3', name: 'カリウム', symbol: 'K', category: 'primary', description: '耐病性', bonsaiRole: '幹の強化', slug: 'potassium' },
]

const mockNutrientDetail = {
  id: 'n1',
  name: '窒素',
  symbol: 'N',
  category: 'primary',
  description: '葉の成長に必要',
  bonsaiRole: '成長促進',
  deficiencySymptoms: '葉が黄化する',
  excessSymptoms: '徒長しやすくなる',
  foodSources: '油かす、魚粉',
  slug: 'nitrogen',
}

const mockCategories = [
  { code: 'organic', name: '有機肥料', description: '植物・動物由来', merit: '土壌改善', demerit: '即効性低い', bonsaiUsage: '元肥', slug: 'organic' },
  { code: 'chemical', name: '化成肥料', description: '化学合成', merit: '即効性高い', demerit: '土壌劣化', bonsaiUsage: '追肥', slug: 'chemical' },
]

const mockTreeSpecies = [
  { id: 'ts1', name: '黒松', category: 'conifer', fertilizingPolicy: '年2回', slug: 'kuromatsu' },
  { id: 'ts2', name: 'もみじ', category: 'deciduous', fertilizingPolicy: '春秋', slug: 'momiji' },
]

const mockTreeSpeciesDetail = {
  id: 'ts1',
  name: '黒松',
  slug: 'kuromatsu',
  plans: [
    { month: 3, action: 'moderate', nitrogenLevel: 'balanced', phosphorusLevel: 'balanced', potassiumLevel: 'balanced', recommendedType: 'organic', description: '春施肥' },
    { month: 9, action: 'light', nitrogenLevel: 'low', phosphorusLevel: 'balanced', potassiumLevel: 'high', recommendedType: 'organic', description: '秋施肥' },
  ],
}

describe('listNutrients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFertilizerNutrientFindMany.mockResolvedValue(mockNutrients)
  })

  it('正常系: nutrients 配列を返す', async () => {
    const { listNutrients } = await import('@/lib/services/fertilizer-read-service')
    const result = await listNutrients()

    expect(result.nutrients).toHaveLength(3)
  })

  it('各 nutrient に { id, name, symbol, category, slug } が含まれる', async () => {
    const { listNutrients } = await import('@/lib/services/fertilizer-read-service')
    const result = await listNutrients()

    expect(result.nutrients[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      symbol: expect.any(String),
      category: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('category=primary フィルタが DB クエリに渡される', async () => {
    const { listNutrients } = await import('@/lib/services/fertilizer-read-service')
    await listNutrients({ category: 'primary' as const })

    expect(mockFertilizerNutrientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: 'primary' },
      }),
    )
  })

  it('category なしのとき where を渡さない', async () => {
    const { listNutrients } = await import('@/lib/services/fertilizer-read-service')
    await listNutrients()

    expect(mockFertilizerNutrientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    )
  })

  it('DB エラー時は { nutrients: [] } を返す', async () => {
    mockFertilizerNutrientFindMany.mockRejectedValue(new Error('DB error'))

    const { listNutrients } = await import('@/lib/services/fertilizer-read-service')
    const result = await listNutrients()

    expect(result.nutrients).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

describe('getNutrientBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFertilizerNutrientFindUnique.mockResolvedValue(mockNutrientDetail)
  })

  it('正常系: nutrient 詳細を返す', async () => {
    const { getNutrientBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getNutrientBySlug('nitrogen')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('nitrogen')
  })

  it('詳細に deficiencySymptoms, excessSymptoms, foodSources が含まれる', async () => {
    const { getNutrientBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getNutrientBySlug('nitrogen')

    expect(result).toMatchObject({
      deficiencySymptoms: expect.any(String),
      excessSymptoms: expect.any(String),
      foodSources: expect.any(String),
    })
  })

  it('不存在 slug → null を返す', async () => {
    mockFertilizerNutrientFindUnique.mockResolvedValueOnce(null)

    const { getNutrientBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getNutrientBySlug('no-such')

    expect(result).toBeNull()
  })

  it('DB エラー時は null を返す', async () => {
    mockFertilizerNutrientFindUnique.mockRejectedValue(new Error('DB error'))

    const { getNutrientBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getNutrientBySlug('nitrogen')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

describe('listFertilizerCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFertilizerCategoryFindMany.mockResolvedValue(mockCategories)
  })

  it('正常系: categories 配列を返す', async () => {
    const { listFertilizerCategories } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerCategories()

    expect(result.categories).toHaveLength(2)
  })

  it('各 category に { code, name, slug } が含まれる', async () => {
    const { listFertilizerCategories } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerCategories()

    expect(result.categories[0]).toMatchObject({
      code: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('DB エラー時は { categories: [] } を返す', async () => {
    mockFertilizerCategoryFindMany.mockRejectedValue(new Error('DB error'))

    const { listFertilizerCategories } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerCategories()

    expect(result.categories).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

describe('listTreeSpecies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTreeSpeciesFindMany.mockResolvedValue(mockTreeSpecies)
  })

  it('正常系: treeSpecies 配列を返す', async () => {
    const { listTreeSpecies } = await import('@/lib/services/fertilizer-read-service')
    const result = await listTreeSpecies()

    expect(result.treeSpecies).toHaveLength(2)
  })

  it('各 species に { id, name, category, slug } が含まれる', async () => {
    const { listTreeSpecies } = await import('@/lib/services/fertilizer-read-service')
    const result = await listTreeSpecies()

    expect(result.treeSpecies[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('category=conifer フィルタが DB クエリに渡される', async () => {
    const { listTreeSpecies } = await import('@/lib/services/fertilizer-read-service')
    await listTreeSpecies({ category: 'conifer' as const })

    expect(mockTreeSpeciesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: 'conifer' },
      }),
    )
  })

  it('DB エラー時は { treeSpecies: [] } を返す', async () => {
    mockTreeSpeciesFindMany.mockRejectedValue(new Error('DB error'))

    const { listTreeSpecies } = await import('@/lib/services/fertilizer-read-service')
    const result = await listTreeSpecies()

    expect(result.treeSpecies).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

describe('getFertilizationScheduleBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTreeSpeciesFindUnique.mockResolvedValue(mockTreeSpeciesDetail)
  })

  it('正常系: 樹種と plans を返す', async () => {
    const { getFertilizationScheduleBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizationScheduleBySlug('kuromatsu')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('kuromatsu')
    expect(result?.plans).toHaveLength(2)
  })

  it('plans に { month, action } が含まれる', async () => {
    const { getFertilizationScheduleBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizationScheduleBySlug('kuromatsu')

    expect(result?.plans[0]).toMatchObject({
      month: expect.any(Number),
      action: expect.any(String),
    })
  })

  it('不存在 slug → null を返す', async () => {
    mockTreeSpeciesFindUnique.mockResolvedValueOnce(null)

    const { getFertilizationScheduleBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizationScheduleBySlug('no-such')

    expect(result).toBeNull()
  })

  it('DB エラー時は null を返す', async () => {
    mockTreeSpeciesFindUnique.mockRejectedValue(new Error('DB error'))

    const { getFertilizationScheduleBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizationScheduleBySlug('kuromatsu')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
