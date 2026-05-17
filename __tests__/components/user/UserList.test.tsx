import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { UserList } from '@/components/user/UserList'

// UserCard モック
vi.mock('@/components/user/UserCard', () => ({
  UserCard: ({ user }: { user: { id: string; nickname: string } }) => (
    <div data-testid={`user-card-${user.id}`}>{user.nickname}</div>
  ),
}))

describe('UserList', () => {
  const mockUsers = [
    {
      id: 'user-1',
      nickname: 'ユーザー1',
      avatar_url: 'https://example.com/avatar1.jpg',
      bio: '自己紹介1',
    },
    {
      id: 'user-2',
      nickname: 'ユーザー2',
      avatar_url: null,
      bio: null,
    },
    {
      id: 'user-3',
      nickname: 'ユーザー3',
      avatar_url: null,
      bio: '自己紹介3',
    },
  ]

  it('ユーザー一覧を表示する', () => {
    render(<UserList users={mockUsers} />)

    expect(screen.getByTestId('user-card-user-1')).toBeInTheDocument()
    expect(screen.getByTestId('user-card-user-2')).toBeInTheDocument()
    expect(screen.getByTestId('user-card-user-3')).toBeInTheDocument()
  })

  it('各ユーザーのニックネームを表示する', () => {
    render(<UserList users={mockUsers} />)

    expect(screen.getByText('ユーザー1')).toBeInTheDocument()
    expect(screen.getByText('ユーザー2')).toBeInTheDocument()
    expect(screen.getByText('ユーザー3')).toBeInTheDocument()
  })

  it('ユーザーが0人の場合はデフォルトの空メッセージを表示する', () => {
    render(<UserList users={[]} />)

    expect(screen.getByText('ユーザーがいません')).toBeInTheDocument()
  })

  it('カスタム空メッセージを表示できる', () => {
    render(<UserList users={[]} emptyMessage="フォロワーがいません" />)

    expect(screen.getByText('フォロワーがいません')).toBeInTheDocument()
  })

  it('検索結果用の空メッセージを表示できる', () => {
    render(<UserList users={[]} emptyMessage="該当するユーザーが見つかりませんでした" />)

    expect(screen.getByText('該当するユーザーが見つかりませんでした')).toBeInTheDocument()
  })

  it('ユーザーが1人の場合も正しく表示する', () => {
    render(<UserList users={[mockUsers[0]]} />)

    expect(screen.getByTestId('user-card-user-1')).toBeInTheDocument()
    expect(screen.queryByText('ユーザーがいません')).not.toBeInTheDocument()
  })

  it('divide-yクラスで区切り線が適用される', () => {
    const { container } = render(<UserList users={mockUsers} />)

    const list = container.querySelector('.divide-y')
    expect(list).toBeInTheDocument()
  })

  it('空の場合は区切り線を持つ要素がない', () => {
    const { container } = render(<UserList users={[]} />)

    expect(container.querySelector('.divide-y')).not.toBeInTheDocument()
  })
})
