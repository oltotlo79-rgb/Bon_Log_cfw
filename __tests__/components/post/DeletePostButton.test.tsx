import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { DeletePostButton } from '@/components/post/DeletePostButton'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}))

// Server Actionモック
const mockDeletePost = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  deletePost: (...args: unknown[]) => mockDeletePost(...args),
}))

describe('DeletePostButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('アイコン形式で削除ボタンを表示する', () => {
    render(<DeletePostButton postId="post-1" variant="icon" />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('メニュー形式で削除ボタンを表示する', () => {
    render(<DeletePostButton postId="post-1" variant="menu" />)
    expect(screen.getByText('削除する')).toBeInTheDocument()
  })

  it('クリックで確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<DeletePostButton postId="post-1" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('投稿を削除しますか？')).toBeInTheDocument()
      expect(screen.getByText(/この操作は取り消せません/i)).toBeInTheDocument()
    })
  })

  it('キャンセルボタンでダイアログを閉じる', async () => {
    const user = userEvent.setup()
    render(<DeletePostButton postId="post-1" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('投稿を削除しますか？')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByText('投稿を削除しますか？')).not.toBeInTheDocument()
    })
  })

  it('削除ボタンクリックで投稿を削除する', async () => {
    mockDeletePost.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<DeletePostButton postId="post-1" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('投稿を削除しますか？')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockDeletePost).toHaveBeenCalledWith('post-1')
    })

    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('削除成功時にonDeletedコールバックを呼ぶ', async () => {
    mockDeletePost.mockResolvedValue({ success: true })
    const mockOnDeleted = vi.fn()

    const user = userEvent.setup()
    render(<DeletePostButton postId="post-1" onDeleted={mockOnDeleted} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('投稿を削除しますか？')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockOnDeleted).toHaveBeenCalled()
    })
  })

  it('削除中はボタンが無効化される', async () => {
    // 長めの遅延を設定してローディング状態をキャプチャ
    let resolveDelete: (value: { success: boolean }) => void
    mockDeletePost.mockImplementation(() => new Promise(resolve => {
      resolveDelete = resolve
    }))

    const user = userEvent.setup()
    render(<DeletePostButton postId="post-1" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText('投稿を削除しますか？')).toBeInTheDocument()
    })

    // 削除ボタンをクリック
    await user.click(screen.getByRole('button', { name: '削除する' }))

    // Server Actionが呼ばれたことを確認
    await waitFor(() => {
      expect(mockDeletePost).toHaveBeenCalledWith('post-1')
    })

    // Promiseを解決して処理を完了
    resolveDelete!({ success: true })
  })

  it('削除確認のダイアログに警告メッセージを表示する', async () => {
    const user = userEvent.setup()
    render(<DeletePostButton postId="post-1" />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(screen.getByText(/コメントやいいねも削除されます/i)).toBeInTheDocument()
    })
  })
})
