import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ReportModal } from '@/components/report/ReportModal'

// Server Action モック
const mockCreateReport = vi.fn()
vi.mock('@/lib/actions/report', () => ({
  createReport: (...args: unknown[]) => mockCreateReport(...args),
}))

// createPortal モック
vi.mock('react-dom', async () => ({
  ...(await vi.importActual('react-dom')),
  createPortal: (node: React.ReactNode) => node,
}))

describe('ReportModal', () => {
  const defaultProps = {
    targetType: 'post' as const,
    targetId: 'post-123',
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('モーダルのタイトルを表示する', () => {
    render(<ReportModal {...defaultProps} />)
    expect(screen.getByText('投稿を通報')).toBeInTheDocument()
  })

  it('対象タイプに応じたタイトルを表示する', () => {
    render(<ReportModal {...defaultProps} targetType="comment" />)
    expect(screen.getByText('コメントを通報')).toBeInTheDocument()
  })

  it('通報理由の選択肢を表示する', () => {
    render(<ReportModal {...defaultProps} />)
    expect(screen.getByText('スパム')).toBeInTheDocument()
    expect(screen.getByText('不適切な内容')).toBeInTheDocument()
    expect(screen.getByText('誹謗中傷')).toBeInTheDocument()
    expect(screen.getByText('著作権侵害')).toBeInTheDocument()
    expect(screen.getByText('その他')).toBeInTheDocument()
  })

  it('詳細説明のテキストエリアを表示する', () => {
    render(<ReportModal {...defaultProps} />)
    expect(screen.getByPlaceholderText(/問題の詳細があれば/)).toBeInTheDocument()
  })

  it('理由未選択時は送信ボタンが無効', () => {
    render(<ReportModal {...defaultProps} />)
    expect(screen.getByRole('button', { name: '通報する' })).toBeDisabled()
  })

  it('理由を選択すると送信ボタンが有効になる', async () => {
    const user = userEvent.setup()
    render(<ReportModal {...defaultProps} />)

    await user.click(screen.getByText('スパム'))

    expect(screen.getByRole('button', { name: '通報する' })).not.toBeDisabled()
  })

  it('閉じるボタンでonCloseが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<ReportModal {...defaultProps} />)

    // Xボタンをクリック
    const closeButtons = screen.getAllByRole('button')
    await user.click(closeButtons[0]!) // 最初のボタンがXボタン

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('キャンセルボタンでonCloseが呼ばれる', async () => {
    const user = userEvent.setup()
    render(<ReportModal {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))

    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('通報を送信できる', async () => {
    mockCreateReport.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ReportModal {...defaultProps} />)

    // 理由を選択
    await user.click(screen.getByText('スパム'))
    // 送信
    await user.click(screen.getByRole('button', { name: '通報する' }))

    await waitFor(() => {
      expect(mockCreateReport).toHaveBeenCalledWith({
        targetType: 'post',
        targetId: 'post-123',
        reason: 'spam',
        description: undefined,
      })
    })
  })

  it('詳細説明を入力して送信できる', async () => {
    mockCreateReport.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ReportModal {...defaultProps} />)

    // 理由を選択
    await user.click(screen.getByText('不適切な内容'))
    // 詳細を入力
    await user.type(screen.getByPlaceholderText(/問題の詳細があれば/), '具体的な問題点')
    // 送信
    await user.click(screen.getByRole('button', { name: '通報する' }))

    await waitFor(() => {
      expect(mockCreateReport).toHaveBeenCalledWith({
        targetType: 'post',
        targetId: 'post-123',
        reason: 'inappropriate',
        description: '具体的な問題点',
      })
    })
  })

  it('送信成功時に完了メッセージを表示する', async () => {
    mockCreateReport.mockResolvedValue({ success: true })
    const user = userEvent.setup()
    render(<ReportModal {...defaultProps} />)

    await user.click(screen.getByText('スパム'))
    await user.click(screen.getByRole('button', { name: '通報する' }))

    await waitFor(() => {
      expect(screen.getByText('通報を受け付けました')).toBeInTheDocument()
    })
  })

  it('送信エラー時にエラーメッセージを表示する', async () => {
    mockCreateReport.mockResolvedValue({ error: '通報に失敗しました' })
    const user = userEvent.setup()
    render(<ReportModal {...defaultProps} />)

    await user.click(screen.getByText('スパム'))
    await user.click(screen.getByRole('button', { name: '通報する' }))

    await waitFor(() => {
      expect(screen.getByText('通報に失敗しました')).toBeInTheDocument()
    })
  })

  it('送信中はボタンが無効化される', async () => {
    // 並列実行下のフレークを避けるため、解決を手動制御する Promise を使う。
    // 旧実装は setTimeout(100ms) に依存しており、パラレル負荷で送信完了が
    // disabled 状態の検証より早く起きるケースがあった。
    let resolveCreate: ((value: { success: true }) => void) | undefined
    mockCreateReport.mockImplementation(
      () => new Promise<{ success: true }>((resolve) => { resolveCreate = resolve as (value: { success: true }) => void })
    )
    const user = userEvent.setup()
    render(<ReportModal {...defaultProps} />)

    await user.click(screen.getByText('スパム'))
    await user.click(screen.getByRole('button', { name: '通報する' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '送信中...' })).toBeDisabled()
    })

    // 後始末: pending Promise を解決させてリーク警告を防ぐ
    resolveCreate?.({ success: true as const })
  })

  it('文字数カウンターを表示する', async () => {
    const user = userEvent.setup()
    render(<ReportModal {...defaultProps} />)

    expect(screen.getByText('0/500')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/問題の詳細があれば/), 'テスト')

    expect(screen.getByText('3/500')).toBeInTheDocument()
  })

  it('ユーザー通報の場合は正しいタイトルを表示する', () => {
    render(<ReportModal {...defaultProps} targetType="user" targetId="user-456" />)
    expect(screen.getByText('ユーザーを通報')).toBeInTheDocument()
  })
})
