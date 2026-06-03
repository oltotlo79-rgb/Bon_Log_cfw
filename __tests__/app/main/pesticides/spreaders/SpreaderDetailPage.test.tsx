import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetPesticideBySlug = vi.fn()
const mockGetSpreaderTypeBySlug = vi.fn()
vi.mock('@/lib/actions/pesticide', () => ({
  getPesticideBySlug: (slug: string) => mockGetPesticideBySlug(slug),
  getSpreaderTypeBySlug: (slug: string) => mockGetSpreaderTypeBySlug(slug),
}))

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
  redirect: (url: string) => mockRedirect(url),
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

function makeSpreaderType(overrides: Record<string, unknown> = {}) {
  return {
    id: 'st1',
    name: 'パラフィン型',
    slug: 'paraffin',
    description: '石油系展着剤です。',
    effect: '展着・固着効果があります。',
    usageNote: '高温時の使用は避けてください。',
    ...overrides,
  }
}

describe('SpreaderDetailPage', () => {
  let Page: typeof import('@/app/(main)/pesticides/spreaders/[slug]/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/spreaders/[slug]/page')
    Page = mod.default
  })

  it('slugが製品に一致する場合は製品詳細にリダイレクトする', async () => {
    mockGetPesticideBySlug.mockResolvedValue({ id: 'p1', name: 'メイリノ', slug: 'mairino' })

    await expect(
      Page({ params: Promise.resolve({ slug: 'mairino' }) })
    ).rejects.toThrow('REDIRECT:/pesticides/products/mairino')

    expect(mockRedirect).toHaveBeenCalledWith('/pesticides/products/mairino')
  })

  it('展着剤型の詳細ページを正しく表示する', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    mockGetSpreaderTypeBySlug.mockResolvedValue(makeSpreaderType())

    const result = await Page({ params: Promise.resolve({ slug: 'paraffin' }) })
    render(result)

    expect(screen.getByRole('heading', { name: 'パラフィン型' })).toBeInTheDocument()
    expect(screen.getByText('石油系展着剤です。')).toBeInTheDocument()
    expect(screen.getByText('展着・固着効果があります。')).toBeInTheDocument()
    expect(screen.getByText('高温時の使用は避けてください。')).toBeInTheDocument()
  })

  it('descriptionがない場合は概要セクションを表示しない', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    mockGetSpreaderTypeBySlug.mockResolvedValue(
      makeSpreaderType({ description: null })
    )

    const result = await Page({ params: Promise.resolve({ slug: 'paraffin' }) })
    render(result)

    expect(screen.queryByText('概要')).not.toBeInTheDocument()
  })

  it('effectがない場合は効果セクションを表示しない', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    mockGetSpreaderTypeBySlug.mockResolvedValue(
      makeSpreaderType({ effect: null })
    )

    const result = await Page({ params: Promise.resolve({ slug: 'paraffin' }) })
    render(result)

    expect(screen.queryByText('効果')).not.toBeInTheDocument()
  })

  it('展着剤型が見つからない場合はnotFoundを呼ぶ', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    mockGetSpreaderTypeBySlug.mockResolvedValue(null)

    await expect(
      Page({ params: Promise.resolve({ slug: 'unknown' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  it('戻るリンクが展着剤一覧を指している', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    mockGetSpreaderTypeBySlug.mockResolvedValue(makeSpreaderType())

    const result = await Page({ params: Promise.resolve({ slug: 'paraffin' }) })
    render(result)

    expect(screen.getByRole('link', { name: /展着剤一覧/ })).toHaveAttribute(
      'href',
      '/pesticides/spreaders'
    )
  })

  it('usageNoteがない場合は利用時の注意セクションを表示しない', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    mockGetSpreaderTypeBySlug.mockResolvedValue(
      makeSpreaderType({ usageNote: null })
    )

    const result = await Page({ params: Promise.resolve({ slug: 'paraffin' }) })
    render(result)

    expect(screen.queryByText('利用時の注意')).not.toBeInTheDocument()
  })
})

describe('SpreaderDetailPage - generateMetadata', () => {
  let generateMetadata: typeof import('@/app/(main)/pesticides/spreaders/[slug]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/spreaders/[slug]/page')
    generateMetadata = mod.generateMetadata
  })

  it('slugが製品に一致する場合は製品名を含むメタデータを返す', async () => {
    mockGetPesticideBySlug.mockResolvedValue({ id: 'p1', name: 'メイリノ', slug: 'mairino' })

    const result = await generateMetadata({ params: Promise.resolve({ slug: 'mairino' }) })

    const { BASE_URL } = await import('@/lib/constants/routes')
    expect(result).toEqual({
      title: 'メイリノ - 展着剤',
      alternates: { canonical: `${BASE_URL}/pesticides/spreaders/mairino` },
    })
  })

  it('slugが展着剤型に一致する場合は型名を含むメタデータを返す', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    mockGetSpreaderTypeBySlug.mockResolvedValue({ id: 'st1', name: 'パラフィン型', slug: 'paraffin' })

    const result = await generateMetadata({ params: Promise.resolve({ slug: 'paraffin' }) })

    const { BASE_URL } = await import('@/lib/constants/routes')
    expect(result).toEqual({
      title: 'パラフィン型の展着剤',
      alternates: { canonical: `${BASE_URL}/pesticides/spreaders/paraffin` },
    })
  })

  it('どちらにも一致しない場合は見つからないメタデータを返す', async () => {
    mockGetPesticideBySlug.mockResolvedValue(null)
    mockGetSpreaderTypeBySlug.mockResolvedValue(null)

    const result = await generateMetadata({ params: Promise.resolve({ slug: 'unknown' }) })

    expect(result).toEqual({ title: '展着剤が見つかりません' })
  })
})

describe('SpreaderDetailPage - generateStaticParams', () => {
  let generateStaticParams: typeof import('@/app/(main)/pesticides/spreaders/[slug]/page').generateStaticParams

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/spreaders/[slug]/page')
    generateStaticParams = mod.generateStaticParams
  })

  it('DB例外時は空配列を返す', async () => {
    // prisma.spreaderType is not in the global mock, so findMany will throw
    // The catch block in generateStaticParams should return []
    const result = await generateStaticParams()

    expect(result).toEqual([])
  })
})
