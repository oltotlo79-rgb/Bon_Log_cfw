import { vi } from 'vitest'
import { render, screen } from '../../utils/test-utils'
import { ProfileHeader } from '@/components/user/ProfileHeader'

// Next-Auth モック
vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  useSession: () => ({
    data: { user: { id: 'test-user-id' } },
    status: 'authenticated',
  }),
}))

// Server Actions モック
vi.mock('@/lib/actions/follow', () => ({
  toggleFollow: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/actions/block', () => ({
  blockUser: vi.fn(),
  unblockUser: vi.fn(),
}))
vi.mock('@/lib/actions/mute', () => ({
  muteUser: vi.fn(),
  unmuteUser: vi.fn(),
}))
vi.mock('@/lib/actions/message', () => ({
  getOrCreateConversation: vi.fn(),
}))

// フォローリクエスト Server Actions モック
vi.mock('@/lib/actions/follow-request', () => ({
  sendFollowRequest: vi.fn().mockResolvedValue({ success: true, status: 'pending' }),
  cancelFollowRequest: vi.fn().mockResolvedValue({ success: true }),
}))

// hooks/use-toast モック
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

const mockUser = {
  id: 'user-1',
  nickname: 'テストユーザー',
  avatarUrl: null,
  headerUrl: null,
  bio: 'これは自己紹介です',
  location: '東京都',
  bonsaiStartYear: 2020,
  bonsaiStartMonth: 4,
  birthDate: null,
  isPublic: true,
  createdAt: '2023-01-15T00:00:00.000Z',
  postsCount: 100,
  followersCount: 50,
  followingCount: 30,
}

describe('ProfileHeader', () => {
  it('ユーザー名を表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    expect(screen.getByText('テストユーザー')).toBeInTheDocument()
  })

  it('自己紹介を表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    expect(screen.getByText('これは自己紹介です')).toBeInTheDocument()
  })

  it('位置情報を表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    expect(screen.getByText('東京都')).toBeInTheDocument()
  })

  it('盆栽歴を表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    // 盆栽歴が計算されて表示される
    expect(screen.getByText(/盆栽歴/)).toBeInTheDocument()
  })

  it('登録日を表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    expect(screen.getByText('2023年1月から利用')).toBeInTheDocument()
  })

  it('フォロー数を表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('フォロー中')).toBeInTheDocument()
  })

  it('フォロワー数を表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    expect(screen.getByText('50')).toBeInTheDocument()
    expect(screen.getByText('フォロワー')).toBeInTheDocument()
  })

  it('投稿数を表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('投稿')).toBeInTheDocument()
  })

  it('オーナーの場合は編集ボタンを表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={true} />)
    expect(screen.getByRole('link', { name: 'プロフィールを編集' })).toBeInTheDocument()
  })

  it('オーナーの場合はフォローボタンを表示しない', () => {
    render(<ProfileHeader user={mockUser} isOwner={true} />)
    expect(screen.queryByRole('button', { name: /フォロー/i })).not.toBeInTheDocument()
  })

  it('非オーナーの場合はフォローボタンを表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} isFollowing={false} />)
    expect(screen.getByRole('button', { name: /フォロー/i })).toBeInTheDocument()
  })

  it('プレミアム会員の場合はバッジを表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} isPremium={true} />)
    expect(screen.getByText('Premium')).toBeInTheDocument()
  })

  it('非公開アカウントの場合は非公開マークを表示する', () => {
    const privateUser = { ...mockUser, isPublic: false }
    render(<ProfileHeader user={privateUser} isOwner={false} />)
    expect(screen.getByText('非公開')).toBeInTheDocument()
  })

  it('フォロー中リンクが正しいhrefを持つ', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    const followingLink = screen.getByRole('link', { name: /フォロー中/i })
    expect(followingLink).toHaveAttribute('href', '/users/user-1/following')
  })

  it('フォロワーリンクが正しいhrefを持つ', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    const followersLink = screen.getByRole('link', { name: /フォロワー/i })
    expect(followersLink).toHaveAttribute('href', '/users/user-1/followers')
  })

  it('アバターがない場合はイニシャルを表示する', () => {
    render(<ProfileHeader user={mockUser} isOwner={false} />)
    // 最初の文字「テ」がイニシャルとして表示される
    const initials = screen.getAllByText('テ')
    expect(initials.length).toBeGreaterThan(0)
  })

  it('自己紹介がない場合は表示しない', () => {
    const userWithoutBio = { ...mockUser, bio: null }
    render(<ProfileHeader user={userWithoutBio} isOwner={false} />)
    expect(screen.queryByText('これは自己紹介です')).not.toBeInTheDocument()
  })

  it('位置情報がない場合は表示しない', () => {
    const userWithoutLocation = { ...mockUser, location: null }
    render(<ProfileHeader user={userWithoutLocation} isOwner={false} />)
    expect(screen.queryByText('東京都')).not.toBeInTheDocument()
  })
})
