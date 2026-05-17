import { render, screen } from '../../utils/test-utils'
import { UserCard } from '@/components/user/UserCard'

const mockUser = {
  id: 'user-1',
  nickname: 'テストユーザー',
  avatar_url: null,
  bio: 'これは自己紹介です。盆栽が大好きです。',
}

describe('UserCard', () => {
  it('ニックネームを表示する', () => {
    render(<UserCard user={mockUser} />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('自己紹介を表示する', () => {
    render(<UserCard user={mockUser} />)
    expect(screen.getByText('これは自己紹介です。盆栽が大好きです。')).toBeInTheDocument()
  })

  it('ユーザーページへのリンクを持つ', () => {
    render(<UserCard user={mockUser} />)
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/users/user-1')
  })

  it('アバターがない場合はイニシャルを表示する', () => {
    render(<UserCard user={mockUser} />)
    expect(screen.getByText('テ')).toBeInTheDocument()
  })

  it('アバターがある場合は画像を表示する', () => {
    const userWithAvatar = {
      ...mockUser,
      avatar_url: 'https://example.com/avatar.jpg',
    }
    render(<UserCard user={userWithAvatar} />)
    const img = screen.getByRole('img', { name: 'テストユーザー' })
    expect(img).toBeInTheDocument()
  })

  it('自己紹介がない場合は表示しない', () => {
    const userWithoutBio = {
      ...mockUser,
      bio: null,
    }
    render(<UserCard user={userWithoutBio} />)
    expect(screen.queryByText('これは自己紹介です。盆栽が大好きです。')).not.toBeInTheDocument()
  })

  it('カード全体がクリック可能', () => {
    render(<UserCard user={mockUser} />)
    const link = screen.getByRole('link')
    expect(link).toHaveClass('flex')
  })
})
