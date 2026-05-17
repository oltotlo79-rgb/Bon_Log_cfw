import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { FollowButton } from '@/components/user/FollowButton'

// Next.js navigation モック
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}))

// Server Actionモック
const mockToggleFollow = vi.fn()
vi.mock('@/lib/actions/follow', () => ({
  toggleFollow: (...args: unknown[]) => mockToggleFollow(...args),
}))

// フォローリクエストServer Actionモック
const mockSendFollowRequest = vi.fn()
const mockCancelFollowRequest = vi.fn()
vi.mock('@/lib/actions/follow-request', () => ({
  sendFollowRequest: (...args: unknown[]) => mockSendFollowRequest(...args),
  cancelFollowRequest: (...args: unknown[]) => mockCancelFollowRequest(...args),
}))

describe('FollowButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未フォロー状態でフォローボタンを表示する', () => {
    render(<FollowButton userId="user-1" initialIsFollowing={false} />)
    expect(screen.getByRole('button', { name: /フォローする/i })).toBeInTheDocument()
  })

  it('フォロー中状態でボタンを表示する', () => {
    render(<FollowButton userId="user-1" initialIsFollowing={true} />)
    // フォロー中またはフォロー解除(ホバー時)のいずれかが表示される
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('クリックでフォローをトグルする（未フォロー→フォロー）', async () => {
    mockToggleFollow.mockResolvedValue({ success: true, data: { following: true } })

    const user = userEvent.setup()
    render(<FollowButton userId="user-1" initialIsFollowing={false} />)

    await user.click(screen.getByRole('button', { name: /フォローする/i }))

    await waitFor(() => {
      expect(mockToggleFollow).toHaveBeenCalledWith('user-1')
    })
  })

  it('クリックでフォローをトグルする（フォロー→解除）', async () => {
    mockToggleFollow.mockResolvedValue({ success: true, data: { following: false } })

    const user = userEvent.setup()
    render(<FollowButton userId="user-1" initialIsFollowing={true} />)

    await user.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(mockToggleFollow).toHaveBeenCalledWith('user-1')
    })
  })

  it('エラー時は元の状態にロールバックする', async () => {
    mockToggleFollow.mockResolvedValue({ success: false, error: 'エラーが発生しました' })

    const user = userEvent.setup()
    render(<FollowButton userId="user-1" initialIsFollowing={false} />)

    await user.click(screen.getByRole('button', { name: /フォローする/i }))

    // エラー後にロールバックして元の状態に戻る
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /フォローする/i })).toBeInTheDocument()
    })
  })

  it('認証エラー時はログインページにリダイレクトする', async () => {
    mockToggleFollow.mockResolvedValue({ success: false, error: '認証が必要です' })

    const user = userEvent.setup()
    render(<FollowButton userId="user-1" initialIsFollowing={false} />)

    await user.click(screen.getByRole('button', { name: /フォローする/i }))

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login')
    })
  })

  it('ローディング中はボタンテキストが...になる', async () => {
    mockToggleFollow.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))

    const user = userEvent.setup()
    render(<FollowButton userId="user-1" initialIsFollowing={false} />)

    await user.click(screen.getByRole('button', { name: /フォローする/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '...' })).toBeInTheDocument()
    })
  })

  it('ローディング中はボタンが無効化される', async () => {
    mockToggleFollow.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100)))

    const user = userEvent.setup()
    render(<FollowButton userId="user-1" initialIsFollowing={false} />)

    await user.click(screen.getByRole('button', { name: /フォローする/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '...' })).toBeDisabled()
    })
  })

  it('未フォロー状態では緑色のスタイルが適用される', () => {
    render(<FollowButton userId="user-1" initialIsFollowing={false} />)
    const button = screen.getByRole('button', { name: /フォローする/i })
    expect(button).toHaveClass('bg-bonsai-green')
  })

  // 非公開アカウント向けテスト
  describe('非公開アカウント', () => {
    it('非公開アカウントにはフォローリクエストボタンを表示する', () => {
      render(
        <FollowButton
          userId="user-1"
          initialIsFollowing={false}
          isPublic={false}
          initialHasRequest={false}
        />
      )
      expect(screen.getByRole('button', { name: /フォローリクエスト/i })).toBeInTheDocument()
    })

    it('リクエスト送信済みの場合はリクエスト済みを表示する', () => {
      render(
        <FollowButton
          userId="user-1"
          initialIsFollowing={false}
          isPublic={false}
          initialHasRequest={true}
        />
      )
      expect(screen.getByRole('button', { name: /リクエスト済み/i })).toBeInTheDocument()
    })

    it('フォローリクエストボタンクリックでリクエストを送信する', async () => {
      mockSendFollowRequest.mockResolvedValue({ success: true, status: 'pending' })

      const user = userEvent.setup()
      render(
        <FollowButton
          userId="user-1"
          initialIsFollowing={false}
          isPublic={false}
          initialHasRequest={false}
        />
      )

      await user.click(screen.getByRole('button', { name: /フォローリクエスト/i }))

      await waitFor(() => {
        expect(mockSendFollowRequest).toHaveBeenCalledWith('user-1')
      })
    })

    it('リクエスト済みボタンクリックでキャンセルする', async () => {
      mockCancelFollowRequest.mockResolvedValue({ success: true })

      const user = userEvent.setup()
      render(
        <FollowButton
          userId="user-1"
          initialIsFollowing={false}
          isPublic={false}
          initialHasRequest={true}
        />
      )

      await user.click(screen.getByRole('button', { name: /リクエスト済み/i }))

      await waitFor(() => {
        expect(mockCancelFollowRequest).toHaveBeenCalledWith('user-1')
      })
    })
  })
})
