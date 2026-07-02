// @vitest-environment node
/**
 * lib/services/hormone-read-service のユニットテスト
 *
 * listHormones / getHormoneBySlug（interactions/techniques 含む）/
 * listHormoneInteractions / listHormoneTechniques / getHormoneSimulatorData /
 * listHormoneColumns / getHormoneColumnBySlug の
 * 正常系・category フィルタ・カーソルページネーション・エラーハンドリングを検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockHormoneTypeFindMany = vi.fn()
const mockHormoneTypeFindUnique = vi.fn()
const mockHormoneInteractionFindMany = vi.fn()
const mockHormoneTechniqueFindMany = vi.fn()
const mockHormoneSeasonalLevelFindMany = vi.fn()
const mockHormoneColumnFindMany = vi.fn()
const mockHormoneColumnFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    hormoneType: {
      findMany: (...args: unknown[]) => mockHormoneTypeFindMany(...args),
      findUnique: (...args: unknown[]) => mockHormoneTypeFindUnique(...args),
    },
    hormoneInteraction: {
      findMany: (...args: unknown[]) => mockHormoneInteractionFindMany(...args),
    },
    hormoneTechnique: {
      findMany: (...args: unknown[]) => mockHormoneTechniqueFindMany(...args),
    },
    hormoneSeasonalLevel: {
      findMany: (...args: unknown[]) => mockHormoneSeasonalLevelFindMany(...args),
    },
    hormoneColumn: {
      findMany: (...args: unknown[]) => mockHormoneColumnFindMany(...args),
      findUnique: (...args: unknown[]) => mockHormoneColumnFindUnique(...args),
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
  interactionsA: [
    {
      id: 'ia1',
      hormoneAId: 'h1',
      hormoneBId: 'h2',
      type: 'synergistic',
      description: '相乗作用',
      bonsaiRelevance: '根の発達に有効',
      hormoneB: { name: 'サイトカイニン', slug: 'cytokinin' },
    },
  ],
  interactionsB: [
    {
      id: 'ib1',
      hormoneAId: 'h3',
      hormoneBId: 'h1',
      type: 'antagonistic',
      description: '拮抗作用',
      bonsaiRelevance: null,
      hormoneA: { name: 'アブシシン酸', slug: 'abscisic-acid' },
    },
  ],
  techniques: [
    {
      id: 't1',
      techniqueSlug: 'pruning',
      techniqueName: '剪定',
      techniqueNameEn: 'Pruning',
      effectType: 'promote',
      magnitude: 'moderate',
      mechanism: '頂芽優勢の解除',
    },
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

  it('詳細に interactions 配列が含まれる（H-1/H-2）', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    expect(Array.isArray(result?.interactions)).toBe(true)
    expect(result?.interactions).toHaveLength(2)
  })

  it('interactions 要素に hormoneAName / hormoneASlug / hormoneBName / hormoneBSlug がある', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    const interaction = result?.interactions[0]
    expect(interaction).toMatchObject({
      id: expect.any(String),
      hormoneAId: expect.any(String),
      hormoneAName: expect.any(String),
      hormoneASlug: expect.any(String),
      hormoneBId: expect.any(String),
      hormoneBName: expect.any(String),
      hormoneBSlug: expect.any(String),
      type: expect.any(String),
    })
  })

  it('interactionsA（自=A側）は自ホルモンの名前/slug が hormoneAName/hormoneASlug に入る', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    const fromA = result?.interactions.find((i) => i.id === 'ia1')
    expect(fromA?.hormoneAName).toBe('オーキシン')
    expect(fromA?.hormoneASlug).toBe('auxin')
    expect(fromA?.hormoneBName).toBe('サイトカイニン')
    expect(fromA?.hormoneBSlug).toBe('cytokinin')
  })

  it('interactionsB（自=B側）は自ホルモンの名前/slug が hormoneBName/hormoneBSlug に入る', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    const fromB = result?.interactions.find((i) => i.id === 'ib1')
    expect(fromB?.hormoneBName).toBe('オーキシン')
    expect(fromB?.hormoneBSlug).toBe('auxin')
    expect(fromB?.hormoneAName).toBe('アブシシン酸')
    expect(fromB?.hormoneASlug).toBe('abscisic-acid')
  })

  it('詳細に techniques 配列が含まれる（H-1/H-2）', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    expect(Array.isArray(result?.techniques)).toBe(true)
    expect(result?.techniques).toHaveLength(1)
  })

  it('techniques 要素に techniqueKey / techniqueNameJa がある', async () => {
    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    const technique = result?.techniques[0]
    expect(technique).toMatchObject({
      id: expect.any(String),
      techniqueKey: 'pruning',
      techniqueNameJa: '剪定',
      techniqueNameEn: 'Pruning',
      effectType: expect.any(String),
      magnitude: expect.any(String),
    })
  })

  it('interactionsA/interactionsB が空のとき interactions は空配列', async () => {
    mockHormoneTypeFindUnique.mockResolvedValueOnce({
      ...mockHormoneDetail,
      interactionsA: [],
      interactionsB: [],
    })

    const { getHormoneBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneBySlug('auxin')

    expect(result?.interactions).toHaveLength(0)
  })
})

// ── listHormoneInteractions（H-3） ─────────────────────────────

const mockInteractionRows = [
  {
    id: 'int1',
    hormoneAId: 'h1',
    hormoneBId: 'h2',
    type: 'synergistic',
    description: '相乗作用の説明',
    bonsaiRelevance: '根の発達に有効',
    hormoneA: { name: 'オーキシン', slug: 'auxin' },
    hormoneB: { name: 'サイトカイニン', slug: 'cytokinin' },
  },
  {
    id: 'int2',
    hormoneAId: 'h1',
    hormoneBId: 'h3',
    type: 'antagonistic',
    description: null,
    bonsaiRelevance: null,
    hormoneA: { name: 'オーキシン', slug: 'auxin' },
    hormoneB: { name: 'アブシシン酸', slug: 'abscisic-acid' },
  },
]

describe('listHormoneInteractions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHormoneInteractionFindMany.mockResolvedValue(mockInteractionRows)
  })

  it('正常系: items 配列を返す', async () => {
    const { listHormoneInteractions } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneInteractions()

    expect(result.items).toHaveLength(2)
  })

  it('各 item に { id, hormoneAId, hormoneAName, hormoneASlug, hormoneBId, hormoneBName, hormoneBSlug, type } がある', async () => {
    const { listHormoneInteractions } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneInteractions()

    expect(result.items[0]).toMatchObject({
      id: 'int1',
      hormoneAId: 'h1',
      hormoneAName: 'オーキシン',
      hormoneASlug: 'auxin',
      hormoneBId: 'h2',
      hormoneBName: 'サイトカイニン',
      hormoneBSlug: 'cytokinin',
      type: 'synergistic',
    })
  })

  it('description が null のとき null のまま返る', async () => {
    const { listHormoneInteractions } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneInteractions()

    expect(result.items[1]?.description).toBeNull()
  })

  it('bonsaiRelevance が null のとき null のまま返る', async () => {
    const { listHormoneInteractions } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneInteractions()

    expect(result.items[1]?.bonsaiRelevance).toBeNull()
  })

  it('空配列のとき { items: [] } を返す', async () => {
    mockHormoneInteractionFindMany.mockResolvedValueOnce([])

    const { listHormoneInteractions } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneInteractions()

    expect(result.items).toHaveLength(0)
  })

  it('DB エラー時は { items: [] } を返す', async () => {
    mockHormoneInteractionFindMany.mockRejectedValue(new Error('DB error'))

    const { listHormoneInteractions } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneInteractions()

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('Error インスタンス以外が throw されたときも { items: [] } を返す', async () => {
    mockHormoneInteractionFindMany.mockRejectedValue('network timeout')

    const { listHormoneInteractions } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneInteractions()

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── listHormoneTechniques（H-4） ───────────────────────────────

const mockTechniqueRows = [
  {
    techniqueSlug: 'pruning',
    techniqueName: '剪定',
    techniqueNameEn: 'Pruning',
    effectType: 'promote',
    magnitude: 'moderate',
    mechanism: '頂芽優勢の解除',
    hormone: { id: 'h1', name: 'オーキシン', slug: 'auxin' },
  },
  {
    techniqueSlug: 'pruning',
    techniqueName: '剪定',
    techniqueNameEn: 'Pruning',
    effectType: 'suppress',
    magnitude: 'low',
    mechanism: null,
    hormone: { id: 'h2', name: 'サイトカイニン', slug: 'cytokinin' },
  },
  {
    techniqueSlug: 'wiring',
    techniqueName: '針金掛け',
    techniqueNameEn: 'Wiring',
    effectType: 'promote',
    magnitude: 'high',
    mechanism: '機械的ストレス応答',
    hormone: { id: 'h1', name: 'オーキシン', slug: 'auxin' },
  },
]

describe('listHormoneTechniques', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHormoneTechniqueFindMany.mockResolvedValue(mockTechniqueRows)
  })

  it('正常系: techniqueSlug 単位にグループ化した items を返す', async () => {
    const { listHormoneTechniques } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneTechniques()

    expect(result.items).toHaveLength(2)
  })

  it('同じ techniqueSlug の行は 1 グループに集約される', async () => {
    const { listHormoneTechniques } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneTechniques()

    const pruningGroup = result.items.find((g) => g.techniqueKey === 'pruning')
    expect(pruningGroup?.effects).toHaveLength(2)
  })

  it('各グループに { techniqueKey, techniqueNameJa, techniqueNameEn, effects[] } がある', async () => {
    const { listHormoneTechniques } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneTechniques()

    const pruning = result.items.find((g) => g.techniqueKey === 'pruning')
    expect(pruning).toMatchObject({
      techniqueKey: 'pruning',
      techniqueNameJa: '剪定',
      techniqueNameEn: 'Pruning',
    })
    expect(Array.isArray(pruning?.effects)).toBe(true)
  })

  it('effects 要素に { hormoneId, hormoneNameJa, hormoneSlug, effectType, magnitude, mechanism } がある', async () => {
    const { listHormoneTechniques } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneTechniques()

    const pruning = result.items.find((g) => g.techniqueKey === 'pruning')
    expect(pruning?.effects[0]).toMatchObject({
      hormoneId: expect.any(String),
      hormoneNameJa: expect.any(String),
      hormoneSlug: expect.any(String),
      effectType: expect.any(String),
      magnitude: expect.any(String),
    })
  })

  it('グループの description フィールドは含まれない（モデルに存在しない）', async () => {
    const { listHormoneTechniques } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneTechniques()

    for (const group of result.items) {
      expect('description' in group).toBe(false)
    }
  })

  it('空配列のとき { items: [] } を返す', async () => {
    mockHormoneTechniqueFindMany.mockResolvedValueOnce([])

    const { listHormoneTechniques } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneTechniques()

    expect(result.items).toHaveLength(0)
  })

  it('DB エラー時は { items: [] } を返す', async () => {
    mockHormoneTechniqueFindMany.mockRejectedValue(new Error('DB error'))

    const { listHormoneTechniques } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneTechniques()

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('Error インスタンス以外が throw されたときも { items: [] } を返す', async () => {
    mockHormoneTechniqueFindMany.mockRejectedValue({ code: 'TIMEOUT' })

    const { listHormoneTechniques } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneTechniques()

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── getHormoneSimulatorData（H-5） ────────────────────────────

const mockSimHormoneRows = [
  { id: 'h1', slug: 'auxin', name: 'オーキシン', nameEn: 'Auxin' },
  { id: 'h2', slug: 'cytokinin', name: 'サイトカイニン', nameEn: null },
]

const mockSimTechniqueRows = [
  {
    techniqueSlug: 'pruning',
    techniqueName: '剪定',
    techniqueNameEn: 'Pruning',
    hormoneId: 'h1',
    effectType: 'promote',
    magnitude: 'moderate',
    sortOrder: 1,
  },
  {
    techniqueSlug: 'pruning',
    techniqueName: '剪定',
    techniqueNameEn: 'Pruning',
    hormoneId: 'h2',
    effectType: 'suppress',
    magnitude: 'low',
    sortOrder: 2,
  },
  {
    techniqueSlug: 'wiring',
    techniqueName: '針金掛け',
    techniqueNameEn: 'Wiring',
    hormoneId: 'h1',
    effectType: 'promote',
    magnitude: 'high',
    sortOrder: 1,
  },
]

const mockSimSeasonalLevelRows = [
  { hormoneId: 'h1', month: 3, level: 'high' },
  { hormoneId: 'h1', month: 6, level: 'balanced' },
  { hormoneId: 'h2', month: 3, level: 'low' },
]

describe('getHormoneSimulatorData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHormoneTypeFindMany.mockResolvedValue(mockSimHormoneRows)
    mockHormoneTechniqueFindMany.mockResolvedValue(mockSimTechniqueRows)
    mockHormoneSeasonalLevelFindMany.mockResolvedValue(mockSimSeasonalLevelRows)
  })

  it('正常系: { hormones, techniques, seasonalLevels } を返す', async () => {
    const { getHormoneSimulatorData } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneSimulatorData()

    expect(Array.isArray(result.hormones)).toBe(true)
    expect(Array.isArray(result.techniques)).toBe(true)
    expect(Array.isArray(result.seasonalLevels)).toBe(true)
  })

  it('hormones に { id, slug, name, nameEn } がある', async () => {
    const { getHormoneSimulatorData } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneSimulatorData()

    expect(result.hormones).toHaveLength(2)
    expect(result.hormones[0]).toMatchObject({
      id: 'h1',
      slug: 'auxin',
      name: 'オーキシン',
      nameEn: 'Auxin',
    })
  })

  it('hormones の nameEn は null 許容', async () => {
    const { getHormoneSimulatorData } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneSimulatorData()

    expect(result.hormones[1]?.nameEn).toBeNull()
  })

  it('techniques が techniqueKey 単位にグループ化される', async () => {
    const { getHormoneSimulatorData } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneSimulatorData()

    expect(result.techniques).toHaveLength(2)
    const pruning = result.techniques.find((t) => t.techniqueKey === 'pruning')
    expect(pruning?.effects).toHaveLength(2)
  })

  it('techniques の各要素に { techniqueKey, nameJa, nameEn, effects[] } がある', async () => {
    const { getHormoneSimulatorData } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneSimulatorData()

    const pruning = result.techniques.find((t) => t.techniqueKey === 'pruning')
    expect(pruning).toMatchObject({
      techniqueKey: 'pruning',
      nameJa: '剪定',
      nameEn: 'Pruning',
    })
  })

  it('techniques.effects 要素に { hormoneId, effectType, magnitude } がある', async () => {
    const { getHormoneSimulatorData } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneSimulatorData()

    const pruning = result.techniques.find((t) => t.techniqueKey === 'pruning')
    expect(pruning?.effects[0]).toMatchObject({
      hormoneId: expect.any(String),
      effectType: expect.any(String),
      magnitude: expect.any(String),
    })
  })

  it('seasonalLevels に { hormoneId, month, level } がある', async () => {
    const { getHormoneSimulatorData } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneSimulatorData()

    expect(result.seasonalLevels).toHaveLength(3)
    expect(result.seasonalLevels[0]).toMatchObject({
      hormoneId: 'h1',
      month: 3,
      level: 'high',
    })
  })

  it('DB エラー時は { hormones: [], techniques: [], seasonalLevels: [] } を返す', async () => {
    mockHormoneTypeFindMany.mockRejectedValue(new Error('DB error'))

    const { getHormoneSimulatorData } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneSimulatorData()

    expect(result.hormones).toHaveLength(0)
    expect(result.techniques).toHaveLength(0)
    expect(result.seasonalLevels).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('Error インスタンス以外が throw されたときも空配列を返す', async () => {
    mockHormoneTypeFindMany.mockRejectedValue('connection refused')

    const { getHormoneSimulatorData } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneSimulatorData()

    expect(result.hormones).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── listHormoneColumns（H-6） ─────────────────────────────────

const mockColumnRows = [
  {
    id: 'col1',
    slug: 'auxin-guide',
    title: 'オーキシンガイド',
    category: 'hormone_guide',
    publishedAt: new Date('2025-01-01T00:00:00Z'),
    sortOrder: 1,
  },
  {
    id: 'col2',
    slug: 'cytokinin-guide',
    title: 'サイトカイニンガイド',
    category: 'hormone_guide',
    publishedAt: new Date('2025-02-01T00:00:00Z'),
    sortOrder: 2,
  },
]

describe('listHormoneColumns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHormoneColumnFindMany.mockResolvedValue(mockColumnRows)
  })

  it('正常系: { items, nextCursor } を返す', async () => {
    const { listHormoneColumns } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneColumns({})

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeNull()
  })

  it('各 item に { id, slug, title, category, publishedAt, sortOrder } がある', async () => {
    const { listHormoneColumns } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneColumns({})

    expect(result.items[0]).toMatchObject({
      id: 'col1',
      slug: 'auxin-guide',
      title: 'オーキシンガイド',
      category: 'hormone_guide',
      sortOrder: 1,
    })
  })

  it('publishedAt は ISO 文字列で返る', async () => {
    const { listHormoneColumns } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneColumns({})

    expect(typeof result.items[0]?.publishedAt).toBe('string')
    expect(result.items[0]?.publishedAt).toBe('2025-01-01T00:00:00.000Z')
  })

  it('カーソルページネーション: limit+1 件取得で hasNext を判定する', async () => {
    const extraRows = [
      ...mockColumnRows,
      {
        id: 'col3',
        slug: 'ga-guide',
        title: 'GAガイド',
        category: 'hormone_guide',
        publishedAt: new Date('2025-03-01T00:00:00Z'),
        sortOrder: 3,
      },
    ]
    mockHormoneColumnFindMany.mockResolvedValueOnce(extraRows)

    const { listHormoneColumns } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneColumns({ limit: 2 })

    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBe('cytokinin-guide')
  })

  it('publishedAt が null の行はフィルタされる', async () => {
    const rowsWithNull = [
      ...mockColumnRows,
      {
        id: 'col-draft',
        slug: 'draft-col',
        title: '下書き',
        category: 'hormone_guide',
        publishedAt: null,
        sortOrder: 99,
      },
    ]
    mockHormoneColumnFindMany.mockResolvedValueOnce(rowsWithNull)

    const { listHormoneColumns } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneColumns({})

    expect(result.items.some((i) => i.slug === 'draft-col')).toBe(false)
  })

  it('空配列のとき { items: [], nextCursor: null } を返す', async () => {
    mockHormoneColumnFindMany.mockResolvedValueOnce([])

    const { listHormoneColumns } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneColumns({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
  })

  it('DB エラー時は { items: [], nextCursor: null } を返す', async () => {
    mockHormoneColumnFindMany.mockRejectedValue(new Error('DB error'))

    const { listHormoneColumns } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneColumns({})

    expect(result.items).toHaveLength(0)
    expect(result.nextCursor).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('Error インスタンス以外が throw されたときも空を返す', async () => {
    mockHormoneColumnFindMany.mockRejectedValue('network error')

    const { listHormoneColumns } = await import('@/lib/services/hormone-read-service')
    const result = await listHormoneColumns({})

    expect(result.items).toHaveLength(0)
    expect(mockLoggerError).toHaveBeenCalled()
  })
})

// ── getHormoneColumnBySlug（H-7） ─────────────────────────────

const mockColumnDetail = {
  id: 'col1',
  slug: 'auxin-guide',
  title: 'オーキシンガイド',
  content: 'オーキシンは植物の根の伸長を促進する植物ホルモンです。',
  category: 'hormone_guide',
  publishedAt: new Date('2025-01-01T00:00:00Z'),
  sortOrder: 1,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-15T00:00:00Z'),
}

describe('getHormoneColumnBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHormoneColumnFindUnique.mockResolvedValue(mockColumnDetail)
  })

  it('正常系: コラム詳細を返す', async () => {
    const { getHormoneColumnBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneColumnBySlug('auxin-guide')

    expect(result).not.toBeNull()
    expect(result?.slug).toBe('auxin-guide')
  })

  it('詳細に content が含まれる', async () => {
    const { getHormoneColumnBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneColumnBySlug('auxin-guide')

    expect(result?.content).toBe('オーキシンは植物の根の伸長を促進する植物ホルモンです。')
  })

  it('publishedAt / createdAt / updatedAt は ISO 文字列で返る', async () => {
    const { getHormoneColumnBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneColumnBySlug('auxin-guide')

    expect(typeof result?.publishedAt).toBe('string')
    expect(typeof result?.createdAt).toBe('string')
    expect(typeof result?.updatedAt).toBe('string')
    expect(result?.publishedAt).toBe('2025-01-01T00:00:00.000Z')
  })

  it('不存在 slug → null を返す', async () => {
    mockHormoneColumnFindUnique.mockResolvedValueOnce(null)

    const { getHormoneColumnBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneColumnBySlug('no-such')

    expect(result).toBeNull()
  })

  it('publishedAt が null（未公開）のとき null を返す', async () => {
    mockHormoneColumnFindUnique.mockResolvedValueOnce({
      ...mockColumnDetail,
      publishedAt: null,
    })

    const { getHormoneColumnBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneColumnBySlug('auxin-guide')

    expect(result).toBeNull()
  })

  it('空スラッグ → null を返す（slugQuerySchema 検証失敗）', async () => {
    const { getHormoneColumnBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneColumnBySlug('')

    expect(result).toBeNull()
    expect(mockHormoneColumnFindUnique).not.toHaveBeenCalled()
  })

  it('DB エラー時は null を返す', async () => {
    mockHormoneColumnFindUnique.mockRejectedValue(new Error('DB error'))

    const { getHormoneColumnBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneColumnBySlug('auxin-guide')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })

  it('Error インスタンス以外が throw されたときも null を返す', async () => {
    mockHormoneColumnFindUnique.mockRejectedValue({ code: 'CONNECTION_RESET' })

    const { getHormoneColumnBySlug } = await import('@/lib/services/hormone-read-service')
    const result = await getHormoneColumnBySlug('auxin-guide')

    expect(result).toBeNull()
    expect(mockLoggerError).toHaveBeenCalled()
  })
})
