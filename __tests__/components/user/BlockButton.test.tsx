import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { BlockButton } from '@/components/user/BlockButton'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Next.js navigation モック
vi.mock('next/navigation', () => ({
  useRouter: () => ({}),
}))

// React Query モック
const mockInvalidateQueries = vi.fn()
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query')
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
    }),
  }
})

// Toast モック
const mockToast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}))

// Server Actionモック
const mockBlockUser = vi.fn()
const mockUnblockUser = vi.fn()
vi.mock('@/lib/actions/block', () => ({
  blockUser: (...args: unknown[]) => mockBlockUser(...args),
  unblockUser: (...args: unknown[]) => mockUnblockUser(...args),
}))

describe('BlockButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未ブロック状態でブロックボタンを表示する', () => {
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={false} />)
    expect(screen.getByRole('button', { name: /ブロック/i })).toBeInTheDocument()
  })

  it('ブロック済み状態でブロック解除ボタンを表示する', () => {
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={true} />)
    expect(screen.getByRole('button', { name: /ブロック解除/i })).toBeInTheDocument()
  })

  it('ブロックボタンクリックで確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={false} />)

    await user.click(screen.getByRole('button', { name: /ブロック/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをブロックしますか/i)).toBeInTheDocument()
    })
  })

  it('確認ダイアログでブロックの影響を説明する', async () => {
    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={false} />)

    await user.click(screen.getByRole('button', { name: /ブロック/i }))

    await waitFor(() => {
      expect(screen.getByText(/相互フォローが解除されます/i)).toBeInTheDocument()
      expect(screen.getByText(/相手の投稿が表示されなくなります/i)).toBeInTheDocument()
    })
  })

  it('キャンセルボタンでダイアログを閉じる', async () => {
    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={false} />)

    await user.click(screen.getByRole('button', { name: /ブロック/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをブロックしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByText(/テストユーザーさんをブロックしますか/i)).not.toBeInTheDocument()
    })
  })

  it('ブロック実行時にServer Actionを呼ぶ', async () => {
    mockBlockUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={false} />)

    await user.click(screen.getByRole('button', { name: /ブロック/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをブロックしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ブロック' }))

    await waitFor(() => {
      expect(mockBlockUser).toHaveBeenCalledWith('user-1')
    })
  })

  it('ブロック成功時にトーストを表示する', async () => {
    mockBlockUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={false} />)

    await user.click(screen.getByRole('button', { name: /ブロック/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをブロックしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ブロック' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'ブロックしました',
      }))
    })
  })

  it('ブロック解除ボタンクリックで直接解除する（確認ダイアログなし）', async () => {
    mockUnblockUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={true} />)

    await user.click(screen.getByRole('button', { name: /ブロック解除/i }))

    await waitFor(() => {
      expect(mockUnblockUser).toHaveBeenCalledWith('user-1')
    })
  })

  it('ブロック解除成功時にトーストを表示する', async () => {
    mockUnblockUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={true} />)

    await user.click(screen.getByRole('button', { name: /ブロック解除/i }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'ブロックを解除しました',
      }))
    })
  })

  it('エラー時はロールバックしてトーストを表示する', async () => {
    mockBlockUser.mockResolvedValue({ error: 'エラーが発生しました' })

    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={false} />)

    await user.click(screen.getByRole('button', { name: /ブロック/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをブロックしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ブロック' }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'エラー',
        variant: 'destructive',
      }))
    })

    // ロールバック: ブロック解除ではなくブロックボタンが表示される
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^ブロック$/i })).toBeInTheDocument()
    })
  })

  it('ローディング中はボタンが無効化される', async () => {
    mockBlockUser.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 500)))

    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={false} />)

    await user.click(screen.getByRole('button', { name: /ブロック/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをブロックしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ブロック' }))

    await waitFor(() => {
      const disabledButton = screen.getAllByRole('button').find((el) => (el as HTMLButtonElement).disabled)
      expect(disabledButton).toBeDefined()
    })
  })

  it('処理完了後にキャッシュを無効化する', async () => {
    mockBlockUser.mockResolvedValue({ success: true })

    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={false} />)

    await user.click(screen.getByRole('button', { name: /ブロック/i }))

    await waitFor(() => {
      expect(screen.getByText(/テストユーザーさんをブロックしますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'ブロック' }))

    await waitFor(() => {
      expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['timeline'] })
    })
  })

  it('ブロック解除エラー時はロールバックしてトーストを表示する', async () => {
    mockUnblockUser.mockResolvedValue({ error: 'ブロック解除に失敗しました' })

    const user = userEvent.setup()
    render(<BlockButton userId="user-1" nickname="テストユーザー" initialIsBlocked={true} />)

    await user.click(screen.getByRole('button', { name: /ブロック解除/i }))

    await waitFor(() => {
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: 'エラー',
        description: 'ブロック解除に失敗しました',
        variant: 'destructive',
      }))
    })

    // ロールバック: ブロック解除ボタンが再び表示される
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ブロック解除/i })).toBeInTheDocument()
    })
  })
})
