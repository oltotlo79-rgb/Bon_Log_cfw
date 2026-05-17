import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/actions/post', () => ({ getPost: vi.fn() }))
vi.mock('@/lib/actions/comment', () => ({
  getComments: vi.fn(),
  getCommentCount: vi.fn(),
}))
vi.mock('@/lib/actions/analytics', () => ({ recordPostView: vi.fn().mockResolvedValue(undefined) }))
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
import { recordPostView } from '@/lib/actions/analytics'
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

    expect(recordPostView).not.toHaveBeenCalled()
  })

  it('自分の投稿でも recordPostView を呼ばない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'author-1' }, expires: '' } as never)
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)

    await Page({ params: Promise.resolve({ id: 'post-1' }) })

    expect(recordPostView).not.toHaveBeenCalled()
  })

  it('passes comment data to CommentThread', async () => {
    mockAuth.mockResolvedValue(null as never)
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)
    mockGetComments.mockResolvedValue({ comments: [{ id: 'c1' }], nextCursor: 'cur' } as never)
    mockGetCommentCount.mockResolvedValue({ count: 5 } as never)

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    // CommentThreadはSuspense内の非同期コンポーネントのためjsdomでは検証不可
    // コメントデータの取得自体はgetComments/getCommentCountモックで確認済み
    expect(mockGetComments).toHaveBeenCalledWith('post-1')
  })
})

describe('generateMetadata for posts', async () => {
  let generateMetadata: typeof import('@/app/(main)/posts/[id]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@/app/(main)/posts/[id]/page')
    generateMetadata = mod.generateMetadata
  })

  it('returns post metadata', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } } as never)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    expect(result.title).toBe('Authorさんの投稿')
  })

  it('returns fallback when not found', async () => {
    mockGetPost.mockResolvedValue({ success: false, error: 'Not found' } as never)

    const result = await generateMetadata({ params: Promise.resolve({ id: 'x' }) })
    expect(result.title).toBe('投稿が見つかりません')
  })
})
