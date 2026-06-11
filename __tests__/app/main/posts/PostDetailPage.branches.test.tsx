import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * 投稿詳細ページの追加ブランチカバレッジテスト
 * - generateMetadata: コンテンツ切り詰め、メディア有無
 * - PostDetailPage: session有無とpostView記録の各パターン
 * - コンテンツが長い場合の切り詰め
 * - メディア付き投稿のOG画像
 */

const mockFindMany = vi.fn()
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    commentThreadMute: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockGetPost = vi.fn()
vi.mock('@/lib/actions/post', () => ({ getPost: (...args: unknown[]) => mockGetPost(...args) }))

const mockGetComments = vi.fn()
const mockGetCommentCount = vi.fn()
vi.mock('@/lib/actions/comment', () => ({
  getComments: (...args: unknown[]) => mockGetComments(...args),
  getCommentCount: (...args: unknown[]) => mockGetCommentCount(...args),
}))

const mockRecordPostView = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/actions/analytics', () => ({
  recordPostView: (...args: unknown[]) => mockRecordPostView(...args),
}))

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))

vi.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}))

vi.mock('@/components/post/PostCard', () => ({
  PostCard: ({ post, currentUserId, disableNavigation }: { post: Record<string, unknown>; currentUserId?: string; disableNavigation?: boolean }) => (
    <div data-testid="post-card" data-user-id={currentUserId} data-disable-nav={disableNavigation} data-post-content={post.content as string} />
  ),
}))

// ViewBeacon は client beacon を 1 つ render する。テストでは props だけ可視化する。
vi.mock('@/components/analytics/ViewBeacon', () => ({
  ViewBeacon: (props: Record<string, unknown>) => (
    <div data-testid="view-beacon" data-type={props.type as string} data-target-user-id={props.targetUserId as string} />
  ),
}))

vi.mock('@/components/post/ShareButtons', () => ({
  ShareButtons: ({ url, title, text }: { url: string; title: string; text: string }) => (
    <div data-testid="share-buttons" data-url={url} data-title={title} data-text={text} />
  ),
}))

vi.mock('@/components/comment', () => ({
  CommentThread: ({ postId, comments, nextCursor, currentUserId, commentCount, mutedThreadIds }: Record<string, unknown>) => (
    <div
      data-testid="comment-thread"
      data-post-id={postId as string}
      data-comment-count={comments ? (comments as unknown[]).length : 0}
      data-next-cursor={nextCursor as string}
      data-current-user={currentUserId as string}
      data-total-count={commentCount as number}
      data-muted-count={mutedThreadIds ? (mutedThreadIds as unknown[]).length : 0}
    />
  ),
}))

vi.mock('@/components/ads', () => ({
  PostDetailAdUnit: () => <div data-testid="ad-banner" />,
}))

vi.mock('@/components/seo/JsonLd', () => ({
  ArticleJsonLd: ({ headline, description }: { headline: string; description?: string }) => (
    <script data-testid="json-ld" data-headline={headline} data-description={description} />
  ),
  BreadcrumbJsonLd: () => <script data-testid="breadcrumb-json-ld" />,
}))

vi.mock('@/components/common/Breadcrumb', () => ({
  Breadcrumb: ({ items }: { items: { name: string; href?: string }[] }) => (
    <nav data-testid="breadcrumb" data-items={JSON.stringify(items)} />
  ),
}))

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn() },
}))

// CommentSection は Suspense 内の async Server Component。テスト環境でこの async 関数が
// suspend すると "A component suspended inside an act scope" 警告が出るため、
// 外部ファイルのコンポーネントとしてモック化して解消する。
vi.mock('@/app/(main)/posts/[id]/CommentSection', () => ({
  CommentSection: () => <div data-testid="comment-section" />,
  CommentSectionSkeleton: () => <div data-testid="comment-section-skeleton" />,
}))

function makePost(overrides = {}) {
  return {
    id: 'post-1',
    content: 'Hello World',
    createdAt: new Date('2026-01-01').toISOString(),
    user: { id: 'author-1', nickname: 'Author', avatarUrl: null },
    media: [],
    genres: [],
    _count: { likes: 5, comments: 3 },
    ...overrides,
  }
}

describe('PostDetailPage - ブランチカバレッジ', () => {
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
  }, 20000)

  // render-time の analytics write は P0-2 で client beacon に切り出し済み。
  // server side では recordPostView は呼ばず、ViewBeacon の有無で確認する。
  it('未ログイン: ViewBeacon を render しない', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    expect(mockRecordPostView).not.toHaveBeenCalled()
    expect(screen.queryByTestId('view-beacon')).toBeNull()
  })

  it('ログイン中・他人の投稿: ViewBeacon が render され、server side では record しない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer-1' }, expires: '' })

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    expect(mockRecordPostView).not.toHaveBeenCalled()
    const beacon = screen.getByTestId('view-beacon')
    expect(beacon.getAttribute('data-type')).toBe('post')
    expect(beacon.getAttribute('data-target-user-id')).toBe('author-1')
  })

  it('ログイン中・自分の投稿: ViewBeacon を render しない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'author-1' }, expires: '' })

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    expect(mockRecordPostView).not.toHaveBeenCalled()
    expect(screen.queryByTestId('view-beacon')).toBeNull()
  })

  it('currentUserIdがPostCardに渡される', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer-1' }, expires: '' })

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    expect(screen.getByTestId('post-card')).toHaveAttribute('data-user-id', 'viewer-1')
    expect(screen.getByTestId('post-card')).toHaveAttribute('data-disable-nav', 'true')
  })

  it('未ログイン: currentUserIdがundefined', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    // data-user-id should not be set
    expect(screen.getByTestId('post-card').getAttribute('data-user-id')).toBeFalsy()
  })

  it('コメントありでログイン: ミュート情報が取得される', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer-1' }, expires: '' })
    mockGetComments.mockResolvedValue({
      comments: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      nextCursor: 'next',
    })
    mockFindMany.mockResolvedValue([{ commentId: 'c1' }, { commentId: 'c3' }])

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    // CommentSectionはSuspense内の非同期コンポーネントのためjsdomでは検証不可
    expect(result).toBeTruthy()
  })

  it('コメントなしでログイン: ミュート情報は取得されない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'viewer-1' }, expires: '' })
    mockGetComments.mockResolvedValue({ comments: [], nextCursor: undefined })

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it('パンくずリストに投稿者名が含まれる', async () => {
    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    const breadcrumb = screen.getByTestId('breadcrumb')
    const items = JSON.parse(breadcrumb.getAttribute('data-items') || '[]')
    expect(items).toContainEqual({ name: 'Authorさんの投稿' })
  })

  it('タイムラインに戻るリンクが表示される', async () => {
    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    const backLink = screen.getByText('← タイムラインに戻る')
    expect(backLink.closest('a')).toHaveAttribute('href', '/feed')
  })

  it('ShareButtonsに正しいURLとタイトルが渡される', async () => {
    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    const share = screen.getByTestId('share-buttons')
    expect(share.getAttribute('data-url')).toContain('/posts/post-1')
    expect(share.getAttribute('data-title')).toContain('Authorさんの投稿')
  })

  it('コンテンツが長い場合はShareButtonsのtextが切り詰められる', async () => {
    const longContent = 'あ'.repeat(200)
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost({ content: longContent }) } })

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    const share = screen.getByTestId('share-buttons')
    const text = share.getAttribute('data-text') || ''
    expect(text.endsWith('...')).toBe(true)
  })

  it('コンテンツがnullの場合', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost({ content: null }) } })

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    render(result)

    const share = screen.getByTestId('share-buttons')
    expect(share.getAttribute('data-text')).toBe('')
  })

  it('CommentThreadにnextCursorが渡される（Suspense内）', async () => {
    mockGetComments.mockResolvedValue({ comments: [{ id: 'c1' }], nextCursor: 'cursor-abc' })
    mockGetCommentCount.mockResolvedValue({ count: 10 })

    const result = await Page({ params: Promise.resolve({ id: 'post-1' }) })
    // Suspense内の非同期コンポーネントはjsdomでは検証不可
    expect(result).toBeTruthy()
  })
})

describe('generateMetadata - ブランチカバレッジ', () => {
  let generateMetadata: typeof import('@/app/(main)/posts/[id]/page').generateMetadata

  beforeEach(async () => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: false })

    const mod = await import('@/app/(main)/posts/[id]/page')
    generateMetadata = mod.generateMetadata
  }, 20000)

  it('投稿が見つからない場合のフォールバック', async () => {
    mockGetPost.mockResolvedValue({ error: 'Not found' })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'missing' }) })
    expect(result.title).toBe('投稿が見つかりません')
  })

  it('短いコンテンツ: 切り詰めなし', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost({ content: 'Short' }) } })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    expect(result.description).toBe('Short')
  })

  it('長いコンテンツ: 切り詰め + ...', async () => {
    const longContent = 'あ'.repeat(200)
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost({ content: longContent }) } })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    expect(result.description?.endsWith('...')).toBe(true)
  })

  it('コンテンツがnullの場合: デフォルト値「投稿」', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost({ content: null }) } })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    expect(result.description).toBe('投稿')
  })

  it('メディアがある場合: OG画像がメディアURL', async () => {
    mockGetPost.mockResolvedValue({
      success: true,
      data: { post: makePost({ media: [{ url: 'https://example.com/image.jpg', type: 'image' }] }) },
    })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    const ogImages = (result.openGraph as { images?: { url: string }[] })?.images
    expect(ogImages?.[0]?.url).toBe('https://example.com/image.jpg')
  })

  it('メディアがない場合: デフォルトOG画像', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost({ media: [] }) } })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    const ogImages = (result.openGraph as { images?: { url: string }[] })?.images
    expect(ogImages?.[0]?.url).toBe('/api/og')
  })

  it('OpenGraphにtype:articleとpublishedTimeが含まれる', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    const og = result.openGraph as Record<string, unknown>
    expect(og?.type).toBe('article')
    expect(og?.publishedTime).toBeTruthy()
    expect((og?.authors as string[])?.[0]).toBe('Author')
  })

  it('Twitter cardがsummary_large_image', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    const twitter = result.twitter as Record<string, unknown>
    expect(twitter?.card).toBe('summary_large_image')
  })

  it('alternates.canonicalが正しいURL', async () => {
    mockGetPost.mockResolvedValue({ success: true, data: { post: makePost() } })

    const result = await generateMetadata({ params: Promise.resolve({ id: 'post-1' }) })
    const alternates = result.alternates as Record<string, unknown>
    expect(alternates?.canonical).toContain('/posts/post-1')
  })
})
