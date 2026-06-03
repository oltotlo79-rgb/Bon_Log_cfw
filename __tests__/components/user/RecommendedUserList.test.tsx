import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { RecommendedUserList } from '@/components/user/RecommendedUserList'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/user/FollowButton', () => ({
  FollowButton: ({ userId }: { userId: string }) => <button data-testid={`follow-${userId}`}>フォローする</button>,
}))

describe('RecommendedUserList', () => {
  it('ユーザーをフォローボタン付きで描画する', () => {
    render(
      <RecommendedUserList
        users={[
          { id: 'u1', nickname: '松好き', avatarUrl: null, bio: '黒松が好き', followersCount: 12 },
          { id: 'u2', nickname: '盆栽初心者', avatarUrl: null, bio: null, followersCount: 3 },
        ]}
      />
    )

    expect(screen.getByText('松好き')).toBeInTheDocument()
    expect(screen.getByText('黒松が好き')).toBeInTheDocument()
    // bio が無い場合はフォロワー数を表示
    expect(screen.getByText('3フォロワー')).toBeInTheDocument()
    expect(screen.getByTestId('follow-u1')).toBeInTheDocument()
    expect(screen.getByTestId('follow-u2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /松好き/ })).toHaveAttribute('href', '/users/u1')
  })

  it('ユーザーが空なら何も描画しない', () => {
    const { container } = render(<RecommendedUserList users={[]} />)
    expect(container.querySelector('[data-testid="recommended-user-list"]')).toBeNull()
  })
})
