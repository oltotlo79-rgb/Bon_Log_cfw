import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetDiseasePestBySlug = vi.fn()
vi.mock('@/lib/actions/pesticide', () => ({
  getDiseasePestBySlug: (slug: string) => mockGetDiseasePestBySlug(slug),
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
vi.mock('@/components/pesticide/DiseasePestImageLightbox', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  DiseasePestImageLightbox: ({ alt }: { alt: string }) => <img alt={alt} data-testid="lightbox-image" />,
}))

import { notFound } from 'next/navigation'

function makeDiseasePest(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dp1',
    name: 'うどんこ病',
    slug: 'powdery-mildew',
    nameKana: 'うどんこびょう',
    category: 'disease' as const,
    description: 'カビによる病害です。',
    imageUrl: null,
    effects: [],
    ...overrides,
  }
}

describe('DiseasePestDetailPage (branches)', () => {
  let Page: typeof import('@/app/(main)/pesticides/diseases-pests/[slug]/page').default
  let generateMetadata: typeof import('@/app/(main)/pesticides/diseases-pests/[slug]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/diseases-pests/[slug]/page')
    Page = mod.default
    generateMetadata = mod.generateMetadata
  }, 20000)

  // --- generateMetadata ---
  it('generateMetadata: 病害虫が見つかった場合はタイトルを返す', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest())
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    expect(meta.title).toBe('うどんこ病 - 病害虫・益虫図鑑 - BON-LOG')
  })

  it('generateMetadata: 病害虫が見つからない場合はフォールバックタイトル', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(null)
    const meta = await generateMetadata({ params: Promise.resolve({ slug: 'unknown' }) })
    expect(meta.title).toBe('病害虫が見つかりません - BON-LOG')
  })

  // --- notFound ---
  it('病害虫が見つからない場合はnotFoundを呼ぶ', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(null)
    await expect(
      Page({ params: Promise.resolve({ slug: 'unknown' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  // --- description conditional ---
  it('descriptionがnullの場合は概要セクションを表示しない', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest({ description: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.queryByText('概要')).not.toBeInTheDocument()
  })

  it('descriptionがある場合は概要セクションを表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest({ description: '白い粉状のカビです。' }))
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByText('概要')).toBeInTheDocument()
    expect(screen.getByText('白い粉状のカビです。')).toBeInTheDocument()
  })

  // --- nameKana conditional ---
  it('nameKanaがnullの場合はカナ表示しない', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest({ nameKana: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.queryByText('うどんこびょう')).not.toBeInTheDocument()
  })

  it('nameKanaがある場合はカナを表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest({ nameKana: 'ウドンコビョウ' }))
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByText('ウドンコビョウ')).toBeInTheDocument()
  })

  // --- effects with different pesticideTypes ---
  it('殺虫剤の場合は効果バッジのみ表示し予防・治療は非表示', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({
        effects: [
          {
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: 'A',
            persistenceLevel: 'B',
            pesticide: {
              id: 'p1',
              name: '殺虫スプレー',
              slug: 'insect-spray',
              pesticideType: 'insecticide',
              registrationNumber: null,
              formulationType: null,
              ingredients: [],
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByTestId('badge-効果')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
    expect(screen.queryByTestId('badge-予防')).not.toBeInTheDocument()
    expect(screen.queryByTestId('badge-治療')).not.toBeInTheDocument()
  })

  it('殺ダニ剤の場合は効果バッジを表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({
        effects: [
          {
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: 'A',
            persistenceLevel: null,
            pesticide: {
              id: 'p2',
              name: 'ダニ剤',
              slug: 'acaricide-1',
              pesticideType: 'acaricide',
              registrationNumber: null,
              formulationType: null,
              ingredients: [],
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByTestId('badge-効果')).toBeInTheDocument()
  })

  it('複合剤の場合は予防・治療・効果・持続全バッジを表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({
        effects: [
          {
            preventionLevel: 'A',
            treatmentLevel: 'B',
            efficacyLevel: 'C',
            persistenceLevel: 'D',
            pesticide: {
              id: 'p3',
              name: '複合剤テスト',
              slug: 'compound-1',
              pesticideType: 'compound',
              registrationNumber: '55555',
              formulationType: { name: '水和剤' },
              ingredients: [
                { activeIngredient: { name: '成分X', fracCode: 'G1', iracCode: null } },
              ],
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByTestId('badge-予防')).toBeInTheDocument()
    expect(screen.getByTestId('badge-治療')).toBeInTheDocument()
    expect(screen.getByTestId('badge-効果')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
    expect(screen.getByText('No.55555')).toBeInTheDocument()
    expect(screen.getByText('水和剤')).toBeInTheDocument()
    expect(screen.getByText(/成分X/)).toBeInTheDocument()
    expect(screen.getByText(/\[FRAC:G1\]/)).toBeInTheDocument()
  })

  it('薬剤の成分にIRACコードがある場合表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({
        effects: [
          {
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: null,
            persistenceLevel: null,
            pesticide: {
              id: 'p4',
              name: 'テスト薬',
              slug: 'test-drug',
              pesticideType: 'other',
              registrationNumber: null,
              formulationType: null,
              ingredients: [
                { activeIngredient: { name: '成分Y', fracCode: null, iracCode: '4A' } },
              ],
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByText(/\[IRAC:4A\]/)).toBeInTheDocument()
  })

  // --- effects empty array ---
  it('効果がない場合はeffectsセクションを表示しない', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest({ effects: [] }))
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.queryByText(/効く薬剤/)).not.toBeInTheDocument()
    expect(screen.queryByText(/関連薬剤/)).not.toBeInTheDocument()
  })

  // --- ingredients empty ---
  it('薬剤の成分が空配列の場合は成分を非表示', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({
        effects: [
          {
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: null,
            persistenceLevel: null,
            pesticide: {
              id: 'p5',
              name: '成分なし薬',
              slug: 'no-ing',
              pesticideType: 'other',
              registrationNumber: null,
              formulationType: null,
              ingredients: [],
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByText('成分なし薬')).toBeInTheDocument()
  })

  // --- registrationNumber and formulationType conditionals ---
  it('薬剤の登録番号がない場合は表示しない', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({
        effects: [
          {
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: null,
            persistenceLevel: null,
            pesticide: {
              id: 'p6',
              name: 'テスト薬B',
              slug: 'test-b',
              pesticideType: 'other',
              registrationNumber: null,
              formulationType: null,
              ingredients: [],
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.queryByText(/No\./)).not.toBeInTheDocument()
  })

  // --- PesticideDisclaimer ---
  it('PesticideDisclaimerが表示される', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest())
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
  })

  // --- imageUrl conditional (with image) ---
  it('imageUrlがある場合はライトボックスを表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({ imageUrl: 'https://example.com/img.jpg' })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByTestId('lightbox-image')).toBeInTheDocument()
  })

  // --- beneficial_insect category heading ---
  it('益虫の場合は「関連薬剤」と表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({
        category: 'beneficial_insect',
        effects: [
          {
            preventionLevel: null,
            treatmentLevel: null,
            efficacyLevel: null,
            persistenceLevel: null,
            pesticide: {
              id: 'p7',
              name: 'テスト薬C',
              slug: 'test-c',
              pesticideType: 'other',
              registrationNumber: null,
              formulationType: null,
              ingredients: [],
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'bee-slug' }) })
    render(result)
    expect(screen.getByText(/関連薬剤/)).toBeInTheDocument()
  })

  // --- pest emoji ---
  it('害虫カテゴリは🐛絵文字と「害虫」バッジを使う', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({ category: 'pest', imageUrl: null })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'pest-slug' }) })
    render(result)
    expect(screen.getByText('🐛')).toBeInTheDocument()
    expect(screen.getByText('害虫')).toBeInTheDocument()
  })

  // --- disease emoji ---
  it('病害カテゴリは🦠絵文字と「病害」バッジを使う', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({ category: 'disease', imageUrl: null })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'disease-slug' }) })
    render(result)
    expect(screen.getByText('🦠')).toBeInTheDocument()
    expect(screen.getByText('病害')).toBeInTheDocument()
  })

  // --- beneficial_insect emoji ---
  it('益虫カテゴリは🐝絵文字と「益虫」バッジを使う', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({ category: 'beneficial_insect', imageUrl: null })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'bee-slug' }) })
    render(result)
    expect(screen.getByText('🐝')).toBeInTheDocument()
    expect(screen.getByText('益虫')).toBeInTheDocument()
  })

  // --- back link ---
  it('戻るリンクが病害虫・益虫図鑑を指している', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest())
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByRole('link', { name: /病害虫・益虫図鑑/ })).toHaveAttribute(
      'href',
      '/pesticides/diseases-pests'
    )
  })
})
