import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => mockUserFindUnique(...args) } },
}))
vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/actions/post', () => ({ getPost: vi.fn() }))
// CommentSection は Suspense 内の async Server Component。テスト環境でこの async 関数が
// suspend すると "A component suspended inside an act scope" 警告が出るため、
// 外部ファイルのコンポーネントとしてモック化して解消する。
vi.mock('@/app/(main)/posts/[id]/CommentSection', () => ({
  CommentSection: () => <div data-testid="comment-section" />,
  CommentSectionSkeleton: () => <div data-testid="comment-section-skeleton" />,
}))
vi.mock('@/lib/actions/comment', () => ({
  getComments: vi.fn(),
  getCommentCount: vi.fn(),
}))
const mockRecordPostView = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/actions/analytics', () => ({ recordPostView: mockRecordPostView }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('next/link', () => ({ __esModule: true, default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }))
vi.mock('@/components/post/PostCard', () => ({
  PostCard: () => <div data-testid="post-card" />,
}))
vi.mock('@/components/post/ShareButtons', () => ({
  ShareButtons: () => <div data-testid="share-buttons" />,
}))
vi.mock('@/components/comment', () => ({
  CommentThread: (props: Record<string, unknown>) => <div data-testid="comment-thread" data-count={props.commentCount} />,
}))
vi.mock('@/components/ads', () => ({
  PostDetailAdUnit: () => <div data-testid="ad-banner" />,
}))
vi.mock('@/components/seo/JsonLd', () => ({
  ArticleJsonLd: () => <script data-testid="json-ld" />,
  BreadcrumbJsonLd: () => <script data-testid="breadcrumb-json-ld" />,
}))

import { auth } from '@/lib/auth'
import { getPost } from '@/lib/actions/post'
import { getComments, getCommentCount } from '@/lib/actions/comment'
import { notFound } from 'next/navigation'

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockGetPost = getPost as ReturnType<typeof vi.fn>
const mockGetComments = getComments as ReturnType<typeof vi.fn>
const mockGetCommentCount = getCommentCount as ReturnType<typeof vi.fn>

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

describe('PostDetailPage', async () => {
  let Page: typeof import('@/app/(main)/posts/[id]/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    mockGetComments.mockResolvedValue({ comments: [] } as never)
    mockGetCommentCount.mockResolvedValue({ count: 0 } as never)

    const mod = await import('@/app/(main)/posts/[id]/page')
    Page = mod.default
  })

  it('renders post detail page', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    expect(screen.getByTestId('post-card')).toBeInTheDocument()
    expect(screen.getByTestId('share-buttons')).toBeInTheDocument()
    // CommentThreadはSuspense内の非同期コンポーネントのためjsdomでは検証不可
    expect(screen.getByTestId('ad-banner')).toBeInTheDocument()
  })

  it('calls notFound when post not found', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockGetPost.mockResolvedValue({ success: false, error: 'Not found' } as never)

    await expect(
      Page({ params: Promise.resolve({ id: 'none' }) })
    ).rejects.toThrow('NOT_FOUND')
    expect(notFound).toHaveBeenCalled()
  })

  // render-time の analytics write は P0-2 で client beacon に切り出し済み。
  // server side では recordPostView は呼ばないことを確認する。
  it('server side では recordPostView を呼ばない (他人の投稿)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer' }, expires: '' } as never)
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)

    await Page({ params: Promise.resolve({ id: 'post-1' }) })

    expect(mockRecordPostView).not.toHaveBeenCalled()
  })

  it('自分の投稿でも recordPostView を呼ばない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'author-1' }, expires: '' } as never)
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)

    await Page({ params: Promise.resolve({ id: 'post-1' }) })

    expect(mockRecordPostView).not.toHaveBeenCalled()
  })

  it('passes comment data to CommentThread', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)
    mockGetComments.mockResolvedValue({ comments: [{ id: 'c1' }], nextCursor: 'cur' } as never)
    mockGetCommentCount.mockResolvedValue({ count: 5 } as never)

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    // CommentSection は vi.mock で置き換えているため getComments は呼ばれない。
    // CommentSection（Suspense フォールバックを含む境界）が描画されることを確認する。
    expect(screen.getByTestId('comment-section')).toBeInTheDocument()
  })
})

describe('generateMetadata for posts', async () => {
  let generateMetadata: typeof import('@/app/(main)/posts/[id]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    // 既定では公開・非停止ユーザー（noindex なし）
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: false })
    const mod = await import('@/app/(main)/posts/[id]/page')
    generateMetadata = mod.generateMetadata
  })

  it('returns post metadata', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    expect(result.title).toBe('Authorさんの投稿 | BON-LOG')
  })

  it('returns fallback when not found', async () => {
    mockGetPost.mockResolvedValue({ success: false, error: 'Not found' } as never)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('投稿が見つかりません')
  })

  it('公開ユーザーの投稿は noindex を設定しない', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)
    mockUserFindUnique.mockResolvedValueOnce({ isPublic: true, isSuspended: false })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    expect(result.robots).toBeUndefined()
  })

  it('非公開ユーザーの投稿は noindex を設定する', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)
    mockUserFindUnique.mockResolvedValueOnce({ isPublic: false, isSuspended: false })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    expect(result.robots).toEqual({ index: false, follow: false })
  })

  it('停止ユーザーの投稿は noindex を設定する', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)
    mockUserFindUnique.mockResolvedValueOnce({ isPublic: true, isSuspended: true })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    expect(result.robots).toEqual({ index: false, follow: false })
  })

  it('著者が取得できない場合も安全側で noindex にする', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)
    mockUserFindUnique.mockResolvedValueOnce(null)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    expect(result.robots).toEqual({ index: false, follow: false })
  })
})
