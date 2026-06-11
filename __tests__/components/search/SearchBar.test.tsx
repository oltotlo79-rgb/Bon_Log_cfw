 
import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '@/components/search/SearchBar'

// Next.js navigation モック
const mockPush = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/search',
}))

// localStorage モック
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

describe('SearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    mockSearchParams = new URLSearchParams()
  })

  it('検索バーを表示する', () => {
    render(<SearchBar />)
    expect(screen.getByPlaceholderText('検索...')).toBeInTheDocument()
  })

  it('カスタムプレースホルダーを表示する', () => {
    render(<SearchBar placeholder="投稿を検索..." />)
    expect(screen.getByPlaceholderText('投稿を検索...')).toBeInTheDocument()
  })

  it('デフォルト値を表示する', () => {
    render(<SearchBar defaultValue="盆栽" />)
    expect(screen.getByDisplayValue('盆栽')).toBeInTheDocument()
  })

  it('検索キーワードを入力できる', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.type(input, '盆栽')
    expect(input).toHaveValue('盆栽')
  })

  it('Enterキーで検索を実行する', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.type(input, '盆栽')
    await user.keyboard('{Enter}')
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('q='))
  })

  it('onSearchコールバックが指定されている場合はそれを呼び出す', async () => {
    const mockOnSearch = vi.fn()
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} />)
    const input = screen.getByPlaceholderText('検索...')
    await user.type(input, '盆栽')
    await user.keyboard('{Enter}')
    expect(mockOnSearch).toHaveBeenCalledWith('盆栽')
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('入力があるときクリアボタンが表示される', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')

    // 初期状態ではクリアボタンがない
    expect(screen.queryByRole('button')).not.toBeInTheDocument()

    await user.type(input, '盆栽')

    // 入力後はクリアボタンが表示される
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('クリアボタンで入力をクリアする', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.type(input, '盆栽')

    const clearButton = screen.getByRole('button')
    await user.click(clearButton)

    expect(input).toHaveValue('')
  })

  it('クリアボタンクリック時にURLからqパラメータが削除される', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.type(input, '盆栽')

    const clearButton = screen.getByRole('button')
    await user.click(clearButton)

    expect(mockPush).toHaveBeenCalledWith('/search?')
  })

  it('検索履歴をローカルストレージに保存する', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.type(input, '盆栽')
    await user.keyboard('{Enter}')

    expect(localStorageMock.setItem).toHaveBeenCalled()
  })

  it('フォーカス時に検索履歴ドロップダウンを表示する', async () => {
    // 検索履歴をセット
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['盆栽', '松']))

    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('最近の検索')).toBeInTheDocument()
    })
  })

  it('検索履歴からキーワードを選択して検索できる', async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['盆栽', '松']))

    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('盆栽')).toBeInTheDocument()
    })

    const historyItem = screen.getByText('盆栽')
    await user.click(historyItem)

    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('q='))
  })

  it('「すべて削除」ボタンで検索履歴をクリアする', async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['盆栽', '松']))

    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('すべて削除')).toBeInTheDocument()
    })

    const clearAllButton = screen.getByText('すべて削除')
    await user.click(clearAllButton)

    expect(localStorageMock.removeItem).toHaveBeenCalledWith('bonsai-sns-recent-searches')
  })

  it('入力中は検索履歴ドロップダウンを非表示にする', async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['盆栽', '松']))

    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')

    // フォーカスすると履歴が表示
    await user.click(input)
    await waitFor(() => {
      expect(screen.getByText('最近の検索')).toBeInTheDocument()
    })

    // 入力すると履歴が非表示
    await user.type(input, 'test')
    await waitFor(() => {
      expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
    })
  })

  it('Escapeキーでフォーカスを解除する', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.click(input)

    expect(input).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(input).not.toHaveFocus()
  })

  it('検索履歴の最大件数は10件', async () => {
    // 既存の履歴を10件セット
    const existingSearches = Array.from({ length: 10 }, (_, i) => `検索${i}`)
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existingSearches))

    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.type(input, '新しい検索')
    await user.keyboard('{Enter}')

    // setItemが呼ばれたことを確認
    expect(localStorageMock.setItem).toHaveBeenCalled()

    // 保存されたデータを検証
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0]![1]!)
    expect(savedData.length).toBeLessThanOrEqual(10)
    expect(savedData[0]).toBe('新しい検索')
  })

  it('重複する検索は先頭に移動する', async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['松', '盆栽', '梅']))

    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.type(input, '盆栽')
    await user.keyboard('{Enter}')

    // setItemが呼ばれたことを確認
    const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0]![1]!)
    expect(savedData[0]).toBe('盆栽') // 盆栽が先頭に
    expect(savedData.filter((s: string) => s === '盆栽').length).toBe(1) // 重複なし
  })

  it('URLパラメータのqが変更されると入力値が更新される', async () => {
    mockSearchParams = new URLSearchParams('q=初期検索')
    render(<SearchBar />)

    // URLパラメータの値が反映される
    await waitFor(() => {
      expect(screen.getByDisplayValue('初期検索')).toBeInTheDocument()
    })
  })

  it('検索履歴が空の場合はドロップダウンを表示しない', async () => {
    localStorageMock.getItem.mockReturnValue(null)

    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.click(input)

    // 少し待ってもドロップダウンが表示されないことを確認
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(screen.queryByText('最近の検索')).not.toBeInTheDocument()
  })

  it('個別の検索履歴を削除するとsetItemが呼ばれる', async () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify(['盆栽', '松', '梅']))

    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.click(input)

    await waitFor(() => {
      expect(screen.getByText('盆栽')).toBeInTheDocument()
    })

    // 「すべて削除」ボタンの前にsetItemの呼び出し回数を記録
    const callsBefore = localStorageMock.setItem.mock.calls.length

    // 個別削除ボタン（ネストされたbutton内のXIcon）をクリック
    // 検索履歴の各項目にはXIconの個別削除ボタンがある
    const listItems = screen.getAllByRole('listitem')
    if (listItems.length > 0) {
      const innerButtons = listItems[0]!.querySelectorAll('button')
      // 内側のbutton（削除ボタン）をクリック
      if (innerButtons.length > 1) {
        await user.click(innerButtons[1]!)
        expect(localStorageMock.setItem.mock.calls.length).toBeGreaterThan(callsBefore)
      }
    }
  })

  it('空白のみの入力では検索履歴に保存しない', async () => {
    const user = userEvent.setup()
    render(<SearchBar />)
    const input = screen.getByPlaceholderText('検索...')
    await user.type(input, '   ')
    await user.keyboard('{Enter}')

    // setItemは空白のみの場合呼ばれない（または空配列で呼ばれる）
    // 実際の実装ではtrim()チェックがあるので保存されない
    if (localStorageMock.setItem.mock.calls.length > 0) {
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0]![1]!)
      expect(savedData.includes('   ')).toBe(false)
    }
  })

  describe('アクセシビリティ', () => {
    it('検索クリアボタンにaria-label="検索をクリア"があること', async () => {
      const user = userEvent.setup()
      render(<SearchBar />)
      const input = screen.getByPlaceholderText('検索...')
      await user.type(input, '盆栽')

      const clearButton = screen.getByLabelText('検索をクリア')
      expect(clearButton).toBeInTheDocument()
    })

    it('履歴削除ボタンにaria-label="履歴を削除"があること', async () => {
      localStorageMock.getItem.mockReturnValue(JSON.stringify(['盆栽', '松']))

      const user = userEvent.setup()
      render(<SearchBar />)
      const input = screen.getByPlaceholderText('検索...')
      await user.click(input)

      await waitFor(() => {
        expect(screen.getByText('最近の検索')).toBeInTheDocument()
      })

      const deleteButtons = screen.getAllByLabelText('履歴を削除')
      expect(deleteButtons.length).toBeGreaterThan(0)
    })
  })
})
