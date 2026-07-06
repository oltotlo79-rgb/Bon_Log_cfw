// @vitest-environment node
/**
 * lib/services/pesticide-read-service のユニットテスト
 *
 * listDiseasePests / getDiseasePestBySlug /
 * listPesticides / getPesticideBySlug /
 * listActiveIngredients / getActiveIngredientBySlug /
 * parsePesticideTypeParam の
 * 正常系・フィルタ・ネスト・カーソルページネーション・エラーハンドリングを検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockDiseasePestFindMany = vi.fn()
const mockDiseasePestFindUnique = vi.fn()
const mockPesticideFindMany = vi.fn()
const mockPesticideFindUnique = vi.fn()
const mockActiveIngredientFindMany = vi.fn()
const mockActiveIngredientFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    diseasePest: {
      findMany: (...args: unknown[]) => mockDiseasePestFindMany(...args),
      findUnique: (...args: unknown[]) => mockDiseasePestFindUnique(...args),
    },
    pesticide: {
      findMany: (...args: unknown[]) => mockPesticideFindMany(...args),
      findUnique: (...args: unknown[]) => mockPesticideFindUnique(...args),
    },
    activeIngredient: {
      findMany: (...args: unknown[]) => mockActiveIngredientFindMany(...args),
      findUnique: (...args: unknown[]) => mockActiveIngredientFindUnique(...args),
    },
  },
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  default: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}))

vi.mock('@/lib/utils/pesticide', () => ({
  normalizePesticideType: (type: string | undefined) => {
    if (!type) return undefined
    if (type === 'herbicide') return 'other'
    const valid = ['fungicide', 'insecticide', 'acaricide', 'compound', 'other']
    return valid.includes(type) ? type : undefined
  },
}))

const mockDiseasePests = [
  {
    id: 'dp1',
    name: 'アブラムシ',
    nameKana: 'アブラムシ',
    category: 'pest' as const,
    description: '葉に寄生する害虫',
    imageUrl: '/images/aphid.jpg',
    slug: 'aphid',
    bodySizeMinMm: null,
    bodySizeMaxMm: null,
    _count: { effects: 3 },
  },
  {
    id: 'dp2',
    name: 'うどんこ病',
    nameKana: 'ウドンコビョウ',
    category: 'disease' as const,
    description: '葉に白い粉が付く',
    imageUrl: null,
    slug: 'powdery-mildew',
    bodySizeMinMm: null,
    bodySizeMaxMm: null,
    _count: { effects: 0 },
  },
]

const mockDiseasePestDetail = {
  id: 'dp1',
  name: 'アブラムシ',
  nameKana: 'アブラムシ',
  category: 'pest' as const,
  description: '葉に寄生する害虫',
  imageUrl: '/images/aphid.jpg',
  slug: 'aphid',
  bodySizeMinMm: null,
  bodySizeMaxMm: null,
  effects: [
    {
      preventionLevel: 'high',
      treatmentLevel: 'medium',
      efficacyLevel: null,
      persistenceLevel: 'low',
      pesticide: {
        id: 'p1',
        name: 'スミチオン',
        slug: 'sumithion',
        pesticideType: 'insecticide' as const,
        formulationType: null,
        ingredients: [],
      },
    },
  ],
}

const mockPesticides = [
  {
    id: 'p1',
    name: 'スミチオン',
    registrationNumber: '12345',
    pesticideType: 'insecticide' as const,
    description: '有機リン系殺虫剤',
    slug: 'sumithion',
  },
  {
    id: 'p2',
    name: 'トップジンM',
    registrationNumber: '67890',
    pesticideType: 'fungicide' as const,
    description: 'チオファネートメチル系殺菌剤',
    slug: 'topsin-m',
  },
]

const mockPesticideDetail = {
  id: 'p1',
  name: 'スミチオン',
  registrationNumber: '12345',
  pesticideType: 'insecticide' as const,
  description: '有機リン系殺虫剤',
  slug: 'sumithion',
  formulationType: { name: '乳剤', code: 'EC' },
  ingredients: [
    {
      activeIngredient: {
        id: 'ai1',
        name: 'フェニトロチオン',
        fracCode: null,
        iracCode: '1B',
        resistanceRisk: 'medium' as const,
        slug: 'fenitrothion',
      },
    },
  ],
  effects: [
    {
      preventionLevel: 'high',
      treatmentLevel: 'medium',
      efficacyLevel: null,
      persistenceLevel: 'low',
      diseasePest: { id: 'dp1', name: 'アブラムシ', slug: 'aphid' },
    },
  ],
  incompatibleWith: [
    {
      incompatibleWith: {
        id: 'p3',
        name: 'ボルドー液',
        slug: 'bordeaux',
        formulationType: { name: '水和剤' },
      },
    },
  ],
  spreaderTypes: [
    {
      spreaderType: { id: 'st1', slug: 'nonionic', name: '非イオン系' },
    },
  ],
}

const mockIngredients = [
  {
    id: 'ai1',
    name: 'フェニトロチオン',
    nameEn: 'Fenitrothion',
    fracCode: null,
    iracCode: '1B',
    resistanceRisk: 'medium' as const,
    slug: 'fenitrothion',
  },
  {
    id: 'ai2',
    name: 'チオファネートメチル',
    nameEn: 'Thiophanate-methyl',
    fracCode: '1',
    iracCode: null,
    resistanceRisk: 'high' as const,
    slug: 'thiophanate-methyl',
  },
]

const mockIngredientDetail = {
  id: 'ai1',
  name: 'フェニトロチオン',
  nameEn: 'Fenitrothion',
  fracCode: null,
  iracCode: '1B',
  resistanceRisk: 'medium' as const,
  slug: 'fenitrothion',
  ingredientGroup: '有機リン系',
  description: '広範囲の害虫に効果',
  pesticides: [
    {
      contentLabel: '50%',
      pesticide: {
        id: 'p1',
        name: 'スミチオン',
        slug: 'sumithion',
        formulationType: { name: '乳剤' },
      },
    },
  ],
}

// ── listDiseasePests ──────────────────────────────────────────

describe('listDiseasePests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDiseasePestFindMany.mockResolvedValue(mockDiseasePests)
  })

  it('正常系: items と nextCursor を返す', async () => {
    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('各 item に { id, name, nameKana, category, description, imageUrl, slug } が含まれる', async () => {
    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('各 item の effectsCount が _count.effects と一致する', async () => {
    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items[0]?.effectsCount).toBe(3)
    expect(result.items[1]?.effectsCount).toBe(0)
  })

  it('effects が 0 件の病害虫でも effectsCount: 0 を返す（例外にならない）', async () => {
    mockDiseasePestFindMany.mockResolvedValueOnce([
      { ...mockDiseasePests[0], _count: { effects: 0 } },
    ])

    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items[0]?.effectsCount).toBe(0)
  })

  it('items に bodySizeMinMm と bodySizeMaxMm（number|null）が含まれる', async () => {
    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    for (const item of result.items) {
      expect('bodySizeMinMm' in item).toBe(true)
      expect('bodySizeMaxMm' in item).toBe(true)
      expect(item.bodySizeMinMm === null || typeof item.bodySizeMinMm === 'number').toBe(true)
      expect(item.bodySizeMaxMm === null || typeof item.bodySizeMaxMm === 'number').toBe(true)
    }
  })

  it('bodySizeMinMm/bodySizeMaxMm に数値がある場合にも正しく返す', async () => {
    const withBodySize = [
      { ...mockDiseasePests[0], bodySizeMinMm: 2.5, bodySizeMaxMm: 5.0 },
    ]
    mockDiseasePestFindMany.mockResolvedValueOnce(withBodySize)

    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items[0]?.bodySizeMinMm).toBe(2.5)
    expect(result.items[0]?.bodySizeMaxMm).toBe(5.0)
  })

  it('category フィルタが DB クエリの where に渡される', async () => {
    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    await listDiseasePests({ category: 'pest' })

    expect(mockDiseasePestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: 'pest' }),
      }),
    )
  })

  it('search フィルタが where.OR に渡される', async () => {
    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    await listDiseasePests({ search: 'アブラムシ' })

    expect(mockDiseasePestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    )
  })

  it('bodySizeMm フィルタが bodySizeMinMm/bodySizeMaxMm の範囲検索に変換される', async () => {
    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    await listDiseasePests({ bodySizeMm: 10 })

    expect(mockDiseasePestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bodySizeMinMm: { lte: 10 },
          bodySizeMaxMm: { gte: 10 },
        }),
      }),
    )
  })

  it('cursor 指定でページネーションが機能する', async () => {
    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    await listDiseasePests({ cursor: 'aphid' })

    expect(mockDiseasePestFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { slug: 'aphid' },
        skip: 1,
      }),
    )
  })

  it('safeLimit+1 件返ったとき nextCursor が設定される', async () => {
    const limitedItems = Array.from({ length: 21 }, (_, i) => ({
      ...mockDiseasePests[0],
      id: `dp${i}`,
      slug: `slug-${i}`,
    }))
    mockDiseasePestFindMany.mockResolvedValueOnce(limitedItems)

    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({ limit: 20 })

    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('slug-19')
  })

  it('imageUrl null のとき PEST_IMAGE_FALLBACK が適用される（既知 slug）', async () => {
    const itemsWithKnownSlug = [
      { ...mockDiseasePests[0], slug: 'kabura-habachi', imageUrl: null },
    ]
    mockDiseasePestFindMany.mockResolvedValueOnce(itemsWithKnownSlug)

    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items[0]?.imageUrl).toBe('/images/pesticides/kabura-habachi.png')
  })

  it('imageUrl null かつ未知 slug のとき imageUrl は null のまま', async () => {
    const itemsWithUnknownSlug = [
      { ...mockDiseasePests[0], slug: 'unknown-pest', imageUrl: null },
    ]
    mockDiseasePestFindMany.mockResolvedValueOnce(itemsWithUnknownSlug)

    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items[0]?.imageUrl).toBeNull()
  })

  it('空配列のとき { items: [], nextCursor: null } を返す', async () => {
    mockDiseasePestFindMany.mockResolvedValueOnce([])

    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('DB エラー時は { items: [], nextCursor: null } を返す', async () => {
    mockDiseasePestFindMany.mockRejectedValue(new Error('DB error'))

    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('DB が Error 以外の値を reject した場合も String化してログに記録する', async () => {
    mockDiseasePestFindMany.mockRejectedValue('string rejection')

    const { listDiseasePests } = await import('@/lib/services/pesticide-read-service')
    const result = await listDiseasePests({})

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalledWith(
      'listDiseasePests failed',
      expect.objectContaining({ error: 'string rejection' }),
    )
  })
})

// ── getDiseasePestBySlug ──────────────────────────────────────

describe('getDiseasePestBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDiseasePestFindUnique.mockResolvedValue(mockDiseasePestDetail)
  })

  it('正常系: 詳細オブジェクトを返す', async () => {
    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('aphid')
  })

  it('effects 配列が含まれ pesticide と rating を持つ', async () => {
    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(Array.isArray(result?.effects)).toBe(true)
    expect(result?.effects).toHaveLength(1)
    expect(result?.effects[0]).toMatchObject({
      pesticide: expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
        pesticideType: expect.any(String),
      }),
      rating: expect.objectContaining({
        preventionLevel: expect.any(String),
      }),
    })
  })

  it('effectsCount が effects.length と一致する', async () => {
    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(result?.effectsCount).toBe(result?.effects.length)
    expect(result?.effectsCount).toBe(1)
  })

  it('effects が 0 件のとき effectsCount: 0 を返す', async () => {
    mockDiseasePestFindUnique.mockResolvedValueOnce({ ...mockDiseasePestDetail, effects: [] })

    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(result?.effectsCount).toBe(0)
    expect(result?.effects).toHaveLength(0)
  })

  it('rating の各フィールドが null または string', async () => {
    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    const rating = result?.effects[0]?.rating
    expect(rating).toBeDefined()
    if (rating) {
      for (const val of Object.values(rating)) {
        expect(val === null || typeof val === 'string').toBe(true)
      }
    }
  })

  it('rating の全フィールドが未測定（null/undefined）でも全て null で返す', async () => {
    mockDiseasePestFindUnique.mockResolvedValueOnce({
      ...mockDiseasePestDetail,
      effects: [
        {
          preventionLevel: null,
          treatmentLevel: undefined,
          efficacyLevel: null,
          persistenceLevel: undefined,
          pesticide: mockDiseasePestDetail.effects[0]!.pesticide,
        },
      ],
    })

    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(result?.effects[0]?.rating).toEqual({
      preventionLevel: null,
      treatmentLevel: null,
      efficacyLevel: null,
      persistenceLevel: null,
    })
  })

  it('pesticide.formulationType が設定されている場合はそのまま返し、ingredients から activeIngredients を導出する', async () => {
    mockDiseasePestFindUnique.mockResolvedValueOnce({
      ...mockDiseasePestDetail,
      effects: [
        {
          preventionLevel: 'high',
          treatmentLevel: 'medium',
          efficacyLevel: null,
          persistenceLevel: 'low',
          pesticide: {
            id: 'p1',
            name: 'スミチオン',
            slug: 'sumithion',
            pesticideType: 'insecticide',
            formulationType: { name: '乳剤', code: 'EC' },
            ingredients: [
              {
                activeIngredient: {
                  id: 'ai1',
                  name: 'フェニトロチオン',
                  fracCode: null,
                  iracCode: '1B',
                  resistanceRisk: 'medium',
                  slug: 'fenitrothion',
                },
              },
            ],
          },
        },
      ],
    })

    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(result?.effects[0]?.pesticide.formulationType).toEqual({ name: '乳剤', code: 'EC' })
    expect(result?.effects[0]?.pesticide.activeIngredients).toEqual([
      {
        id: 'ai1',
        name: 'フェニトロチオン',
        fracCode: null,
        iracCode: '1B',
        resistanceRisk: 'medium',
        slug: 'fenitrothion',
      },
    ])
  })

  it('結果に bodySizeMinMm と bodySizeMaxMm（number|null）が含まれる', async () => {
    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(result).not.toBeNull()
    expect('bodySizeMinMm' in result!).toBe(true)
    expect('bodySizeMaxMm' in result!).toBe(true)
    expect(result!.bodySizeMinMm === null || typeof result!.bodySizeMinMm === 'number').toBe(true)
    expect(result!.bodySizeMaxMm === null || typeof result!.bodySizeMaxMm === 'number').toBe(true)
  })

  it('bodySizeMinMm/bodySizeMaxMm に数値がある場合にも正しく返す', async () => {
    const detailWithBodySize = { ...mockDiseasePestDetail, bodySizeMinMm: 1.0, bodySizeMaxMm: 3.5 }
    mockDiseasePestFindUnique.mockResolvedValueOnce(detailWithBodySize)

    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(result?.bodySizeMinMm).toBe(1.0)
    expect(result?.bodySizeMaxMm).toBe(3.5)
  })

  it('PEST_IMAGE_FALLBACK が詳細にも適用される（既知 slug）', async () => {
    const detailNoImage = {
      ...mockDiseasePestDetail,
      slug: 'kabura-habachi',
      imageUrl: null,
    }
    mockDiseasePestFindUnique.mockResolvedValueOnce(detailNoImage)

    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('kabura-habachi')

    expect(result?.imageUrl).toBe('/images/pesticides/kabura-habachi.png')
  })

  it('不存在 slug → null を返す', async () => {
    mockDiseasePestFindUnique.mockResolvedValueOnce(null)

    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('no-such-pest')

    expect(result).toBeNull()
  })

  it('空文字 slug → null を返す（slugSchema min 1 違反）', async () => {
    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('')

    expect(result).toBeNull()
    expect(mockDiseasePestFindUnique).not.toHaveBeenCalled()
  })

  it('DB エラー時は null を返す', async () => {
    mockDiseasePestFindUnique.mockRejectedValue(new Error('DB error'))

    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('DB が Error 以外の値を reject した場合も String化してログに記録する', async () => {
    mockDiseasePestFindUnique.mockRejectedValue('string rejection')

    const { getDiseasePestBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getDiseasePestBySlug('aphid')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getDiseasePestBySlug failed',
      expect.objectContaining({ error: 'string rejection' }),
    )
  })
})

// ── listPesticides ────────────────────────────────────────────

describe('listPesticides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPesticideFindMany.mockResolvedValue(mockPesticides)
  })

  it('正常系: items と nextCursor を返す', async () => {
    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticides({})

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('各 item に { id, name, registrationNumber, pesticideType, slug } が含まれる', async () => {
    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticides({})

    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      pesticideType: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('type フィルタが where.pesticideType に渡される', async () => {
    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    await listPesticides({ type: 'insecticide' })

    expect(mockPesticideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ pesticideType: 'insecticide' }),
      }),
    )
  })

  it('search フィルタが where.OR に渡される', async () => {
    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    await listPesticides({ search: 'スミチオン' })

    expect(mockPesticideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    )
  })

  it('diseasePestId フィルタが where.effects.some に渡される', async () => {
    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    await listPesticides({ diseasePestId: 'dp1' })

    expect(mockPesticideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          effects: { some: { diseasePestId: 'dp1' } },
        }),
      }),
    )
  })

  it('formulationTypeCode フィルタが where.formulationType.is に渡される', async () => {
    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    await listPesticides({ formulationTypeCode: 'EC' })

    expect(mockPesticideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          formulationType: { is: { code: 'EC' } },
        }),
      }),
    )
  })

  it('cursor 指定でページネーションが機能する', async () => {
    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    await listPesticides({ cursor: 'sumithion' })

    expect(mockPesticideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { slug: 'sumithion' },
        skip: 1,
      }),
    )
  })

  it('safeLimit+1 件返ったとき nextCursor が設定される', async () => {
    const limitedItems = Array.from({ length: 21 }, (_, i) => ({
      ...mockPesticides[0],
      id: `p${i}`,
      slug: `slug-${i}`,
    }))
    mockPesticideFindMany.mockResolvedValueOnce(limitedItems)

    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticides({ limit: 20 })

    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('slug-19')
  })

  it('空配列のとき { items: [], nextCursor: null } を返す', async () => {
    mockPesticideFindMany.mockResolvedValueOnce([])

    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticides({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('DB エラー時は { items: [], nextCursor: null } を返す', async () => {
    mockPesticideFindMany.mockRejectedValue(new Error('DB error'))

    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticides({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('DB が Error 以外の値を reject した場合も String化してログに記録する', async () => {
    mockPesticideFindMany.mockRejectedValue('string rejection')

    const { listPesticides } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticides({})

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalledWith(
      'listPesticides failed',
      expect.objectContaining({ error: 'string rejection' }),
    )
  })
})

// ── getPesticideBySlug ────────────────────────────────────────

describe('getPesticideBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPesticideFindUnique.mockResolvedValue(mockPesticideDetail)
  })

  it('正常系: 詳細オブジェクトを返す', async () => {
    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('sumithion')
  })

  it('formulationType が含まれる', async () => {
    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(result?.formulationType).toMatchObject({
      name: expect.any(String),
      code: expect.any(String),
    })
  })

  it('activeIngredients 配列が含まれる', async () => {
    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(Array.isArray(result?.activeIngredients)).toBe(true)
    expect(result?.activeIngredients).toHaveLength(1)
    expect(result?.activeIngredients[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('effects 配列が含まれ diseasePest と rating を持つ', async () => {
    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(Array.isArray(result?.effects)).toBe(true)
    expect(result?.effects[0]).toMatchObject({
      diseasePest: expect.objectContaining({ id: expect.any(String), slug: expect.any(String) }),
      rating: expect.objectContaining({}),
    })
  })

  it('incompatibilities 配列が含まれる', async () => {
    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(Array.isArray(result?.incompatibilities)).toBe(true)
    expect(result?.incompatibilities[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('formulationType null のとき null を返す', async () => {
    const detailNoFormulation = { ...mockPesticideDetail, formulationType: null }
    mockPesticideFindUnique.mockResolvedValueOnce(detailNoFormulation)

    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(result?.formulationType).toBeNull()
  })

  it('spreaderTypes 配列が含まれ { id, slug, name } を持つ', async () => {
    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(Array.isArray(result?.spreaderTypes)).toBe(true)
    expect(result?.spreaderTypes).toHaveLength(1)
    expect(result?.spreaderTypes[0]).toMatchObject({
      id: 'st1',
      slug: 'nonionic',
      name: '非イオン系',
    })
  })

  it('展着剤が 0 件のケースで spreaderTypes が空配列になる', async () => {
    const detailNoSpreader = { ...mockPesticideDetail, spreaderTypes: [] }
    mockPesticideFindUnique.mockResolvedValueOnce(detailNoSpreader)

    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(result?.spreaderTypes).toEqual([])
  })

  it('rating の全フィールドが未測定（null）でも全て null で返す', async () => {
    const detailWithNullRatings = {
      ...mockPesticideDetail,
      effects: [
        {
          preventionLevel: null,
          treatmentLevel: null,
          efficacyLevel: null,
          persistenceLevel: null,
          diseasePest: { id: 'dp1', name: 'アブラムシ', slug: 'aphid' },
        },
      ],
    }
    mockPesticideFindUnique.mockResolvedValueOnce(detailWithNullRatings)

    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(result?.effects[0]?.rating).toEqual({
      preventionLevel: null,
      treatmentLevel: null,
      efficacyLevel: null,
      persistenceLevel: null,
    })
  })

  it('incompatibleWith の formulationType null → formulationTypeName null', async () => {
    const detailWithNullFormulation = {
      ...mockPesticideDetail,
      incompatibleWith: [
        {
          incompatibleWith: {
            id: 'p3',
            name: 'ボルドー液',
            slug: 'bordeaux',
            formulationType: null,
          },
        },
      ],
    }
    mockPesticideFindUnique.mockResolvedValueOnce(detailWithNullFormulation)

    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(result?.incompatibilities[0]?.formulationTypeName).toBeNull()
  })

  it('不存在 slug → null を返す', async () => {
    mockPesticideFindUnique.mockResolvedValueOnce(null)

    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('no-such')

    expect(result).toBeNull()
  })

  it('空文字 slug → null を返す（slugSchema min 1 違反）', async () => {
    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('')

    expect(result).toBeNull()
    expect(mockPesticideFindUnique).not.toHaveBeenCalled()
  })

  it('DB エラー時は null を返す', async () => {
    mockPesticideFindUnique.mockRejectedValue(new Error('DB error'))

    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('DB が Error 以外の値を reject した場合も String化してログに記録する', async () => {
    mockPesticideFindUnique.mockRejectedValue('string rejection')

    const { getPesticideBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideBySlug('sumithion')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getPesticideBySlug failed',
      expect.objectContaining({ error: 'string rejection' }),
    )
  })
})

// ── listActiveIngredients ─────────────────────────────────────

describe('listActiveIngredients', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveIngredientFindMany.mockResolvedValue(mockIngredients)
  })

  it('正常系: items と nextCursor を返す', async () => {
    const { listActiveIngredients } = await import('@/lib/services/pesticide-read-service')
    const result = await listActiveIngredients({})

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('各 item に { id, name, nameEn, fracCode, iracCode, resistanceRisk, slug } が含まれる', async () => {
    const { listActiveIngredients } = await import('@/lib/services/pesticide-read-service')
    const result = await listActiveIngredients({})

    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
    })
  })

  it('search フィルタが where.OR に渡される', async () => {
    const { listActiveIngredients } = await import('@/lib/services/pesticide-read-service')
    await listActiveIngredients({ search: 'フェニトロ' })

    expect(mockActiveIngredientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    )
  })

  it('cursor 指定でページネーションが機能する', async () => {
    const { listActiveIngredients } = await import('@/lib/services/pesticide-read-service')
    await listActiveIngredients({ cursor: 'fenitrothion' })

    expect(mockActiveIngredientFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { slug: 'fenitrothion' },
        skip: 1,
      }),
    )
  })

  it('safeLimit+1 件返ったとき nextCursor が設定される', async () => {
    const limitedItems = Array.from({ length: 21 }, (_, i) => ({
      ...mockIngredients[0],
      id: `ai${i}`,
      slug: `slug-${i}`,
    }))
    mockActiveIngredientFindMany.mockResolvedValueOnce(limitedItems)

    const { listActiveIngredients } = await import('@/lib/services/pesticide-read-service')
    const result = await listActiveIngredients({ limit: 20 })

    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('slug-19')
  })

  it('空配列のとき { items: [], nextCursor: null } を返す', async () => {
    mockActiveIngredientFindMany.mockResolvedValueOnce([])

    const { listActiveIngredients } = await import('@/lib/services/pesticide-read-service')
    const result = await listActiveIngredients({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('DB エラー時は { items: [], nextCursor: null } を返す', async () => {
    mockActiveIngredientFindMany.mockRejectedValue(new Error('DB error'))

    const { listActiveIngredients } = await import('@/lib/services/pesticide-read-service')
    const result = await listActiveIngredients({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('DB が Error 以外の値を reject した場合も String化してログに記録する', async () => {
    mockActiveIngredientFindMany.mockRejectedValue('string rejection')

    const { listActiveIngredients } = await import('@/lib/services/pesticide-read-service')
    const result = await listActiveIngredients({})

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalledWith(
      'listActiveIngredients failed',
      expect.objectContaining({ error: 'string rejection' }),
    )
  })
})

// ── getActiveIngredientBySlug ─────────────────────────────────

describe('getActiveIngredientBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockActiveIngredientFindUnique.mockResolvedValue(mockIngredientDetail)
  })

  it('正常系: 詳細オブジェクトを返す', async () => {
    const { getActiveIngredientBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getActiveIngredientBySlug('fenitrothion')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('fenitrothion')
  })

  it('pesticides 配列が含まれる', async () => {
    const { getActiveIngredientBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getActiveIngredientBySlug('fenitrothion')

    expect(Array.isArray(result?.pesticides)).toBe(true)
    expect(result?.pesticides).toHaveLength(1)
    expect(result?.pesticides[0]).toMatchObject({
      pesticide: expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        slug: expect.any(String),
      }),
    })
  })

  it('pesticide の formulationTypeName が formulationType.name から導出される', async () => {
    const { getActiveIngredientBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getActiveIngredientBySlug('fenitrothion')

    expect(result?.pesticides[0]?.pesticide.formulationTypeName).toBe('乳剤')
  })

  it('pesticide の formulationType null → formulationTypeName null', async () => {
    const detailWithNullFormulation = {
      ...mockIngredientDetail,
      pesticides: [
        {
          contentLabel: '50%',
          pesticide: {
            id: 'p1',
            name: 'スミチオン',
            slug: 'sumithion',
            formulationType: null,
          },
        },
      ],
    }
    mockActiveIngredientFindUnique.mockResolvedValueOnce(detailWithNullFormulation)

    const { getActiveIngredientBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getActiveIngredientBySlug('fenitrothion')

    expect(result?.pesticides[0]?.pesticide.formulationTypeName).toBeNull()
  })

  it('ingredientGroup / description が含まれる', async () => {
    const { getActiveIngredientBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getActiveIngredientBySlug('fenitrothion')

    expect(result?.ingredientGroup).toBe('有機リン系')
    expect(result?.description).toBe('広範囲の害虫に効果')
  })

  it('不存在 slug → null を返す', async () => {
    mockActiveIngredientFindUnique.mockResolvedValueOnce(null)

    const { getActiveIngredientBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getActiveIngredientBySlug('no-such')

    expect(result).toBeNull()
  })

  it('空文字 slug → null を返す（slugSchema min 1 違反）', async () => {
    const { getActiveIngredientBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getActiveIngredientBySlug('')

    expect(result).toBeNull()
    expect(mockActiveIngredientFindUnique).not.toHaveBeenCalled()
  })

  it('DB エラー時は null を返す', async () => {
    mockActiveIngredientFindUnique.mockRejectedValue(new Error('DB error'))

    const { getActiveIngredientBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getActiveIngredientBySlug('fenitrothion')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('DB が Error 以外の値を reject した場合も String化してログに記録する', async () => {
    mockActiveIngredientFindUnique.mockRejectedValue('string rejection')

    const { getActiveIngredientBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getActiveIngredientBySlug('fenitrothion')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalledWith(
      'getActiveIngredientBySlug failed',
      expect.objectContaining({ error: 'string rejection' }),
    )
  })
})

// ── parsePesticideTypeParam ───────────────────────────────────

describe('parsePesticideTypeParam', () => {
  it('null → undefined を返す', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam(null)).toBeUndefined()
  })

  it('空文字 → undefined を返す', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam('')).toBeUndefined()
  })

  it('有効な PesticideType "fungicide" → "fungicide" を返す', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam('fungicide')).toBe('fungicide')
  })

  it('有効な PesticideType "insecticide" → "insecticide" を返す', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam('insecticide')).toBe('insecticide')
  })

  it('有効な PesticideType "acaricide" → "acaricide" を返す', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam('acaricide')).toBe('acaricide')
  })

  it('有効な PesticideType "compound" → "compound" を返す', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam('compound')).toBe('compound')
  })

  it('有効な PesticideType "other" → "other" を返す', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam('other')).toBe('other')
  })

  it('"herbicide" → "other" に正規化される（Web 互換）', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam('herbicide')).toBe('other')
  })

  it('不正な値 "INVALID" → undefined を返す', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam('INVALID')).toBeUndefined()
  })

  it('不正な値 "nematicide" → undefined を返す', async () => {
    const { parsePesticideTypeParam } = await import('@/lib/services/pesticide-read-service')
    expect(parsePesticideTypeParam('nematicide')).toBeUndefined()
  })
})

// ── クエリスキーマ（diseasePestListQuerySchema / pesticideListQuerySchema / ingredientListQuerySchema） ──

describe('diseasePestListQuerySchema', () => {
  it('正常系: cursor/limit/category/search/bodySizeMm を受け付ける', async () => {
    const { diseasePestListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = diseasePestListQuerySchema.safeParse({
      cursor: 'aphid',
      limit: 20,
      category: 'pest',
      search: 'アブラムシ',
      bodySizeMm: 5,
    })

    expect(result.success).toBe(true)
  })

  it('search が非空文字のとき transform 後もそのまま保持される', async () => {
    const { diseasePestListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = diseasePestListQuerySchema.safeParse({ search: 'アブラムシ' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.search).toBe('アブラムシ')
  })

  it('search が空文字のとき transform で undefined になる', async () => {
    const { diseasePestListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = diseasePestListQuerySchema.safeParse({ search: '' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.search).toBeUndefined()
  })

  it('全フィールド省略でも成功する（全て optional）', async () => {
    const { diseasePestListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = diseasePestListQuerySchema.safeParse({})

    expect(result.success).toBe(true)
  })

  it('category に不正な enum 値を渡すと失敗する', async () => {
    const { diseasePestListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = diseasePestListQuerySchema.safeParse({ category: 'not-a-category' })

    expect(result.success).toBe(false)
  })

  it('limit が MAX_PAGE_LIMIT を超えると失敗する', async () => {
    const { diseasePestListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = diseasePestListQuerySchema.safeParse({ limit: 100000 })

    expect(result.success).toBe(false)
  })
})

describe('pesticideListQuerySchema', () => {
  it('正常系: cursor/limit/search/type/diseasePestId/formulationTypeCode を受け付ける', async () => {
    const { pesticideListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = pesticideListQuerySchema.safeParse({
      cursor: 'sumithion',
      limit: 20,
      search: 'スミチオン',
      type: 'insecticide',
      diseasePestId: 'dp1',
      formulationTypeCode: 'EC',
    })

    expect(result.success).toBe(true)
  })

  it('search が非空文字のとき transform 後もそのまま保持される', async () => {
    const { pesticideListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = pesticideListQuerySchema.safeParse({ search: 'スミチオン' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.search).toBe('スミチオン')
  })

  it('search が空文字のとき transform で undefined になる', async () => {
    const { pesticideListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = pesticideListQuerySchema.safeParse({ search: '' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.search).toBeUndefined()
  })

  it('type に不正な enum 値を渡すと失敗する', async () => {
    const { pesticideListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = pesticideListQuerySchema.safeParse({ type: 'not-a-type' })

    expect(result.success).toBe(false)
  })
})

describe('ingredientListQuerySchema', () => {
  it('正常系: cursor/limit/search を受け付ける', async () => {
    const { ingredientListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = ingredientListQuerySchema.safeParse({
      cursor: 'fenitrothion',
      limit: 20,
      search: 'フェニトロチオン',
    })

    expect(result.success).toBe(true)
  })

  it('search が非空文字のとき transform 後もそのまま保持される', async () => {
    const { ingredientListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = ingredientListQuerySchema.safeParse({ search: 'フェニトロチオン' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.search).toBe('フェニトロチオン')
  })

  it('search が空文字のとき transform で undefined になる', async () => {
    const { ingredientListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = ingredientListQuerySchema.safeParse({ search: '' })

    expect(result.success).toBe(true)
    if (result.success) expect(result.data.search).toBeUndefined()
  })

  it('cursor が MAX_SLUG_LENGTH を超えると失敗する', async () => {
    const { ingredientListQuerySchema } = await import('@/lib/services/pesticide-read-service')
    const result = ingredientListQuerySchema.safeParse({ cursor: 'a'.repeat(500) })

    expect(result.success).toBe(false)
  })
})
