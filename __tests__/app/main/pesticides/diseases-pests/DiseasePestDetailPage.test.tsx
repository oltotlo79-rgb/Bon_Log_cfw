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
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <svg data-testid="icon-chevron-left" />,
  BookOpen: () => <svg data-testid="icon-book-open" />,
  FlaskConical: () => <svg data-testid="icon-flask" />,
}))
vi.mock('@/lib/db', () => ({
  prisma: { diseasePest: { findMany: vi.fn().mockResolvedValue([]) } },
}))
vi.mock('@/lib/utils/pesticide-badge', () => ({
  CATEGORY_BADGE: {
    disease: { label: '病害', className: 'bg-rose-100 text-rose-700' },
    pest: { label: '害虫', className: 'bg-amber-100 text-amber-700' },
    beneficial_insect: { label: '益虫', className: 'bg-emerald-100 text-emerald-700' },
  },
}))
vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="disclaimer" />,
}))
vi.mock('@/components/pesticide/EffectRatingBadge', () => ({
  EffectRatingBadge: ({ label }: { label: string }) => <span data-testid={`badge-${label}`} />,
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

describe('DiseasePestDetailPage', () => {
  let Page: typeof import('@/app/(main)/pesticides/diseases-pests/[slug]/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/diseases-pests/[slug]/page')
    Page = mod.default
  })

  it('病害の詳細ページを正しく表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest())
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)

    expect(screen.getByRole('heading', { name: 'うどんこ病' })).toBeInTheDocument()
    expect(screen.getByText('うどんこびょう')).toBeInTheDocument()
    expect(screen.getByText('病害')).toBeInTheDocument()
    expect(screen.getByText('カビによる病害です。')).toBeInTheDocument()
  })

  it('imageUrlがある場合はDiseasePestImageLightboxを表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({ imageUrl: 'https://example.com/img.jpg' })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByTestId('lightbox-image')).toBeInTheDocument()
  })

  it('imageUrlがない場合は絵文字プレースホルダーを表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest({ imageUrl: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.queryByTestId('lightbox-image')).not.toBeInTheDocument()
    expect(screen.getByText('🦠')).toBeInTheDocument()
  })

  it('害虫カテゴリは🐛絵文字を使う', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({ category: 'pest', imageUrl: null })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'pest-slug' }) })
    render(result)
    expect(screen.getByText('🐛')).toBeInTheDocument()
    expect(screen.getByText('害虫')).toBeInTheDocument()
  })

  it('益虫カテゴリは🐝絵文字を使い「益虫」バッジを表示する', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({ category: 'beneficial_insect', imageUrl: null })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'bee-slug' }) })
    render(result)
    expect(screen.getByText('🐝')).toBeInTheDocument()
    expect(screen.getByText('益虫')).toBeInTheDocument()
  })

  it('効果のある薬剤を表示する（殺菌剤は予防・治療・持続バッジ）', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(
      makeDiseasePest({
        effects: [
          {
            preventionLevel: 3,
            treatmentLevel: 2,
            efficacyLevel: null,
            persistenceLevel: 4,
            pesticide: {
              id: 'p1',
              name: 'トリフミン乳剤',
              slug: 'trifumin-ec',
              pesticideType: 'fungicide',
              registrationNumber: '12345',
              formulationType: { name: '乳剤' },
              ingredients: [],
            },
          },
        ],
      })
    )
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)

    expect(screen.getByText('効く薬剤')).toBeInTheDocument()
    expect(screen.getByText('(1件)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /トリフミン乳剤/ })).toHaveAttribute(
      'href',
      '/pesticides/products/trifumin-ec'
    )
    expect(screen.getByTestId('badge-予防')).toBeInTheDocument()
    expect(screen.getByTestId('badge-治療')).toBeInTheDocument()
    expect(screen.getByTestId('badge-持続')).toBeInTheDocument()
  })

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
              id: 'p2',
              name: 'テスト薬剤',
              slug: 'test-drug',
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
    expect(screen.getByText('関連薬剤')).toBeInTheDocument()
    expect(screen.getByText('(1件)')).toBeInTheDocument()
  })

  it('病害虫が見つからない場合はnotFoundを呼ぶ', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(null)
    await expect(
      Page({ params: Promise.resolve({ slug: 'unknown' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('戻るリンクが病害虫図鑑を指している', async () => {
    mockGetDiseasePestBySlug.mockResolvedValue(makeDiseasePest())
    const result = await Page({ params: Promise.resolve({ slug: 'powdery-mildew' }) })
    render(result)
    expect(screen.getByRole('link', { name: /病害虫・益虫図鑑/ })).toHaveAttribute(
      'href',
      '/pesticides/diseases-pests'
    )
  })
})
