// @vitest-environment node
/**
 * lib/services/pesticide-read-service — Wave 2 関数のユニットテスト
 *
 * listSpreaderTypes / getSpreaderTypeBySlug / listSpreaderProducts /
 * listPesticideColumns / getPesticideColumnBySlug / listFormulationTypes /
 * getMixingData の正常系・カーソルページネーション・エラーハンドリングを検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockSpreaderTypeFindMany = vi.fn()
const mockSpreaderTypeFindUnique = vi.fn()
const mockPesticideFindMany = vi.fn()
const mockPesticideColumnFindMany = vi.fn()
const mockPesticideColumnFindUnique = vi.fn()
const mockFormulationTypeFindMany = vi.fn()
const mockPesticideIncompatibilityFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    spreaderType: {
      findMany: (...args: unknown[]) => mockSpreaderTypeFindMany(...args),
      findUnique: (...args: unknown[]) => mockSpreaderTypeFindUnique(...args),
    },
    pesticide: {
      findMany: (...args: unknown[]) => mockPesticideFindMany(...args),
    },
    pesticideColumn: {
      findMany: (...args: unknown[]) => mockPesticideColumnFindMany(...args),
      findUnique: (...args: unknown[]) => mockPesticideColumnFindUnique(...args),
    },
    formulationType: {
      findMany: (...args: unknown[]) => mockFormulationTypeFindMany(...args),
    },
    pesticideIncompatibility: {
      findMany: (...args: unknown[]) => mockPesticideIncompatibilityFindMany(...args),
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

// ── モックデータ ──────────────────────────────────────────────

const mockSpreaderTypeRows = [
  {
    id: 'st1',
    slug: 'nonionic',
    name: 'ノニオン系',
    description: '非イオン性展着剤',
    sortOrder: 1,
    pesticides: [
      {
        pesticide: {
          id: 'sp1',
          slug: 'spread-1',
          name: '展着剤A',
          description: '汎用展着剤',
          formulationType: { name: '液剤', code: 'SL' },
        },
      },
    ],
  },
  {
    id: 'st2',
    slug: 'cationic',
    name: 'カチオン系',
    description: null,
    sortOrder: 2,
    pesticides: [],
  },
]

const mockSpreaderTypeDetailRow = {
  id: 'st1',
  slug: 'nonionic',
  name: 'ノニオン系',
  description: '非イオン性展着剤',
  effect: '浸透性・展着性を向上',
  usageNote: '1000〜2000倍に希釈',
  sortOrder: 1,
  pesticides: [
    {
      pesticide: {
        id: 'sp1',
        slug: 'spread-1',
        name: '展着剤A',
        description: '汎用展着剤',
        formulationType: { name: '液剤', code: 'SL' },
      },
    },
  ],
}

const mockSpreaderProductRows = [
  {
    id: 'sp1',
    slug: 'spread-1',
    name: '展着剤A',
    registrationNumber: '11111',
    formulationType: { name: '液剤', code: 'SL' },
    spreaderTypes: [
      { spreaderType: { id: 'st1', slug: 'nonionic', name: 'ノニオン系' } },
    ],
  },
]

const mockColumnRows = [
  {
    id: 'col1',
    slug: 'column-1',
    title: '農薬の基礎知識',
    category: 'basics',
    publishedAt: new Date('2024-01-01T00:00:00.000Z'),
    sortOrder: 1,
  },
  {
    id: 'col2',
    slug: 'column-2',
    title: '病害虫の見分け方',
    category: 'pest',
    publishedAt: new Date('2024-02-01T00:00:00.000Z'),
    sortOrder: 2,
  },
]

const mockColumnDetailRow = {
  id: 'col1',
  slug: 'column-1',
  title: '農薬の基礎知識',
  content: '農薬についての詳しい解説です。',
  category: 'basics',
  publishedAt: new Date('2024-01-01T00:00:00.000Z'),
  sortOrder: 1,
  createdAt: new Date('2024-01-01T00:00:00.000Z'),
  updatedAt: new Date('2024-01-15T00:00:00.000Z'),
}

const mockFormulationTypeRows = [
  {
    id: 'ft1',
    code: 'SL',
    name: '液剤',
    description: '液状の製剤',
    sortOrder: 1,
    _count: { pesticides: 5 },
  },
  {
    id: 'ft2',
    code: 'WP',
    name: '水和剤',
    description: '水に溶かして使用する粉末状製剤',
    sortOrder: 2,
    _count: { pesticides: 3 },
  },
]

const mockPesticidesForMixing = [
  { id: 'p1', slug: 'sumithion', name: 'スミチオン', pesticideType: 'insecticide' },
  { id: 'p2', slug: 'topsin-m', name: 'トップジンM', pesticideType: 'fungicide' },
]

const mockIncompatibilities = [
  { pesticideId: 'p1', incompatibleWithId: 'p2' },
]

// ── listSpreaderTypes ─────────────────────────────────────────

describe('listSpreaderTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSpreaderTypeFindMany.mockResolvedValue(mockSpreaderTypeRows)
  })

  it('正常系: { items } を返す', async () => {
    const { listSpreaderTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderTypes()

    expect(result.items).toHaveLength(2)
  })

  it('items の各要素に { id, slug, name, description, sortOrder, products } が含まれる', async () => {
    const { listSpreaderTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderTypes()

    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      sortOrder: expect.any(Number),
    })
    expect(Array.isArray(result.items[0]?.products)).toBe(true)
  })

  it('products 配列の各要素に { id, slug, name, description, formulationType } が含まれる', async () => {
    const { listSpreaderTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderTypes()

    const product = result.items[0]?.products[0]
    expect(product).toBeDefined()
    expect(product).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
    })
    expect(product?.formulationType).toMatchObject({ name: expect.any(String), code: expect.any(String) })
  })

  it('products が空の場合も items 要素として返す', async () => {
    const { listSpreaderTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderTypes()

    expect(result.items[1]?.products).toEqual([])
  })

  it('description が null の場合 null のまま返す', async () => {
    const { listSpreaderTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderTypes()

    expect(result.items[1]?.description).toBeNull()
  })

  it('空配列のとき { items: [] } を返す', async () => {
    mockSpreaderTypeFindMany.mockResolvedValueOnce([])

    const { listSpreaderTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderTypes()

    expect(result.items).toHaveLength(0)
  })

  it('DB エラー時は { items: [] } を返す', async () => {
    mockSpreaderTypeFindMany.mockRejectedValue(new Error('DB error'))

    const { listSpreaderTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderTypes()

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── getSpreaderTypeBySlug ─────────────────────────────────────

describe('getSpreaderTypeBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSpreaderTypeFindUnique.mockResolvedValue(mockSpreaderTypeDetailRow)
  })

  it('正常系: 詳細オブジェクトを返す', async () => {
    const { getSpreaderTypeBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getSpreaderTypeBySlug('nonionic')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('nonionic')
  })

  it('{ id, slug, name, description, effect, usageNote, sortOrder, products } が含まれる', async () => {
    const { getSpreaderTypeBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getSpreaderTypeBySlug('nonionic')

    expect(result).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      sortOrder: expect.any(Number),
      effect: expect.any(String),
      usageNote: expect.any(String),
    })
    expect(Array.isArray(result?.products)).toBe(true)
  })

  it('products の各要素に { id, slug, name, description, formulationType } が含まれる', async () => {
    const { getSpreaderTypeBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getSpreaderTypeBySlug('nonionic')

    const product = result?.products[0]
    expect(product).toBeDefined()
    expect(product).toMatchObject({ id: expect.any(String), slug: expect.any(String), name: expect.any(String) })
  })

  it('effect/usageNote が null の場合も null で返す', async () => {
    const rowWithNulls = { ...mockSpreaderTypeDetailRow, effect: null, usageNote: null }
    mockSpreaderTypeFindUnique.mockResolvedValueOnce(rowWithNulls)

    const { getSpreaderTypeBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getSpreaderTypeBySlug('nonionic')

    expect(result?.effect).toBeNull()
    expect(result?.usageNote).toBeNull()
  })

  it('不存在 slug → null を返す', async () => {
    mockSpreaderTypeFindUnique.mockResolvedValueOnce(null)

    const { getSpreaderTypeBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getSpreaderTypeBySlug('no-such')

    expect(result).toBeNull()
  })

  it('空文字 slug → null を返す（slugSchema min 1 違反）', async () => {
    const { getSpreaderTypeBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getSpreaderTypeBySlug('')

    expect(result).toBeNull()
    expect(mockSpreaderTypeFindUnique).not.toHaveBeenCalled()
  })

  it('DB エラー時は null を返す', async () => {
    mockSpreaderTypeFindUnique.mockRejectedValue(new Error('DB error'))

    const { getSpreaderTypeBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getSpreaderTypeBySlug('nonionic')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── listSpreaderProducts ──────────────────────────────────────

describe('listSpreaderProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPesticideFindMany.mockResolvedValue(mockSpreaderProductRows)
  })

  it('正常系: items と nextCursor を返す', async () => {
    const { listSpreaderProducts } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderProducts({})

    expect(result.items).toHaveLength(1)
    expect(result.nextCursor).toBeNull()
  })

  it('items に spreaderTypes を持つ製品が含まれる', async () => {
    const { listSpreaderProducts } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderProducts({})

    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
    })
    expect(Array.isArray(result.items[0]?.spreaderTypes)).toBe(true)
    expect(result.items[0]?.spreaderTypes[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
    })
  })

  it('cursor 指定でページネーションが機能する', async () => {
    const { listSpreaderProducts } = await import('@/lib/services/pesticide-read-service')
    await listSpreaderProducts({ cursor: 'spread-1' })

    expect(mockPesticideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { slug: 'spread-1' },
        skip: 1,
      }),
    )
  })

  it('spreaderTypes: { some: {} } が where に含まれる（展着剤製品のみ取得）', async () => {
    const { listSpreaderProducts } = await import('@/lib/services/pesticide-read-service')
    await listSpreaderProducts({})

    expect(mockPesticideFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { spreaderTypes: { some: {} } },
      }),
    )
  })

  it('safeLimit+1 件返ったとき nextCursor が設定される', async () => {
    const limitedRows = Array.from({ length: 21 }, (_, i) => ({
      ...mockSpreaderProductRows[0],
      id: `sp${i}`,
      slug: `spread-${i}`,
      spreaderTypes: [{ spreaderType: { id: 'st1', slug: 'nonionic', name: 'ノニオン系' } }],
    }))
    mockPesticideFindMany.mockResolvedValueOnce(limitedRows)

    const { listSpreaderProducts } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderProducts({ limit: 20 })

    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('spread-19')
  })

  it('空配列のとき { items: [], nextCursor: null } を返す', async () => {
    mockPesticideFindMany.mockResolvedValueOnce([])

    const { listSpreaderProducts } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderProducts({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('DB エラー時は { items: [], nextCursor: null } を返す', async () => {
    mockPesticideFindMany.mockRejectedValue(new Error('DB error'))

    const { listSpreaderProducts } = await import('@/lib/services/pesticide-read-service')
    const result = await listSpreaderProducts({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── listPesticideColumns ──────────────────────────────────────

describe('listPesticideColumns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPesticideColumnFindMany.mockResolvedValue(mockColumnRows)
  })

  it('正常系: items と nextCursor を返す', async () => {
    const { listPesticideColumns } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticideColumns({})

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('items に { id, slug, title, category, publishedAt, sortOrder } が含まれる', async () => {
    const { listPesticideColumns } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticideColumns({})

    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      title: expect.any(String),
      category: expect.any(String),
      sortOrder: expect.any(Number),
    })
  })

  it('publishedAt は ISO 8601 文字列として返される', async () => {
    const { listPesticideColumns } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticideColumns({})

    expect(typeof result.items[0]?.publishedAt).toBe('string')
    expect(() => new Date(result.items[0]!.publishedAt)).not.toThrow()
  })

  it('publishedAt not null の WHERE が DB クエリに渡される', async () => {
    const { listPesticideColumns } = await import('@/lib/services/pesticide-read-service')
    await listPesticideColumns({})

    expect(mockPesticideColumnFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { publishedAt: { not: null } },
      }),
    )
  })

  it('cursor 指定でページネーションが機能する', async () => {
    const { listPesticideColumns } = await import('@/lib/services/pesticide-read-service')
    await listPesticideColumns({ cursor: 'column-1' })

    expect(mockPesticideColumnFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { slug: 'column-1' },
        skip: 1,
      }),
    )
  })

  it('safeLimit+1 件返ったとき nextCursor が設定される', async () => {
    const limitedRows = Array.from({ length: 21 }, (_, i) => ({
      ...mockColumnRows[0],
      id: `col${i}`,
      slug: `column-${i}`,
    }))
    mockPesticideColumnFindMany.mockResolvedValueOnce(limitedRows)

    const { listPesticideColumns } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticideColumns({ limit: 20 })

    expect(result.items).toHaveLength(20)
    expect(result.nextCursor).toBe('column-19')
  })

  it('publishedAt が null の行はフィルタアウトされる', async () => {
    const rowsWithNull = [
      ...mockColumnRows,
      { id: 'col-draft', slug: 'draft', title: '下書き', category: 'basics', publishedAt: null, sortOrder: 99 },
    ]
    mockPesticideColumnFindMany.mockResolvedValueOnce(rowsWithNull)

    const { listPesticideColumns } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticideColumns({})

    expect(result.items).toHaveLength(2)
  })

  it('空配列のとき { items: [], nextCursor: null } を返す', async () => {
    mockPesticideColumnFindMany.mockResolvedValueOnce([])

    const { listPesticideColumns } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticideColumns({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('DB エラー時は { items: [], nextCursor: null } を返す', async () => {
    mockPesticideColumnFindMany.mockRejectedValue(new Error('DB error'))

    const { listPesticideColumns } = await import('@/lib/services/pesticide-read-service')
    const result = await listPesticideColumns({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── getPesticideColumnBySlug ──────────────────────────────────

describe('getPesticideColumnBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPesticideColumnFindUnique.mockResolvedValue(mockColumnDetailRow)
  })

  it('正常系: 詳細オブジェクトを返す', async () => {
    const { getPesticideColumnBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideColumnBySlug('column-1')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('column-1')
  })

  it('{ id, slug, title, category, publishedAt, content, sortOrder, createdAt, updatedAt } が含まれる', async () => {
    const { getPesticideColumnBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideColumnBySlug('column-1')

    expect(result).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      title: expect.any(String),
      category: expect.any(String),
      content: expect.any(String),
      sortOrder: expect.any(Number),
    })
  })

  it('publishedAt/createdAt/updatedAt は ISO 8601 文字列として返される', async () => {
    const { getPesticideColumnBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideColumnBySlug('column-1')

    expect(typeof result?.publishedAt).toBe('string')
    expect(typeof result?.createdAt).toBe('string')
    expect(typeof result?.updatedAt).toBe('string')
    expect(() => new Date(result!.publishedAt)).not.toThrow()
  })

  it('publishedAt が null（未公開）→ null を返す', async () => {
    mockPesticideColumnFindUnique.mockResolvedValueOnce({ ...mockColumnDetailRow, publishedAt: null })

    const { getPesticideColumnBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideColumnBySlug('column-1')

    expect(result).toBeNull()
  })

  it('不存在 slug → null を返す', async () => {
    mockPesticideColumnFindUnique.mockResolvedValueOnce(null)

    const { getPesticideColumnBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideColumnBySlug('no-such')

    expect(result).toBeNull()
  })

  it('空文字 slug → null を返す（slugSchema min 1 違反）', async () => {
    const { getPesticideColumnBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideColumnBySlug('')

    expect(result).toBeNull()
    expect(mockPesticideColumnFindUnique).not.toHaveBeenCalled()
  })

  it('DB エラー時は null を返す', async () => {
    mockPesticideColumnFindUnique.mockRejectedValue(new Error('DB error'))

    const { getPesticideColumnBySlug } = await import('@/lib/services/pesticide-read-service')
    const result = await getPesticideColumnBySlug('column-1')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── listFormulationTypes ──────────────────────────────────────

describe('listFormulationTypes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFormulationTypeFindMany.mockResolvedValue(mockFormulationTypeRows)
  })

  it('正常系: { items } を返す', async () => {
    const { listFormulationTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listFormulationTypes()

    expect(result.items).toHaveLength(2)
  })

  it('items に { id, code, name, description, sortOrder, pesticidesCount } が含まれる', async () => {
    const { listFormulationTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listFormulationTypes()

    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      code: expect.any(String),
      name: expect.any(String),
      sortOrder: expect.any(Number),
      pesticidesCount: expect.any(Number),
    })
  })

  it('pesticidesCount が _count.pesticides から正しく導出される', async () => {
    const { listFormulationTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listFormulationTypes()

    expect(result.items[0]?.pesticidesCount).toBe(5)
    expect(result.items[1]?.pesticidesCount).toBe(3)
  })

  it('description が null の場合 null のまま返す', async () => {
    const rowWithNullDesc = [{ ...mockFormulationTypeRows[0], description: null }]
    mockFormulationTypeFindMany.mockResolvedValueOnce(rowWithNullDesc)

    const { listFormulationTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listFormulationTypes()

    expect(result.items[0]?.description).toBeNull()
  })

  it('空配列のとき { items: [] } を返す', async () => {
    mockFormulationTypeFindMany.mockResolvedValueOnce([])

    const { listFormulationTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listFormulationTypes()

    expect(result.items).toHaveLength(0)
  })

  it('DB エラー時は { items: [] } を返す', async () => {
    mockFormulationTypeFindMany.mockRejectedValue(new Error('DB error'))

    const { listFormulationTypes } = await import('@/lib/services/pesticide-read-service')
    const result = await listFormulationTypes()

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── getMixingData ─────────────────────────────────────────────

describe('getMixingData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPesticideFindMany.mockResolvedValue(mockPesticidesForMixing)
    mockPesticideIncompatibilityFindMany.mockResolvedValue(mockIncompatibilities)
  })

  it('正常系: { pesticides, incompatibilities } を返す', async () => {
    const { getMixingData } = await import('@/lib/services/pesticide-read-service')
    const result = await getMixingData()

    expect(Array.isArray(result.pesticides)).toBe(true)
    expect(Array.isArray(result.incompatibilities)).toBe(true)
  })

  it('pesticides に { id, slug, name, pesticideType } が含まれる', async () => {
    const { getMixingData } = await import('@/lib/services/pesticide-read-service')
    const result = await getMixingData()

    expect(result.pesticides).toHaveLength(2)
    expect(result.pesticides[0]).toMatchObject({
      id: expect.any(String),
      slug: expect.any(String),
      name: expect.any(String),
      pesticideType: expect.any(String),
    })
  })

  it('incompatibilities に { pesticideId, incompatibleWithId } が含まれる', async () => {
    const { getMixingData } = await import('@/lib/services/pesticide-read-service')
    const result = await getMixingData()

    expect(result.incompatibilities).toHaveLength(1)
    expect(result.incompatibilities[0]).toMatchObject({
      pesticideId: expect.any(String),
      incompatibleWithId: expect.any(String),
    })
    expect(result.incompatibilities[0]?.pesticideId).toBe('p1')
    expect(result.incompatibilities[0]?.incompatibleWithId).toBe('p2')
  })

  it('incompatibilities が空のとき空配列を返す', async () => {
    mockPesticideIncompatibilityFindMany.mockResolvedValueOnce([])

    const { getMixingData } = await import('@/lib/services/pesticide-read-service')
    const result = await getMixingData()

    expect(result.incompatibilities).toHaveLength(0)
    expect(result.pesticides).toHaveLength(2)
  })

  it('pesticides が空のとき { pesticides: [], incompatibilities } を返す', async () => {
    mockPesticideFindMany.mockResolvedValueOnce([])

    const { getMixingData } = await import('@/lib/services/pesticide-read-service')
    const result = await getMixingData()

    expect(result.pesticides).toHaveLength(0)
  })

  it('DB エラー時は { pesticides: [], incompatibilities: [] } を返す', async () => {
    mockPesticideFindMany.mockRejectedValue(new Error('DB error'))

    const { getMixingData } = await import('@/lib/services/pesticide-read-service')
    const result = await getMixingData()

    expect(result.pesticides).toHaveLength(0)
    expect(result.incompatibilities).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
