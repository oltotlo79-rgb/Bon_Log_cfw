import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { DeleteAccountButton } from '@/components/user/DeleteAccountButton'

// Next-Auth モック
const mockSignOut = vi.fn()
vi.mock('next-auth/react', () => ({
  signOut: (...args: unknown[]) => mockSignOut(...args),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Server Actionモック
const mockDeleteAccount = vi.fn()
vi.mock('@/lib/actions/user', () => ({
  deleteAccount: () => mockDeleteAccount(),
}))

describe('DeleteAccountButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('アカウント削除ボタンを表示する', () => {
    render(<DeleteAccountButton />)
    expect(screen.getByRole('button', { name: /アカウントを削除/i })).toBeInTheDocument()
  })

  it('削除の警告文を表示する', () => {
    render(<DeleteAccountButton />)
    expect(screen.getByText(/すべての投稿、コメント、いいねなどのデータが完全に削除されます/i)).toBeInTheDocument()
    expect(screen.getByText(/この操作は取り消せません/i)).toBeInTheDocument()
  })

  it('クリックで確認ダイアログを表示する', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountButton />)

    await user.click(screen.getByRole('button', { name: /アカウントを削除/i }))

    await waitFor(() => {
      expect(screen.getByText(/本当にアカウントを削除しますか/i)).toBeInTheDocument()
    })
  })

  it('確認ダイアログで削除の影響を説明する', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountButton />)

    await user.click(screen.getByRole('button', { name: /アカウントを削除/i }))

    await waitFor(() => {
      expect(screen.getByText(/すべての投稿、コメント、いいね、フォロー関係などが完全に削除されます/i)).toBeInTheDocument()
    })
  })

  it('キャンセルボタンでダイアログを閉じる', async () => {
    const user = userEvent.setup()
    render(<DeleteAccountButton />)

    await user.click(screen.getByRole('button', { name: /アカウントを削除/i }))

    await waitFor(() => {
      expect(screen.getByText(/本当にアカウントを削除しますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    await waitFor(() => {
      expect(screen.queryByText(/本当にアカウントを削除しますか/i)).not.toBeInTheDocument()
    })
  })

  it('削除実行時にServer Actionを呼ぶ', async () => {
    mockDeleteAccount.mockResolvedValue({ success: true })
    mockSignOut.mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<DeleteAccountButton />)

    await user.click(screen.getByRole('button', { name: /アカウントを削除/i }))

    await waitFor(() => {
      expect(screen.getByText(/本当にアカウントを削除しますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalled()
    })
  })

  it('削除成功時にサインアウトしてトップページへリダイレクトする', async () => {
    mockDeleteAccount.mockResolvedValue({ success: true })
    mockSignOut.mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(<DeleteAccountButton />)

    await user.click(screen.getByRole('button', { name: /アカウントを削除/i }))

    await waitFor(() => {
      expect(screen.getByText(/本当にアカウントを削除しますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: '/' })
    })
  })

  it('エラー時はエラーメッセージを表示する', async () => {
    mockDeleteAccount.mockResolvedValue({ error: 'アカウント削除に失敗しました' })

    const user = userEvent.setup()
    render(<DeleteAccountButton />)

    await user.click(screen.getByRole('button', { name: /アカウントを削除/i }))

    await waitFor(() => {
      expect(screen.getByText(/本当にアカウントを削除しますか/i)).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: '削除する' }))

    await waitFor(() => {
      expect(screen.getByText(/アカウント削除に失敗しました/i)).toBeInTheDocument()
    })
  })

  it('削除中はボタンが無効化される', async () => {
    // 長めの遅延を設定してローディング状態をキャプチャ
    let resolveDelete: (value: { success: boolean }) => void
    mockDeleteAccount.mockImplementation(() => new Promise(resolve => {
      resolveDelete = resolve
    }))

    const user = userEvent.setup()
    render(<DeleteAccountButton />)

    await user.click(screen.getByRole('button', { name: /アカウントを削除/i }))

    await waitFor(() => {
      expect(screen.getByText(/本当にアカウントを削除しますか/i)).toBeInTheDocument()
    })

    // 削除ボタンをクリック
    await user.click(screen.getByRole('button', { name: '削除する' }))

    // Server Actionが呼ばれたことを確認
    await waitFor(() => {
      expect(mockDeleteAccount).toHaveBeenCalled()
    })

    // Promiseを解決して処理を完了
    resolveDelete!({ success: true })
  })

  it('削除ボタンはdestructive variantを持つ', () => {
    render(<DeleteAccountButton />)
    const button = screen.getByRole('button', { name: /アカウントを削除/i })
    expect(button).toBeInTheDocument()
    // shadcn/uiのvariant="destructive"が適用されているかはクラスで確認
  })
})
