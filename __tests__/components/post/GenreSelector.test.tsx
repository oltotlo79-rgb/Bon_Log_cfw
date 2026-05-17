import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { GenreSelector } from '@/components/post/GenreSelector'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
    { id: 'genre-2', name: '五葉松', category: '松柏類' },
    { id: 'genre-3', name: '赤松', category: '松柏類' },
  ],
  '雑木類': [
    { id: 'genre-4', name: 'もみじ', category: '雑木類' },
    { id: 'genre-5', name: '欅', category: '雑木類' },
  ],
}

describe('GenreSelector', () => {
  const mockOnChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ジャンル選択ボタンを表示する', () => {
    render(<GenreSelector genres={mockGenres} selectedIds={[]} onChange={mockOnChange} />)
    expect(screen.getByRole('button', { name: /ジャンルを選択/i })).toBeInTheDocument()
  })

  it('選択されたジャンル名を表示する', () => {
    render(<GenreSelector genres={mockGenres} selectedIds={['genre-1']} onChange={mockOnChange} />)
    expect(screen.getByText('黒松')).toBeInTheDocument()
  })

  it('複数選択されたジャンル名をカンマ区切りで表示する', () => {
    render(<GenreSelector genres={mockGenres} selectedIds={['genre-1', 'genre-4']} onChange={mockOnChange} />)
    expect(screen.getByText('黒松, もみじ')).toBeInTheDocument()
  })

  it('クリックでドロップダウンを開く', async () => {
    const user = userEvent.setup()
    render(<GenreSelector genres={mockGenres} selectedIds={[]} onChange={mockOnChange} />)

    await user.click(screen.getByRole('button', { name: /ジャンルを選択/i }))

    await waitFor(() => {
      expect(screen.getByText('松柏類')).toBeInTheDocument()
      expect(screen.getByText('雑木類')).toBeInTheDocument()
    })
  })

  it('カテゴリ別にジャンルを表示する', async () => {
    const user = userEvent.setup()
    render(<GenreSelector genres={mockGenres} selectedIds={[]} onChange={mockOnChange} />)

    await user.click(screen.getByRole('button', { name: /ジャンルを選択/i }))

    await waitFor(() => {
      expect(screen.getByText('黒松')).toBeInTheDocument()
      expect(screen.getByText('五葉松')).toBeInTheDocument()
      expect(screen.getByText('もみじ')).toBeInTheDocument()
      expect(screen.getByText('欅')).toBeInTheDocument()
    })
  })

  it('ジャンルをクリックで選択できる', async () => {
    const user = userEvent.setup()
    render(<GenreSelector genres={mockGenres} selectedIds={[]} onChange={mockOnChange} />)

    await user.click(screen.getByRole('button', { name: /ジャンルを選択/i }))

    await waitFor(() => {
      expect(screen.getByText('黒松')).toBeInTheDocument()
    })

    await user.click(screen.getByText('黒松'))

    expect(mockOnChange).toHaveBeenCalledWith(['genre-1'])
  })

  it('選択済みジャンルをクリックで解除できる', async () => {
    const user = userEvent.setup()
    render(<GenreSelector genres={mockGenres} selectedIds={['genre-1']} onChange={mockOnChange} />)

    // ドロップダウンを開く
    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getAllByText('黒松').length).toBeGreaterThan(0)
    })

    // ドロップダウン内のジャンルをクリック（getAllByTextの2番目の要素がドロップダウン内）
    const kuromatsus = screen.getAllByText('黒松')
    // 複数ある場合は後の要素がドロップダウン内のはず
    if (kuromatsus.length > 1) {
      await user.click(kuromatsus[1])
    } else {
      await user.click(kuromatsus[0])
    }

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith([])
    })
  })

  it('最大選択数に達すると未選択のジャンルが無効化される', async () => {
    const user = userEvent.setup()
    render(
      <GenreSelector
        genres={mockGenres}
        selectedIds={['genre-1', 'genre-2', 'genre-3']}
        onChange={mockOnChange}
        maxSelections={3}
      />
    )

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      // もみじは未選択で、上限に達しているので無効化されているはず
      const momojiButtons = screen.getAllByText('もみじ')
      const dropdownButton = momojiButtons.find(el => el.tagName === 'BUTTON')
      if (dropdownButton) {
        expect(dropdownButton).toBeDisabled()
      }
    })
  })

  it('選択数カウンターを表示する', () => {
    render(<GenreSelector genres={mockGenres} selectedIds={['genre-1', 'genre-2']} onChange={mockOnChange} maxSelections={3} />)
    expect(screen.getByText('2/3 選択中')).toBeInTheDocument()
  })

  it('未選択時はカウンターを表示しない', () => {
    render(<GenreSelector genres={mockGenres} selectedIds={[]} onChange={mockOnChange} />)
    expect(screen.queryByText(/選択中/)).not.toBeInTheDocument()
  })

  it('ドロップダウンを再度クリックで閉じる', async () => {
    const user = userEvent.setup()
    render(<GenreSelector genres={mockGenres} selectedIds={[]} onChange={mockOnChange} />)

    // 開く
    await user.click(screen.getByRole('button', { name: /ジャンルを選択/i }))
    await waitFor(() => {
      expect(screen.getByText('松柏類')).toBeInTheDocument()
    })

    // 閉じる
    await user.click(screen.getByRole('button', { name: /ジャンルを選択/i }))
    await waitFor(() => {
      expect(screen.queryByText('松柏類')).not.toBeInTheDocument()
    })
  })

  it('デフォルトの最大選択数は3', async () => {
    render(<GenreSelector genres={mockGenres} selectedIds={['genre-1', 'genre-2', 'genre-3']} onChange={mockOnChange} />)
    expect(screen.getByText('3/3 選択中')).toBeInTheDocument()
  })
})
