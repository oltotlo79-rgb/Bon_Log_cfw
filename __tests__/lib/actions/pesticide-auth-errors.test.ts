// @vitest-environment node

import { vi } from 'vitest'

const mockPrisma = {
  diseasePest: { findMany: vi.fn() },
  pesticide: { findMany: vi.fn() },
  activeIngredient: { findMany: vi.fn() },
  spreaderType: { findMany: vi.fn() },
  pesticideColumn: { findMany: vi.fn() },
  formulationType: { findMany: vi.fn() },
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireAuth = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireAdmin: vi.fn(),
}))

describe('Pesticide actions - auth error responses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })
  })

  it('getDiseasePests は { diseasePests: [], error } を返す', async () => {
    const { getDiseasePests } = await import('@/lib/actions/pesticide')
    const result = await getDiseasePests()
    expect(result).toEqual({ diseasePests: [], error: '認証が必要です' })
    expect(mockPrisma.diseasePest.findMany).not.toHaveBeenCalled()
  })

  it('getPesticides は { pesticides: [], error } を返す', async () => {
    const { getPesticides } = await import('@/lib/actions/pesticide')
    const result = await getPesticides()
    expect(result).toEqual({ pesticides: [], error: '認証が必要です' })
    expect(mockPrisma.pesticide.findMany).not.toHaveBeenCalled()
  })

  it('getActiveIngredients は { ingredients: [], error } を返す', async () => {
    const { getActiveIngredients } = await import('@/lib/actions/pesticide')
    const result = await getActiveIngredients()
    expect(result).toEqual({ ingredients: [], error: '認証が必要です' })
    expect(mockPrisma.activeIngredient.findMany).not.toHaveBeenCalled()
  })

  it('getSpreaderTypes は { spreaders: [], error } を返す', async () => {
    const { getSpreaderTypes } = await import('@/lib/actions/pesticide')
    const result = await getSpreaderTypes()
    expect(result).toEqual({ spreaders: [], error: '認証が必要です' })
    expect(mockPrisma.spreaderType.findMany).not.toHaveBeenCalled()
  })

  it('getSpreaderProducts は { pesticides: [], error } を返す', async () => {
    const { getSpreaderProducts } = await import('@/lib/actions/pesticide')
    const result = await getSpreaderProducts()
    expect(result).toEqual({ pesticides: [], error: '認証が必要です' })
    expect(mockPrisma.pesticide.findMany).not.toHaveBeenCalled()
  })

  it('getColumns は { columns: [], error } を返す', async () => {
    const { getColumns } = await import('@/lib/actions/pesticide')
    const result = await getColumns()
    expect(result).toEqual({ columns: [], error: '認証が必要です' })
    expect(mockPrisma.pesticideColumn.findMany).not.toHaveBeenCalled()
  })

  it('getFormulationTypes は { formulations: [], error } を返す', async () => {
    const { getFormulationTypes } = await import('@/lib/actions/pesticide')
    const result = await getFormulationTypes()
    expect(result).toEqual({ formulations: [], error: '認証が必要です' })
    expect(mockPrisma.formulationType.findMany).not.toHaveBeenCalled()
  })
})
