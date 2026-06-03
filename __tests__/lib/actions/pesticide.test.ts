// @vitest-environment node

import { vi } from 'vitest'

const mockPrisma = {
  user: { findUnique: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  diseasePest: { findMany: vi.fn(), findUnique: vi.fn() },
  pesticide: { findMany: vi.fn(), findUnique: vi.fn() },
  activeIngredient: { findMany: vi.fn(), findUnique: vi.fn() },
  formulationType: { findMany: vi.fn(), findUnique: vi.fn() },
  spreaderType: { findMany: vi.fn(), findUnique: vi.fn() },
  pesticideColumn: { findMany: vi.fn(), findUnique: vi.fn() },
  pesticideIncompatibility: { findMany: vi.fn() },
}

vi.mock('@/lib/build/db-availability', () => ({ shouldSkipBuildTimeDbAccess: () => false }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireAuth = vi.fn()
const mockRequireAdmin = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}))

describe('Pesticide Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getDiseasePests', () => {
    it('認証済みの場合は病害虫一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [
        { id: 'dp1', name: 'うどんこ病', slug: 'udonko-byo', category: 'disease', _count: { effects: 2 } },
      ]
      mockPrisma.diseasePest.findMany.mockResolvedValue(list)

      const { getDiseasePests } = await import('@/lib/actions/pesticide')
      const result = await getDiseasePests()

      expect(result.diseasePests).toEqual(list)
      expect(mockPrisma.diseasePest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          include: { _count: { select: { effects: true } } },
        })
      )
    })

    it('category指定でwhereに反映する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.diseasePest.findMany.mockResolvedValue([])

      const { getDiseasePests } = await import('@/lib/actions/pesticide')
      await getDiseasePests({ category: 'pest' })

      expect(mockPrisma.diseasePest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { category: 'pest' } })
      )
    })

    it('search指定でwhere.ORに名前・かな・説明の部分一致を渡す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.diseasePest.findMany.mockResolvedValue([])

      const { getDiseasePests } = await import('@/lib/actions/pesticide')
      await getDiseasePests({ search: 'うどんこ' })

      expect(mockPrisma.diseasePest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'うどんこ', mode: 'insensitive' } },
              { nameKana: { contains: 'うどんこ', mode: 'insensitive' } },
              { description: { contains: 'うどんこ', mode: 'insensitive' } },
            ],
          }),
        })
      )
    })

    it('bodySizeMm指定で害虫を体長範囲で絞り込む', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.diseasePest.findMany.mockResolvedValue([])

      const { getDiseasePests } = await import('@/lib/actions/pesticide')
      await getDiseasePests({ bodySizeMm: 5 })

      expect(mockPrisma.diseasePest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            bodySizeMinMm: { lte: 5 },
            bodySizeMaxMm: { gte: 5 },
            category: { in: ['pest', 'beneficial_insect'] },
          }),
        })
      )
    })

    it('bodySizeMmが0以下の場合は体長条件を付けない', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.diseasePest.findMany.mockResolvedValue([])

      const { getDiseasePests } = await import('@/lib/actions/pesticide')
      await getDiseasePests({ bodySizeMm: 0 })

      const call = mockPrisma.diseasePest.findMany.mock.calls[0][0]
      expect(call.where).not.toHaveProperty('bodySizeMinMm')
      expect(call.where).not.toHaveProperty('bodySizeMaxMm')
    })
  })

  describe('getPesticides', () => {
    it('認証済みの場合は薬剤一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [{ id: 'p1', name: 'トリフミン乳剤', slug: 'trifumin-ec' }]
      mockPrisma.pesticide.findMany.mockResolvedValue(list)

      const { getPesticides } = await import('@/lib/actions/pesticide')
      const result = await getPesticides()

      expect(result.pesticides).toEqual(list)
      expect(mockPrisma.pesticide.findMany).toHaveBeenCalled()
    })

    it('type=herbicideの場合はotherとして検索する（後方互換）', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.pesticide.findMany.mockResolvedValue([])

      const { getPesticides } = await import('@/lib/actions/pesticide')
      await getPesticides({ type: 'herbicide' })

      expect(mockPrisma.pesticide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ pesticideType: 'other' }),
        })
      )
    })

    it('typeが無効な文字列の場合はtype条件を付けない', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.pesticide.findMany.mockResolvedValue([])

      const { getPesticides } = await import('@/lib/actions/pesticide')
      await getPesticides({ type: 'invalid-type' })

      const call = mockPrisma.pesticide.findMany.mock.calls[0][0]
      expect(call.where).not.toHaveProperty('pesticideType')
    })

    it('typeが有効な値の場合はそのままwhereに渡す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.pesticide.findMany.mockResolvedValue([])

      const { getPesticides } = await import('@/lib/actions/pesticide')
      await getPesticides({ type: 'fungicide' })

      expect(mockPrisma.pesticide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ pesticideType: 'fungicide' }),
        })
      )
    })

    it('search指定でwhere.ORに名前・登録番号の部分一致を渡す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.pesticide.findMany.mockResolvedValue([])

      const { getPesticides } = await import('@/lib/actions/pesticide')
      await getPesticides({ search: 'トリフミン' })

      expect(mockPrisma.pesticide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'トリフミン', mode: 'insensitive' } },
              { registrationNumber: { contains: 'トリフミン', mode: 'insensitive' } },
            ],
          }),
        })
      )
    })

    it('diseasePestId指定でwhere.effectsを渡す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.pesticide.findMany.mockResolvedValue([])

      const { getPesticides } = await import('@/lib/actions/pesticide')
      await getPesticides({ diseasePestId: 'dp1' })

      expect(mockPrisma.pesticide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            effects: { some: { diseasePestId: 'dp1' } },
          }),
        })
      )
    })

    it('formulationTypeCode指定でwhere.formulationTypeを渡す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.pesticide.findMany.mockResolvedValue([])

      const { getPesticides } = await import('@/lib/actions/pesticide')
      await getPesticides({ formulationTypeCode: 'EC' })

      expect(mockPrisma.pesticide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            formulationType: { is: { code: 'EC' } },
          }),
        })
      )
    })
  })

  describe('getFormulationTypes', () => {
    it('認証済みの場合は剤型一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [{ id: 'ft1', code: 'EC', name: '乳剤' }]
      mockPrisma.formulationType.findMany.mockResolvedValue(list)

      const { getFormulationTypes } = await import('@/lib/actions/pesticide')
      const result = await getFormulationTypes()

      expect(result.formulations).toEqual(list)
      expect(mockPrisma.formulationType.findMany).toHaveBeenCalled()
    })
  })

  describe('getFormulationTypeByCode', () => {
    it('認証済みの場合はcodeで取得する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const row = { id: 'ft1', code: 'EC', name: '乳剤' }
      mockPrisma.formulationType.findUnique.mockResolvedValue(row)

      const { getFormulationTypeByCode } = await import('@/lib/actions/pesticide')
      const result = await getFormulationTypeByCode('EC')

      expect(result).toEqual(row)
      expect(mockPrisma.formulationType.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { code: 'EC' } })
      )
    })
  })

  describe('getDiseasePestBySlug', () => {
    it('認証済みの場合はslugで取得する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const row = { id: 'dp1', name: 'うどんこ病', slug: 'udonko-byo', effects: [] }
      mockPrisma.diseasePest.findUnique.mockResolvedValue(row)

      const { getDiseasePestBySlug } = await import('@/lib/actions/pesticide')
      const result = await getDiseasePestBySlug('udonko-byo')

      expect(result).toEqual(row)
      expect(mockPrisma.diseasePest.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'udonko-byo' } })
      )
    })
  })

  describe('getPesticideBySlug', () => {
    it('認証済みの場合はslugで取得する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const row = { id: 'p1', name: 'トリフミン乳剤', slug: 'trifumin-ec' }
      mockPrisma.pesticide.findUnique.mockResolvedValue(row)

      const { getPesticideBySlug } = await import('@/lib/actions/pesticide')
      const result = await getPesticideBySlug('trifumin-ec')

      expect(result).toEqual(row)
      expect(mockPrisma.pesticide.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'trifumin-ec' } })
      )
    })

    it('取得時に spreaderTypes を select する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.pesticide.findUnique.mockResolvedValue(null)

      const { getPesticideBySlug } = await import('@/lib/actions/pesticide')
      await getPesticideBySlug('avanone')

      expect(mockPrisma.pesticide.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({
            spreaderTypes: expect.objectContaining({
              select: expect.objectContaining({
                spreaderType: expect.objectContaining({
                  select: expect.objectContaining({ id: true, name: true, slug: true }),
                }),
              }),
            }),
          }),
        })
      )
    })
  })

  describe('getActiveIngredients', () => {
    it('認証済みの場合は原体一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [{ id: 'ai1', name: 'トリフミゾール', slug: 'trifumizole', _count: { pesticides: 3 } }]
      mockPrisma.activeIngredient.findMany.mockResolvedValue(list)

      const { getActiveIngredients } = await import('@/lib/actions/pesticide')
      const result = await getActiveIngredients()

      expect(result.ingredients).toEqual(list)
      expect(mockPrisma.activeIngredient.findMany).toHaveBeenCalled()
    })

    it('search指定でwhere.ORを渡す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.activeIngredient.findMany.mockResolvedValue([])

      const { getActiveIngredients } = await import('@/lib/actions/pesticide')
      await getActiveIngredients({ search: 'トリフ' })

      expect(mockPrisma.activeIngredient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'トリフ', mode: 'insensitive' } },
              { nameEn: { contains: 'トリフ', mode: 'insensitive' } },
              { fracCode: { contains: 'トリフ', mode: 'insensitive' } },
              { iracCode: { contains: 'トリフ', mode: 'insensitive' } },
            ],
          }),
        })
      )
    })
  })

  describe('getActiveIngredientBySlug', () => {
    it('認証済みの場合はslugで取得する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const row = { id: 'ai1', name: 'トリフミゾール', slug: 'trifumizole', pesticides: [] }
      mockPrisma.activeIngredient.findUnique.mockResolvedValue(row)

      const { getActiveIngredientBySlug } = await import('@/lib/actions/pesticide')
      const result = await getActiveIngredientBySlug('trifumizole')

      expect(result).toEqual(row)
      expect(mockPrisma.activeIngredient.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'trifumizole' } })
      )
    })
  })

  describe('getSpreaderTypes', () => {
    it('認証済みの場合は展着剤タイプ一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [{ id: 'st1', name: '非イオン', slug: 'non-ionic' }]
      mockPrisma.spreaderType.findMany.mockResolvedValue(list)

      const { getSpreaderTypes } = await import('@/lib/actions/pesticide')
      const result = await getSpreaderTypes()

      expect(result.spreaders).toEqual(list)
      expect(mockPrisma.spreaderType.findMany).toHaveBeenCalled()
    })
  })

  describe('getSpreaderProducts', () => {
    it('認証済みの場合は spreaderTypes を持つ薬剤一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [
        {
          id: 'p1',
          name: '展着剤A',
          slug: 'spreader-a',
          formulationType: { name: '液剤' },
          registrationNumber: '12345',
        },
      ]
      mockPrisma.pesticide.findMany.mockResolvedValue(list)

      const { getSpreaderProducts } = await import('@/lib/actions/pesticide')
      const result = await getSpreaderProducts()

      expect(result.pesticides).toEqual(list)
      expect(mockPrisma.pesticide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { spreaderTypes: { some: {} } },
          orderBy: { name: 'asc' },
          include: expect.objectContaining({
            formulationType: { select: { name: true } },
            spreaderTypes: { include: { spreaderType: true } },
          }),
        })
      )
    })

    it('DBエラーが発生した場合は例外をスローする', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const { Prisma } = await import('@prisma/client')
      const p2021 = new Prisma.PrismaClientKnownRequestError(
        'The table `public.pesticide_spreader_types` does not exist in the current database.',
        { code: 'P2021', clientVersion: '0.0.0' }
      )
      mockPrisma.pesticide.findMany.mockRejectedValue(p2021)

      const { getSpreaderProducts } = await import('@/lib/actions/pesticide')
      await expect(getSpreaderProducts()).rejects.toThrow()
    })
  })

  describe('getSpreaderTypeBySlug', () => {
    it('認証済みの場合はslugで取得する（includeなし）', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const row = { id: 'st1', name: '非イオン', slug: 'non-ionic' }
      mockPrisma.spreaderType.findUnique.mockResolvedValue(row)

      const { getSpreaderTypeBySlug } = await import('@/lib/actions/pesticide')
      const result = await getSpreaderTypeBySlug('non-ionic')

      expect(result).toEqual(row)
      expect(mockPrisma.spreaderType.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'non-ionic' } })
      )
    })
  })

  describe('getColumns', () => {
    it('認証済みの場合はコラム一覧を返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const list = [{ id: 'pc1', title: '農薬の基礎', slug: 'basics', publishedAt: new Date() }]
      mockPrisma.pesticideColumn.findMany.mockResolvedValue(list)

      const { getColumns } = await import('@/lib/actions/pesticide')
      const result = await getColumns()

      expect(result.columns).toEqual(list)
      expect(mockPrisma.pesticideColumn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publishedAt: { not: null } },
        })
      )
    })

    it('category指定でwhereに反映する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      mockPrisma.pesticideColumn.findMany.mockResolvedValue([])

      const { getColumns } = await import('@/lib/actions/pesticide')
      await getColumns({ category: 'usage' })

      expect(mockPrisma.pesticideColumn.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'usage', publishedAt: { not: null } }),
        })
      )
    })
  })

  describe('getColumnBySlug', () => {
    it('認証済みの場合はslugで取得する', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
      const row = { id: 'pc1', title: '農薬の基礎', slug: 'basics' }
      mockPrisma.pesticideColumn.findUnique.mockResolvedValue(row)

      const { getColumnBySlug } = await import('@/lib/actions/pesticide')
      const result = await getColumnBySlug('basics')

      expect(result).toEqual(row)
      expect(mockPrisma.pesticideColumn.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { slug: 'basics' } })
      )
    })
  })

  describe('getPesticideIncompatibilities', () => {
    it('認証済みの場合は混用不可リストを { pesticideId, incompatibleWithId } のみ select で返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'u1' })
      const list = [
        { pesticideId: 'p1', incompatibleWithId: 'p2' },
        { pesticideId: 'p2', incompatibleWithId: 'p3' },
      ]
      mockPrisma.pesticideIncompatibility.findMany.mockResolvedValue(list)
      const { getPesticideIncompatibilities } = await import('@/lib/actions/pesticide')
      const result = await getPesticideIncompatibilities()
      expect(result).toEqual({ incompatibilities: list })
      expect(mockPrisma.pesticideIncompatibility.findMany).toHaveBeenCalledWith({
        select: { pesticideId: true, incompatibleWithId: true },
      })
    })
  })

  describe('getPesticideOptions', () => {
    it('認証済みの場合は id/name/slug/pesticideType の minimal フィールドで返す', async () => {
      mockRequireAuth.mockResolvedValue({ userId: 'u1' })
      const list = [
        { id: 'p1', name: 'A', slug: 'a', pesticideType: 'fungicide' },
        { id: 'p2', name: 'B', slug: 'b', pesticideType: 'insecticide' },
      ]
      mockPrisma.pesticide.findMany.mockResolvedValue(list)
      const { getPesticideOptions } = await import('@/lib/actions/pesticide')
      const result = await getPesticideOptions()
      expect(result).toEqual({ pesticides: list })
      expect(mockPrisma.pesticide.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { id: true, name: true, slug: true, pesticideType: true },
          orderBy: { name: 'asc' },
        }),
      )
    })
  })
})
