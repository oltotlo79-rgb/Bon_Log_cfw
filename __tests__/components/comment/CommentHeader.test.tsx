import { render, screen } from '../../utils/test-utils'
import { CommentHeader, CommentMeta } from '@/components/comment/CommentHeader'

const mockUser = {
  id: 'user-1',
  nickname: 'テストユーザー',
  avatarUrl: null,
}

describe('CommentHeader', () => {
  it('ユーザープロフィールへのリンクを表示する', () => {
    render(<CommentHeader user={mockUser} createdAt={new Date().toISOString()} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/users/user-1')
  })

  it('アバター画像がある場合はimgタグで表示する', () => {
    const userWithAvatar = { ...mockUser, avatarUrl: '/avatar.jpg' }
    render(<CommentHeader user={userWithAvatar} createdAt={new Date().toISOString()} />)
    const img = document.querySelector('img[alt="テストユーザー"]')
    expect(img).toBeInTheDocument()
  })

  it('アバター画像がない場合はニックネームの頭文字を表示する', () => {
    render(<CommentHeader user={mockUser} createdAt={new Date().toISOString()} />)
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('相対時間を表示する（sr-only内）', () => {
    render(<CommentHeader user={mockUser} createdAt={new Date().toISOString()} />)
    // sr-only内に時間が表示される
    expect(screen.getByText(/前/)).toBeInTheDocument()
  })

  it('ニックネームをsr-only内に表示する', () => {
    render(<CommentHeader user={mockUser} createdAt={new Date().toISOString()} />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('Dateオブジェクトを受け取れる', () => {
    const date = new Date('2025-01-01T00:00:00Z')
    render(<CommentHeader user={mockUser} createdAt={date} />)
    expect(screen.getByRole('link')).toBeInTheDocument()
  })
})

describe('CommentMeta', () => {
  it('ニックネームをリンクとして表示する', () => {
    render(<CommentMeta user={mockUser} createdAt={new Date().toISOString()} />)
    const link = screen.getByRole('link', { name: 'テストユーザー' })
    expect(link).toHaveAttribute('href', '/users/user-1')
  })

  it('相対時間を表示する', () => {
    render(<CommentMeta user={mockUser} createdAt={new Date().toISOString()} />)
    expect(screen.getByText(/前/)).toBeInTheDocument()
  })

  it('ニックネームを表示する', () => {
    render(<CommentMeta user={mockUser} createdAt={new Date().toISOString()} />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('Dateオブジェクトを受け取れる', () => {
    const date = new Date('2025-06-01T12:00:00Z')
    render(<CommentMeta user={mockUser} createdAt={date} />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })
})
