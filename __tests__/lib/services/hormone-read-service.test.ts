// @vitest-environment node
/**
 * lib/services/hormone-read-service のユニットテスト
 *
 * listHormones / getHormoneBySlug の
 * 正常系・category フィルタ・effects/seasonalLevels 含む詳細・
 * エラーハンドリングを検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockHormoneTypeFindMany = vi.fn()
const mockHormoneTypeFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    hormoneType: {
      findMany: (...args: unknown[]) => mockHormoneTypeFindMany(...args),
      findUnique: (...args: unknown[]) => mockHormoneTypeFindUnique(...args),
    },
  },
}))

const mockLoggerError = vi.fn()
vi.mock('@/lib/logger', () => ({
  default: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}))

const mockHormones = [
  { id: 'h1', name: 'オーキシン', nameEn: 'Auxin', slug: 'auxin', category: 'major', chemicalFormula: 'C10H9NO2', description: '細胞伸長促進' },
  { id: 'h2', name: 'サイトカイニン', nameEn: 'Cytokinin', slug: 'cytokinin', category: 'major', chemicalFormula: null, description: '細胞分裂促進' },
  { id: 'h3', name: 'アブシシン酸', nameEn: 'Abscisic acid', slug: 'abscisic-acid', category: 'secondary', chemicalFormula: 'C15H20O4', description: '成長抑制' },
]

const mockHormoneDetail = {
  id: 'h1',
  name: 'オーキシン',
  nameEn: 'Auxin',
  slug: 'auxin',
  category: 'major',
  chemicalFormula: 'C10H9NO2',
  description: '細胞伸長を促進する植物ホルモン',
  bonsaiRole: '根の発達促進に活用',
  productionSite: '頂端分裂組織',
  practicalTips: '発根促進剤として活用できる',
  activationMethod: '芽に塗布する',
  effects: [
    { effectName: '細胞伸長', isPromoting: true },
    { effectName: '頂芽優勢', isPromoting: true },
    { effectName: '根の発達', isPromoting: false },
  ],
  seasonalLevels: [
    { month: 3, level: 'high' },
    { month: 6, level: 'balanced' },
    { month: 9, level: 'low' },
    { month: 12, level: 'none' },
  ],
}

describe('listHormones', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHormoneTypeFindMany.mockResolvedValue(mockHormones)
  })

  it('正常系: hormones 配列を返す', async () => {
    const { listHormones } = await import('@/lib/services/hormone-read-service')
    const result = await listHormones()

    expect(result.hormones).toHaveLength(3)
  })

  it('各 hormone に { id, name, nameEn, slug, category } が含まれる', async () => {
    const { listHormones } = await import('@/lib/services/hormone-read-service')
    const result = await listHormones()

    expect(result.hormones[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      slug: expect.any(String),
      category: expect.any(String),
    })
  })

  it('category=major フィルタが DB クエリに渡される', async () => {
    const { listHormones } = await import('@/lib/services/hormone-read-service')
    await listHormones({ category: 'major' as const })

    expect(mockHormoneTypeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: 'major' },
      }),
    )
  })

  it('category=secondary フィルタが DB クエリに渡される', async () => {
    const { listHormones } = await import('@/lib/services/hormone-read-service')
    await listHormones({ category: 'secondary' as const })

    expect(mockHormoneTypeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: 'secondary' },
      }),
    )
  })

  it('category なしのとき where を渡さない', async () => {
    const { listHormones } = await import('@/lib/services/hormone-read-service')
    await listHormones()

    expect(mockHormoneTypeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    )
  })

  it('orderBy が [{ sortOrder: asc }, { name: asc }] で呼ばれる', async () => {
    const { listHormones } = await import('@/lib/services/hormone-read-service')
    await listHormones()

    expect(mockHormoneTypeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
    )
  })

  it('空配列のとき { hormones: [] } を返す', async () => {
    mockHormoneTypeFindMany.mockResolvedValueOnce([])

    const { listHormones } = await import('@/lib/services/hormone-read-service')
    const result = await listHormones()

    expect(result.hormones).toHaveLength(0)
  })

  it('DB エラー時は { hormones: [] } を返す', async () => {
    mockHormoneTypeFindMany.mockRejectedValue(new Error('DB error'))

    const { listHormones } = await import('@/lib/services/hormone-read-service')
    const result = await listHormones()

    expect(result.hormones).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('Error インスタンス以外が throw されたときも { hormones: [] } を返す', async () => {
    mockHormoneTypeFindMany.mockRejectedValue('network timeout')

    const { listHormones } = await import('@/lib/services/hormone-read-service')
    const result = await listHormones()

    expect(result.hormones).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

describe('getHormoneBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHormoneTypeFindUnique.mockResolvedValue(mockHormoneDetail)
  })

  it('正常系: hormone 詳細を返す', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('auxin')
  })

  it('詳細に effects 配列が含まれる', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    expect(Array.isArray(result?.effects)).toBe(true)
    expect(result?.effects).toHaveLength(3)
    expect(result?.effects[0]).toMatchObject({
      effectName: expect.any(String),
      isPromoting: expect.any(Boolean),
    })
  })

  it('詳細に seasonalLevels 配列が含まれる', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    expect(Array.isArray(result?.seasonalLevels)).toBe(true)
    expect(result?.seasonalLevels).toHaveLength(4)
    expect(result?.seasonalLevels[0]).toMatchObject({
      month: expect.any(Number),
      level: expect.any(String),
    })
  })

  it('effects に isPromoting boolean が含まれる', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    for (const effect of result?.effects ?? []) {
      expect(typeof effect.isPromoting).toBe('boolean')
    }
  })

  it('seasonalLevels の month は数値', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    for (const sl of result?.seasonalLevels ?? []) {
      expect(typeof sl.month).toBe('number')
      expect(Number.isInteger(sl.month)).toBe(true)
    }
  })

  it('不存在 slug → null を返す', async () => {
    mockHormoneTypeFindUnique.mockResolvedValueOnce(null)

    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('no-such')

    expect(result).toBeNull()
  })

  it('DB エラー時は null を返す', async () => {
    mockHormoneTypeFindUnique.mockRejectedValue(new Error('DB error'))

    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('Error インスタンス以外が throw されたときも null を返す', async () => {
    mockHormoneTypeFindUnique.mockRejectedValue({ code: 'CONNECTION_RESET' })

    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
