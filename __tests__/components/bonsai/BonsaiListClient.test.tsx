import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { BonsaiListClient } from '@/components/bonsai/BonsaiListClient'

// BonsaiSearchモック
vi.mock('@/components/bonsai/BonsaiSearch', () => ({
  BonsaiSearch: ({ onClear, initialCount }: { onClear: () => void; initialCount: number }) => (
    <div data-testid="bonsai-search">
      <span>検索（{initialCount}件）</span>
      <button onClick={onClear}>クリア</button>
    </div>
  ),
}))

const mockBonsais = [
  {
    id: 'bonsai-1',
    name: '五葉松',
    species: 'Pinus parviflora',
    acquiredAt: new Date('2020-04-01'),
    description: '5年前に購入した盆栽',
    records: [{ images: [{ url: 'https://example.com/image1.jpg' }] }],
    _count: { records: 10 },
  },
  {
    id: 'bonsai-2',
    name: '黒松',
    species: 'Pinus thunbergii',
    acquiredAt: null,
    description: null,
    records: [],
    _count: { records: 5 },
  },
]

describe('BonsaiListClient', () => {
  it('「マイ盆栽」ヘッダーを表示する', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)
    expect(screen.getByText('マイ盆栽')).toBeInTheDocument()
  })

  it('「盆栽を追加」リンクを表示する', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)
    const addLink = screen.getByRole('link', { name: /盆栽を追加/i })
    expect(addLink).toHaveAttribute('href', '/bonsai/new')
  })

  it('盆栽一覧を表示する', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)
    expect(screen.getByText('五葉松')).toBeInTheDocument()
    expect(screen.getByText('黒松')).toBeInTheDocument()
  })

  it('盆栽の種名を表示する', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)
    expect(screen.getByText('Pinus parviflora')).toBeInTheDocument()
    expect(screen.getByText('Pinus thunbergii')).toBeInTheDocument()
  })

  it('記録件数を表示する', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)
    expect(screen.getByText('10件の記録')).toBeInTheDocument()
    expect(screen.getByText('5件の記録')).toBeInTheDocument()
  })

  it('入手日を表示する', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)
    expect(screen.getByText(/入手:/)).toBeInTheDocument()
  })

  it('説明を表示する', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)
    expect(screen.getByText('5年前に購入した盆栽')).toBeInTheDocument()
  })

  it('盆栽詳細ページへのリンクを持つ', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)
    const links = screen.getAllByRole('link')
    const bonsaiLink = links.find(link => link.getAttribute('href') === '/bonsai/bonsai-1')
    expect(bonsaiLink).toBeInTheDocument()
  })

  it('盆栽がない場合は空状態メッセージを表示する', () => {
    render(<BonsaiListClient initialBonsais={[]} />)
    expect(screen.getByText('まだ盆栽が登録されていません')).toBeInTheDocument()
    expect(screen.getByText('あなたの盆栽を登録して、成長記録を残しましょう')).toBeInTheDocument()
  })

  it('盆栽がない場合は「最初の盆栽を登録」リンクを表示する', () => {
    render(<BonsaiListClient initialBonsais={[]} />)
    const registerLink = screen.getByRole('link', { name: /最初の盆栽を登録/i })
    expect(registerLink).toHaveAttribute('href', '/bonsai/new')
  })

  it('検索コンポーネントを表示する', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)
    expect(screen.getByTestId('bonsai-search')).toBeInTheDocument()
  })
})
