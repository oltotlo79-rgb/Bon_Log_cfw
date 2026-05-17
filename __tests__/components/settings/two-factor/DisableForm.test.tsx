import { vi } from 'vitest'
/**
 * DisableFormコンポーネントのテスト
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Server Actionsモック
const mockDisable2FA = vi.fn()
vi.mock('@/lib/actions/two-factor', () => ({
  disable2FA: (...args: unknown[]) => mockDisable2FA(...args),
}))

// icons モック
vi.mock('@/components/settings/two-factor/icons', () => ({
  EyeIcon: ({ className }: { className?: string }) => (
    <svg data-testid="eye-icon" className={className} />
  ),
  EyeOffIcon: ({ className }: { className?: string }) => (
    <svg data-testid="eye-off-icon" className={className} />
  ),
  CopyIcon: ({ className }: { className?: string }) => (
    <svg data-testid="copy-icon" className={className} />
  ),
  CheckIcon: ({ className }: { className?: string }) => (
    <svg data-testid="check-icon" className={className} />
  ),
}))

import { DisableForm } from '@/components/settings/two-factor/DisableForm'

describe('DisableForm', () => {
  const mockOnSuccess = vi.fn()
  const mockOnCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ============================================================
  // レンダリング
  // ============================================================

  describe('レンダリング', () => {
    it('フォームが正常にレンダリングされる', () => {
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByText('2段階認証を無効化')).toBeInTheDocument()
    })

    it('パスワード入力フィールドが表示される', () => {
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    })

    it('パスワード入力フィールドの初期タイプがpasswordである', () => {
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText('パスワード')).toHaveAttribute('type', 'password')
    })

    it('無効化するボタンが表示される', () => {
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: '無効化する' })).toBeInTheDocument()
    })

    it('キャンセルボタンが表示される', () => {
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    })

    it('説明テキストが表示される', () => {
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByText(/パスワードを入力して、2段階認証を無効にします/)).toBeInTheDocument()
    })
  })

  // ============================================================
  // バリデーション
  // ============================================================

  describe('バリデーション', () => {
    it('パスワード未入力の場合、無効化するボタンが無効になる', () => {
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: '無効化する' })).toBeDisabled()
    })

    it('パスワードを入力すると無効化するボタンが有効になる', async () => {
      const user = userEvent.setup()
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'password123')

      expect(screen.getByRole('button', { name: '無効化する' })).not.toBeDisabled()
    })
  })

  // ============================================================
  // 送信処理
  // ============================================================

  describe('送信処理', () => {
    it('正しいパスワードで無効化アクションが呼ばれる', async () => {
      mockDisable2FA.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'password123')
      await user.click(screen.getByRole('button', { name: '無効化する' }))

      await waitFor(() => {
        expect(mockDisable2FA).toHaveBeenCalledWith('password123')
      })
    })

    it('無効化成功後にonSuccessが呼ばれる', async () => {
      mockDisable2FA.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'password123')
      await user.click(screen.getByRole('button', { name: '無効化する' }))

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled()
      })
    })

    it('無効化失敗時にエラーメッセージを表示する', async () => {
      mockDisable2FA.mockResolvedValue({ success: false, error: 'パスワードが正しくありません' })
      const user = userEvent.setup()
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'wrongpass')
      await user.click(screen.getByRole('button', { name: '無効化する' }))

      await waitFor(() => {
        expect(screen.getByText('パスワードが正しくありません')).toBeInTheDocument()
      })
    })

    it('無効化失敗時にonSuccessが呼ばれない', async () => {
      mockDisable2FA.mockResolvedValue({ success: false, error: 'エラー' })
      const user = userEvent.setup()
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'wrongpass')
      await user.click(screen.getByRole('button', { name: '無効化する' }))

      await waitFor(() => {
        expect(mockOnSuccess).not.toHaveBeenCalled()
      })
    })
  })

  // ============================================================
  // キャンセル
  // ============================================================

  describe('キャンセル', () => {
    it('キャンセルボタンでonCancelが呼ばれる', async () => {
      const user = userEvent.setup()
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.click(screen.getByRole('button', { name: 'キャンセル' }))

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  // ============================================================
  // パスワード表示切替
  // ============================================================

  describe('パスワード表示切替', () => {
    it('目のアイコンボタンをクリックするとパスワードが表示される', async () => {
      const user = userEvent.setup()
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      const passwordInput = screen.getByLabelText('パスワード')
      expect(passwordInput).toHaveAttribute('type', 'password')

      const toggleButton = passwordInput.parentElement?.querySelector('button[type="button"]')
      expect(toggleButton).toBeTruthy()

      if (toggleButton) {
        await user.click(toggleButton)
        expect(passwordInput).toHaveAttribute('type', 'text')
      }
    })

    it('目のアイコンボタンを再度クリックするとパスワードが非表示になる', async () => {
      const user = userEvent.setup()
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      const passwordInput = screen.getByLabelText('パスワード')
      const toggleButton = passwordInput.parentElement?.querySelector('button[type="button"]')

      if (toggleButton) {
        await user.click(toggleButton)
        expect(passwordInput).toHaveAttribute('type', 'text')

        await user.click(toggleButton)
        expect(passwordInput).toHaveAttribute('type', 'password')
      }
    })
  })

  // ============================================================
  // ローディング状態
  // ============================================================

  describe('ローディング状態', () => {
    it('送信中は「無効化中...」と表示される', async () => {
      mockDisable2FA.mockImplementation(() => new Promise(() => {}))
      const user = userEvent.setup()
      render(<DisableForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'password123')
      await user.click(screen.getByRole('button', { name: '無効化する' }))

      await waitFor(() => {
        expect(screen.getByText('無効化中...')).toBeInTheDocument()
      })
    })
  })
})
