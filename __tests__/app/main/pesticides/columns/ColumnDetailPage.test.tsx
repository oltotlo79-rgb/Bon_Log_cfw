import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetColumnBySlug = vi.fn()
vi.mock('@/lib/actions/pesticide', () => ({
  getColumnBySlug: (slug: string) => mockGetColumnBySlug(slug),
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('lucide-react', () => ({
  ChevronLeft: () => <svg data-testid="chevron-left" />,
}))
vi.mock('@/components/pesticide/PesticideDisclaimer', () => ({
  PesticideDisclaimer: () => <div data-testid="disclaimer" />,
}))
vi.mock('@/components/seo/ArticleJsonLd', () => ({
  ArticleJsonLd: () => null,
}))

import { notFound } from 'next/navigation'

function makeColumn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'col-1',
    title: 'テストコラム',
    slug: 'test-column',
    category: 'general',
    content: 'コラムの本文です。詳細な農薬知識を説明します。',
    publishedAt: new Date('2026-03-01'),
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-15'),
    ...overrides,
  }
}

describe('ColumnDetailPage', () => {
  let Page: typeof import('@/app/(main)/pesticides/columns/[slug]/page').default
  let generateMetadata: typeof import('@/app/(main)/pesticides/columns/[slug]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/columns/[slug]/page')
    Page = mod.default
    generateMetadata = mod.generateMetadata
  })

  it('コラム詳細を正しく表示する', async () => {
    mockGetColumnBySlug.mockResolvedValue(makeColumn())
    const result = await Page({ params: Promise.resolve({ slug: 'test-column' }) })
    render(result)
    expect(screen.getByRole('heading', { name: 'テストコラム' })).toBeInTheDocument()
    expect(screen.getByText('コラムの本文です。詳細な農薬知識を説明します。')).toBeInTheDocument()
  })

  it('publishedAt があれば日付が表示される', async () => {
    mockGetColumnBySlug.mockResolvedValue(makeColumn({ publishedAt: new Date('2026-03-01') }))
    const result = await Page({ params: Promise.resolve({ slug: 'test-column' }) })
    render(result)
    expect(screen.getByText('2026/3/1')).toBeInTheDocument()
  })

  it('publishedAt が null のとき日付は表示されない', async () => {
    mockGetColumnBySlug.mockResolvedValue(makeColumn({ publishedAt: null }))
    const result = await Page({ params: Promise.resolve({ slug: 'test-column' }) })
    render(result)
    expect(screen.getByRole('heading', { name: 'テストコラム' })).toBeInTheDocument()
  })

  it('コラム一覧へのリンクが存在する', async () => {
    mockGetColumnBySlug.mockResolvedValue(makeColumn())
    const result = await Page({ params: Promise.resolve({ slug: 'test-column' }) })
    render(result)
    const link = screen.getByRole('link', { name: /コラム一覧/ })
    expect(link).toHaveAttribute('href', '/pesticides/columns')
  })

  it('免責事項コンポーネントが表示される', async () => {
    mockGetColumnBySlug.mockResolvedValue(makeColumn())
    const result = await Page({ params: Promise.resolve({ slug: 'test-column' }) })
    render(result)
    expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
  })

  it('コラムが見つからない場合は notFound を呼ぶ', async () => {
    mockGetColumnBySlug.mockResolvedValue(null)
    await expect(
      Page({ params: Promise.resolve({ slug: 'nonexistent' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  describe('generateMetadata', () => {
    it('コラムが見つかった場合はタイトルを返す', async () => {
      mockGetColumnBySlug.mockResolvedValue(makeColumn({ title: '農薬混用ガイド' }))
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'test-column' }) })
      expect(metadata.title).toBe('農薬混用ガイド - コラム - BON-LOG')
    })

    it('コラムが見つからない場合はフォールバックタイトルを返す', async () => {
      mockGetColumnBySlug.mockResolvedValue(null)
      const metadata = await generateMetadata({ params: Promise.resolve({ slug: 'nonexistent' }) })
      expect(metadata.title).toBe('コラムが見つかりません - BON-LOG')
    })
  })
})
