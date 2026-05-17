import { vi } from 'vitest'
/**
 * RegenerateBackupCodesコンポーネントのテスト
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Server Actionsモック
const mockRegenerateBackupCodes = vi.fn()
vi.mock('@/lib/actions/two-factor', () => ({
  regenerateBackupCodes: (...args: unknown[]) => mockRegenerateBackupCodes(...args),
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

import { RegenerateBackupCodes } from '@/components/settings/two-factor/RegenerateBackupCodes'

describe('RegenerateBackupCodes', () => {
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
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByText('バックアップコードを再生成')).toBeInTheDocument()
    })

    it('パスワード入力フィールドが表示される', () => {
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    })

    it('パスワード入力フィールドの初期タイプがpasswordである', () => {
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByLabelText('パスワード')).toHaveAttribute('type', 'password')
    })

    it('再生成ボタンが表示される', () => {
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: '再生成' })).toBeInTheDocument()
    })

    it('キャンセルボタンが表示される', () => {
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument()
    })

    it('説明テキストが表示される', () => {
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByText(/パスワードを入力して、新しいバックアップコードを生成します/)).toBeInTheDocument()
    })
  })

  // ============================================================
  // バリデーション
  // ============================================================

  describe('バリデーション', () => {
    it('パスワード未入力の場合、再生成ボタンが無効になる', () => {
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      expect(screen.getByRole('button', { name: '再生成' })).toBeDisabled()
    })

    it('パスワードを入力すると再生成ボタンが有効になる', async () => {
      const user = userEvent.setup()
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'password123')

      expect(screen.getByRole('button', { name: '再生成' })).not.toBeDisabled()
    })
  })

  // ============================================================
  // 送信処理
  // ============================================================

  describe('送信処理', () => {
    it('再生成アクションが正しいパスワードで呼ばれる', async () => {
      mockRegenerateBackupCodes.mockResolvedValue({
        success: true,
        data: { backupCodes: ['NEW1', 'NEW2', 'NEW3', 'NEW4', 'NEW5', 'NEW6', 'NEW7', 'NEW8'] },
      })
      const user = userEvent.setup()
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'password123')
      await user.click(screen.getByRole('button', { name: '再生成' }))

      await waitFor(() => {
        expect(mockRegenerateBackupCodes).toHaveBeenCalledWith('password123')
      })
    })

    it('再生成成功後にonSuccessが新しいコードと共に呼ばれる', async () => {
      const newCodes = ['NEW1', 'NEW2', 'NEW3', 'NEW4', 'NEW5', 'NEW6', 'NEW7', 'NEW8']
      mockRegenerateBackupCodes.mockResolvedValue({
        success: true,
        data: { backupCodes: newCodes },
      })
      const user = userEvent.setup()
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'password123')
      await user.click(screen.getByRole('button', { name: '再生成' }))

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(newCodes)
      })
    })

    it('再生成失敗時にエラーメッセージを表示する', async () => {
      mockRegenerateBackupCodes.mockResolvedValue({
        success: false,
        error: 'パスワードが正しくありません',
      })
      const user = userEvent.setup()
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'wrongpass')
      await user.click(screen.getByRole('button', { name: '再生成' }))

      await waitFor(() => {
        expect(screen.getByText('パスワードが正しくありません')).toBeInTheDocument()
      })
    })

    it('再生成失敗時にonSuccessが呼ばれない', async () => {
      mockRegenerateBackupCodes.mockResolvedValue({
        success: false,
        error: 'エラー',
      })
      const user = userEvent.setup()
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'wrongpass')
      await user.click(screen.getByRole('button', { name: '再生成' }))

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
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

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
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

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
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

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
    it('送信中は「生成中...」と表示される', async () => {
      mockRegenerateBackupCodes.mockImplementation(() => new Promise(() => {}))
      const user = userEvent.setup()
      render(<RegenerateBackupCodes onSuccess={mockOnSuccess} onCancel={mockOnCancel} />)

      await user.type(screen.getByLabelText('パスワード'), 'password123')
      await user.click(screen.getByRole('button', { name: '再生成' }))

      await waitFor(() => {
        expect(screen.getByText('生成中...')).toBeInTheDocument()
      })
    })
  })
})
