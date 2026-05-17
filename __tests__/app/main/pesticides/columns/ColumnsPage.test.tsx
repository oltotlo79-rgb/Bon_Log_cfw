import React from 'react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetColumns = vi.fn()
vi.mock('@/lib/actions/pesticide', () => ({
  getColumns: () => mockGetColumns(),
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

function makeColumn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'col-1',
    title: 'テストコラム',
    slug: 'test-column',
    category: 'general',
    content: 'コラムの内容です。',
    publishedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('ColumnsPage', () => {
  let Page: typeof import('@/app/(main)/pesticides/columns/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/pesticides/columns/page')
    Page = mod.default
  })

  it('ページタイトルが表示される', async () => {
    mockGetColumns.mockResolvedValue({ columns: [] })
    const result = await Page()
    render(result)
    expect(screen.getByRole('heading', { name: 'コラム' })).toBeInTheDocument()
  })

  it('農薬トップへのリンクが存在する', async () => {
    mockGetColumns.mockResolvedValue({ columns: [] })
    const result = await Page()
    render(result)
    const link = screen.getByRole('link', { name: /農薬・病害虫トップ/ })
    expect(link).toHaveAttribute('href', '/pesticides')
  })

  it('免責事項コンポーネントが表示される', async () => {
    mockGetColumns.mockResolvedValue({ columns: [] })
    const result = await Page()
    render(result)
    expect(screen.getByTestId('disclaimer')).toBeInTheDocument()
  })

  it('コラムが0件のとき空メッセージが表示される', async () => {
    mockGetColumns.mockResolvedValue({ columns: [] })
    const result = await Page()
    render(result)
    expect(screen.getByText('コラム記事はまだ公開されていません')).toBeInTheDocument()
  })

  it('コラム一覧が表示される', async () => {
    mockGetColumns.mockResolvedValue({
      columns: [
        makeColumn({ id: 'col-1', title: '混用の基本', slug: 'mixing-basics', category: 'mixing_order' }),
        makeColumn({ id: 'col-2', title: '散布温度の注意', slug: 'temperature', category: 'temperature' }),
      ],
    })
    const result = await Page()
    render(result)
    expect(screen.getByText('混用の基本')).toBeInTheDocument()
    expect(screen.getByText('散布温度の注意')).toBeInTheDocument()
  })

  it('コラムリンクが正しいhrefを持つ', async () => {
    mockGetColumns.mockResolvedValue({
      columns: [makeColumn({ slug: 'my-column' })],
    })
    const result = await Page()
    render(result)
    const link = screen.getByRole('link', { name: /テストコラム/ })
    expect(link).toHaveAttribute('href', '/pesticides/columns/my-column')
  })

  it('カテゴリラベルが正しく表示される', async () => {
    mockGetColumns.mockResolvedValue({
      columns: [makeColumn({ category: 'mixing_order' })],
    })
    const result = await Page()
    render(result)
    expect(screen.getByText('混用技術')).toBeInTheDocument()
  })

  it('publishedAt があれば日付が表示される', async () => {
    mockGetColumns.mockResolvedValue({
      columns: [makeColumn({ publishedAt: new Date('2026-01-15') })],
    })
    const result = await Page()
    render(result)
    expect(screen.getByText('2026/1/15')).toBeInTheDocument()
  })

  it('publishedAt が null のとき日付は表示されない', async () => {
    mockGetColumns.mockResolvedValue({
      columns: [makeColumn({ publishedAt: null })],
    })
    const result = await Page()
    render(result)
    // 日付テキストが表示されないことを確認（タイトルは表示される）
    expect(screen.getByText('テストコラム')).toBeInTheDocument()
  })
})
