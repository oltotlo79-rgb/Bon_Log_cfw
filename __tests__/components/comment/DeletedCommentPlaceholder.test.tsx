import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import userEvent from '@testing-library/user-event'
import { DeletedCommentPlaceholder } from '@/components/comment/DeletedCommentPlaceholder'

const defaultProps = {
  message: '削除されたコメントです',
  showReplies: false,
  loadingReplies: false,
  onToggleReplies: vi.fn(),
}

describe('DeletedCommentPlaceholder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('メッセージを表示する', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} />)
    expect(screen.getByText('削除されたコメントです')).toBeInTheDocument()
  })

  it('カスタムメッセージを表示する', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} message="ブロックされているユーザーのコメントです" />)
    expect(screen.getByText('ブロックされているユーザーのコメントです')).toBeInTheDocument()
  })

  it('replyCountが0の場合、返信表示ボタンを表示しない', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} replyCount={0} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('replyCountがundefinedの場合、返信表示ボタンを表示しない', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} replyCount={undefined} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('replyCount>0の場合、返信件数ボタンを表示する', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} replyCount={3} />)
    expect(screen.getByRole('button', { name: /3件の返信を表示/i })).toBeInTheDocument()
  })

  it('返信件数ボタンクリックでonToggleRepliesが呼ばれる', async () => {
    const mockToggle = vi.fn()
    const user = userEvent.setup()
    render(<DeletedCommentPlaceholder {...defaultProps} replyCount={2} onToggleReplies={mockToggle} />)
    await user.click(screen.getByRole('button', { name: /2件の返信を表示/i }))
    expect(mockToggle).toHaveBeenCalledTimes(1)
  })

  it('showReplies=trueの場合、返信を非表示ボタンを表示する', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} replyCount={3} showReplies={true} />)
    expect(screen.getByRole('button', { name: /返信を非表示/i })).toBeInTheDocument()
  })

  it('loadingReplies=trueの場合、読み込み中テキストを表示する', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} replyCount={3} loadingReplies={true} />)
    expect(screen.getByRole('button', { name: '読み込み中...' })).toBeInTheDocument()
  })

  it('loadingReplies=trueの場合、返信トグルボタンが無効化される', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} replyCount={3} loadingReplies={true} />)
    expect(screen.getByRole('button', { name: '読み込み中...' })).toBeDisabled()
  })

  it('×アイコン（プレースホルダーアバター）を表示する', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} />)
    expect(screen.getByText('×')).toBeInTheDocument()
  })

  it('ユーザー情報（アバター画像やニックネーム）を表示しない', () => {
    render(<DeletedCommentPlaceholder {...defaultProps} />)
    expect(document.querySelector('img')).not.toBeInTheDocument()
    expect(document.querySelector('a')).not.toBeInTheDocument()
  })
})
