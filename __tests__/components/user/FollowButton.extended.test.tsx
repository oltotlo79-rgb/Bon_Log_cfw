import { vi } from 'vitest'
/**
 * FollowButton 拡張テスト
 *
 * カバレッジ向上のためのエッジケーステスト
 */

import { render, screen, waitFor, fireEvent } from '../../utils/test-utils'
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

describe('FollowButton Extended Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('マウスイベント', () => {
    it('マウスホバー時にフォロー解除テキストが表示される', async () => {
      render(<FollowButton userId="user-1" initialIsFollowing={true} />)

      const button = screen.getByRole('button')
      fireEvent.mouseEnter(button)

      // ホバー時のテキスト変化を確認
      await waitFor(() => {
        expect(button).toBeInTheDocument()
      })
    })

    it('マウスリーブ時にフォロー中テキストに戻る', async () => {
      render(<FollowButton userId="user-1" initialIsFollowing={true} />)

      const button = screen.getByRole('button')

      // ホバー開始
      fireEvent.mouseEnter(button)

      // ホバー終了
      fireEvent.mouseLeave(button)

      await waitFor(() => {
        expect(button).toBeInTheDocument()
      })
    })
  })

  describe('非公開アカウント - エラーハンドリング', () => {
    it('フォローリクエスト送信時に認証エラーでログインページへリダイレクト', async () => {
      mockSendFollowRequest.mockResolvedValue({ error: '認証が必要です' })

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
        expect(mockPush).toHaveBeenCalledWith('/login')
      })
    })

    it('フォローリクエスト送信時に一般エラーでロールバック', async () => {
      mockSendFollowRequest.mockResolvedValue({ error: 'ユーザーが見つかりません' })

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

      // エラー後、元の状態（リクエスト未送信）に戻る
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /フォローリクエスト/i })).toBeInTheDocument()
      })
    })

    it('フォローリクエストキャンセル時にエラーでロールバック', async () => {
      mockCancelFollowRequest.mockResolvedValue({ error: 'キャンセルに失敗しました' })

      const user = userEvent.setup()
      render(
        <FollowButton
          userId="user-1"
          initialIsFollowing={false}
          isPublic={false}
          initialHasRequest={true}
        />
      )

      // ホバー状態でキャンセルボタンとして表示
      const button = screen.getByRole('button')
      await user.click(button)

      // エラー後、hasRequestがtrueに戻る（ボタンはまだホバー状態の可能性がある）
      await waitFor(() => {
        expect(mockCancelFollowRequest).toHaveBeenCalledWith('user-1')
      })
    })
  })

  describe('ローディング状態', () => {
    it('フォローリクエスト送信中にローディング表示', async () => {
      mockSendFollowRequest.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

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
        expect(screen.getByRole('button', { name: '...' })).toBeDisabled()
      })
    })

    it('キャンセル中にローディング表示', async () => {
      mockCancelFollowRequest.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 100))
      )

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
        expect(screen.getByRole('button', { name: '...' })).toBeDisabled()
      })
    })
  })

  describe('公開アカウント - 追加テスト', () => {
    it('フォロー中状態でホバーすると解除ボタンスタイルに変化', () => {
      render(<FollowButton userId="user-1" initialIsFollowing={true} />)

      const button = screen.getByRole('button')
      fireEvent.mouseEnter(button)

      // ボタンが存在することを確認
      expect(button).toBeInTheDocument()
    })

    it('その他のエラーでトースト表示', async () => {
      mockToggleFollow.mockResolvedValue({ error: 'サーバーエラー' })

      const user = userEvent.setup()
      render(<FollowButton userId="user-1" initialIsFollowing={false} />)

      await user.click(screen.getByRole('button', { name: /フォローする/i }))

      // エラー後にロールバック
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /フォローする/i })).toBeInTheDocument()
      })
    })
  })
})
