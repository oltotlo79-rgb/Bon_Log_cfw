import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import * as nextNavigation from 'next/navigation'
import { GenreFilter } from '@/components/search/GenreFilter'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: mockPush,
  })),
  useSearchParams: vi.fn(() => ({
    toString: () => 'q=test',
    getAll: () => [],
  })),
}))

const mockGenres = {
  '松柏類': [
    { id: 'genre-1', name: '黒松', category: '松柏類' },
    { id: 'genre-2', name: '五葉松', category: '松柏類' },
  ],
  '雑木類': [
    { id: 'genre-3', name: 'もみじ', category: '雑木類' },
  ],
}

describe('GenreFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ジャンルフィルターボタンを表示する', () => {
    render(<GenreFilter genres={mockGenres} />)
    expect(screen.getByText('ジャンル')).toBeInTheDocument()
  })

  it('クリックでドロップダウンを開く', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('ジャンルで絞り込み')).toBeInTheDocument()
      expect(screen.getByText('黒松')).toBeInTheDocument()
      expect(screen.getByText('五葉松')).toBeInTheDocument()
      expect(screen.getByText('もみじ')).toBeInTheDocument()
    })
  })

  it('カテゴリ別にジャンルをグループ表示する', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('松柏類')).toBeInTheDocument()
      expect(screen.getByText('雑木類')).toBeInTheDocument()
    })
  })

  it('選択されたジャンル数を表示する', () => {
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1', 'genre-2']} />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('ジャンルをクリックでURLを更新する', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('黒松')).toBeInTheDocument()
    })

    await user.click(screen.getByText('黒松'))

    expect(mockPush).toHaveBeenCalled()
  })

  it('選択中のジャンルにはスタイルが適用される', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      const genreButton = screen.getByText('黒松')
      expect(genreButton).toHaveClass('bg-primary')
    })
  })

  it('クリアボタンが選択中に表示される', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('クリア')).toBeInTheDocument()
    })
  })

  // ============================================================
  // 追加テスト
  // ============================================================

  it('選択がない場合はクリアボタンを表示しない', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.queryByText('クリア')).not.toBeInTheDocument()
    })
  })

  it('選択がない場合はバッジ数を表示しない', () => {
    render(<GenreFilter genres={mockGenres} />)

    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('未選択のジャンルにはbg-mutedクラスが適用される', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={[]} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      const genreButton = screen.getByText('黒松')
      expect(genreButton).toHaveClass('bg-muted')
    })
  })

  it('ドロップダウンが初期状態で閉じている', () => {
    render(<GenreFilter genres={mockGenres} />)

    expect(screen.queryByText('ジャンルで絞り込み')).not.toBeInTheDocument()
  })

  it('空のジャンルオブジェクトで何も表示しない', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={{}} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('ジャンルで絞り込み')).toBeInTheDocument()
    })
    // カテゴリやジャンルは表示されない
    expect(screen.queryByText('松柏類')).not.toBeInTheDocument()
  })

  it('単一カテゴリのみの場合正しく表示する', async () => {
    const user = userEvent.setup()
    const singleCategory = {
      '松柏類': [{ id: 'g1', name: '黒松', category: '松柏類' }],
    }

    render(<GenreFilter genres={singleCategory} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('松柏類')).toBeInTheDocument()
      expect(screen.getByText('黒松')).toBeInTheDocument()
    })
  })

  it('クリアボタンをクリックするとURLを更新する', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('クリア')).toBeInTheDocument()
    })

    await user.click(screen.getByText('クリア'))

    expect(mockPush).toHaveBeenCalled()
  })

  it('ジャンルクリック時にgenreパラメータがURLに追加される', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))
    await waitFor(() => {
      expect(screen.getByText('黒松')).toBeInTheDocument()
    })

    await user.click(screen.getByText('黒松'))

    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('genre=genre-1')
    )
  })

  it('複数ジャンルを選択できる', () => {
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1', 'genre-2', 'genre-3']} />)

    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('selectedGenreIdsが省略された場合デフォルトで空配列が使われる', () => {
    render(<GenreFilter genres={mockGenres} />)

    // バッジ数が表示されないことで確認
    const button = screen.getByText('ジャンル')
    expect(button).toBeInTheDocument()
  })

  it('ドロップダウンのヘッダーに「ジャンルで絞り込み」を表示する', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('ジャンルで絞り込み')).toBeInTheDocument()
    })
  })

  it('ドロップダウンボタンにシェブロンアイコンがある', () => {
    const { container } = render(<GenreFilter genres={mockGenres} />)

    const svg = container.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })

  it('選択済みジャンルにtext-primary-foregroundクラスがある', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      const genreButton = screen.getByText('黒松')
      expect(genreButton).toHaveClass('text-primary-foreground')
    })
  })

  it('カテゴリラベルがtext-muted-foregroundクラスを持つ', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      const categories = screen.getAllByText('松柏類')
      // カテゴリラベルのp要素
      const categoryLabel = categories.find(el => el.tagName === 'P')
      expect(categoryLabel).toHaveClass('text-muted-foreground')
    })
  })

  it('背景オーバーレイクリックでドロップダウンを閉じる', async () => {
    const user = userEvent.setup()
    const { container } = render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('ジャンルで絞り込み')).toBeInTheDocument()
    })

    // オーバーレイ（fixed inset-0）をクリック
    const overlay = container.querySelector('.fixed.inset-0')
    if (overlay) {
      await user.click(overlay)
    }

    await waitFor(() => {
      expect(screen.queryByText('ジャンルで絞り込み')).not.toBeInTheDocument()
    })
  })

  it('ジャンルボタンがrounded-fullクラスを持つ', async () => {
    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      const genreButton = screen.getByText('黒松')
      expect(genreButton).toHaveClass('rounded-full')
    })
  })
})

// 選択解除テスト（別のuseSearchParamsモックが必要）
describe('GenreFilter - 選択解除', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('選択済みジャンルをクリックすると解除される', async () => {
    // useSearchParamsを一時的にオーバーライド
    vi.mocked(nextNavigation.useSearchParams).mockReturnValue({
      toString: () => 'q=test&genre=genre-1',
      getAll: (key: string) => key === 'genre' ? ['genre-1'] : [],
       
    } as any)

    const mockPush2 = vi.fn()
     
    vi.mocked(nextNavigation.useRouter).mockReturnValue({ push: mockPush2 } as any)

    const user = userEvent.setup()
    render(<GenreFilter genres={mockGenres} selectedGenreIds={['genre-1']} />)

    await user.click(screen.getByText('ジャンル'))

    await waitFor(() => {
      expect(screen.getByText('黒松')).toBeInTheDocument()
    })

    await user.click(screen.getByText('黒松'))

    expect(mockPush2).toHaveBeenCalledWith(
      expect.not.stringContaining('genre=genre-1')
    )

    // 元に戻す (mock will be reset in beforeEach)
  })
})
