// @vitest-environment node
/**
 * generateStaticParams のテスト
 *
 * ISR対応で追加されたgenerateStaticParamsが正しくslugを返すことを検証
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockBonsaiTermFindMany = vi.fn()
const mockPesticideFindMany = vi.fn()
const mockDiseasePestFindMany = vi.fn()
const mockActiveIngredientFindMany = vi.fn()
const mockPesticideColumnFindMany = vi.fn()
const mockSpreaderTypeFindMany = vi.fn()

vi.mock('@/lib/build/static-params', () => ({
  loadStaticParams: (loader: () => Promise<unknown[]>) => loader(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    bonsaiTerm: { findMany: (...args: unknown[]) => mockBonsaiTermFindMany(...args) },
    pesticide: { findMany: (...args: unknown[]) => mockPesticideFindMany(...args) },
    diseasePest: { findMany: (...args: unknown[]) => mockDiseasePestFindMany(...args) },
    activeIngredient: { findMany: (...args: unknown[]) => mockActiveIngredientFindMany(...args) },
    pesticideColumn: { findMany: (...args: unknown[]) => mockPesticideColumnFindMany(...args) },
    spreaderType: { findMany: (...args: unknown[]) => mockSpreaderTypeFindMany(...args) },
  },
}))

vi.mock('@/lib/actions/dictionary', () => ({
  getTermBySlug: vi.fn(),
  getAdjacentTerms: vi.fn(),
}))

vi.mock('@/lib/actions/pesticide', () => ({
  getPesticideBySlug: vi.fn(),
  getDiseasePestBySlug: vi.fn(),
  getActiveIngredientBySlug: vi.fn(),
  getColumnBySlug: vi.fn(),
  getSpreaderTypeBySlug: vi.fn(),
}))

describe('generateStaticParams', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dictionary/[slug] が全用語のslugを返す', async () => {
    mockBonsaiTermFindMany.mockResolvedValue([
      { slug: 'toriki' },
      { slug: 'misho' },
    ])

    const mod = await import('@/app/(main)/dictionary/[slug]/page')
    const params = await mod.generateStaticParams()

    expect(params).toEqual([{ slug: 'toriki' }, { slug: 'misho' }])
    expect(mockBonsaiTermFindMany).toHaveBeenCalledWith({ select: { slug: true } })
  })

  it('pesticides/products/[slug] が全農薬のslugを返す', async () => {
    mockPesticideFindMany.mockResolvedValue([
      { slug: 'trifumin-ec' },
    ])

    const mod = await import('@/app/(main)/pesticides/products/[slug]/page')
    const params = await mod.generateStaticParams()

    expect(params).toEqual([{ slug: 'trifumin-ec' }])
  })

  it('pesticides/diseases-pests/[slug] が全病害虫のslugを返す', async () => {
    mockDiseasePestFindMany.mockResolvedValue([
      { slug: 'udonko-byo' },
      { slug: 'hadani' },
    ])

    const mod = await import('@/app/(main)/pesticides/diseases-pests/[slug]/page')
    const params = await mod.generateStaticParams()

    expect(params).toEqual([{ slug: 'udonko-byo' }, { slug: 'hadani' }])
  })

  it('pesticides/ingredients/[slug] が全原体のslugを返す', async () => {
    mockActiveIngredientFindMany.mockResolvedValue([
      { slug: 'triflumizole' },
    ])

    const mod = await import('@/app/(main)/pesticides/ingredients/[slug]/page')
    const params = await mod.generateStaticParams()

    expect(params).toEqual([{ slug: 'triflumizole' }])
  })

  it('pesticides/columns/[slug] が全コラムのslugを返す', async () => {
    mockPesticideColumnFindMany.mockResolvedValue([
      { slug: 'rotation-guide' },
    ])

    const mod = await import('@/app/(main)/pesticides/columns/[slug]/page')
    const params = await mod.generateStaticParams()

    expect(params).toEqual([{ slug: 'rotation-guide' }])
  })

  it('pesticides/spreaders/[slug] が全展着剤タイプのslugを返す', async () => {
    mockSpreaderTypeFindMany.mockResolvedValue([
      { slug: 'ether' },
      { slug: 'silicone' },
    ])

    const mod = await import('@/app/(main)/pesticides/spreaders/[slug]/page')
    const params = await mod.generateStaticParams()

    expect(params).toEqual([{ slug: 'ether' }, { slug: 'silicone' }])
  })

  it('空配列の場合も正しく動作する', async () => {
    mockBonsaiTermFindMany.mockResolvedValue([])

    const mod = await import('@/app/(main)/dictionary/[slug]/page')
    const params = await mod.generateStaticParams()

    expect(params).toEqual([])
  })
})
