/**
 * app/admin/posts/page.tsx
 *
 * 未カバー分岐:
 * - getAdminPosts がエラーを返した場合のリダイレクト
 * - avatarUrl がある場合は next/image を表示する
 * - content が空の場合は「（メディアのみ）」を表示する
 * - reportCount > 0 の場合は通報数バッジを表示する
 */
import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetAdminPosts = vi.fn()
vi.mock('@/lib/actions/admin/posts', () => ({
  getAdminPosts: (...args: unknown[]) => mockGetAdminPosts(...args),
}))

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`)
})
vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: Record<string, unknown>) => <img alt="" data-testid="avatar-image" {...props} />,
}))

vi.mock('@/app/admin/posts/PostActionsDropdown', () => ({
  PostActionsDropdown: ({ postId }: { postId: string }) => (
    <button data-testid={`actions-${postId}`}>操作</button>
  ),
}))

import AdminPostsPage from '@/app/admin/posts/page'

function buildPost(overrides: Record<string, unknown> = {}) {
  return {
    id: 'post-1',
    content: '通常の投稿内容',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    reportCount: 0,
    user: { id: 'user-1', nickname: '投稿者', avatarUrl: null },
    _count: { likes: 0 },
    ...overrides,
  }
}

describe('AdminPostsPage - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getAdminPostsがエラーの場合はログインへリダイレクトする', async () => {
    mockGetAdminPosts.mockResolvedValue({ error: '認証エラー' })

    await expect(
      AdminPostsPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow('REDIRECT')
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('avatarUrlがある場合はImageを表示し、content空文字は「（メディアのみ）」、報告数>0はバッジ表示する', async () => {
    mockGetAdminPosts.mockResolvedValue({
      posts: [
        buildPost({
          content: '',
          reportCount: 3,
          user: { id: 'user-2', nickname: '画像ユーザー', avatarUrl: '/avatar.png' },
        }),
      ],
      total: 1,
    })

    const result = await AdminPostsPage({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.getByTestId('avatar-image')).toHaveAttribute('src', '/avatar.png')
    expect(screen.getByText('（メディアのみ）')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('avatarUrlが無い場合はプレースホルダーを表示し、reportCount 0の場合は"0"を薄く表示する', async () => {
    mockGetAdminPosts.mockResolvedValue({
      posts: [buildPost()],
      total: 1,
    })

    const result = await AdminPostsPage({ searchParams: Promise.resolve({}) })
    render(result)

    expect(screen.queryByTestId('avatar-image')).not.toBeInTheDocument()
    expect(screen.getByText('通常の投稿内容')).toBeInTheDocument()
  })
})
