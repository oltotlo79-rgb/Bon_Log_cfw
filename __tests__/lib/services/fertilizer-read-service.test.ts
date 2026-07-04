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
const mockFertilizerColumnFindMany = vi.fn()
const mockFertilizerColumnFindUnique = vi.fn()

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
    fertilizerColumn: {
      findMany: (...args: unknown[]) => mockFertilizerColumnFindMany(...args),
      findUnique: (...args: unknown[]) => mockFertilizerColumnFindUnique(...args),
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
  nameEn: 'Japanese black pine',
  category: 'conifer',
  description: '松柏類の代表的な樹種',
  examples: '黒松盆栽の代表作',
  fertilizingPolicy: '年2回、春秋に施肥',
  slug: 'kuromatsu',
  plans: [
    { month: 3, action: 'moderate', nitrogenLevel: 'balanced', phosphorusLevel: 'balanced', potassiumLevel: 'balanced', recommendedType: 'organic', description: '春施肥', cautionNote: '梅雨時期の多肥に注意' },
    { month: 9, action: 'light', nitrogenLevel: 'low', phosphorusLevel: 'balanced', potassiumLevel: 'high', recommendedType: 'organic', description: '秋施肥', cautionNote: null },
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

  it('Error インスタンス以外が throw されたときも { nutrients: [] } を返す', async () => {
    mockFertilizerNutrientFindMany.mockRejectedValue('connection refused')

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

  it('Error インスタンス以外が throw されたときも null を返す', async () => {
    mockFertilizerNutrientFindUnique.mockRejectedValue({ code: 'TIMEOUT' })

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

  it('Error インスタンス以外が throw されたときも { categories: [] } を返す', async () => {
    mockFertilizerCategoryFindMany.mockRejectedValue('read timeout')

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

  it('Error インスタンス以外が throw されたときも { treeSpecies: [] } を返す', async () => {
    mockTreeSpeciesFindMany.mockRejectedValue(42)

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

  it('樹種メタ情報 { nameEn, category, description, examples, fertilizingPolicy } を含む', async () => {
    const { getFertilizationScheduleBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizationScheduleBySlug('kuromatsu')

    expect(result).toMatchObject({
      nameEn: 'Japanese black pine',
      category: 'conifer',
      description: '松柏類の代表的な樹種',
      examples: '黒松盆栽の代表作',
      fertilizingPolicy: '年2回、春秋に施肥',
    })
  })

  it('nameEn / description / examples / fertilizingPolicy が null のケースでも null を維持する', async () => {
    mockTreeSpeciesFindUnique.mockResolvedValueOnce({
      ...mockTreeSpeciesDetail,
      nameEn: null,
      description: null,
      examples: null,
      fertilizingPolicy: null,
    })

    const { getFertilizationScheduleBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizationScheduleBySlug('kuromatsu')

    expect(result?.nameEn).toBeNull()
    expect(result?.description).toBeNull()
    expect(result?.examples).toBeNull()
    expect(result?.fertilizingPolicy).toBeNull()
  })

  it('plans の各要素に cautionNote が含まれる（値あり・null 両方）', async () => {
    const { getFertilizationScheduleBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizationScheduleBySlug('kuromatsu')

    expect(result?.plans[0]).toHaveProperty('cautionNote', '梅雨時期の多肥に注意')
    expect(result?.plans[1]).toHaveProperty('cautionNote', null)
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

  it('Error インスタンス以外が throw されたときも null を返す', async () => {
    mockTreeSpeciesFindUnique.mockRejectedValue({ message: 'not an Error instance' })

    const { getFertilizationScheduleBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizationScheduleBySlug('kuromatsu')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── listFertilizerColumns（F-1） ───────────────────────────────

const mockFertilizerColumnRows = [
  {
    id: 'fc1',
    slug: 'basic-fertilizer',
    title: '基本の施肥ガイド',
    category: 'product_guide',
    publishedAt: new Date('2025-01-01T00:00:00Z'),
    sortOrder: 1,
  },
  {
    id: 'fc2',
    slug: 'trouble-shooting',
    title: '施肥のトラブル対処法',
    category: 'trouble',
    publishedAt: new Date('2025-02-01T00:00:00Z'),
    sortOrder: 2,
  },
]

describe('listFertilizerColumns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFertilizerColumnFindMany.mockResolvedValue(mockFertilizerColumnRows)
  })

  it('正常系: { items, nextCursor } を返す', async () => {
    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerColumns({})

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('各 item に { id, slug, title, category, publishedAt, sortOrder } がある', async () => {
    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerColumns({})

    expect(result.items[0]).toMatchObject({
      id: 'fc1',
      slug: 'basic-fertilizer',
      title: '基本の施肥ガイド',
      category: 'product_guide',
      sortOrder: 1,
    })
  })

  it('publishedAt は ISO 文字列で返る', async () => {
    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerColumns({})

    expect(typeof result.items[0]?.publishedAt).toBe('string')
    expect(result.items[0]?.publishedAt).toBe('2025-01-01T00:00:00.000Z')
  })

  it('category フィルタが DB クエリの where に渡される', async () => {
    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    await listFertilizerColumns({ category: 'product_guide' })

    expect(mockFertilizerColumnFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'product_guide' }),
      }),
    )
  })

  it('category 未指定のとき where に category が含まれない', async () => {
    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    await listFertilizerColumns({})

    const callArgs = mockFertilizerColumnFindMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>
    }
    expect(callArgs?.where).not.toHaveProperty('category')
  })

  it('カーソルページネーション: limit+1 件で hasNext を判定し nextCursor を設定する', async () => {
    const extraRows = [
      ...mockFertilizerColumnRows,
      {
        id: 'fc3',
        slug: 'seasonal-guide',
        title: '季節別施肥ガイド',
        category: 'product_guide',
        publishedAt: new Date('2025-03-01T00:00:00Z'),
        sortOrder: 3,
      },
    ]
    mockFertilizerColumnFindMany.mockResolvedValueOnce(extraRows)

    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerColumns({ limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBe('trouble-shooting')
  })

  it('publishedAt が null の行はフィルタされる', async () => {
    const rowsWithNull = [
      ...mockFertilizerColumnRows,
      {
        id: 'fc-draft',
        slug: 'draft',
        title: '下書き',
        category: 'product_guide',
        publishedAt: null,
        sortOrder: 99,
      },
    ]
    mockFertilizerColumnFindMany.mockResolvedValueOnce(rowsWithNull)

    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerColumns({})

    expect(result.items.some((i) => i.slug === 'draft')).toBe(false)
  })

  it('空配列のとき { items: [], nextCursor: null } を返す', async () => {
    mockFertilizerColumnFindMany.mockResolvedValueOnce([])

    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerColumns({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('DB エラー時は { items: [], nextCursor: null } を返す', async () => {
    mockFertilizerColumnFindMany.mockRejectedValue(new Error('DB error'))

    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerColumns({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('Error インスタンス以外が throw されたときも空を返す', async () => {
    mockFertilizerColumnFindMany.mockRejectedValue('network error')

    const { listFertilizerColumns } = await import('@/lib/services/fertilizer-read-service')
    const result = await listFertilizerColumns({})

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── getFertilizerColumnBySlug（F-2） ──────────────────────────

const mockFertilizerColumnDetail = {
  id: 'fc1',
  slug: 'basic-fertilizer',
  title: '基本の施肥ガイド',
  content: '盆栽の施肥は春と秋が基本です。',
  category: 'product_guide',
  publishedAt: new Date('2025-01-01T00:00:00Z'),
  sortOrder: 1,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-15T00:00:00Z'),
}

describe('getFertilizerColumnBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFertilizerColumnFindUnique.mockResolvedValue(mockFertilizerColumnDetail)
  })

  it('正常系: コラム詳細を返す', async () => {
    const { getFertilizerColumnBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizerColumnBySlug('basic-fertilizer')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('basic-fertilizer')
  })

  it('詳細に content が含まれる', async () => {
    const { getFertilizerColumnBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizerColumnBySlug('basic-fertilizer')

    expect(result?.content).toBe('盆栽の施肥は春と秋が基本です。')
  })

  it('publishedAt / createdAt / updatedAt は ISO 文字列で返る', async () => {
    const { getFertilizerColumnBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizerColumnBySlug('basic-fertilizer')

    expect(typeof result?.publishedAt).toBe('string')
    expect(typeof result?.createdAt).toBe('string')
    expect(typeof result?.updatedAt).toBe('string')
    expect(result?.publishedAt).toBe('2025-01-01T00:00:00.000Z')
  })

  it('不存在 slug → null を返す', async () => {
    mockFertilizerColumnFindUnique.mockResolvedValueOnce(null)

    const { getFertilizerColumnBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizerColumnBySlug('no-such')

    expect(result).toBeNull()
  })

  it('publishedAt が null（未公開）のとき null を返す', async () => {
    mockFertilizerColumnFindUnique.mockResolvedValueOnce({
      ...mockFertilizerColumnDetail,
      publishedAt: null,
    })

    const { getFertilizerColumnBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizerColumnBySlug('basic-fertilizer')

    expect(result).toBeNull()
  })

  it('空スラッグ → null を返す（slugQuerySchema 検証失敗）', async () => {
    const { getFertilizerColumnBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizerColumnBySlug('')

    expect(result).toBeNull()
    expect(mockFertilizerColumnFindUnique).not.toHaveBeenCalled()
  })

  it('DB エラー時は null を返す', async () => {
    mockFertilizerColumnFindUnique.mockRejectedValue(new Error('DB error'))

    const { getFertilizerColumnBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizerColumnBySlug('basic-fertilizer')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('Error インスタンス以外が throw されたときも null を返す', async () => {
    mockFertilizerColumnFindUnique.mockRejectedValue({ code: 'TIMEOUT' })

    const { getFertilizerColumnBySlug } = await import('@/lib/services/fertilizer-read-service')
    const result = await getFertilizerColumnBySlug('basic-fertilizer')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
