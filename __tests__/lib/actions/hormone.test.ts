// @vitest-environment node

import { vi } from 'vitest'

const mockPrisma = {
  hormoneType: { findMany: vi.fn(), findUnique: vi.fn() },
  hormoneInteraction: { findMany: vi.fn() },
  hormoneColumn: { findMany: vi.fn(), findUnique: vi.fn() },
  hormoneTechnique: { findMany: vi.fn() },
  hormoneSeasonalLevel: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireAuth = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

describe('Hormone Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getHormones ──────────────────────────────────────────────

  describe('getHormones', () => {
    it('未認証の場合はエラーと空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getHormones } = await import('@/lib/actions/hormone')
      const result = await getHormones()

      expect(result).toEqual({ hormones: [], error: '認証が必要です' })
      expect(mockPrisma.hormoneType.findMany).not.toHaveBeenCalled()
    })

    it('認証済みの場合はホルモン一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [
        { id: 'h1', name: 'オーキシン', slug: 'auxin', category: 'major', sortOrder: 1, _count: { effects: 3 } },
        { id: 'h2', name: 'ジベレリン', slug: 'gibberellin', category: 'major', sortOrder: 2, _count: { effects: 2 } },
      ]
      mockPrisma.hormoneType.findMany.mockResolvedValue(list)

      const { getHormones } = await import('@/lib/actions/hormone')
      const result = await getHormones()

      expect(result.hormones).toEqual(list)
      expect(result.hormones).toHaveLength(2)
      expect(mockPrisma.hormoneType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { _count: { select: { effects: true } } },
        })
      )
    })

    it('category指定でwhereに反映する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneType.findMany.mockResolvedValue([])

      const { getHormones } = await import('@/lib/actions/hormone')
      await getHormones({ category: 'major' })

      expect(mockPrisma.hormoneType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'major' },
        })
      )
    })

    it('category未指定ではwhereがundefinedになる', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneType.findMany.mockResolvedValue([])

      const { getHormones } = await import('@/lib/actions/hormone')
      await getHormones()

      expect(mockPrisma.hormoneType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
        })
      )
    })
  })

  // ── getHormoneBySlug ──────────────────────────────────────────

  describe('getHormoneBySlug', () => {
    it('未認証の場合はnullを返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getHormoneBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneBySlug('auxin')

      expect(result).toBeNull()
      expect(mockPrisma.hormoneType.findUnique).not.toHaveBeenCalled()
    })

    it('認証済みの場合はホルモン詳細をeffects付きで返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const hormone = {
        id: 'h1',
        name: 'オーキシン',
        slug: 'auxin',
        category: 'major',
        effects: [{ effectName: '細胞伸長', isPromoting: true, sortOrder: 1 }],
        seasonalLevels: [{ month: 4, level: 'high' }],
        interactionsA: [],
        interactionsB: [],
      }
      mockPrisma.hormoneType.findUnique.mockResolvedValue(hormone)

      const { getHormoneBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneBySlug('auxin')

      expect(result).toEqual(hormone)
      expect(result?.effects).toHaveLength(1)
      expect(result?.effects[0].effectName).toBe('細胞伸長')
      expect(mockPrisma.hormoneType.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { slug: 'auxin' },
          include: expect.objectContaining({
            effects: { orderBy: { sortOrder: 'asc' } },
            seasonalLevels: { orderBy: { month: 'asc' } },
          }),
        })
      )
    })

    it('存在しないslugの場合はnullを返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneType.findUnique.mockResolvedValue(null)

      const { getHormoneBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneBySlug('nonexistent')

      expect(result).toBeNull()
    })
  })

  // ── getHormoneInteractions ──────────────────────────────────────

  describe('getHormoneInteractions', () => {
    it('未認証の場合はエラーと空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getHormoneInteractions } = await import('@/lib/actions/hormone')
      const result = await getHormoneInteractions()

      expect(result).toEqual({ interactions: [], error: '認証が必要です' })
      expect(mockPrisma.hormoneInteraction.findMany).not.toHaveBeenCalled()
    })

    it('認証済みの場合は相互作用一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const interactions = [
        {
          id: 'i1',
          type: 'synergistic',
          hormoneA: { id: 'h1', name: 'オーキシン', slug: 'auxin', category: 'major' },
          hormoneB: { id: 'h2', name: 'ジベレリン', slug: 'gibberellin', category: 'major' },
          sortOrder: 1,
        },
      ]
      mockPrisma.hormoneInteraction.findMany.mockResolvedValue(interactions)

      const { getHormoneInteractions } = await import('@/lib/actions/hormone')
      const result = await getHormoneInteractions()

      expect(result.interactions).toEqual(interactions)
      expect(result.interactions).toHaveLength(1)
      expect(mockPrisma.hormoneInteraction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { sortOrder: 'asc' },
          include: expect.objectContaining({
            hormoneA: expect.any(Object),
            hormoneB: expect.any(Object),
          }),
        })
      )
    })
  })

  // ── getHormoneInteractionsBySlug ──────────────────────────────────

  describe('getHormoneInteractionsBySlug', () => {
    it('未認証の場合は空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getHormoneInteractionsBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneInteractionsBySlug('auxin')

      expect(result).toEqual({ interactions: [] })
    })

    it('ホルモンが見つからない場合は空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneType.findUnique.mockResolvedValue(null)

      const { getHormoneInteractionsBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneInteractionsBySlug('nonexistent')

      expect(result).toEqual({ interactions: [] })
      expect(mockPrisma.hormoneInteraction.findMany).not.toHaveBeenCalled()
    })

    it('ホルモンが見つかった場合はOR条件で相互作用を取得する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneType.findUnique.mockResolvedValue({ id: 'h1' })
      const interactions = [
        { id: 'i1', hormoneAId: 'h1', hormoneBId: 'h2', type: 'antagonistic' },
      ]
      mockPrisma.hormoneInteraction.findMany.mockResolvedValue(interactions)

      const { getHormoneInteractionsBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneInteractionsBySlug('auxin')

      expect(result.interactions).toEqual(interactions)
      expect(mockPrisma.hormoneInteraction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { hormoneAId: 'h1' },
              { hormoneBId: 'h1' },
            ],
          },
        })
      )
    })
  })

  // ── getHormoneColumns ──────────────────────────────────────────

  describe('getHormoneColumns', () => {
    it('未認証の場合はエラーと空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getHormoneColumns } = await import('@/lib/actions/hormone')
      const result = await getHormoneColumns()

      expect(result).toEqual({ columns: [], error: '認証が必要です' })
      expect(mockPrisma.hormoneColumn.findMany).not.toHaveBeenCalled()
    })

    it('認証済みの場合はコラム一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const columns = [
        { id: 'c1', title: 'オーキシンの基礎', slug: 'auxin-basics', sortOrder: 1, publishedAt: new Date() },
      ]
      mockPrisma.hormoneColumn.findMany.mockResolvedValue(columns)

      const { getHormoneColumns } = await import('@/lib/actions/hormone')
      const result = await getHormoneColumns()

      expect(result.columns).toEqual(columns)
      expect(result.columns).toHaveLength(1)
      expect(mockPrisma.hormoneColumn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            publishedAt: { not: null },
          }),
          orderBy: { sortOrder: 'asc' },
        })
      )
    })

    it('category指定でwhereに反映する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneColumn.findMany.mockResolvedValue([])

      const { getHormoneColumns } = await import('@/lib/actions/hormone')
      await getHormoneColumns({ category: 'basics' })

      expect(mockPrisma.hormoneColumn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            category: 'basics',
          }),
        })
      )
    })
  })

  // ── getHormoneColumnBySlug ──────────────────────────────────────

  describe('getHormoneColumnBySlug', () => {
    it('未認証の場合はnullを返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getHormoneColumnBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneColumnBySlug('auxin-basics')

      expect(result).toBeNull()
      expect(mockPrisma.hormoneColumn.findUnique).not.toHaveBeenCalled()
    })

    it('認証済みの場合はコラム詳細を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const column = { id: 'c1', title: 'オーキシンの基礎', slug: 'auxin-basics', content: '本文' }
      mockPrisma.hormoneColumn.findUnique.mockResolvedValue(column)

      const { getHormoneColumnBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneColumnBySlug('auxin-basics')

      expect(result).toEqual(column)
      expect(result?.title).toBe('オーキシンの基礎')
      expect(mockPrisma.hormoneColumn.findUnique).toHaveBeenCalledWith({
        where: { slug: 'auxin-basics' },
      })
    })

    it('存在しないslugの場合はnullを返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneColumn.findUnique.mockResolvedValue(null)

      const { getHormoneColumnBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneColumnBySlug('nonexistent')

      expect(result).toBeNull()
    })
  })

  // ── getHormoneTechniques ──────────────────────────────────────────

  describe('getHormoneTechniques', () => {
    it('未認証の場合はエラーと空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getHormoneTechniques } = await import('@/lib/actions/hormone')
      const result = await getHormoneTechniques()

      expect(result).toEqual({ techniques: [], error: '認証が必要です' })
      expect(mockPrisma.hormoneTechnique.findMany).not.toHaveBeenCalled()
    })

    it('認証済みの場合は技法一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const techniques = [
        { id: 't1', techniqueSlug: 'pinching', effectType: 'decrease', magnitude: 'strong', hormone: { id: 'h1', name: 'オーキシン', slug: 'auxin' } },
      ]
      mockPrisma.hormoneTechnique.findMany.mockResolvedValue(techniques)

      const { getHormoneTechniques } = await import('@/lib/actions/hormone')
      const result = await getHormoneTechniques()

      expect(result.techniques).toEqual(techniques)
      expect(result.techniques).toHaveLength(1)
      expect(mockPrisma.hormoneTechnique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ techniqueSlug: 'asc' }, { sortOrder: 'asc' }],
          include: { hormone: expect.any(Object) },
        })
      )
    })

    it('techniqueSlug指定でwhereに反映する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneTechnique.findMany.mockResolvedValue([])

      const { getHormoneTechniques } = await import('@/lib/actions/hormone')
      await getHormoneTechniques({ techniqueSlug: 'pinching' })

      expect(mockPrisma.hormoneTechnique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { techniqueSlug: 'pinching' },
        })
      )
    })

    it('techniqueSlug未指定ではwhereがundefinedになる', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneTechnique.findMany.mockResolvedValue([])

      const { getHormoneTechniques } = await import('@/lib/actions/hormone')
      await getHormoneTechniques()

      expect(mockPrisma.hormoneTechnique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: undefined,
        })
      )
    })
  })

  // ── getHormoneTechniquesBySlug ──────────────────────────────────────

  describe('getHormoneTechniquesBySlug', () => {
    it('未認証の場合は空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getHormoneTechniquesBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneTechniquesBySlug('auxin')

      expect(result).toEqual({ techniques: [] })
    })

    it('ホルモンが見つからない場合は空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneType.findUnique.mockResolvedValue(null)

      const { getHormoneTechniquesBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneTechniquesBySlug('nonexistent')

      expect(result).toEqual({ techniques: [] })
      expect(mockPrisma.hormoneTechnique.findMany).not.toHaveBeenCalled()
    })

    it('ホルモンが見つかった場合はhormoneIdで技法を取得する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneType.findUnique.mockResolvedValue({ id: 'h1' })
      const techniques = [
        { id: 't1', hormoneId: 'h1', techniqueSlug: 'pinching', effectType: 'decrease' },
      ]
      mockPrisma.hormoneTechnique.findMany.mockResolvedValue(techniques)

      const { getHormoneTechniquesBySlug } = await import('@/lib/actions/hormone')
      const result = await getHormoneTechniquesBySlug('auxin')

      expect(result.techniques).toEqual(techniques)
      expect(mockPrisma.hormoneTechnique.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { hormoneId: 'h1' },
          orderBy: { sortOrder: 'asc' },
        })
      )
    })
  })

  // ── getHormonesWithSeasonalLevels ──────────────────────────────────

  describe('getHormonesWithSeasonalLevels', () => {
    it('未認証の場合はエラーと空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getHormonesWithSeasonalLevels } = await import('@/lib/actions/hormone')
      const result = await getHormonesWithSeasonalLevels()

      expect(result).toEqual({ hormones: [], error: '認証が必要です' })
      expect(mockPrisma.hormoneType.findMany).not.toHaveBeenCalled()
    })

    it('認証済みの場合はmajorホルモンとseasonalLevelsを返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const hormones = [
        { id: 'h1', name: 'オーキシン', slug: 'auxin', sortOrder: 1, seasonalLevels: [{ month: 1, level: 'minimal' }] },
      ]
      mockPrisma.hormoneType.findMany.mockResolvedValue(hormones)

      const { getHormonesWithSeasonalLevels } = await import('@/lib/actions/hormone')
      const result = await getHormonesWithSeasonalLevels()

      expect(result.hormones).toEqual(hormones)
      expect(mockPrisma.hormoneType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'major' },
          include: { seasonalLevels: { orderBy: { month: 'asc' } } },
        })
      )
    })
  })

  // ── getSimulatorData ──────────────────────────────────────────────

  describe('getSimulatorData', () => {
    it('未認証の場合はエラーと空配列を返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getSimulatorData } = await import('@/lib/actions/hormone')
      const result = await getSimulatorData()

      expect(result).toEqual({ hormones: [], techniques: [], seasonalLevels: [], error: '認証が必要です' })
    })

    it('認証済みの場合はhormones, techniques, seasonalLevelsを返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const hormones = [{ id: 'h1', name: 'オーキシン', slug: 'auxin' }]
      const techniques = [{ id: 't1', techniqueSlug: 'pinching', hormone: { slug: 'auxin' } }]
      const seasonalLevels = [{ hormoneId: 'h1', month: 4, level: 'high' }]

      mockPrisma.hormoneType.findMany.mockResolvedValue(hormones)
      mockPrisma.hormoneTechnique.findMany.mockResolvedValue(techniques)
      mockPrisma.hormoneSeasonalLevel.findMany.mockResolvedValue(seasonalLevels)

      const { getSimulatorData } = await import('@/lib/actions/hormone')
      const result = await getSimulatorData()

      expect(result.hormones).toEqual(hormones)
      expect(result.techniques).toEqual(techniques)
      expect(result.seasonalLevels).toEqual(seasonalLevels)
    })

    it('majorホルモンのみを取得する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.hormoneType.findMany.mockResolvedValue([])
      mockPrisma.hormoneTechnique.findMany.mockResolvedValue([])
      mockPrisma.hormoneSeasonalLevel.findMany.mockResolvedValue([])

      const { getSimulatorData } = await import('@/lib/actions/hormone')
      await getSimulatorData()

      expect(mockPrisma.hormoneType.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { category: 'major' },
        })
      )
    })
  })
})
