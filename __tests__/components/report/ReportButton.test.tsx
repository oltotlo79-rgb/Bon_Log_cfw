import { vi } from 'vitest'
import { render, screen, waitFor } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { ReportButton } from '@/components/report/ReportButton'

// ReportModal モック
vi.mock('@/components/report/ReportModal', () => ({
  ReportModal: ({ targetType, targetId, onClose }: { targetType: string; targetId: string; onClose: () => void }) => (
    <div data-testid="report-modal">
      <span>通報対象: {targetType}</span>
      <span>ID: {targetId}</span>
      <button onClick={onClose}>閉じる</button>
    </div>
  ),
}))

describe('ReportButton', () => {
  const defaultProps = {
    targetType: 'post' as const,
    targetId: 'post-123',
  }

  it('menuバリアントでボタンを表示する（デフォルト）', () => {
    render(<ReportButton {...defaultProps} />)

    const button = screen.getByRole('button', { name: 'このコンテンツを通報' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('text-destructive')
  })

  it('iconバリアントでボタンを表示する', () => {
    render(<ReportButton {...defaultProps} variant="icon" />)

    const button = screen.getByRole('button', { name: 'このコンテンツを通報' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label', 'このコンテンツを通報')
  })

  it('textバリアントでボタンを表示する', () => {
    render(<ReportButton {...defaultProps} variant="text" />)

    expect(screen.getByRole('button', { name: 'このコンテンツを通報' })).toBeInTheDocument()
  })

  it('ボタンクリックでモーダルを表示する', async () => {
    const user = userEvent.setup()
    render(<ReportButton {...defaultProps} />)

    await user.click(screen.getByRole('button', { name: 'このコンテンツを通報' }))

    expect(screen.getByTestId('report-modal')).toBeInTheDocument()
    expect(screen.getByText('通報対象: post')).toBeInTheDocument()
    expect(screen.getByText('ID: post-123')).toBeInTheDocument()
  })

  it('モーダルを閉じることができる', async () => {
    const user = userEvent.setup()
    render(<ReportButton {...defaultProps} />)

    // モーダルを開く
    await user.click(screen.getByRole('button', { name: 'このコンテンツを通報' }))
    expect(screen.getByTestId('report-modal')).toBeInTheDocument()

    // モーダルを閉じる
    await user.click(screen.getByRole('button', { name: '閉じる' }))

    await waitFor(() => {
      expect(screen.queryByTestId('report-modal')).not.toBeInTheDocument()
    })
  })

  it('異なるtargetTypeを渡せる', async () => {
    const user = userEvent.setup()
    render(<ReportButton targetType="user" targetId="user-456" />)

    await user.click(screen.getByRole('button', { name: 'このコンテンツを通報' }))

    expect(screen.getByText('通報対象: user')).toBeInTheDocument()
    expect(screen.getByText('ID: user-456')).toBeInTheDocument()
  })

  it('コメントの通報ができる', async () => {
    const user = userEvent.setup()
    render(<ReportButton targetType="comment" targetId="comment-789" />)

    await user.click(screen.getByRole('button', { name: 'このコンテンツを通報' }))

    expect(screen.getByText('通報対象: comment')).toBeInTheDocument()
  })

  it('classNameが適用される', () => {
    render(<ReportButton {...defaultProps} variant="icon" className="custom-class" />)

    expect(screen.getByRole('button')).toHaveClass('custom-class')
  })

  it('クリック時にイベント伝播が止まる', async () => {
    const parentClickHandler = vi.fn()
    const user = userEvent.setup()

    render(
      <div onClick={parentClickHandler}>
        <ReportButton {...defaultProps} />
      </div>
    )

    await user.click(screen.getByRole('button', { name: 'このコンテンツを通報' }))

    // 親要素のクリックハンドラが呼ばれないことを確認
    expect(parentClickHandler).not.toHaveBeenCalled()
  })
})
