// @vitest-environment node

import { vi } from 'vitest'

// vi.hoisted ensures this is created before vi.mock factories run
const mockShouldSkip = vi.hoisted(() => vi.fn(() => false))

const mockPrisma = {
  fertilizerNutrient: { findMany: vi.fn(), findUnique: vi.fn() },
  fertilizerCategory: { findMany: vi.fn() },
  treeSpecies: { findMany: vi.fn(), findUnique: vi.fn() },
  fertilizationPlan: { findMany: vi.fn() },
  fertilizerColumn: { findMany: vi.fn(), findUnique: vi.fn() },
}

vi.mock('@/lib/build/db-availability', () => ({ shouldSkipBuildTimeDbAccess: mockShouldSkip }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireAuth = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

describe('Fertilizer Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── getNutrients ──────────────────────────────────────────────

  describe('getNutrients', () => {
    it('認証済みの場合は栄養素一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [
        { id: 'n1', name: '窒素', slug: 'nitrogen', category: 'primary', sortOrder: 1 },
      ]
      mockPrisma.fertilizerNutrient.findMany.mockResolvedValue(list)

      const { getNutrients } = await import('@/lib/actions/fertilizer')
      const result = await getNutrients()

      expect(result.nutrients).toEqual(list)
      expect(mockPrisma.fertilizerNutrient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        })
      )
    })

    it('category指定でwhereに反映する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.fertilizerNutrient.findMany.mockResolvedValue([])

      const { getNutrients } = await import('@/lib/actions/fertilizer')
      await getNutrients({ category: 'primary' })

      expect(mockPrisma.fertilizerNutrient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { category: 'primary' } })
      )
    })

    it('categoryなしのときwhereはundefined', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.fertilizerNutrient.findMany.mockResolvedValue([])

      const { getNutrients } = await import('@/lib/actions/fertilizer')
      await getNutrients()

      expect(mockPrisma.fertilizerNutrient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined })
      )
    })
  })

  // ── getNutrientBySlug ─────────────────────────────────────────

  describe('getNutrientBySlug', () => {
    it('認証済みの場合は栄養素を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const nutrient = { id: 'n1', name: '窒素', slug: 'nitrogen' }
      mockPrisma.fertilizerNutrient.findUnique.mockResolvedValue(nutrient)

      const { getNutrientBySlug } = await import('@/lib/actions/fertilizer')
      const result = await getNutrientBySlug('nitrogen')

      expect(result).toEqual(nutrient)
      expect(mockPrisma.fertilizerNutrient.findUnique).toHaveBeenCalledWith(
        { where: { slug: 'nitrogen' } }
      )
    })

    it('存在しないslugの場合はnullを返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.fertilizerNutrient.findUnique.mockResolvedValue(null)

      const { getNutrientBySlug } = await import('@/lib/actions/fertilizer')
      const result = await getNutrientBySlug('unknown')

      expect(result).toBeNull()
    })
  })

  // ── getFertilizerCategories ───────────────────────────────────

  describe('getFertilizerCategories', () => {
    it('認証済みの場合はカテゴリ一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [
        { id: 'c1', name: '有機肥料', sortOrder: 1 },
        { id: 'c2', name: '化成肥料', sortOrder: 2 },
      ]
      mockPrisma.fertilizerCategory.findMany.mockResolvedValue(list)

      const { getFertilizerCategories } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizerCategories()

      expect(result.categories).toEqual(list)
    })

    it('orderByにsortOrderが指定される', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.fertilizerCategory.findMany.mockResolvedValue([])

      const { getFertilizerCategories } = await import('@/lib/actions/fertilizer')
      await getFertilizerCategories()

      expect(mockPrisma.fertilizerCategory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { sortOrder: 'asc' } })
      )
    })
  })

  // ── getTreeSpecies ────────────────────────────────────────────

  describe('getTreeSpecies', () => {
    it('認証済みの場合は樹種一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [
        { id: 't1', name: '黒松', slug: 'kuromatsu', category: 'conifer', _count: { plans: 12 } },
      ]
      mockPrisma.treeSpecies.findMany.mockResolvedValue(list)

      const { getTreeSpecies } = await import('@/lib/actions/fertilizer')
      const result = await getTreeSpecies()

      expect(result.treeSpecies).toEqual(list)
    })

    it('_countのplansがincludeされる', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.treeSpecies.findMany.mockResolvedValue([])

      const { getTreeSpecies } = await import('@/lib/actions/fertilizer')
      await getTreeSpecies()

      expect(mockPrisma.treeSpecies.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { _count: { select: { plans: true } } },
        })
      )
    })

    it('category指定でwhereに反映する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.treeSpecies.findMany.mockResolvedValue([])

      const { getTreeSpecies } = await import('@/lib/actions/fertilizer')
      await getTreeSpecies({ category: 'conifer' })

      expect(mockPrisma.treeSpecies.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { category: 'conifer' } })
      )
    })

    it('categoryなしのときwhereはundefined', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.treeSpecies.findMany.mockResolvedValue([])

      const { getTreeSpecies } = await import('@/lib/actions/fertilizer')
      await getTreeSpecies()

      expect(mockPrisma.treeSpecies.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined })
      )
    })
  })

  // ── getFertilizationSchedule ──────────────────────────────────

  describe('getFertilizationSchedule', () => {
    it('認証済みの場合は樹種と施肥計画を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const tree = {
        id: 't1',
        name: '黒松',
        slug: 'kuromatsu',
        plans: [
          { month: 1, action: 'none' },
          { month: 2, action: 'light' },
        ],
      }
      mockPrisma.treeSpecies.findUnique.mockResolvedValue(tree)

      const { getFertilizationSchedule } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizationSchedule('kuromatsu')

      expect(result).toEqual(tree)
      expect(mockPrisma.treeSpecies.findUnique).toHaveBeenCalledWith({
        where: { slug: 'kuromatsu' },
        include: { plans: { orderBy: { month: 'asc' } } },
      })
    })

    it('存在しないslugの場合はnullを返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.treeSpecies.findUnique.mockResolvedValue(null)

      const { getFertilizationSchedule } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizationSchedule('unknown')

      expect(result).toBeNull()
    })
  })

  // ── getFertilizerColumns ──────────────────────────────────────

  describe('getFertilizerColumns', () => {
    it('認証済みの場合はコラム一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [
        { id: 'col1', title: '肥料の基本', slug: 'basics', category: 'beginner' },
      ]
      mockPrisma.fertilizerColumn.findMany.mockResolvedValue(list)

      const { getFertilizerColumns } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizerColumns()

      expect(result.columns).toEqual(list)
    })

    it('publishedAtフィルタが適用される', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.fertilizerColumn.findMany.mockResolvedValue([])

      const { getFertilizerColumns } = await import('@/lib/actions/fertilizer')
      await getFertilizerColumns()

      expect(mockPrisma.fertilizerColumn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ publishedAt: { not: null } }),
        })
      )
    })

    it('category指定でwhereに反映する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.fertilizerColumn.findMany.mockResolvedValue([])

      const { getFertilizerColumns } = await import('@/lib/actions/fertilizer')
      await getFertilizerColumns({ category: 'beginner' })

      expect(mockPrisma.fertilizerColumn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'beginner' }),
        })
      )
    })

    it('orderByにsortOrderとtitleが指定される', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.fertilizerColumn.findMany.mockResolvedValue([])

      const { getFertilizerColumns } = await import('@/lib/actions/fertilizer')
      await getFertilizerColumns()

      expect(mockPrisma.fertilizerColumn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
        })
      )
    })
  })

  // ── getFertilizerColumnBySlug ─────────────────────────────────

  describe('getFertilizerColumnBySlug', () => {
    it('認証済みの場合はコラムを返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const column = { id: 'col1', title: '肥料の基本', slug: 'basics' }
      mockPrisma.fertilizerColumn.findUnique.mockResolvedValue(column)

      const { getFertilizerColumnBySlug } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizerColumnBySlug('basics')

      expect(result).toEqual(column)
      expect(mockPrisma.fertilizerColumn.findUnique).toHaveBeenCalledWith(
        { where: { slug: 'basics' } }
      )
    })

    it('存在しないslugの場合はnullを返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.fertilizerColumn.findUnique.mockResolvedValue(null)

      const { getFertilizerColumnBySlug } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizerColumnBySlug('unknown')

      expect(result).toBeNull()
    })
  })

  describe('shouldSkipBuildTimeDbAccess が true のとき早期 return する', () => {
    it('getNutrients は DB を呼ばず { nutrients: [] } を返す', async () => {
      mockShouldSkip.mockReturnValueOnce(true)
      const { getNutrients } = await import('@/lib/actions/fertilizer')
      const result = await getNutrients()
      expect(result).toEqual({ nutrients: [] })
      expect(mockPrisma.fertilizerNutrient.findMany).not.toHaveBeenCalled()
    })

    it('getNutrientBySlug は DB を呼ばず null を返す', async () => {
      mockShouldSkip.mockReturnValueOnce(true)
      const { getNutrientBySlug } = await import('@/lib/actions/fertilizer')
      const result = await getNutrientBySlug('some-slug')
      expect(result).toBeNull()
      expect(mockPrisma.fertilizerNutrient.findUnique).not.toHaveBeenCalled()
    })

    it('getFertilizerCategories は DB を呼ばず { categories: [] } を返す', async () => {
      mockShouldSkip.mockReturnValueOnce(true)
      const { getFertilizerCategories } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizerCategories()
      expect(result).toEqual({ categories: [] })
      expect(mockPrisma.fertilizerCategory.findMany).not.toHaveBeenCalled()
    })

    it('getTreeSpecies は DB を呼ばず { treeSpecies: [] } を返す', async () => {
      mockShouldSkip.mockReturnValueOnce(true)
      const { getTreeSpecies } = await import('@/lib/actions/fertilizer')
      const result = await getTreeSpecies()
      expect(result).toEqual({ treeSpecies: [] })
      expect(mockPrisma.treeSpecies.findMany).not.toHaveBeenCalled()
    })

    it('getFertilizationSchedule は DB を呼ばず null を返す', async () => {
      mockShouldSkip.mockReturnValueOnce(true)
      const { getFertilizationSchedule } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizationSchedule('some-slug')
      expect(result).toBeNull()
      expect(mockPrisma.treeSpecies.findUnique).not.toHaveBeenCalled()
    })

    it('getFertilizerColumns は DB を呼ばず { columns: [] } を返す', async () => {
      mockShouldSkip.mockReturnValueOnce(true)
      const { getFertilizerColumns } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizerColumns()
      expect(result).toEqual({ columns: [] })
      expect(mockPrisma.fertilizerColumn.findMany).not.toHaveBeenCalled()
    })

    it('getFertilizerColumnBySlug は DB を呼ばず null を返す', async () => {
      mockShouldSkip.mockReturnValueOnce(true)
      const { getFertilizerColumnBySlug } = await import('@/lib/actions/fertilizer')
      const result = await getFertilizerColumnBySlug('some-slug')
      expect(result).toBeNull()
      expect(mockPrisma.fertilizerColumn.findUnique).not.toHaveBeenCalled()
    })
  })
})
