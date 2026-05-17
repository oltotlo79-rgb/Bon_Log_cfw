import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('next/image', () => ({
  __esModule: true,
  default: function MockImage(_props: Record<string, unknown>) { return <div data-testid="next-image" /> },
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))

const mockGetAdminUserDetail = vi.fn()
vi.mock('@/lib/actions/admin/users', () => ({
  getAdminUserDetail: (...args: unknown[]) => mockGetAdminUserDetail(...args),
}))

const mockPrisma = {
  post: { findMany: vi.fn() },
  report: { findMany: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('@/app/admin/users/[id]/UserDetailActions', () => ({
  UserDetailActions: () => <div data-testid="user-actions" />,
}))

function makeUser(overrides = {}) {
  return {
    id: 'u1',
    nickname: 'TestUser',
    email: 'test@example.com',
    avatarUrl: '/avatar.jpg',
    bio: 'テスト自己紹介',
    isSuspended: false,
    suspendedAt: null,
    createdAt: new Date('2024-06-01'),
    _count: { posts: 10, comments: 5, followers: 20, following: 15 },
    ...overrides,
  }
}

describe('AdminUserDetailPage', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.report.findMany.mockResolvedValue([])
  })

  async function renderPage(id = 'u1') {
    const { default: Page } = await import('@/app/admin/users/[id]/page')
    const result = await Page({ params: Promise.resolve({ id }) })
    render(result)
  }

  it('ユーザー詳細を表示する', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 0 })
    await renderPage()

    expect(screen.getByText('ユーザー詳細')).toBeInTheDocument()
    expect(screen.getByText('TestUser')).toBeInTheDocument()
    expect(screen.getByText('test@example.com')).toBeInTheDocument()
    expect(screen.getByText('テスト自己紹介')).toBeInTheDocument()
    expect(screen.getByText('アクティブ')).toBeInTheDocument()
  })

  it('統計を表示する', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 0 })
    await renderPage()

    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('投稿')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('20')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
  })

  it('停止中ユーザーのバッジを表示する', async () => {
    mockGetAdminUserDetail.mockResolvedValue({
      user: makeUser({ isSuspended: true, suspendedAt: new Date('2025-01-01') }),
      reportCount: 0,
    })
    await renderPage()

    expect(screen.getByText('停止中')).toBeInTheDocument()
  })

  it('ユーザーが見つからない場合notFoundを呼ぶ', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ error: 'Not found' })
    await expect(renderPage('none')).rejects.toThrow('NOT_FOUND')
  })

  it('アバターなしの場合フォールバックを表示する', async () => {
    mockGetAdminUserDetail.mockResolvedValue({
      user: makeUser({ avatarUrl: null }),
      reportCount: 0,
    })
    await renderPage()
    expect(screen.getByText('TestUser')).toBeInTheDocument()
  })

  it('最近の投稿を表示する', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 0 })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: 'テスト投稿内容', createdAt: new Date(), _count: { likes: 3, comments: 1 } },
    ])
    await renderPage()

    expect(screen.getByText('最近の投稿')).toBeInTheDocument()
    expect(screen.getByText('テスト投稿内容')).toBeInTheDocument()
    expect(screen.getByText(/いいね: 3/)).toBeInTheDocument()
  })

  it('投稿がない場合メッセージを表示する', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 0 })
    await renderPage()

    expect(screen.getByText('投稿がありません')).toBeInTheDocument()
  })

  it('通報履歴を表示する', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 2 })
    mockPrisma.report.findMany.mockResolvedValue([
      {
        id: 'r1',
        reason: 'スパム',
        targetType: 'post',
        status: 'pending',
        description: '不適切な内容',
        createdAt: new Date(),
        reporter: { id: 'reporter1', nickname: '通報者A' },
      },
    ])
    await renderPage()

    expect(screen.getByText(/このユーザーへの通報/)).toBeInTheDocument()
    expect(screen.getByText('スパム')).toBeInTheDocument()
    expect(screen.getByText(/通報者A/)).toBeInTheDocument()
  })

  it('クイックリンクを表示する', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 0 })
    await renderPage()

    expect(screen.getByRole('link', { name: /公開プロフィールを見る/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /このユーザーの投稿を管理/ })).toBeInTheDocument()
  })

  it('UserDetailActionsを表示する', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 0 })
    await renderPage()
    expect(screen.getByTestId('user-actions')).toBeInTheDocument()
  })
})

describe('generateMetadata for admin user detail', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ユーザーが見つかった場合メタデータを返す', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ user: makeUser(), reportCount: 0 })
    const { generateMetadata } = await import('@/app/admin/users/[id]/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'u1' }) })
    expect(result.title).toBe('TestUser - ユーザー詳細 - BON-LOG 管理')
  })

  it('ユーザーが見つからない場合フォールバックを返す', async () => {
    mockGetAdminUserDetail.mockResolvedValue({ error: 'Not found' })
    const { generateMetadata } = await import('@/app/admin/users/[id]/page')
    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('ユーザーが見つかりません - BON-LOG 管理')
  })
})
