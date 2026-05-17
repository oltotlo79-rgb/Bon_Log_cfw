import React from 'react'
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetPesticideBySlug = vi.fn()
vi.mock('@/lib/actions/pesticide', () => ({
  getPesticideBySlug: (slug: string) => mockGetPesticideBySlug(slug),
}))
vi.mock('@/lib/utils/pesticide', () => ({
  getMaffUrl: (num: string) => `https://pesticide.maff.go.jp/agricultural-chemicals/details/${num}`,
  getResistanceRiskLabel: () => null,
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('@/components/pesticide/EffectRatingBadge', () => ({
  EffectRatingBadge: () => <span data-testid="effect-rating-badge" />,
}))

import { notFound } from 'next/navigation'

function makePesticide(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'トリフミン乳剤',
    slug: 'trifumin-ec',
    pesticideType: 'fungicide' as const,
    description: null,
    registrationNumber: '12345',
    formulationType: { name: '乳剤' },
    ingredients: [],
    effects: [],
    incompatibleWith: [],
    spreaderTypes: [],
    ...overrides,
  }
}

describe('PesticideDetailPage', () => {
  let Page: typeof import('@/app/(main)/pesticides/products/[slug]/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/products/[slug]/page')
    Page = mod.default
  })

  it('展着剤のみの場合は展着剤の分類を表示し、効果のある病害虫セクションを表示しない', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        name: 'メイリノ',
        slug: 'mairino',
        pesticideType: 'other',
        spreaderTypes: [
          { spreaderType: { id: 'st1', name: 'パラフィン型', slug: 'paraffin' } },
        ],
      })
    )

    const result = await Page({ params: Promise.resolve({ slug: 'mairino' }) })
    render(result)

    expect(screen.getByText('展着剤の分類')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'パラフィン型' })).toHaveAttribute(
      'href',
      '/pesticides/spreaders?type=paraffin'
    )
    expect(screen.queryByText('効果のある病害虫')).not.toBeInTheDocument()
    expect(screen.queryByText('耐性がつきやすいか')).not.toBeInTheDocument()
  })

  it('通常の薬剤の場合は耐性がつきやすいかと効果のある病害虫を表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(
      makePesticide({
        spreaderTypes: [],
        effects: [],
      })
    )

    const result = await Page({ params: Promise.resolve({ slug: 'trifumin-ec' }) })
    render(result)

    expect(screen.getByText('耐性がつきやすいか')).toBeInTheDocument()
    expect(screen.getByText('効果のある病害虫')).toBeInTheDocument()
    expect(screen.queryByText('展着剤の分類')).not.toBeInTheDocument()
  })

  it('薬剤が見つからない場合は notFound を呼ぶ', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)

    await expect(Page({ params: Promise.resolve({ slug: 'unknown' }) })).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })
})
