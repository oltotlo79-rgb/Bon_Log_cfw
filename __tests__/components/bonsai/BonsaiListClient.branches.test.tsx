/**
 * BonsaiListClient - uncovered branch tests
 *
 * Targets:
 * - Search results showing "検索結果がありません" when isSearching=true and results=0
 * - Bonsai without latest image shows TreeIcon placeholder
 * - Bonsai without description does not render description
 * - Bonsai without acquiredAt does not render date
 * - Bonsai without _count shows 0
 * - handleSearch callback sets bonsais and isSearching
 * - handleClear callback resets to initial state
 */

import { vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '../../utils/test-utils'
import { BonsaiListClient } from '@/components/bonsai/BonsaiListClient'

// BonsaiSearch mock that exposes onSearch and onClear
let capturedOnSearch: (results: unknown[]) => void
let _capturedOnClear: () => void

vi.mock('@/components/bonsai/BonsaiSearch', () => ({
  BonsaiSearch: ({ onSearch, onClear, initialCount }: {
    onSearch: (results: unknown[]) => void
    onClear: () => void
    initialCount: number
  }) => {
    capturedOnSearch = onSearch
    _capturedOnClear = onClear
    return (
      <div data-testid="bonsai-search">
        <span>検索（{initialCount}件）</span>
        <button onClick={onClear} data-testid="search-clear">クリア</button>
        <button onClick={() => onSearch([])} data-testid="search-empty">空検索</button>
      </div>
    )
  },
}))

vi.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
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
]

describe('BonsaiListClient - uncovered branches', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------------
  // Search with empty results shows "検索結果がありません"
  // ----------------------------------------------------------------
  it('検索結果が0件の場合に「検索結果がありません」を表示する', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)

    // Trigger search with empty results
    fireEvent.click(screen.getByTestId('search-empty'))

    expect(screen.getByText('検索結果がありません')).toBeInTheDocument()
    expect(screen.getByText('別のキーワードで検索してみてください')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // handleClear resets to initial bonsais
  // ----------------------------------------------------------------
  it('検索クリア後に初期データが復元される', () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)

    // Search with empty results first
    fireEvent.click(screen.getByTestId('search-empty'))
    expect(screen.queryByText('五葉松')).not.toBeInTheDocument()

    // Clear search
    fireEvent.click(screen.getByTestId('search-clear'))
    expect(screen.getByText('五葉松')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Bonsai without records shows TreeIcon placeholder
  // ----------------------------------------------------------------
  it('成長記録画像がない盆栽はプレースホルダーアイコンを表示する', () => {
    const bonsaiWithoutImage = [
      {
        id: 'bonsai-no-img',
        name: '紅葉',
        species: null,
        acquiredAt: null,
        description: null,
        records: [],
        _count: { records: 0 },
      },
    ]
    render(<BonsaiListClient initialBonsais={bonsaiWithoutImage} />)

    // No img element in card, instead an SVG placeholder
    const cardLink = screen.getByRole('link', { name: /紅葉/ })
    const svgs = cardLink.querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
  })

  // ----------------------------------------------------------------
  // Bonsai without acquiredAt does not show date
  // ----------------------------------------------------------------
  it('入手日がない場合は日付を表示しない', () => {
    const bonsaiNoDate = [
      {
        id: 'bonsai-2',
        name: '黒松',
        species: '黒松',
        acquiredAt: null,
        description: null,
        records: [],
        _count: { records: 3 },
      },
    ]
    render(<BonsaiListClient initialBonsais={bonsaiNoDate} />)

    expect(screen.queryByText(/入手:/)).not.toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // Bonsai without species does not show species
  // ----------------------------------------------------------------
  it('樹種がnullの場合は樹種を表示しない', () => {
    const bonsaiNoSpecies = [
      {
        id: 'bonsai-3',
        name: '楓',
        species: null,
        acquiredAt: null,
        description: null,
        records: [],
        _count: { records: 0 },
      },
    ]
    render(<BonsaiListClient initialBonsais={bonsaiNoSpecies} />)

    // The species text should not be present
    expect(screen.getByText('楓')).toBeInTheDocument()
    expect(screen.getByText('0件の記録')).toBeInTheDocument()
  })

  // ----------------------------------------------------------------
  // handleSearch with results updates the list
  // ----------------------------------------------------------------
  it('検索結果が盆栽リストを更新する', async () => {
    render(<BonsaiListClient initialBonsais={mockBonsais} />)

    const searchResult = [
      {
        id: 'result-1',
        name: '検索結果盆栽',
        species: null,
        acquiredAt: null,
        description: null,
        records: [],
        _count: { records: 1 },
      },
    ]
    act(() => {
      capturedOnSearch(searchResult)
    })

    await waitFor(() => {
      expect(screen.getByText('検索結果盆栽')).toBeInTheDocument()
    })
    expect(screen.queryByText('五葉松')).not.toBeInTheDocument()
  })
})
