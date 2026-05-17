import { vi } from 'vitest'
import { render, screen } from '@testing-library/react'

/**
 * タイムライン（フィード）ページのテスト
 * - 認証済みユーザーのタイムライン
 * - ゲストユーザー（ComposeButton非表示）
 * - 未ログインユーザー
 * - データ並列取得の検証
 */

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockGetGenres = vi.fn()
const mockGetTimeline = vi.fn()
vi.mock('@/lib/actions/post', () => ({
  getGenres: () => mockGetGenres(),
}))
vi.mock('@/lib/actions/feed', () => ({
  getTimeline: () => mockGetTimeline(),
}))

const mockGetDraftCount = vi.fn()
vi.mock('@/lib/actions/draft', () => ({
  getDraftCount: () => mockGetDraftCount(),
}))

const mockGetBonsais = vi.fn()
vi.mock('@/lib/actions/bonsai', () => ({
  getBonsais: () => mockGetBonsais(),
}))

const mockGetMembershipLimits = vi.fn()
// FREE_LIMITS は未ログイン時のフォールバックとして page から直接 import される
const mockFreeLimits = {
  maxPostLength: 500,
  maxImages: 4,
  maxVideos: 1,
  maxDailyPosts: 20,
  canSchedulePost: false,
  canViewAnalytics: false,
}
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
  FREE_LIMITS: mockFreeLimits,
}))

// Mock Suspense to render fallback instead of children (to avoid async component issues)
vi.mock('react', async () => {
  const actual = await vi.importActual('react')
  return {
    ...actual,
    Suspense: ({ fallback }: { fallback: React.ReactNode; children: React.ReactNode }) => <>{fallback}</>,
  }
})

vi.mock('@/components/feed/Timeline', () => ({
  Timeline: ({ initialPosts, currentUserId, isGuest, nextCursor }: { initialPosts: unknown[]; currentUserId?: string; isGuest?: boolean; nextCursor?: string }) => (
    <div
      data-testid="timeline"
      data-post-count={initialPosts.length}
      data-user-id={currentUserId}
      data-is-guest={isGuest}
      data-next-cursor={nextCursor}
    />
  ),
}))

vi.mock('@/components/feed/TimelineSkeleton', () => ({
  TimelineSkeleton: () => <div data-testid="timeline-skeleton" />,
}))

vi.mock('@/components/feed/ComposeButton', () => ({
  ComposeButton: ({ genres, limits, draftCount, bonsais }: { genres: Record<string, unknown>; limits: Record<string, unknown>; draftCount: number; bonsais: unknown[] }) => (
    <div
      data-testid="compose-button"
      data-genres={JSON.stringify(genres)}
      data-max-post-length={limits.maxPostLength as number}
      data-draft-count={draftCount}
      data-bonsai-count={bonsais.length}
    />
  ),
}))

const mockGenres = { pine: '松柏類', misc: '雑木類' }

const defaultLimits = {
  maxPostLength: 1000,
  maxImages: 8,
  maxVideos: 2,
  canSchedulePost: true,
  canViewAnalytics: true,
}

describe('FeedPage', () => {
  let Page: typeof import('@/app/(main)/feed/page').default

  beforeEach(async () => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' }, expires: '' })
    mockGetGenres.mockResolvedValue({ genres: mockGenres })
    mockGetTimeline.mockResolvedValue({ posts: [], nextCursor: undefined })
    mockGetDraftCount.mockResolvedValue(3)
    mockGetBonsais.mockResolvedValue({ success: true, data: { bonsais: [{ id: 'b1', name: '松' }] } })
    mockGetMembershipLimits.mockResolvedValue(defaultLimits)

    const mod = await import('@/app/(main)/feed/page')
    Page = mod.default
  }, 20000)

  it('認証済みユーザー: タイムラインスケルトンと投稿ボタンが表示される', async () => {
    const result = await Page()
    render(result)

    expect(screen.getByText('タイムライン')).toBeInTheDocument()
    // Suspense renders fallback (TimelineSkeleton)
    expect(screen.getByTestId('timeline-skeleton')).toBeInTheDocument()
    expect(screen.getByTestId('compose-button')).toBeInTheDocument()
  })

  it('認証済みユーザー: getMembershipLimitsが呼ばれる', async () => {
    await Page()

    expect(mockGetMembershipLimits).toHaveBeenCalledWith('user-1')
  })

  it('認証済みユーザー: getBonsaisが呼ばれる', async () => {
    await Page()

    expect(mockGetBonsais).toHaveBeenCalledTimes(1)
  })

  it('認証済みユーザー: limitsがComposeButtonに渡される', async () => {
    const result = await Page()
    render(result)

    expect(screen.getByTestId('compose-button')).toHaveAttribute('data-max-post-length', '1000')
  })

  it('認証済みユーザー: draftCountがComposeButtonに渡される', async () => {
    const result = await Page()
    render(result)

    expect(screen.getByTestId('compose-button')).toHaveAttribute('data-draft-count', '3')
  })

  it('認証済みユーザー: bonsaisがComposeButtonに渡される', async () => {
    const result = await Page()
    render(result)

    expect(screen.getByTestId('compose-button')).toHaveAttribute('data-bonsai-count', '1')
  })

  it('ゲストユーザー: ComposeButtonが表示されない', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'guest-1', email: 'guest@example.com' },
      expires: '',
    })

    const result = await Page()
    render(result)

    expect(screen.queryByTestId('compose-button')).not.toBeInTheDocument()
  })

  it('未ログインユーザー: ComposeButtonは表示される（isGuest=false）', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await Page()
    render(result)

    expect(screen.getByTestId('compose-button')).toBeInTheDocument()
  })

  it('未ログインユーザー: デフォルトのlimitsが使用される', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await Page()
    render(result)

    expect(mockGetMembershipLimits).not.toHaveBeenCalled()
    expect(screen.getByTestId('compose-button')).toHaveAttribute('data-max-post-length', '500')
  })

  it('未ログインユーザー: getBonsaisが呼ばれず空配列', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await Page()
    render(result)

    expect(mockGetBonsais).not.toHaveBeenCalled()
    expect(screen.getByTestId('compose-button')).toHaveAttribute('data-bonsai-count', '0')
  })

  it('getGenres結果のgenresがundefinedの場合は空オブジェクト', async () => {
    mockGetGenres.mockResolvedValue({})

    const result = await Page()
    render(result)

    expect(screen.getByTestId('compose-button')).toHaveAttribute('data-genres', '{}')
  })

  it('getBonsaisが ActionResult エラーを返す場合は空配列', async () => {
    mockGetBonsais.mockResolvedValue({ success: false, error: 'some error' })

    const result = await Page()
    render(result)

    expect(screen.getByTestId('compose-button')).toHaveAttribute('data-bonsai-count', '0')
  })

  it('genresデータがComposeButtonに渡される', async () => {
    const result = await Page()
    render(result)

    expect(screen.getByTestId('compose-button')).toHaveAttribute(
      'data-genres',
      JSON.stringify(mockGenres)
    )
  })

  it('全データ取得関数が呼ばれる（並列取得の確認）', async () => {
    await Page()

    expect(mockGetGenres).toHaveBeenCalledTimes(1)
    expect(mockGetDraftCount).toHaveBeenCalledTimes(1)
    expect(mockGetMembershipLimits).toHaveBeenCalledTimes(1)
    expect(mockGetBonsais).toHaveBeenCalledTimes(1)
  })

  it('ゲストでsession.user.emailがGUEST_EMAIL以外: isGuest=false', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-2', email: 'real@example.com' },
      expires: '',
    })

    const result = await Page()
    render(result)

    // isGuest=false なので ComposeButton が表示される
    expect(screen.getByTestId('compose-button')).toBeInTheDocument()
  })

  it('draftCount=0の場合', async () => {
    mockGetDraftCount.mockResolvedValue(0)

    const result = await Page()
    render(result)

    expect(screen.getByTestId('compose-button')).toHaveAttribute('data-draft-count', '0')
  })

  it('h2にdata-testidが設定されている', async () => {
    const result = await Page()
    render(result)

    expect(screen.getByTestId('feed-timeline-heading')).toBeInTheDocument()
  })
})

describe('FeedPage metadata', async () => {
  it('SEO/プライバシー強化されたメタデータがエクスポートされる', async () => {
    const mod = await import('@/app/(main)/feed/page')
    // title は layout 側 template で suffix が付くため文字列のみ
    expect(mod.metadata).toMatchObject({
      title: 'タイムライン',
      // 認証ユーザー固有のフィードのため検索インデックス不要
      robots: { index: false, follow: false },
    })
    expect(mod.metadata).toHaveProperty('description')
    expect(mod.metadata).toHaveProperty('alternates.canonical')
    expect(mod.metadata).toHaveProperty('openGraph')
  })
})
