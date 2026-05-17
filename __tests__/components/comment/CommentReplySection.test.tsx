import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { CommentReplySection } from '@/components/comment/CommentReplySection'

// CommentFormモック
vi.mock('@/components/comment/CommentForm', () => ({
  CommentForm: (props: { onSuccess?: () => void; onCancel?: () => void; placeholder?: string }) => (
    <div data-testid="mock-comment-form">
      <input placeholder={props.placeholder} />
      {props.onSuccess && <button onClick={props.onSuccess} data-testid="submit-reply">送信</button>}
      {props.onCancel && <button onClick={props.onCancel} data-testid="cancel-reply">キャンセル</button>}
    </div>
  ),
}))

const defaultProps = {
  commentId: 'comment-1',
  postId: 'post-1',
  commentUserNickname: 'テストユーザー',
  currentUserId: 'test-user-id',
  showReplyForm: false,
  onCancelReply: vi.fn(),
  onReplySuccess: vi.fn(),
  replyCount: 0,
  showReplies: false,
  loadingReplies: false,
  onToggleReplies: vi.fn(),
}

describe('CommentReplySection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('showReplyForm=falseの場合、返信フォームを表示しない', () => {
    render(<CommentReplySection {...defaultProps} showReplyForm={false} />)
    expect(screen.queryByTestId('mock-comment-form')).not.toBeInTheDocument()
  })

  it('showReplyForm=trueの場合、返信フォームを表示する', () => {
    render(<CommentReplySection {...defaultProps} showReplyForm={true} />)
    expect(screen.getByTestId('mock-comment-form')).toBeInTheDocument()
  })

  it('返信フォームにプレースホルダーを設定する', () => {
    render(<CommentReplySection {...defaultProps} showReplyForm={true} />)
    expect(screen.getByPlaceholderText('@テストユーザー への返信...')).toBeInTheDocument()
  })

  it('replyCount=0の場合、返信表示ボタンを表示しない', () => {
    render(<CommentReplySection {...defaultProps} replyCount={0} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('replyCount>0の場合、返信件数ボタンを表示する', () => {
    render(<CommentReplySection {...defaultProps} replyCount={3} />)
    expect(screen.getByRole('button', { name: /3件の返信を表示/i })).toBeInTheDocument()
  })

  it('返信件数ボタンクリックでonToggleRepliesが呼ばれる', async () => {
    const mockToggle = vi.fn()
    const user = userEvent.setup()
    render(<CommentReplySection {...defaultProps} replyCount={2} onToggleReplies={mockToggle} />)
    await user.click(screen.getByRole('button', { name: /2件の返信を表示/i }))
    expect(mockToggle).toHaveBeenCalledTimes(1)
  })

  it('showReplies=trueの場合、返信を非表示ボタンを表示する', () => {
    render(<CommentReplySection {...defaultProps} replyCount={3} showReplies={true} />)
    expect(screen.getByRole('button', { name: /返信を非表示/i })).toBeInTheDocument()
  })

  it('loadingReplies=trueの場合、読み込み中テキストを表示する', () => {
    render(<CommentReplySection {...defaultProps} replyCount={3} loadingReplies={true} />)
    expect(screen.getByRole('button', { name: '読み込み中...' })).toBeInTheDocument()
  })

  it('loadingReplies=trueの場合、返信トグルボタンが無効化される', () => {
    render(<CommentReplySection {...defaultProps} replyCount={3} loadingReplies={true} />)
    expect(screen.getByRole('button', { name: '読み込み中...' })).toBeDisabled()
  })

  it('返信フォームのキャンセルでonCancelReplyが呼ばれる', async () => {
    const mockCancel = vi.fn()
    const user = userEvent.setup()
    render(<CommentReplySection {...defaultProps} showReplyForm={true} onCancelReply={mockCancel} />)
    await user.click(screen.getByTestId('cancel-reply'))
    expect(mockCancel).toHaveBeenCalledTimes(1)
  })

  it('返信フォームの送信でonReplySuccessが呼ばれる', async () => {
    const mockSuccess = vi.fn()
    const user = userEvent.setup()
    render(<CommentReplySection {...defaultProps} showReplyForm={true} onReplySuccess={mockSuccess} />)
    await user.click(screen.getByTestId('submit-reply'))
    expect(mockSuccess).toHaveBeenCalledTimes(1)
  })

  it('replyCountがundefinedの場合、返信表示ボタンを表示しない', () => {
    render(<CommentReplySection {...defaultProps} replyCount={undefined} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
