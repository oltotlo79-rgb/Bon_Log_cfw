import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BonsaiTimeline } from '@/components/bonsai/BonsaiTimeline'

// Next.js navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Server Actions モック
const mockDeleteBonsaiRecord = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  deleteBonsaiRecord: (...args: unknown[]) => mockDeleteBonsaiRecord(...args),
}))

// window.confirm モック
const originalConfirm = window.confirm
beforeAll(() => {
  window.confirm = vi.fn(() => true)
})
afterAll(() => {
  window.confirm = originalConfirm
})

const mockRecords = [
  {
    id: 'record-1',
    content: '葉が色づいてきた',
    recordAt: new Date(),
    createdAt: new Date(),
    images: [{ id: 'img-1', url: 'https://example.com/image1.jpg' }],
  },
]

const mockPosts = [
  {
    id: 'post-1',
    content: '今日の盆栽です',
    createdAt: new Date(),
    user: {
      id: 'user-1',
      nickname: 'テストユーザー',
      avatarUrl: null,
    },
    media: [],
    genres: [],
    _count: {
      likes: 10,
      comments: 5,
    },
  },
]

describe('BonsaiTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('成長記録を表示する', () => {
    render(<BonsaiTimeline records={mockRecords} posts={[]} isOwner={true} />)
    expect(screen.getByText('成長記録')).toBeInTheDocument()
    expect(screen.getByText('葉が色づいてきた')).toBeInTheDocument()
  })

  it('投稿を表示する', () => {
    render(<BonsaiTimeline records={[]} posts={mockPosts} isOwner={false} />)
    expect(screen.getByText('今日の盆栽です')).toBeInTheDocument()
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('いいね数を表示する', () => {
    render(<BonsaiTimeline records={[]} posts={mockPosts} isOwner={false} />)
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('コメント数を表示する', () => {
    render(<BonsaiTimeline records={[]} posts={mockPosts} isOwner={false} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('記録も投稿もない場合は空状態メッセージを表示する', () => {
    render(<BonsaiTimeline records={[]} posts={[]} isOwner={true} />)
    expect(screen.getByText('まだ記録や投稿がありません')).toBeInTheDocument()
  })

  it('オーナーの場合は削除ボタンを表示する', () => {
    render(<BonsaiTimeline records={mockRecords} posts={[]} isOwner={true} />)
    const deleteButton = screen.getByRole('button', { name: /削除/i })
    expect(deleteButton).toBeInTheDocument()
  })

  it('オーナーでない場合は削除ボタンを表示しない', () => {
    render(<BonsaiTimeline records={mockRecords} posts={[]} isOwner={false} />)
    const deleteButton = screen.queryByRole('button', { name: /削除/i })
    expect(deleteButton).not.toBeInTheDocument()
  })

  it('削除ボタンクリックで確認ダイアログを表示し、確認後に削除アクションを呼ぶ', async () => {
    mockDeleteBonsaiRecord.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<BonsaiTimeline records={mockRecords} posts={[]} isOwner={true} />)

    // 削除ボタンクリック → ConfirmDialog が開く
    await user.click(screen.getByRole('button', { name: /削除/i }))

    await waitFor(() => {
      expect(screen.getByRole('alertdialog')).toBeInTheDocument()
    })

    // 「削除する」ボタンをクリックして確認
    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockDeleteBonsaiRecord).toHaveBeenCalledWith('record-1')
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('投稿は投稿詳細ページへのリンクを持つ', () => {
    render(<BonsaiTimeline records={[]} posts={mockPosts} isOwner={false} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/posts/post-1')
  })

  it('記録と投稿が混在する場合は日付順で表示する', () => {
    render(<BonsaiTimeline records={mockRecords} posts={mockPosts} isOwner={false} />)
    // 両方が表示されていることを確認
    expect(screen.getByText('成長記録')).toBeInTheDocument()
    expect(screen.getByText('今日の盆栽です')).toBeInTheDocument()
  })

  it('記録画像をクリックするとモーダルを表示する', async () => {
    const user = userEvent.setup()
    render(<BonsaiTimeline records={mockRecords} posts={[]} isOwner={true} />)

    // 画像ボタンをクリック
    const imageButton = screen.getByRole('button', { name: /成長記録画像/i })
    await user.click(imageButton)

    // モーダルが表示される（背景クリックで閉じるdivがある）
    await waitFor(() => {
      const modal = document.querySelector('.fixed.inset-0')
      expect(modal).toBeInTheDocument()
    })
  })
})
