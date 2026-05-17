import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { DictionarySearch } from '@/components/dictionary/DictionarySearch'
import { DICTIONARY_CATEGORIES } from '@/prisma/seed/dictionary/seed-dictionary'

// next/navigation モック
const mockPush = vi.fn()
const mockPathname = '/dictionary'
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}))

describe('DictionarySearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('検索入力欄を表示する', () => {
    render(<DictionarySearch />)

    const input = screen.getByLabelText('用語を検索')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'search')
    expect(input).toHaveAttribute('placeholder', '用語・読み・説明文で検索…')
  })

  it('カテゴリフィルターボタンを表示する', () => {
    render(<DictionarySearch />)

    const group = screen.getByRole('group', { name: 'カテゴリで絞り込み' })
    expect(group).toBeInTheDocument()

    // 「すべて」ボタン
    expect(screen.getByText('すべて')).toBeInTheDocument()
  })

  it('DICTIONARY_CATEGORIESの全カテゴリボタンを表示する', () => {
    render(<DictionarySearch />)

    for (const cat of DICTIONARY_CATEGORIES) {
      expect(screen.getByText(cat)).toBeInTheDocument()
    }

    // 全行(1) + 行ボタン(10) + すべて(1) + カテゴリ数
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(10 + 1 + DICTIONARY_CATEGORIES.length + 1)
  })

  it('検索入力を変更するとURLパラメータを更新する', () => {
    render(<DictionarySearch />)

    const input = screen.getByLabelText('用語を検索')
    fireEvent.change(input, { target: { value: '剪定' } })

    expect(mockPush).toHaveBeenCalledWith('/dictionary?search=%E5%89%AA%E5%AE%9A')
  })

  it('検索入力を空にするとsearchパラメータを削除する', () => {
    mockSearchParams = new URLSearchParams('search=剪定')
    render(<DictionarySearch defaultSearch="剪定" />)

    const input = screen.getByLabelText('用語を検索')
    fireEvent.change(input, { target: { value: '' } })

    expect(mockPush).toHaveBeenCalledWith('/dictionary?')
  })

  it('カテゴリボタンをクリックするとcategoryパラメータを設定する', () => {
    render(<DictionarySearch />)

    const categoryButton = screen.getByText('樹形')
    fireEvent.click(categoryButton)

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('category=%E6%A8%B9%E5%BD%A2'))
  })

  it('アクティブなカテゴリボタンをクリックするとフィルターを解除する', () => {
    render(<DictionarySearch defaultCategory="樹形" />)

    const categoryButton = screen.getByText('樹形')
    fireEvent.click(categoryButton)

    // categoryパラメータが削除される（空文字を渡すので削除される）
    expect(mockPush).toHaveBeenCalledWith('/dictionary?')
  })

  it('「すべて」ボタンをクリックするとcategoryパラメータを削除する', () => {
    mockSearchParams = new URLSearchParams('category=樹形')
    render(<DictionarySearch defaultCategory="樹形" />)

    const allButton = screen.getByText('すべて')
    fireEvent.click(allButton)

    expect(mockPush).toHaveBeenCalledWith('/dictionary?')
  })

  it('デフォルト検索値を入力欄に表示する', () => {
    render(<DictionarySearch defaultSearch="盆栽" />)

    const input = screen.getByLabelText('用語を検索')
    expect(input).toHaveAttribute('value', '盆栽')
  })

  it('カテゴリ未選択時は「すべて」ボタンがアクティブスタイルを持つ', () => {
    render(<DictionarySearch />)

    const allButton = screen.getByText('すべて')
    expect(allButton).toHaveClass('bg-primary')
  })

  it('カテゴリ選択時は該当ボタンがアクティブスタイルを持つ', () => {
    render(<DictionarySearch defaultCategory="技術・作業" />)

    const activeButton = screen.getByText('技術・作業')
    expect(activeButton).toHaveClass('bg-primary')

    // 「すべて」は非アクティブ
    const allButton = screen.getByText('すべて')
    expect(allButton).not.toHaveClass('bg-primary')
  })

  it('カテゴリ選択時は他のカテゴリボタンが非アクティブスタイルを持つ', () => {
    render(<DictionarySearch defaultCategory="樹形" />)

    const inactiveButton = screen.getByText('技術・作業')
    expect(inactiveButton).not.toHaveClass('bg-primary')
    expect(inactiveButton).toHaveClass('border-border')
  })

  it('五十音行ボタンをクリックするとrowパラメータが更新される', () => {
    render(<DictionarySearch />)

    const kaButton = screen.getByText('か行')
    fireEvent.click(kaButton)

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('row=')
    )
  })

  it('選択中の行ボタンをクリックするとフィルターが解除される', () => {
    mockSearchParams = new URLSearchParams('row=か行')
    render(<DictionarySearch defaultRow="か行" />)

    const kaButton = screen.getByText('か行')
    fireEvent.click(kaButton)

    expect(mockPush).toHaveBeenCalledWith('/dictionary?')
  })

  it('行未選択時は「全行」ボタンがアクティブスタイルを持つ', () => {
    render(<DictionarySearch />)

    const allRowButton = screen.getByText('全行')
    expect(allRowButton).toHaveClass('bg-foreground')
  })

  it('行選択時は該当ボタンがアクティブスタイルを持つ', () => {
    render(<DictionarySearch defaultRow="さ行" />)

    const saButton = screen.getByText('さ行')
    expect(saButton).toHaveClass('bg-foreground')

    const allRowButton = screen.getByText('全行')
    expect(allRowButton).not.toHaveClass('bg-foreground')
  })

  it('検索とカテゴリを同時に指定できる', () => {
    mockSearchParams = new URLSearchParams('search=剪定')
    render(<DictionarySearch defaultSearch="剪定" />)

    const categoryButton = screen.getByText('技術・作業')
    fireEvent.click(categoryButton)

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('search=%E5%89%AA%E5%AE%9A')
    )
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('category=')
    )
  })
})
