import { vi } from 'vitest'
/**
 * SetupSection の追加カバレッジテスト
 *
 * 対象:
 * - 個別バックアップコードのコピー (handleCopyCode) とアイコン切り替え・自動リセット
 * - 全コピー後の自動リセット (handleCopyAllCodes の setTimeout コールバック)
 * - setup2FA / enable2FA が error フィールドを持たない失敗を返した場合のフォールバックメッセージ
 * - setup2FA が data の一部フィールドを欠いた場合のデフォルト値適用と、setupId 不在時の
 *   handleEnable ガード (`if (!setupId) return`)
 */

import { render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TIMEOUT_COPIED_FEEDBACK } from '@/lib/constants/limits'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

const mockSetup2FA = vi.fn()
const mockEnable2FA = vi.fn()

vi.mock('@/lib/actions/two-factor', () => ({
  setup2FA: () => mockSetup2FA(),
  enable2FA: (...args: unknown[]) => mockEnable2FA(...args),
}))

vi.mock('@/lib/constants/limits', () => ({
  TWO_FACTOR_CODE_LENGTH: 6,
  TIMEOUT_COPIED_FEEDBACK: 2000,
}))

vi.mock('@/components/settings/two-factor/icons', () => ({
  CopyIcon: ({ className }: { className?: string }) => (
    <svg data-testid="copy-icon" className={className} />
  ),
  CheckIcon: ({ className }: { className?: string }) => (
    <svg data-testid="check-icon" className={className} />
  ),
}))

import { SetupSection } from '@/components/settings/two-factor/SetupSection'

const mockSetupData = {
  qrCode: 'data:image/png;base64,testqr',
  secret: 'TESTSECRET123',
  setupId: 'test-setup-id',
  backupCodes: ['CODE1', 'CODE2', 'CODE3'],
}

function rowFor(code: string) {
  return screen.getByText(code).closest('div')!
}

describe('SetupSection - 追加カバレッジテスト', () => {
  const mockOnSuccess = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('個別コードのコピーボタンをクリックするとそのコードだけチェックアイコンになり、一定時間後に戻る', async () => {
    mockSetup2FA.mockResolvedValue({ success: true, data: mockSetupData })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    // @testing-library/user-event は setup() 時に navigator.clipboard を自前のスタブに
    // 差し替えるため、事前の Object.defineProperty ではなく setup 後に spyOn する
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText')
    render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

    await user.click(screen.getByText('2段階認証を設定する'))
    await waitFor(() => expect(screen.getByText('CODE1')).toBeInTheDocument())

    const copyButton = within(rowFor('CODE2')).getByRole('button')
    await user.click(copyButton)

    expect(writeTextSpy).toHaveBeenCalledWith('CODE2')
    await waitFor(() => {
      expect(within(rowFor('CODE2')).getByTestId('check-icon')).toBeInTheDocument()
    })
    // 他のコードはコピーアイコンのまま
    expect(within(rowFor('CODE1')).getByTestId('copy-icon')).toBeInTheDocument()

    await act(async () => {
      vi.advanceTimersByTime(TIMEOUT_COPIED_FEEDBACK)
    })

    await waitFor(() => {
      expect(within(rowFor('CODE2')).getByTestId('copy-icon')).toBeInTheDocument()
    })
  })

  it('全てコピー後、一定時間経過するとボタンラベルが「全てコピー」に戻る', async () => {
    mockSetup2FA.mockResolvedValue({ success: true, data: mockSetupData })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

    await user.click(screen.getByText('2段階認証を設定する'))
    await waitFor(() => expect(screen.getByText('全てコピー')).toBeInTheDocument())

    await user.click(screen.getByText('全てコピー'))
    await waitFor(() => expect(screen.getByText('コピーしました！')).toBeInTheDocument())

    await act(async () => {
      vi.advanceTimersByTime(TIMEOUT_COPIED_FEEDBACK)
    })

    await waitFor(() => {
      expect(screen.getByText('全てコピー')).toBeInTheDocument()
    })
  })

  it('setup2FA失敗が error フィールドを持たない場合、フォールバックメッセージを表示する', async () => {
    mockSetup2FA.mockResolvedValue({ success: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

    await user.click(screen.getByText('2段階認証を設定する'))

    await waitFor(() => {
      expect(screen.getByText(MSG_ERROR_FALLBACK)).toBeInTheDocument()
    })
  })

  it('enable2FA失敗が error フィールドを持たない場合、フォールバックメッセージを表示する', async () => {
    mockSetup2FA.mockResolvedValue({ success: true, data: mockSetupData })
    mockEnable2FA.mockResolvedValue({ success: false })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

    await user.click(screen.getByText('2段階認証を設定する'))
    await waitFor(() => expect(screen.getByLabelText('認証コード')).toBeInTheDocument())

    await user.type(screen.getByLabelText('認証コード'), '123456')
    await user.click(screen.getByText('2段階認証を有効化'))

    await waitFor(() => {
      expect(screen.getByText(MSG_ERROR_FALLBACK)).toBeInTheDocument()
    })
  })

  it('setup2FA の data が setupId を含まない場合、有効化を送信しても enable2FA は呼ばれない', async () => {
    // qrCode のみ返し secret/setupId/backupCodes を欠いたレスポンス（?? デフォルト適用を検証）
    mockSetup2FA.mockResolvedValue({ success: true, data: { qrCode: 'data:image/png;base64,onlyqr' } })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<SetupSection onSuccess={mockOnSuccess} onClose={mockOnClose} />)

    await user.click(screen.getByText('2段階認証を設定する'))
    await waitFor(() => expect(screen.getByLabelText('認証コード')).toBeInTheDocument())

    // secret が無いため手動コード表示は出ない
    expect(screen.queryByText(/QRコードを読み取れない場合/)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('認証コード'), '123456')
    await user.click(screen.getByText('2段階認証を有効化'))

    // setupId が null のため handleEnable は早期 return し、enable2FA は呼ばれない
    expect(mockEnable2FA).not.toHaveBeenCalled()
    expect(screen.getByLabelText('認証コード')).toBeInTheDocument()
  })
})
