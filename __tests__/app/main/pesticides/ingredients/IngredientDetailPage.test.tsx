import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetActiveIngredientBySlug = vi.fn()
vi.mock('@/lib/actions/pesticide', () => ({
  getActiveIngredientBySlug: (slug: string) => mockGetActiveIngredientBySlug(slug),
}))
vi.mock('@/lib/utils/pesticide', () => ({
  getResistanceRiskLabel: (risk: string) => {
    const labels: Record<string, string> = { low: 'つきにくい', medium: 'ややつきやすい', high: 'つきやすい' }
    return labels[risk] ?? null
  },
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="disclaimer" />,
}))

import { notFound } from 'next/navigation'

function makeIngredient(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ing1',
    name: 'トリフルミゾール',
    slug: 'triflumizole',
    nameEn: 'Triflumizole',
    fracCode: 'G1',
    iracCode: null,
    ingredientGroup: 'DMI系',
    resistanceRisk: 'medium',
    description: null,
    pesticides: [],
    ...overrides,
  }
}

describe('IngredientDetailPage', () => {
  let Page: typeof import('@/app/(main)/pesticides/ingredients/[slug]/page').default
  let generateMetadata: typeof import('@/app/(main)/pesticides/ingredients/[slug]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/ingredients/[slug]/page')
    Page = mod.default
    generateMetadata = mod.generateMetadata
  }, 20000)

  // --- generateMetadata ---
  it('generateMetadata: 原体が見つかった場合はタイトルを返す', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient())
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'triflumizole' }) })
    expect(meta.title).toBe('トリフルミゾール - 原体詳細')
  })

  it('generateMetadata: 原体が見つからない場合はフォールバックタイトル', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(null)
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'unknown' }) })
    expect(meta.title).toBe('原体が見つかりません')
  })

  it('generateMetadata: description が無い場合は分類と収載薬剤数から description を生成する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(
      makeIngredient({
        description: null,
        fracCode: 'G1',
        ingredientGroup: 'DMI系',
        pesticides: [{ contentLabel: null, pesticide: { id: 'p1', name: '薬剤A', slug: 'a', formulationType: null } }],
      })
    )
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'triflumizole' }) })
    expect(meta.description).toContain('FRAC G1')
    expect(meta.description).toContain('1件')
  })

  it('generateMetadata: description があればそれを優先して使う', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(
      makeIngredient({ description: 'DMI系の殺菌剤で予防効果が高い。' })
    )
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'triflumizole' }) })
    expect(meta.description).toContain('DMI系の殺菌剤')
  })

  it('generateMetadata: OpenGraph と Twitter カードを設定する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient())
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'triflumizole' }) })
    expect(meta.openGraph?.title).toBe('トリフルミゾール - 原体詳細')
    expect(meta.openGraph).toHaveProperty('images')
    expect((meta.twitter as Record<string, unknown> | undefined)?.card).toBe('summary_large_image')
  })

  it('パンくず・DefinedTerm の構造化データを出力する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient())
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    const { container } = render(result)
    const scripts = container.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts.length).toBeGreaterThanOrEqual(2)
    const json = Array.from(scripts).map((s) => s.innerHTML).join('')
    expect(json).toContain('BreadcrumbList')
    expect(json).toContain('DefinedTerm')
    // 末尾要素の URL に slug が含まれる（ASCII なので unicode エスケープの影響を受けない）。
    expect(json).toContain('triflumizole')
  })

  // --- notFound ---
  it('原体が見つからない場合はnotFoundを呼ぶ', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(null)
    await expect(
      Page({ params: Promise.resolve({ slug: 'unknown' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  // --- basic info ---
  it('原体名と英名を表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient())
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByRole('heading', { name: 'トリフルミゾール' })).toBeInTheDocument()
    expect(screen.getByText('Triflumizole')).toBeInTheDocument()
  })

  it('nameEnがnullの場合は英名を表示しない', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ nameEn: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByRole('heading', { name: 'トリフルミゾール' })).toBeInTheDocument()
    expect(screen.queryByText('Triflumizole')).not.toBeInTheDocument()
  })

  // --- fracCode ---
  it('FRACコードがある場合は表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ fracCode: 'G1' }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('FRACコード')).toBeInTheDocument()
    expect(screen.getByText('G1')).toBeInTheDocument()
  })

  it('FRACコードがnullの場合は非表示', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ fracCode: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.queryByText('FRACコード')).not.toBeInTheDocument()
  })

  // --- iracCode ---
  it('IRACコードがある場合は表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ iracCode: '4A' }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('IRACコード')).toBeInTheDocument()
    expect(screen.getByText('4A')).toBeInTheDocument()
  })

  it('IRACコードがnullの場合は非表示', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ iracCode: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.queryByText('IRACコード')).not.toBeInTheDocument()
  })

  // --- ingredientGroup ---
  it('原体グループがある場合は表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ ingredientGroup: 'DMI系' }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('原体グループ')).toBeInTheDocument()
    expect(screen.getByText('DMI系')).toBeInTheDocument()
  })

  it('原体グループがnullの場合は非表示', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ ingredientGroup: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.queryByText('原体グループ')).not.toBeInTheDocument()
  })

  // --- resistanceRisk ---
  it('耐性リスクがある場合はラベルを表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ resistanceRisk: 'high' }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('耐性がつきやすいか')).toBeInTheDocument()
    expect(screen.getByText('つきやすい')).toBeInTheDocument()
  })

  it('耐性リスクがnullの場合は非表示', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ resistanceRisk: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.queryByText('耐性がつきやすいか')).not.toBeInTheDocument()
  })

  // --- description ---
  it('descriptionがある場合は詳細説明セクションを表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(
      makeIngredient({ description: 'DMI系の殺菌剤です。' })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('原体の詳細説明')).toBeInTheDocument()
    expect(screen.getByText('DMI系の殺菌剤です。')).toBeInTheDocument()
  })

  it('descriptionが複数段落の場合はそれぞれpタグで表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(
      makeIngredient({ description: '段落1です。\n\n段落2です。\n\n段落3です。' })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('段落1です。')).toBeInTheDocument()
    expect(screen.getByText('段落2です。')).toBeInTheDocument()
    expect(screen.getByText('段落3です。')).toBeInTheDocument()
  })

  it('descriptionがnullの場合は詳細説明セクションを表示しない', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ description: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.queryByText('原体の詳細説明')).not.toBeInTheDocument()
  })

  // --- pesticides list ---
  it('含む薬剤一覧を表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(
      makeIngredient({
        pesticides: [
          {
            contentLabel: '15%',
            pesticide: {
              id: 'p1',
              name: 'トリフミン乳剤',
              slug: 'trifumin-ec',
              formulationType: { name: '乳剤' },
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('この原体を含む薬剤 (1件)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /トリフミン乳剤/ })).toHaveAttribute(
      'href',
      '/pesticides/products/trifumin-ec'
    )
    expect(screen.getByText('15%')).toBeInTheDocument()
    expect(screen.getByText('乳剤')).toBeInTheDocument()
  })

  it('薬剤のcontentLabelがnullの場合は含有量を表示しない', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(
      makeIngredient({
        pesticides: [
          {
            contentLabel: null,
            pesticide: {
              id: 'p2',
              name: 'テスト薬剤',
              slug: 'test-drug',
              formulationType: null,
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('テスト薬剤')).toBeInTheDocument()
    expect(screen.queryByText('15%')).not.toBeInTheDocument()
  })

  it('薬剤のformulationTypeがnullの場合は剤型を表示しない', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(
      makeIngredient({
        pesticides: [
          {
            contentLabel: '10%',
            pesticide: {
              id: 'p3',
              name: '剤型なし薬剤',
              slug: 'no-form',
              formulationType: null,
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('剤型なし薬剤')).toBeInTheDocument()
    expect(screen.queryByText('乳剤')).not.toBeInTheDocument()
  })

  it('薬剤リストが空の場合はセクションを表示しない', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient({ pesticides: [] }))
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.queryByText(/この原体を含む薬剤/)).not.toBeInTheDocument()
  })

  it('複数の薬剤がある場合は件数を正しく表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(
      makeIngredient({
        pesticides: [
          { contentLabel: '10%', pesticide: { id: 'p1', name: '薬剤A', slug: 'a', formulationType: null } },
          { contentLabel: '20%', pesticide: { id: 'p2', name: '薬剤B', slug: 'b', formulationType: { name: '水和剤' } } },
          { contentLabel: null, pesticide: { id: 'p3', name: '薬剤C', slug: 'c', formulationType: null } },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByText('この原体を含む薬剤 (3件)')).toBeInTheDocument()
    expect(screen.getByText('薬剤A')).toBeInTheDocument()
    expect(screen.getByText('薬剤B')).toBeInTheDocument()
    expect(screen.getByText('薬剤C')).toBeInTheDocument()
  })

  // --- back link ---
  it('戻るリンクが原体一覧を指している', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient())
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByRole('link', { name: /原体一覧/ })).toHaveAttribute(
      'href',
      '/pesticides/ingredients'
    )
  })

  // --- disclaimer ---
  it('PesticideDisclaimerが表示される', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(makeIngredient())
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
  })

  // --- all optional fields null ---
  it('全てのオプショナルフィールドがnullの場合も正しく表示する', async () => {
    mockGetActiveIngredientBySlug.mockResolvedValue(
      makeIngredient({
        nameEn: null,
        fracCode: null,
        iracCode: null,
        ingredientGroup: null,
        resistanceRisk: null,
        description: null,
        pesticides: [],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'triflumizole' }) })
    render(result)
    expect(screen.getByRole('heading', { name: 'トリフルミゾール' })).toBeInTheDocument()
    expect(screen.queryByText('FRACコード')).not.toBeInTheDocument()
    expect(screen.queryByText('IRACコード')).not.toBeInTheDocument()
    expect(screen.queryByText('原体グループ')).not.toBeInTheDocument()
    expect(screen.queryByText('耐性がつきやすいか')).not.toBeInTheDocument()
    expect(screen.queryByText('原体の詳細説明')).not.toBeInTheDocument()
    expect(screen.queryByText(/この原体を含む薬剤/)).not.toBeInTheDocument()
  })
})
