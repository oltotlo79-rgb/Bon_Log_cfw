import { vi } from 'vitest'
import { render, screen, fireEvent } from '../../utils/test-utils'
import { ReportForm } from '@/components/report/ReportForm'

// REPORT_REASONS と TARGET_TYPE_LABELS は実際の値を使う（定数なのでモック不要）

describe('ReportForm', () => {
  const defaultProps = {
    targetType: 'post' as const,
    reason: '' as const,
    setReason: vi.fn(),
    description: '',
    setDescription: vi.fn(),
    isPending: false,
    error: null,
    onSubmit: vi.fn(),
    onClose: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('全ての通報理由の選択肢を表示する', () => {
    render(<ReportForm {...defaultProps} />)
    expect(screen.getByText('スパム')).toBeInTheDocument()
    expect(screen.getByText('不適切な内容')).toBeInTheDocument()
    expect(screen.getByText('誹謗中傷')).toBeInTheDocument()
    expect(screen.getByText('著作権侵害')).toBeInTheDocument()
    expect(screen.getByText('その他')).toBeInTheDocument()
  })

  it('通報理由を選択するとsetReasonが呼ばれる', () => {
    render(<ReportForm {...defaultProps} />)
    const radioInputs = screen.getAllByRole('radio')
    fireEvent.click(radioInputs[0]!) // spam
    expect(defaultProps.setReason).toHaveBeenCalledWith('spam')
  })

  it('選択済みの理由にチェックスタイルが適用される', () => {
    render(<ReportForm {...defaultProps} reason="spam" />)
    const radioInputs = screen.getAllByRole('radio')
    expect(radioInputs[0]).toBeChecked()
  })

  it('詳細説明テキストエリアにmaxLengthが設定されている', () => {
    render(<ReportForm {...defaultProps} />)
    const textarea = screen.getByPlaceholderText(/問題の詳細があれば/)
    expect(textarea).toHaveAttribute('maxLength', '500')
  })

  it('文字数カウントを正しく表示する', () => {
    render(<ReportForm {...defaultProps} description="テスト" />)
    expect(screen.getByText('3/500')).toBeInTheDocument()
  })

  it('descriptionが空の場合は0/500を表示する', () => {
    render(<ReportForm {...defaultProps} description="" />)
    expect(screen.getByText('0/500')).toBeInTheDocument()
  })

  it('テキストエリアに入力するとsetDescriptionが呼ばれる', () => {
    render(<ReportForm {...defaultProps} />)
    const textarea = screen.getByPlaceholderText(/問題の詳細があれば/)
    fireEvent.change(textarea, { target: { value: 'テスト入力' } })
    expect(defaultProps.setDescription).toHaveBeenCalledWith('テスト入力')
  })

  it('理由未選択時は送信ボタンが無効', () => {
    render(<ReportForm {...defaultProps} reason="" />)
    expect(screen.getByRole('button', { name: '通報する' })).toBeDisabled()
  })

  it('isPending時は送信ボタンが無効で送信中テキストを表示', () => {
    render(<ReportForm {...defaultProps} reason="spam" isPending={true} />)
    const submitButton = screen.getByRole('button', { name: '送信中...' })
    expect(submitButton).toBeDisabled()
  })

  it('理由が選択済みかつisPendingでない場合は送信ボタンが有効', () => {
    render(<ReportForm {...defaultProps} reason="spam" isPending={false} />)
    expect(screen.getByRole('button', { name: '通報する' })).not.toBeDisabled()
  })

  it('フォーム送信時にonSubmitが呼ばれる', () => {
    render(<ReportForm {...defaultProps} reason="spam" />)
    const form = screen.getByRole('button', { name: '通報する' }).closest('form')!
    fireEvent.submit(form)
    expect(defaultProps.onSubmit).toHaveBeenCalled()
  })

  it('キャンセルボタンクリックでonCloseが呼ばれる', () => {
    render(<ReportForm {...defaultProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('errorがある場合にFormErrorを表示する', () => {
    render(<ReportForm {...defaultProps} error="通報に失敗しました" />)
    expect(screen.getByRole('alert')).toHaveTextContent('通報に失敗しました')
  })

  it('errorがnullの場合にFormErrorを表示しない', () => {
    render(<ReportForm {...defaultProps} error={null} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('対象タイプに応じた説明文を表示する', () => {
    render(<ReportForm {...defaultProps} targetType="comment" />)
    expect(screen.getByText(/このコメントに問題がある場合/)).toBeInTheDocument()
  })

  it('投稿対象の場合は投稿の説明文を表示する', () => {
    render(<ReportForm {...defaultProps} targetType="post" />)
    expect(screen.getByText(/この投稿に問題がある場合/)).toBeInTheDocument()
  })
})
