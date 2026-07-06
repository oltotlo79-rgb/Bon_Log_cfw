/**
 * app/admin/pesticide-data/page.tsx (一覧ページ)
 *
 * 未カバーだった分岐:
 * - pesticideType が有効な PesticideType 値の場合、そのまま action へ渡す
 * - getAdminPesticides がエラーを返した場合のリダイレクト
 * - formulationType が無い場合 formulationName は null にフォールバック
 * - updatedAt が Date インスタンスでない場合は String() でそのまま使う
 */
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockIsAdmin = vi.fn()
vi.mock('@/lib/actions/admin', () => ({
  isAdmin: () => mockIsAdmin(),
}))

const mockGetAdminPesticides = vi.fn()
vi.mock('@/lib/actions/admin/pesticide-data', () => ({
  getAdminPesticides: (...args: unknown[]) => mockGetAdminPesticides(...args),
}))

vi.mock('@/lib/db', () => ({
  prisma: new Proxy(
    {},
    {
      get: () => ({ count: vi.fn().mockResolvedValue(0) }),
    },
  ),
}))

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

vi.mock('@/app/admin/pesticide-data/PesticideTable', () => ({
  PesticideTable: ({
    pesticides,
  }: {
    pesticides: Array<{ formulationName: string | null; updatedAt: string }>
  }) => (
    <div data-testid="pesticide-table">
      {pesticides.map((p, i) => (
        <div key={i} data-testid={`row-${i}`} data-formulation={p.formulationName ?? 'null'} data-updated-at={p.updatedAt}>
          row
        </div>
      ))}
    </div>
  ),
}))

import PesticideDataPage from '@/app/admin/pesticide-data/page'

function buildPesticideRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'テスト農薬',
    registrationNumber: 'R-001',
    pesticideType: 'insecticide',
    formulationType: { name: '乳剤' },
    _count: { effects: 1, ingredients: 1 },
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }
}

describe('PesticideDataPage(一覧) - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsAdmin.mockResolvedValue(true)
  })

  it('getAdminPesticidesがエラーの場合はログインへリダイレクトする', async () => {
    mockGetAdminPesticides.mockResolvedValue({ error: '認証エラー' })

    await expect(
      PesticideDataPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('有効なpesticideTypeクエリはそのままフィルターとしてactionへ渡す', async () => {
    mockGetAdminPesticides.mockResolvedValue({ pesticides: [], total: 0 })

    await PesticideDataPage({
      searchParams: Promise.resolve({ pesticideType: 'insecticide' }),
    })

    expect(mockGetAdminPesticides).toHaveBeenCalledWith(
      expect.objectContaining({ pesticideType: 'insecticide' }),
    )
  })

  it('不正なpesticideTypeクエリはundefinedとしてactionへ渡す', async () => {
    mockGetAdminPesticides.mockResolvedValue({ pesticides: [], total: 0 })

    await PesticideDataPage({
      searchParams: Promise.resolve({ pesticideType: 'not_a_real_type' }),
    })

    expect(mockGetAdminPesticides).toHaveBeenCalledWith(
      expect.objectContaining({ pesticideType: undefined }),
    )
  })

  it('formulationTypeが無い場合はformulationNameがnullになり、updatedAtが文字列の場合はそのまま使われる', async () => {
    mockGetAdminPesticides.mockResolvedValue({
      pesticides: [
        buildPesticideRow({
          formulationType: null,
          updatedAt: '2026-02-01T00:00:00.000Z',
        }),
      ],
      total: 1,
    })

    const result = await PesticideDataPage({ searchParams: Promise.resolve({}) })
    render(result)

    const row = screen.getByTestId('row-0')
    expect(row).toHaveAttribute('data-formulation', 'null')
    expect(row).toHaveAttribute('data-updated-at', '2026-02-01T00:00:00.000Z')
  })

  it('formulationTypeがある場合はその名前を使い、updatedAtがDateの場合はISO文字列に変換する', async () => {
    mockGetAdminPesticides.mockResolvedValue({
      pesticides: [
        buildPesticideRow({
          formulationType: { name: '水和剤' },
          updatedAt: new Date('2026-03-01T00:00:00.000Z'),
        }),
      ],
      total: 1,
    })

    const result = await PesticideDataPage({ searchParams: Promise.resolve({}) })
    render(result)

    const row = screen.getByTestId('row-0')
    expect(row).toHaveAttribute('data-formulation', '水和剤')
    expect(row).toHaveAttribute('data-updated-at', '2026-03-01T00:00:00.000Z')
  })
})
