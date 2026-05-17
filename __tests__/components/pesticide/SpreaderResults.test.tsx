import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { SpreaderResults } from '@/app/(main)/pesticides/SpreaderResults'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('SpreaderResults', () => {
  it('0件のとき「展着剤データはまだ登録されていません」を表示する', () => {
    render(<SpreaderResults pesticides={[]} />)

    expect(screen.getByText('展着剤データはまだ登録されていません')).toBeInTheDocument()
    expect(screen.getByText('展着剤一覧')).toBeInTheDocument()
  })

  it('件数と一覧を表示する', () => {
    const pesticides = [
      {
        id: 'p1',
        name: '展着剤A',
        slug: 'spreader-a',
        registrationNumber: '12345',
        formulationType: { name: '液剤' },
      },
    ]
    render(<SpreaderResults pesticides={pesticides} />)

    expect(screen.getByText('展着剤一覧')).toBeInTheDocument()
    expect(screen.getByText('1件')).toBeInTheDocument()
    expect(screen.getByText('展着剤A')).toBeInTheDocument()
    expect(screen.getByText('液剤')).toBeInTheDocument()
    expect(screen.getByText('No.12345')).toBeInTheDocument()
  })

  it('各カードから製品詳細へのリンクを持つ', () => {
    const pesticides = [
      {
        id: 'p1',
        name: '展着剤B',
        slug: 'spreader-b',
        registrationNumber: null,
        formulationType: null,
      },
    ]
    render(<SpreaderResults pesticides={pesticides} />)

    const link = screen.getByRole('link', { name: /展着剤B/ })
    expect(link).toHaveAttribute('href', '/pesticides/products/spreader-b')
  })

  it('formulationType が null の場合は剤型を表示しない', () => {
    const pesticides = [
      {
        id: 'p1',
        name: '展着剤C',
        slug: 'spreader-c',
        registrationNumber: '99999',
        formulationType: null,
      },
    ]
    render(<SpreaderResults pesticides={pesticides} />)

    expect(screen.getByText('展着剤C')).toBeInTheDocument()
    expect(screen.getByText('No.99999')).toBeInTheDocument()
    expect(screen.queryByText('液剤')).not.toBeInTheDocument()
  })

  it('spreaderTypes がある場合に分類名を表示し、分類リンクを持つ', () => {
    const pesticides = [
      {
        id: 'p1',
        name: 'メイリノ',
        slug: 'mairino',
        registrationNumber: '12345',
        formulationType: { name: '液剤' },
        spreaderTypes: [
          { spreaderType: { name: 'パラフィン型', slug: 'paraffin' } },
        ],
      },
    ]
    render(<SpreaderResults pesticides={pesticides} />)

    expect(screen.getByText('分類:')).toBeInTheDocument()
    expect(screen.getByText('パラフィン型')).toBeInTheDocument()
    const typeLink = screen.getByRole('link', { name: 'パラフィン型' })
    expect(typeLink).toHaveAttribute('href', '/pesticides/spreaders?type=paraffin')
  })

  it('spreaderTypes が複数ある場合にすべての分類を表示する', () => {
    const pesticides = [
      {
        id: 'p1',
        name: '展着剤D',
        slug: 'spreader-d',
        registrationNumber: null,
        formulationType: null,
        spreaderTypes: [
          { spreaderType: { name: 'パラフィン型', slug: 'paraffin' } },
          { spreaderType: { name: '非イオン型', slug: 'non-ionic' } },
        ],
      },
    ]
    render(<SpreaderResults pesticides={pesticides} />)

    expect(screen.getByText('パラフィン型')).toBeInTheDocument()
    expect(screen.getByText('非イオン型')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'パラフィン型' })).toHaveAttribute('href', '/pesticides/spreaders?type=paraffin')
    expect(screen.getByRole('link', { name: '非イオン型' })).toHaveAttribute('href', '/pesticides/spreaders?type=non-ionic')
  })
})
