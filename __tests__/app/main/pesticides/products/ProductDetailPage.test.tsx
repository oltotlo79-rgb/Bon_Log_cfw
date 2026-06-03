import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetPesticideBySlug = vi.fn()
vi.mock('@/lib/actions/pesticide', () => ({
  getPesticideBySlug: (slug: string) => mockGetPesticideBySlug(slug),
}))
vi.mock('@/lib/utils/pesticide', () => ({
  getMaffUrl: (num: string) => `https://pesticide.maff.go.jp/agricultural-chemicals/details/${num}`,
  getResistanceRiskLabel: (risk: string) => {
    const labels: Record<string, string> = { low: 'つきにくい', medium: 'ややつきやすい', high: 'つきやすい' }
    return labels[risk] ?? null
  },
  RESISTANCE_RISK_ORDER: { high: 3, medium: 2, low: 1 },
}))
vi.mock('@/lib/utils/pesticide-badge', () => ({
  PESTICIDE_TYPE_BADGE: {
    fungicide: { label: '殺菌剤', className: 'badge-fungicide' },
    insecticide: { label: '殺虫剤', className: 'badge-insecticide' },
    acaricide: { label: '殺ダニ剤', className: 'badge-acaricide' },
    compound: { label: '複合剤', className: 'badge-compound' },
    other: { label: 'その他', className: 'badge-other' },
    spreader: { label: '展着剤', className: 'badge-spreader' },
  },
  CATEGORY_BADGE: {
    disease: { label: '病害', className: 'badge-disease' },
    pest: { label: '害虫', className: 'badge-pest' },
    beneficial_insect: { label: '益虫', className: 'badge-beneficial' },
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
vi.mock('@/components/pesticide/EffectRatingBadge', () => ({
  EffectRatingBadge: ({ label, rating }: { label: string; rating: unknown }) => (
    <span data-testid={`badge-${label}`} data-rating={String(rating)} />
  ),
}))

import { notFound } from 'next/navigation'

function makePesticide(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'トリフミン乳剤',
    slug: 'trifumin-ec',
    pesticideType: 'fungicide',
    description: null,
    registrationNumber: '12345',
    formulationType: { code: 'EC', name: '乳剤' },
    ingredients: [],
    effects: [],
    incompatibleWith: [],
    spreaderTypes: [],
    ...overrides,
  }
}

describe('ProductDetailPage (branches)', () => {
  let Page: typeof import('@/app/(main)/pesticides/products/[slug]/page').default
  let generateMetadata: typeof import('@/app/(main)/pesticides/products/[slug]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/products/[slug]/page')
    Page = mod.default
    generateMetadata = mod.generateMetadata
  }, 20000)

  // --- generateMetadata ---
  it('generateMetadata: 薬剤が見つかった場合はタイトルを返す', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide())
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    expect(meta.title).toBe('トリフミン乳剤 - 薬剤詳細')
  })

  it('generateMetadata: 薬剤が見つからない場合はフォールバックタイトル', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'unknown' }) })
    expect(meta.title).toBe('薬剤が見つかりません')
  })

  // --- notFound ---
  it('薬剤が見つからない場合はnotFoundを呼ぶ', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    await expect(Page({ params: Promise.resolve({ slug: 'unknown' }) })).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  // --- description conditional ---
  it('descriptionがある場合は表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide({ description: 'テスト説明文' }))
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('テスト説明文')).toBeInTheDocument()
  })

  it('descriptionがnullの場合は説明文を表示しない', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide({ description: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.queryByText('テスト説明文')).not.toBeInTheDocument()
  })

  // --- registrationNumber ---
  it('登録番号がある場合は農林水産省リンクを表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide({ registrationNumber: '99999' }))
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('登録番号')).toBeInTheDocument()
    expect(screen.getByText(/99999（農林水産省）↗/)).toBeInTheDocument()
  })

  it('登録番号がnullの場合は登録番号を表示しない', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide({ registrationNumber: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.queryByText('登録番号')).not.toBeInTheDocument()
  })

  // --- formulationType ---
  it('剤型がある場合は表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide({ formulationType: { code: 'EC', name: '乳剤' } }))
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('剤型')).toBeInTheDocument()
    expect(screen.getByText('乳剤')).toBeInTheDocument()
  })

  it('剤型がnullの場合は剤型を表示しない', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide({ formulationType: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.queryByText('剤型')).not.toBeInTheDocument()
  })

  // --- resistance risk (non-spreader) ---
  it('耐性リスクがある成分を含む場合はラベルを表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        ingredients: [
          { contentLabel: '15%', activeIngredient: { slug: 'ing1', name: '成分A', fracCode: 'G1', iracCode: null, resistanceRisk: 'high' } },
        ],
        spreaderTypes: [],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('耐性がつきやすいか')).toBeInTheDocument()
  })

  it('全成分の耐性リスクがnullの場合は「—」を表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        ingredients: [
          { contentLabel: null, activeIngredient: { slug: 'ing1', name: '成分A', fracCode: null, iracCode: null, resistanceRisk: null } },
        ],
        spreaderTypes: [],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('耐性がつきやすいか')).toBeInTheDocument()
    // risk is null → renders "—"
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  // --- ingredients section ---
  it('成分がある場合は成分セクションを表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        ingredients: [
          { contentLabel: '15%', activeIngredient: { slug: 'ing1', name: '成分A', fracCode: 'G1', iracCode: null, resistanceRisk: 'low' } },
          { contentLabel: null, activeIngredient: { slug: 'ing2', name: '成分B', fracCode: null, iracCode: '4A', resistanceRisk: null } },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)

    expect(screen.getByText('成分（原体）')).toBeInTheDocument()
    expect(screen.getByText('成分A')).toBeInTheDocument()
    expect(screen.getByText('15%')).toBeInTheDocument()
    expect(screen.getByText(/FRAC: G1/)).toBeInTheDocument()
    expect(screen.getByText('成分B')).toBeInTheDocument()
    expect(screen.getByText(/IRAC: 4A/)).toBeInTheDocument()
  })

  it('成分が空配列の場合は成分セクションを表示しない', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide({ ingredients: [] }))
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.queryByText('成分（原体）')).not.toBeInTheDocument()
  })

  it('成分のcontentLabelがnullの場合は含有量を表示しない', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        ingredients: [
          { contentLabel: null, activeIngredient: { slug: 'ing1', name: '成分A', fracCode: null, iracCode: null, resistanceRisk: null } },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('成分A')).toBeInTheDocument()
    expect(screen.queryByText('15%')).not.toBeInTheDocument()
  })

  // --- incompatibleWith ---
  it('混用不可の農薬がある場合はリストを表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        incompatibleWith: [
          {
            incompatibleWithId: 'ic1',
            incompatibleWith: { slug: 'stone-lime', name: '石灰硫黄合剤', formulationType: { name: '液剤' } },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('石灰硫黄合剤')).toBeInTheDocument()
    expect(screen.getByText('液剤')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /石灰硫黄合剤/ })).toHaveAttribute(
      'href',
      '/pesticides/products/stone-lime'
    )
  })

  it('混用不可の農薬の剤型がnullの場合は空文字を表示', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        incompatibleWith: [
          {
            incompatibleWithId: 'ic1',
            incompatibleWith: { slug: 'stone-lime', name: '石灰硫黄合剤', formulationType: null },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('石灰硫黄合剤')).toBeInTheDocument()
  })

  it('混用不可の農薬が空の場合は「混用不可情報はありません」を表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide({ incompatibleWith: [] }))
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText(/特に登録・記載されている混用不可情報はありません/)).toBeInTheDocument()
  })

  // --- effects section ---
  it('効果のある病害虫をリスト表示する（殺菌剤: 予防・治療・持続バッジ）', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        pesticideType: 'fungicide',
        ingredients: [
          { contentLabel: null, activeIngredient: { slug: 'ing1', name: '成分A', fracCode: null, iracCode: null, resistanceRisk: 'medium' } },
        ],
        effects: [
          {
            id: 'e1',
            preventionLevel: 'A',
            treatmentLevel: 'B',
            efficacyLevel: null,
            persistenceLevel: 'C',
            diseasePest: { slug: 'powdery-mildew', name: 'うどんこ病', category: 'disease' },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)

    expect(screen.getByText('効果のある病害虫')).toBeInTheDocument()
    expect(screen.getByText('うどんこ病')).toBeInTheDocument()
    expect(screen.getByText('病害')).toBeInTheDocument()
    expect(screen.getByTestId('badge-予防')).toBeInTheDocument()
    expect(screen.getByTestId('badge-治療')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
  })

  it('効果のある病害虫（殺虫剤: 効果・持続バッジ）', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        pesticideType: 'insecticide',
        effects: [
          {
            id: 'e2',
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: 'A',
            persistenceLevel: 'B',
            diseasePest: { slug: 'aphid', name: 'アブラムシ', category: 'pest' },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('アブラムシ')).toBeInTheDocument()
    expect(screen.getByText('害虫')).toBeInTheDocument()
    expect(screen.getByTestId('badge-効果')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
    expect(screen.queryByTestId('badge-予防')).not.toBeInTheDocument()
  })

  it('効果のある病害虫（殺ダニ剤: 効果バッジ表示）', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        pesticideType: 'acaricide',
        effects: [
          {
            id: 'e3',
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: 'A',
            persistenceLevel: null,
            diseasePest: { slug: 'mite', name: 'ハダニ', category: 'pest' },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByTestId('badge-効果')).toBeInTheDocument()
  })

  it('効果のある病害虫（複合剤: 予防・治療・効果・持続バッジ全て）', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        pesticideType: 'compound',
        effects: [
          {
            id: 'e4',
            preventionLevel: 'A',
            treatmentLevel: 'B',
            efficacyLevel: 'C',
            persistenceLevel: 'D',
            diseasePest: { slug: 'dp1', name: '病害虫1', category: 'disease' },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByTestId('badge-予防')).toBeInTheDocument()
    expect(screen.getByTestId('badge-治療')).toBeInTheDocument()
    expect(screen.getByTestId('badge-効果')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
  })

  it('効果のある病害虫が空で展着剤でない場合はメッセージを表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({ effects: [], spreaderTypes: [] })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText(/効果のある病害虫のデータは登録されていません/)).toBeInTheDocument()
  })

  // --- spreader ---
  it('展着剤の場合は効果のある病害虫セクションを非表示にし展着剤分類を表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        pesticideType: 'other',
        spreaderTypes: [
          { spreaderType: { id: 'st1', slug: 'paraffin', name: 'パラフィン型' } },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'spreader-1' }) })
    render(result)
    expect(screen.getByText('展着剤の分類')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'パラフィン型' })).toHaveAttribute(
      'href',
      '/pesticides/spreaders?type=paraffin'
    )
    expect(screen.queryByText('効果のある病害虫')).not.toBeInTheDocument()
    expect(screen.queryByText('耐性がつきやすいか')).not.toBeInTheDocument()
  })

  // --- resistance risk from multiple ingredients ---
  it('複数成分の最大耐性リスクを使用する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        ingredients: [
          { contentLabel: null, activeIngredient: { slug: 'a', name: 'A', fracCode: null, iracCode: null, resistanceRisk: 'low' } },
          { contentLabel: null, activeIngredient: { slug: 'b', name: 'B', fracCode: null, iracCode: null, resistanceRisk: 'high' } },
        ],
        effects: [
          {
            id: 'e1',
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: null,
            persistenceLevel: null,
            diseasePest: { slug: 'dp1', name: '病害虫1', category: 'disease' },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    // resistance label should show "つきやすい" (high) in multiple places
    const labels = screen.getAllByText('つきやすい')
    expect(labels.length).toBeGreaterThanOrEqual(1)
  })

  it('耐性リスクがない場合は効果のある病害虫で「—」を表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        ingredients: [],
        effects: [
          {
            id: 'e1',
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: null,
            persistenceLevel: null,
            diseasePest: { slug: 'dp1', name: '病害虫1', category: 'disease' },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    // No resistance label → shows "—"
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(1)
  })

  // --- back link ---
  it('戻るリンクが農薬・病害虫トップを指している', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide())
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByRole('link', { name: /農薬・病害虫トップ/ })).toHaveAttribute('href', '/pesticides')
  })

  // --- pesticide type badge ---
  it('薬剤種別バッジが正しく表示される', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide({ pesticideType: 'insecticide' }))
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByText('殺虫剤')).toBeInTheDocument()
  })

  // --- disclaimer ---
  it('PesticideDisclaimerが表示される', async () => {
    mockGetPesticideBySlug.mockResolvedValue(makePesticide())
    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)
    expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
  })
})
