import { vi } from 'vitest'
/**
 * Batch test for user sub-pages: followers, following, likes, posts
 * and settings pages: profile, account, security, scheduled posts
 */

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRedirect = vi.fn()
const mockNotFound = vi.fn(() => { throw new Error('NOT_FOUND') })
vi.mock('next/navigation', () => ({
  redirect: (url: any) => { mockRedirect(url); throw new Error('REDIRECT') },
  notFound: () => mockNotFound(),
}))

vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('next/image', () => ({ __esModule: true, default: function MockImage(_props: Record<string, unknown>) { return <div data-testid="next-image" /> } }))

// DB mock
const mockPrisma = {
  user: { findUnique: vi.fn() },
  follow: { findMany: vi.fn() },
  like: { findMany: vi.fn() },
  post: { findMany: vi.fn() },
  scheduledPost: { findMany: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
}))

// Component mocks
vi.mock('@/components/user/UserList', () => ({ UserList: ({ emptyMessage }: { emptyMessage: string }) => <div data-testid="user-list">{emptyMessage}</div> }))
vi.mock('@/components/user/ProfileEditForm', () => ({ ProfileEditForm: () => <div data-testid="profile-form" /> }))
vi.mock('@/components/user/PrivacyToggle', () => ({ PrivacyToggle: () => <div data-testid="privacy-toggle" /> }))
vi.mock('@/components/user/DeleteAccountButton', () => ({ DeleteAccountButton: () => <div data-testid="delete-account" /> }))
vi.mock('@/components/settings/TwoFactorSettings', () => ({ TwoFactorSettings: () => <div data-testid="2fa-settings" /> }))
vi.mock('@/components/settings/PasswordChangeForm', () => ({ PasswordChangeForm: () => <div data-testid="password-change-form" /> }))
vi.mock('@/components/settings/EmailChangeForm', () => ({ EmailChangeForm: () => <div data-testid="email-change-form" /> }))
// SecurityActivity は Suspense 内の async Server Component。テスト環境でこの async 関数が
// suspend すると "A component suspended inside an act scope" 警告が出るため、モック化する。
vi.mock('@/components/settings/SecurityActivity', () => ({ SecurityActivity: () => <div data-testid="security-activity" /> }))
vi.mock('@/components/post/ScheduledPostList', () => ({ ScheduledPostList: () => <div data-testid="scheduled-list" /> }))
// asChild は Radix Slot 用の prop。DOM の <button> に流すと React warning になるため destructure して除外する
vi.mock('@/components/ui/button', () => ({ Button: ({ children, asChild: _asChild, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <button {...props}>{children}</button> }))
vi.mock('lucide-react', () => ({ CalendarPlus: () => <span /> }))

import { render, screen } from '@testing-library/react'
import React from 'react'

// ============================================================
// Followers Page
// ============================================================
describe('FollowersPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: true, isSuspended: false })
    mockPrisma.follow.findMany.mockResolvedValue([])
  })

  it('renders followers page', async () => {
    const { default: Page } = await import('@/app/(main)/users/[id]/followers/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)
    expect(screen.getByText('フォロワー')).toBeInTheDocument()
    expect(screen.getByText('フォロワーはいません')).toBeInTheDocument()
  })

  it('calls notFound for missing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/users/[id]/followers/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('renders followers with data', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([
      { follower: { id: 'f1', nickname: 'Follower1', avatarUrl: null, bio: 'hi' } },
    ])
    const { default: Page } = await import('@/app/(main)/users/[id]/followers/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)
    expect(screen.getByTestId('user-list')).toBeInTheDocument()
  })

  it('generateMetadata returns user title', async () => {
    const { generateMetadata } = await import('@/app/(main)/users/[id]/followers/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'u1' }) })
    expect(result.title).toBe('TestUserのフォロワー')
  })

  it('generateMetadata returns fallback for missing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/(main)/users/[id]/followers/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('ユーザーが見つかりません')
  })

  it('generateMetadata sets noindex for a private/suspended author', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: false, isSuspended: false })
    const { generateMetadata } = await import('@/app/(main)/users/[id]/followers/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'u1' }) })
    if (!('robots' in result)) throw new Error('robots is missing from metadata result')
    expect(result.robots).toEqual({ index: false, follow: false })
  })

  it('calls notFound when viewer cannot view a private author (canViewAuthorContent=false)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: false, isSuspended: false })
    const { default: Page } = await import('@/app/(main)/users/[id]/followers/page')
    await expect(Page({ params: Promise.resolve({ id: 'u1' }) })).rejects.toThrow('NOT_FOUND')
  })
})

// ============================================================
// Following Page
// ============================================================
describe('FollowingPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: true, isSuspended: false })
    mockPrisma.follow.findMany.mockResolvedValue([])
  })

  it('renders following page', async () => {
    const { default: Page } = await import('@/app/(main)/users/[id]/following/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)
    expect(screen.getByText('フォロー中')).toBeInTheDocument()
    expect(screen.getByText('フォロー中のユーザーはいません')).toBeInTheDocument()
  })

  it('calls notFound for missing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/users/[id]/following/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('renders following with data', async () => {
    mockPrisma.follow.findMany.mockResolvedValue([
      { following: { id: 'f1', nickname: 'Following1', avatarUrl: '/a.jpg', bio: '' } },
    ])
    const { default: Page } = await import('@/app/(main)/users/[id]/following/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)
    expect(screen.getByTestId('user-list')).toBeInTheDocument()
  })

  it('generateMetadata returns user title', async () => {
    const { generateMetadata } = await import('@/app/(main)/users/[id]/following/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'u1' }) })
    expect(result.title).toBe('TestUserがフォロー中')
  })

  it('generateMetadata returns fallback for missing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/(main)/users/[id]/following/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('ユーザーが見つかりません')
  })

  it('generateMetadata sets noindex for a private/suspended author', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: false, isSuspended: false })
    const { generateMetadata } = await import('@/app/(main)/users/[id]/following/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'u1' }) })
    if (!('robots' in result)) throw new Error('robots is missing from metadata result')
    expect(result.robots).toEqual({ index: false, follow: false })
  })

  it('calls notFound when viewer cannot view a private author (canViewAuthorContent=false)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: false, isSuspended: false })
    const { default: Page } = await import('@/app/(main)/users/[id]/following/page')
    await expect(Page({ params: Promise.resolve({ id: 'u1' }) })).rejects.toThrow('NOT_FOUND')
  })
})

// ============================================================
// User Likes Page
// ============================================================
describe('UserLikesPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: true, isSuspended: false })
    mockPrisma.like.findMany.mockResolvedValue([])
  })

  it('renders likes page empty', async () => {
    const { default: Page } = await import('@/app/(main)/users/[id]/likes/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)
    expect(screen.getByText('いいねした投稿')).toBeInTheDocument()
    expect(screen.getByText('いいねした投稿がありません')).toBeInTheDocument()
  })

  it('calls notFound for missing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/users/[id]/likes/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('renders liked posts', async () => {
    mockPrisma.like.findMany.mockResolvedValue([
      { post: { id: 'p1', content: 'テスト投稿', createdAt: new Date(), user: { id: 'u2', nickname: 'Author', avatarUrl: null } } },
    ])
    const { default: Page } = await import('@/app/(main)/users/[id]/likes/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)
    expect(screen.getByText('テスト投稿')).toBeInTheDocument()
    expect(screen.getByText('Author')).toBeInTheDocument()
  })

  it('filters null posts', async () => {
    mockPrisma.like.findMany.mockResolvedValue([{ post: null }])
    const { default: Page } = await import('@/app/(main)/users/[id]/likes/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)
    expect(screen.getByText('いいねした投稿がありません')).toBeInTheDocument()
  })

  it('generateMetadata returns user title', async () => {
    const { generateMetadata } = await import('@/app/(main)/users/[id]/likes/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'u1' }) })
    expect(result.title).toBe('TestUserのいいね')
  })

  it('generateMetadata returns fallback for missing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/(main)/users/[id]/likes/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('ユーザーが見つかりません')
  })

  it('generateMetadata sets noindex for a private/suspended author', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: false, isSuspended: false })
    const { generateMetadata } = await import('@/app/(main)/users/[id]/likes/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'u1' }) })
    if (!('robots' in result)) throw new Error('robots is missing from metadata result')
    expect(result.robots).toEqual({ index: false, follow: false })
  })

  it('calls notFound when viewer cannot view a private author (canViewAuthorContent=false)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: false, isSuspended: false })
    const { default: Page } = await import('@/app/(main)/users/[id]/likes/page')
    await expect(Page({ params: Promise.resolve({ id: 'u1' }) })).rejects.toThrow('NOT_FOUND')
  })
})

// ============================================================
// User Posts Page
// ============================================================
describe('UserPostsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', nickname: 'TestUser', isPublic: true, isSuspended: false })
    mockPrisma.post.findMany.mockResolvedValue([])
  })

  it('renders posts page empty', async () => {
    const { default: Page } = await import('@/app/(main)/users/[id]/posts/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)
    expect(screen.getByText('投稿')).toBeInTheDocument()
    expect(screen.getByText('まだ投稿がありません')).toBeInTheDocument()
  })

  it('calls notFound for missing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/users/[id]/posts/page')
    await expect(Page({ params: Promise.resolve({ id: 'x' }) })).rejects.toThrow('NOT_FOUND')
  })

  it('renders user posts', async () => {
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: 'ユーザーの投稿', createdAt: new Date() },
    ])
    const { default: Page } = await import('@/app/(main)/users/[id]/posts/page')
    const result = await Page({ params: Promise.resolve({ id: 'u1' }) })
    render(result)
    expect(screen.getByText('ユーザーの投稿')).toBeInTheDocument()
  })

  it('generateMetadata returns user title', async () => {
    const { generateMetadata } = await import('@/app/(main)/users/[id]/posts/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'u1' }) })
    expect(result.title).toBe('TestUserの投稿')
  })

  it('generateMetadata returns fallback for missing user', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { generateMetadata } = await import('@/app/(main)/users/[id]/posts/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('ユーザーが見つかりません')
  })
})

// ============================================================
// Profile Edit Page
// ============================================================
describe('ProfileEditPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1', nickname: 'Test', bio: 'bio', location: 'Tokyo',
      avatarUrl: '/a.jpg', headerUrl: '/h.jpg',
      bonsaiStartYear: 2020, bonsaiStartMonth: 4, birthDate: new Date('1990-01-15'),
    })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/settings/profile/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('redirects when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/settings/profile/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('renders profile edit form', async () => {
    const { default: Page } = await import('@/app/(main)/settings/profile/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('プロフィール編集')).toBeInTheDocument()
    expect(screen.getByTestId('profile-form')).toBeInTheDocument()
  })

  it('shows guest restriction when session is guest (no edit form)', async () => {
    const { GUEST_EMAIL } = await import('@/lib/constants/guest')
    const { ERR_GUEST_PROFILE_EDIT } = await import('@/lib/constants/errors')
    mockAuth.mockResolvedValue({ user: { id: 'guest-1', email: GUEST_EMAIL } })
    const { default: Page } = await import('@/app/(main)/settings/profile/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('プロフィール編集')).toBeInTheDocument()
    expect(screen.getByText(ERR_GUEST_PROFILE_EDIT)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /新規登録する/i })).toHaveAttribute('href', '/register')
    expect(screen.queryByTestId('profile-form')).not.toBeInTheDocument()
  })
})

// ============================================================
// Account Settings Page
// ============================================================
describe('AccountSettingsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isPublic: true })
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/settings/account/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('redirects when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/settings/account/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('renders account settings', async () => {
    const { default: Page } = await import('@/app/(main)/settings/account/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('アカウント設定')).toBeInTheDocument()
    expect(screen.getByText('プライバシー設定')).toBeInTheDocument()
    expect(screen.getByText('危険な操作')).toBeInTheDocument()
    expect(screen.getByTestId('privacy-toggle')).toBeInTheDocument()
    expect(screen.getByTestId('delete-account')).toBeInTheDocument()
  })

  it('shows guest restriction when session is guest (no settings form)', async () => {
    const { GUEST_EMAIL } = await import('@/lib/constants/guest')
    const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
    mockAuth.mockResolvedValue({ user: { id: 'guest-1', email: GUEST_EMAIL } })
    const { default: Page } = await import('@/app/(main)/settings/account/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('アカウント設定')).toBeInTheDocument()
    expect(screen.getByText(ERR_GUEST_CANNOT_CREATE)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /新規登録する/i })).toHaveAttribute('href', '/register')
    expect(screen.queryByTestId('privacy-toggle')).not.toBeInTheDocument()
    expect(screen.queryByTestId('delete-account')).not.toBeInTheDocument()
  })
})

// ============================================================
// Security Settings Page
// ============================================================
describe('SecuritySettingsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1', email: 'user@example.com' } })
  })

  it('renders security settings', async () => {
    const { default: Page } = await import('@/app/(main)/settings/security/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('セキュリティ設定')).toBeInTheDocument()
    expect(screen.getByTestId('2fa-settings')).toBeInTheDocument()
  })

  it('shows guest restriction when session is guest', async () => {
    const { GUEST_EMAIL } = await import('@/lib/constants/guest')
    mockAuth.mockResolvedValue({ user: { id: 'guest-1', email: GUEST_EMAIL } })
    const { default: Page } = await import('@/app/(main)/settings/security/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('セキュリティ設定')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /新規登録する/i })).toHaveAttribute('href', '/register')
    expect(screen.queryByTestId('2fa-settings')).not.toBeInTheDocument()
  })
})

// ============================================================
// Scheduled Posts Page
// ============================================================
describe('ScheduledPostsPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.scheduledPost.findMany.mockResolvedValue([])
  })

  it('redirects when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { default: Page } = await import('@/app/(main)/posts/scheduled/page')
    await expect(Page()).rejects.toThrow('REDIRECT')
  })

  it('shows premium upgrade for non-premium', async () => {
    const { default: Page } = await import('@/app/(main)/posts/scheduled/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('予約投稿機能')).toBeInTheDocument()
    expect(screen.getByText(/プレミアム会員限定/)).toBeInTheDocument()
  })

  it('renders scheduled posts for premium', async () => {
    const { isPremiumUser } = await import('@/lib/premium')
    ;(isPremiumUser as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true)
    const { default: Page } = await import('@/app/(main)/posts/scheduled/page')
    const result = await Page()
    render(result)
    expect(screen.getByText('予約投稿')).toBeInTheDocument()
    expect(screen.getByTestId('scheduled-list')).toBeInTheDocument()
  })
})
