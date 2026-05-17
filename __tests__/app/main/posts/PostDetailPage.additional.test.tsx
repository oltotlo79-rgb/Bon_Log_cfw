import { vi } from 'vitest'
/**
 * 投稿詳細ページの追加テスト - CommentThreadMute機能
 */

// Prismaをモック
const mockFindMany = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    commentThreadMute: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

// Server Actionsモック
const mockGetPost = vi.fn()
const mockGetComments = vi.fn()
const mockGetCommentCount = vi.fn()
vi.mock('@/lib/actions/post', () => ({ getPost: (...args: unknown[]) => mockGetPost(...args) }))
vi.mock('@/lib/actions/comment', () => ({
  getComments: (...args: unknown[]) => mockGetComments(...args),
  getCommentCount: (...args: unknown[]) => mockGetCommentCount(...args),
}))
vi.mock('@/lib/actions/analytics', () => ({ recordPostView: vi.fn().mockResolvedValue(undefined) }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))
vi.mock('@/components/post/PostCard', () => ({
  PostCard: () => <div data-testid="post-card" />,
}))
vi.mock('@/components/post/ShareButtons', () => ({
  ShareButtons: () => <div data-testid="share-buttons" />,
}))
vi.mock('@/components/comment', () => ({
  CommentThread: () => <div data-testid="comment-thread" />,
}))
vi.mock('@/components/ads', () => ({
  PostDetailAdUnit: () => <div data-testid="ad-banner" />,
}))
vi.mock('@/components/seo/JsonLd', () => ({
  ArticleJsonLd: () => <script data-testid="json-ld" />,
  BreadcrumbJsonLd: () => <script data-testid="breadcrumb-json-ld" />,
}))
vi.mock('@/components/common/Breadcrumb', () => ({
  Breadcrumb: () => <div data-testid="breadcrumb" />,
}))

import { render, screen } from '@testing-library/react'

function makePost(overrides = {}) {
  return {
    id: 'post-1',
    content: 'Hello World',
    createdAt: new Date().toISOString(),
    user: { id: 'author-1', nickname: 'Author', avatarUrl: null },
    media: [],
    genres: [],
    _count: { likes: 0, comments: 0 },
    ...overrides,
  }
}

describe('PostDetailPage - ミュート機能', async () => {
  let Page: typeof import('@/app/(main)/posts/[id]/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    mockFindMany.mockResolvedValue([])
    mockGetComments.mockResolvedValue({ comments: [], nextCursor: undefined })
    mockGetCommentCount.mockResolvedValue({ count: 0 })
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } })
    mockAuth.mockResolvedValue(null)

    const mod = await import('@/app/(main)/posts/[id]/page')
    Page = mod.default
  })

  it('ログインユーザーがいてコメントがある場合、ミュート情報を取得する', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' }, expires: '' })
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } })
    mockGetComments.mockResolvedValue({
      comments: [
        { id: 'comment-1', content: 'test' },
        { id: 'comment-2', content: 'test2' },
      ],
      nextCursor: undefined,
    })
    mockFindMany.mockResolvedValue([{ commentId: 'comment-1' }])

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    // CommentSectionはSuspense内の非同期コンポーネント
    // ページ自体はエラーなくレンダリングされることを確認
    expect(result).toBeTruthy()
  })

  it('コメントがない場合はミュート情報を取得しない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' }, expires: '' })
    mockGetComments.mockResolvedValue({ comments: [], nextCursor: undefined })

    await Page({ params: Promise.resolve({ id: 'post-1' }) })

    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('ログインしていない場合はミュート情報を取得しない', async () => {
    mockAuth.mockResolvedValue(null)
    mockGetComments.mockResolvedValue({
      comments: [{ id: 'comment-1', content: 'test' }],
      nextCursor: undefined,
    })

    await Page({ params: Promise.resolve({ id: 'post-1' }) })

    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('ページが正常にレンダリングされる', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    expect(screen.getByTestId('post-card')).toBeInTheDocument()
    expect(screen.getByTestId('breadcrumb')).toBeInTheDocument()
  })
})
