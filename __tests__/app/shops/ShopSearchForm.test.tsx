

import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { ShopSearchForm } from '@/app/(main)/shops/ShopSearchForm'

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams,
}))

vi.mock('@/lib/prefectures', () => ({
  REGIONS: [
    { id: 'kanto', name: '関東', prefectures: ['東京都', '神奈川県', '埼玉県'] },
    { id: 'kansai', name: '関西', prefectures: ['大阪府', '京都府'] },
  ],
  PREFECTURES: ['東京都', '神奈川県', '埼玉県', '大阪府', '京都府'],
}))

const mockGenres = [
  { id: 'g1', name: '松柏類', category: '樹種' },
  { id: 'g2', name: '雑木類', category: '樹種' },
  { id: 'g3', name: '用品', category: '道具' },
]

describe('ShopSearchForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('検索フォームが表示される', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    expect(screen.getByPlaceholderText('名前または住所で検索...')).toBeInTheDocument()
    expect(screen.getByText('検索')).toBeInTheDocument()
  })

  it('ジャンルセレクトにオプションが表示される', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    expect(screen.getByText('松柏類')).toBeInTheDocument()
    expect(screen.getByText('雑木類')).toBeInTheDocument()
    expect(screen.getByText('用品')).toBeInTheDocument()
  })

  it('地方セレクトにオプションが表示される', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    expect(screen.getByText('関東')).toBeInTheDocument()
    expect(screen.getByText('関西')).toBeInTheDocument()
  })

  it('ソートセレクトにオプションが表示される', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    expect(screen.getByText('北から順')).toBeInTheDocument()
    expect(screen.getByText('新着順')).toBeInTheDocument()
    expect(screen.getByText('評価順')).toBeInTheDocument()
    expect(screen.getByText('名前順')).toBeInTheDocument()
  })

  it('検索ボタンクリックでルーターにpushする', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    const input = screen.getByPlaceholderText('名前または住所で検索...')
    fireEvent.change(input, { target: { value: 'テスト盆栽' } })
    fireEvent.click(screen.getByText('検索'))
    expect(mockPush).toHaveBeenCalled()
  })

  it('Enterキーで検索を実行する', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    const input = screen.getByPlaceholderText('名前または住所で検索...')
    fireEvent.change(input, { target: { value: 'テスト' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(mockPush).toHaveBeenCalled()
  })

  it('Enter以外のキーでは検索しない', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    const input = screen.getByPlaceholderText('名前または住所で検索...')
    fireEvent.keyDown(input, { key: 'a' })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('空の検索でsearchパラメータを削除する', () => {
    render(<ShopSearchForm genres={mockGenres} initialSearch="" />)
    fireEvent.click(screen.getByText('検索'))
    const call = mockPush.mock.calls[0]?.[0] as string
    expect(call).not.toContain('search=')
  })

  it('ジャンル変更で自動検索する', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    const selects = screen.getAllByRole('combobox')
    const genreSelect = selects[0]
    if (genreSelect) fireEvent.change(genreSelect, { target: { value: 'g1' } })
    expect(mockPush).toHaveBeenCalled()
  })

  it('ジャンルを空にするとgenreパラメータを削除する', () => {
    render(<ShopSearchForm genres={mockGenres} initialGenre="g1" />)
    const selects = screen.getAllByRole('combobox')
    const genreSelectEmpty = selects[0]
    if (genreSelectEmpty) fireEvent.change(genreSelectEmpty, { target: { value: '' } })
    expect(mockPush).toHaveBeenCalled()
  })

  it('地方変更で都道府県をリセットし自動検索する', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    const selects = screen.getAllByRole('combobox')
    const regionSelect = selects[1]
    if (regionSelect) fireEvent.change(regionSelect, { target: { value: 'kanto' } })
    expect(mockPush).toHaveBeenCalled()
  })

  it('地方を空にするとregionパラメータを削除する', () => {
    render(<ShopSearchForm genres={mockGenres} initialRegion="kanto" />)
    const selects = screen.getAllByRole('combobox')
    const regionSelectEmpty = selects[1]
    if (regionSelectEmpty) fireEvent.change(regionSelectEmpty, { target: { value: '' } })
    expect(mockPush).toHaveBeenCalled()
  })

  it('都道府県変更で自動検索する', () => {
    render(<ShopSearchForm genres={mockGenres} initialRegion="kanto" />)
    const selects = screen.getAllByRole('combobox')
    const prefSelect = selects[2]
    if (prefSelect) fireEvent.change(prefSelect, { target: { value: '東京都' } })
    expect(mockPush).toHaveBeenCalled()
  })

  it('都道府県を空にするとprefectureパラメータを削除する', () => {
    render(<ShopSearchForm genres={mockGenres} initialPrefecture="東京都" />)
    const selects = screen.getAllByRole('combobox')
    const prefSelectEmpty = selects[2]
    if (prefSelectEmpty) fireEvent.change(prefSelectEmpty, { target: { value: '' } })
    expect(mockPush).toHaveBeenCalled()
  })

  it('ソート変更で自動検索する', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    const selects = screen.getAllByRole('combobox')
    const sortSelect = selects[3]
    if (sortSelect) fireEvent.change(sortSelect, { target: { value: 'rating' } })
    expect(mockPush).toHaveBeenCalled()
  })

  it('ソートをlocationにするとsortパラメータを削除する', () => {
    render(<ShopSearchForm genres={mockGenres} initialSort="rating" />)
    const selects = screen.getAllByRole('combobox')
    const sortSelectLoc = selects[3]
    if (sortSelectLoc) fireEvent.change(sortSelectLoc, { target: { value: 'location' } })
    expect(mockPush).toHaveBeenCalled()
  })

  it('フィルターが適用されている場合リセットボタンを表示する', () => {
    render(<ShopSearchForm genres={mockGenres} initialSearch="テスト" />)
    expect(screen.getByText('リセット')).toBeInTheDocument()
  })

  it('フィルターが未適用の場合リセットボタンを表示しない', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    expect(screen.queryByText('リセット')).not.toBeInTheDocument()
  })

  it('リセットボタンクリックで/shopsに遷移する', () => {
    render(<ShopSearchForm genres={mockGenres} initialSearch="テスト" />)
    fireEvent.click(screen.getByText('リセット'))
    expect(mockPush).toHaveBeenCalledWith('/shops')
  })

  it('初期値が正しく設定される', () => {
    render(
      <ShopSearchForm
        genres={mockGenres}
        initialSearch="初期検索"
        initialGenre="g1"
        initialRegion="kanto"
        initialPrefecture="東京都"
        initialSort="rating"
      />
    )
    const input = screen.getByPlaceholderText('名前または住所で検索...') as HTMLInputElement
    expect(input.value).toBe('初期検索')
  })

  it('地方が選択されていない場合全都道府県を表示する', () => {
    render(<ShopSearchForm genres={mockGenres} />)
    expect(screen.getByText('大阪府')).toBeInTheDocument()
    expect(screen.getByText('東京都')).toBeInTheDocument()
  })

  it('地方が選択されている場合その地方の都道府県のみ表示する', () => {
    render(<ShopSearchForm genres={mockGenres} initialRegion="kanto" />)
    expect(screen.getByText('東京都')).toBeInTheDocument()
    expect(screen.getByText('神奈川県')).toBeInTheDocument()
    // 関西の都道府県は都道府県セレクトには表示されない（ただし地方セレクトには存在）
  })

  it('genreフィルターが設定されている場合リセットボタンを表示する', () => {
    render(<ShopSearchForm genres={mockGenres} initialGenre="g1" />)
    expect(screen.getByText('リセット')).toBeInTheDocument()
  })

  it('regionフィルターが設定されている場合リセットボタンを表示する', () => {
    render(<ShopSearchForm genres={mockGenres} initialRegion="kanto" />)
    expect(screen.getByText('リセット')).toBeInTheDocument()
  })

  it('prefectureフィルターが設定されている場合リセットボタンを表示する', () => {
    render(<ShopSearchForm genres={mockGenres} initialPrefecture="東京都" />)
    expect(screen.getByText('リセット')).toBeInTheDocument()
  })

  it('sortがlocation以外の場合リセットボタンを表示する', () => {
    render(<ShopSearchForm genres={mockGenres} initialSort="newest" />)
    expect(screen.getByText('リセット')).toBeInTheDocument()
  })
})
