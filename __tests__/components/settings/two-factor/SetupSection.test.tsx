import { vi } from 'vitest'
/**
 * SetupSectionコンポーネントのテスト
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Server Actionsモック
const mockSetup2FA = vi.fn()
const mockEnable2FA = vi.fn()

vi.mock('@/lib/actions/two-factor', () => ({
  setup2FA: () => mockSetup2FA(),
  enable2FA: (...args: unknown[]) => mockEnable2FA(...args),
}))

// limits モック
vi.mock('@/lib/constants/limits', () => ({
  TWO_FACTOR_CODE_LENGTH: 6,
  TIMEOUT_COPIED_FEEDBACK: 2000,
  MAX_REVIEW_IMAGES: 3,
  MIN_ADDRESS_SEARCH_LENGTH: 3,
  TIMEOUT_DROPDOWN_BLUR: 150,
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

import { SetupSection } from '@/components/settings/two-factor/SetupSection'

describe('SetupSection', () => {
  const mockOnSuccess = vi.fn()
  const mockOnClose = vi.fn()

  const mockSetupData = {
    qrCode: 'data:image/png;base64,testqr',
    secret: 'TESTSECRET123',
    setupId: 'test-setup-id',
    backupCodes: ['CODE1', 'CODE2', 'CODE3', 'CODE4', 'CODE5', 'CODE6', 'CODE7', 'CODE8'],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    // Clipboard APIのモック
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    })
  })

  // ============================================================
  // アイドル状態
  // ============================================================

  describe('アイドル状態', () => {
    it('セットアップボタンが表示される', () => {
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
    })

    it('説明テキストが表示される', () => {
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      expect(screen.getByText(/2段階認証を有効にすると/)).toBeInTheDocument()
    })
  })

  // ============================================================
  // セットアップフロー
  // ============================================================

  describe('セットアップフロー', () => {
    beforeEach(() => {
      mockSetup2FA.mockResolvedValue({
        success: true,
        data: mockSetupData,
      })
    })

    it('セットアップボタンをクリックするとQRコードが表示される', async () => {
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByAltText('2FA QRコード')).toBeInTheDocument()
      })
    })

    it('セットアップ後にシークレットキーが表示される', async () => {
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByText('TESTSECRET123')).toBeInTheDocument()
      })
    })

    it('バックアップコードが表示される', async () => {
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByText('CODE1')).toBeInTheDocument()
        expect(screen.getByText('CODE8')).toBeInTheDocument()
      })
    })

    it('認証コード入力フィールドが表示される', async () => {
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })
    })

    it('キャンセルボタンをクリックするとアイドル状態に戻る', async () => {
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })

      await user.click(screen.getByText('キャンセル'))

      await waitFor(() => {
        expect(screen.getByText('2段階認証を設定する')).toBeInTheDocument()
      })
    })

    it('6桁未満のコードでは有効化ボタンが無効', async () => {
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('認証コード'), '12345')

      expect(screen.getByText('2段階認証を有効化')).toBeDisabled()
    })
  })

  // ============================================================
  // セットアップエラー
  // ============================================================

  describe('セットアップエラー', () => {
    it('setup2FA失敗時にエラーメッセージを表示する', async () => {
      mockSetup2FA.mockResolvedValue({ success: false, error: 'セットアップに失敗しました' })
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByText('セットアップに失敗しました')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // 有効化フロー
  // ============================================================

  describe('有効化フロー', () => {
    beforeEach(() => {
      mockSetup2FA.mockResolvedValue({
        success: true,
        data: mockSetupData,
      })
    })

    it('正しい認証コードで2FAを有効化できる', async () => {
      mockEnable2FA.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('認証コード'), '123456')
      await user.click(screen.getByText('2段階認証を有効化'))

      await waitFor(() => {
        expect(screen.getByText('2段階認証が有効になりました')).toBeInTheDocument()
      })
    })

    it('有効化成功後にonSuccessが呼ばれる', async () => {
      mockEnable2FA.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('認証コード'), '123456')
      await user.click(screen.getByText('2段階認証を有効化'))

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith(8)
      })
    })

    it('有効化エラー時にエラーメッセージを表示する', async () => {
      mockEnable2FA.mockResolvedValue({ success: false, error: '認証コードが正しくありません' })
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('認証コード'), '123456')
      await user.click(screen.getByText('2段階認証を有効化'))

      await waitFor(() => {
        expect(screen.getByText('認証コードが正しくありません')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // コピー機能
  // ============================================================

  describe('コピー機能', () => {
    beforeEach(() => {
      mockSetup2FA.mockResolvedValue({
        success: true,
        data: mockSetupData,
      })
    })

    it('全てコピーボタンが表示される', async () => {
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByText('全てコピー')).toBeInTheDocument()
      })
    })

    it('全てコピーボタンをクリックするとテキストが変わる', async () => {
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByText('全てコピー')).toBeInTheDocument()
      })

      await user.click(screen.getByText('全てコピー'))

      await waitFor(() => {
        expect(screen.getByText('コピーしました！')).toBeInTheDocument()
      })
    })
  })

  // ============================================================
  // 成功後のUI
  // ============================================================

  describe('成功後のUI', () => {
    it('閉じるボタンをクリックするとonCloseが呼ばれる', async () => {
      mockSetup2FA.mockResolvedValue({
        success: true,
        data: mockSetupData,
      })
      mockEnable2FA.mockResolvedValue({ success: true })
      const user = userEvent.setup()
      render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

      await user.click(screen.getByText('2段階認証を設定する'))

      await waitFor(() => {
        expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
      })

      await user.type(screen.getByLabelText('認証コード'), '123456')
      await user.click(screen.getByText('2段階認証を有効化'))

      await waitFor(() => {
        expect(screen.getByText('閉じる')).toBeInTheDocument()
      })

      await user.click(screen.getByText('閉じる'))

      expect(mockOnClose).toHaveBeenCalled()
    })
  })
})
