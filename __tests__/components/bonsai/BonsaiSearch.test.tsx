import { vi } from 'vitest'
import { render, screen, waitFor, act } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiSearch } from '@/components/bonsai/BonsaiSearch'

// Server Action モック
const mockSearchBonsais = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  searchBonsais: (...args: unknown[]) => mockSearchBonsais(...args),
}))

// タイマーをモック
vi.useFakeTimers({ shouldAdvanceTime: true })

describe('BonsaiSearch', () => {
  const mockOnSearch = vi.fn()
  const mockOnClear = vi.fn()
  const defaultProps = {
    onSearch: mockOnSearch,
    onClear: mockOnClear,
    initialCount: 10,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('検索入力フィールドを表示する', () => {
    render(<BonsaiSearch {...defaultProps} />)
    expect(screen.getByPlaceholderText(/盆栽を検索/)).toBeInTheDocument()
  })

  it('初期状態で盆栽数を表示する', () => {
    render(<BonsaiSearch {...defaultProps} />)
    expect(screen.getByText('10本の盆栽を管理中')).toBeInTheDocument()
  })

  it('検索入力時にデバウンス後に検索が実行される', async () => {
    mockSearchBonsais.mockResolvedValue({
      success: true,
      data: { bonsais: [{ id: '1', name: '黒松' }] },
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BonsaiSearch {...defaultProps} />)

    const input = screen.getByPlaceholderText(/盆栽を検索/)
    await user.type(input, '黒松')

    // デバウンス時間（300ms）経過前は検索されない
    expect(mockSearchBonsais).not.toHaveBeenCalled()

    // デバウンス時間経過後に検索が実行される
    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockSearchBonsais).toHaveBeenCalledWith('黒松')
    })
  })

  it('検索結果件数を表示する', async () => {
    mockSearchBonsais.mockResolvedValue({
      success: true,
      data: {
        bonsais: [
          { id: '1', name: '黒松' },
          { id: '2', name: '五葉松' },
        ],
      },
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BonsaiSearch {...defaultProps} />)

    await user.type(screen.getByPlaceholderText(/盆栽を検索/), '松')

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.getByText('2件の盆栽が見つかりました')).toBeInTheDocument()
    })
  })

  it('検索結果が0件の場合はメッセージを表示する', async () => {
    mockSearchBonsais.mockResolvedValue({
      success: true,
      data: { bonsais: [] },
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BonsaiSearch {...defaultProps} />)

    await user.type(screen.getByPlaceholderText(/盆栽を検索/), 'あいうえお')

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.getByText('該当する盆栽が見つかりませんでした')).toBeInTheDocument()
    })
  })

  it('検索エラー時にエラーメッセージを表示する', async () => {
    mockSearchBonsais.mockResolvedValue({
      success: false,
      error: '検索エラーが発生しました',
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BonsaiSearch {...defaultProps} />)

    await user.type(screen.getByPlaceholderText(/盆栽を検索/), 'test')

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(screen.getByText('検索エラーが発生しました')).toBeInTheDocument()
    })
  })

  it('検索成功時にonSearchコールバックが呼ばれる', async () => {
    const mockBonsais = [{ id: '1', name: '黒松' }]
    mockSearchBonsais.mockResolvedValue({ success: true, data: { bonsais: mockBonsais } })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BonsaiSearch {...defaultProps} />)

    await user.type(screen.getByPlaceholderText(/盆栽を検索/), '黒松')

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith(mockBonsais)
    })
  })

  it('空の入力時にonClearコールバックが呼ばれる', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BonsaiSearch {...defaultProps} />)

    const input = screen.getByPlaceholderText(/盆栽を検索/)
    await user.type(input, '黒松')
    await user.clear(input)

    expect(mockOnClear).toHaveBeenCalled()
  })

  it('クリアボタンクリックで検索をクリアする', async () => {
    mockSearchBonsais.mockResolvedValue({
      success: true,
      data: { bonsais: [{ id: '1', name: '黒松' }] },
    })

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BonsaiSearch {...defaultProps} />)

    // 検索を実行
    await user.type(screen.getByPlaceholderText(/盆栽を検索/), '黒松')

    await act(async () => {
      vi.advanceTimersByTime(300)
    })

    // クリアボタンをクリック
    const clearButton = screen.getByRole('button')
    await user.click(clearButton)

    expect(mockOnClear).toHaveBeenCalled()
    expect(screen.getByPlaceholderText(/盆栽を検索/)).toHaveValue('')
  })

  it('入力が100文字を超えない', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<BonsaiSearch {...defaultProps} />)

    const input = screen.getByPlaceholderText(/盆栽を検索/)
    const longText = 'a'.repeat(150)
    await user.type(input, longText)

    expect(input).toHaveAttribute('maxLength', '100')
  })
})
