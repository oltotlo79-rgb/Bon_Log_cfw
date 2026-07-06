// @vitest-environment node
/**
 * lib/services/user-posts-service の fetchUserPosts ユニットテスト。
 *
 * 対象ユーザーの不存在・ゲスト・非公開アカウントの可視性判定、
 * カーソルページネーションの境界（take 件数と同数/未満での nextCursor 有無、
 * cursor 指定時の skip:1）、viewerId 有無によるインタラクション集合構築を検証する。
 *
 * 依存する post-visibility / post-include / getPostInteractionSets は
 * 単体でテスト済みの外部依存として最小限モックし、本モジュール自身のロジック
 * （可視性分岐・ページネーション・リポスト集合構築）を実行対象にする。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockUserFindUnique = vi.fn()
const mockPostFindMany = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    post: {
      findMany: (...args: unknown[]) => mockPostFindMany(...args),
    },
  },
}))

const mockCanViewAuthorContent = vi.fn()
const mockRedactNonVisibleNestedPosts = vi.fn()

vi.mock('@/lib/services/post-visibility', () => ({
  canViewAuthorContent: (...args: unknown[]) => mockCanViewAuthorContent(...args),
  redactNonVisibleNestedPosts: (...args: unknown[]) => mockRedactNonVisibleNestedPosts(...args),
}))

const mockGetPostInteractionSets = vi.fn()

vi.mock('@/lib/actions/utils', () => ({
  getPostInteractionSets: (...args: unknown[]) => mockGetPostInteractionSets(...args),
}))

vi.mock('@/lib/actions/post-include', () => ({
  POST_LIST_INCLUDE: {},
  POST_QUOTE_INCLUDE: {},
  POST_REPOST_INCLUDE: {},
  buildPostPollInclude: () => ({}),
  formatPostForClient: (
    post: { id: string },
    likedSet: Set<string>,
    bookmarkedSet: Set<string>,
    repostedSet: Set<string>,
  ) => ({
    ...post,
    isLiked: likedSet.has(post.id),
    isBookmarked: bookmarkedSet.has(post.id),
    isReposted: repostedSet.has(post.id),
  }),
}))

const TARGET_USER_ID = 'user-target-001'
const VIEWER_ID = 'user-viewer-001'

const makePostRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'post-001',
  userId: TARGET_USER_ID,
  content: 'テスト投稿',
  isHidden: false,
  quotePost: null,
  repostPost: null,
  ...overrides,
})

describe('fetchUserPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanViewAuthorContent.mockResolvedValue(true)
    mockRedactNonVisibleNestedPosts.mockImplementation(async (_viewerId, posts) => posts)
    mockGetPostInteractionSets.mockResolvedValue({
      likedSet: new Set<string>(),
      bookmarkedSet: new Set<string>(),
    })
  })

  it('対象ユーザーが存在しない場合は reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(mockPostFindMany).not.toHaveBeenCalled()
  })

  it('ゲストアカウント（GUEST_EMAIL）は reason: not_found を返す', async () => {
    const { GUEST_EMAIL } = await import('@/lib/constants/guest')
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: GUEST_EMAIL,
    })

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('非公開アカウントで viewer が閲覧権限を持たない場合は reason: private_account を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: false,
      isSuspended: false,
      email: 'target@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(false)

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'private_account' })
  })

  it('公開アカウントだが canViewAuthorContent が false（例: 停止著者）の場合は reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: true,
      email: 'target@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(false)

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('本人（isSelf）は canView の実装に関わらず投稿一覧を取得できる', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: false,
      isSuspended: false,
      email: 'target@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(true)
    mockPostFindMany.mockResolvedValueOnce([])

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, TARGET_USER_ID)

    expect(result.ok).toBe(true)
  })

  it('findMany の where に { userId, isHidden: false } が渡される', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'target@example.com',
    })
    mockPostFindMany.mockResolvedValueOnce([])

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    await fetchUserPosts(TARGET_USER_ID, VIEWER_ID)

    expect(mockPostFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: TARGET_USER_ID, isHidden: false },
      }),
    )
  })

  it('cursor 未指定: findMany に cursor/skip が渡らない', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'target@example.com',
    })
    mockPostFindMany.mockResolvedValueOnce([])

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    await fetchUserPosts(TARGET_USER_ID, VIEWER_ID)

    const callArgs = mockPostFindMany.mock.calls[0]?.[0] as { cursor?: unknown; skip?: number }
    expect(callArgs.cursor).toBeUndefined()
    expect(callArgs.skip).toBeUndefined()
  })

  it('cursor 指定時: cursor:{id} と skip:1 が渡される', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'target@example.com',
    })
    mockPostFindMany.mockResolvedValueOnce([])

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    await fetchUserPosts(TARGET_USER_ID, VIEWER_ID, 'post-cursor-id')

    const callArgs = mockPostFindMany.mock.calls[0]?.[0] as {
      cursor?: { id: string }
      skip?: number
    }
    expect(callArgs.cursor).toEqual({ id: 'post-cursor-id' })
    expect(callArgs.skip).toBe(1)
  })

  it('取得件数が limit ちょうどのとき nextCursor が最後の投稿 id になる', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'target@example.com',
    })
    const rows = Array.from({ length: 20 }, (_, i) => makePostRow({ id: `post-${i}` }))
    mockPostFindMany.mockResolvedValueOnce(rows)
    mockPostFindMany.mockResolvedValueOnce([]) // repostedRows

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, VIEWER_ID, undefined, 20)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.posts).toHaveLength(20)
    expect(result.nextCursor).toBe('post-19')
  })

  it('取得件数が limit 未満のとき nextCursor は undefined になる', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'target@example.com',
    })
    const rows = Array.from({ length: 5 }, (_, i) => makePostRow({ id: `post-${i}` }))
    mockPostFindMany.mockResolvedValueOnce(rows)
    mockPostFindMany.mockResolvedValueOnce([]) // repostedRows

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, VIEWER_ID, undefined, 20)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.nextCursor).toBeUndefined()
  })

  it('viewerId が無い場合: getPostInteractionSets を呼ばず、いいね/ブックマークは全て false になる', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'target@example.com',
    })
    mockPostFindMany.mockResolvedValueOnce([makePostRow({ id: 'post-1' })])

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, undefined)

    expect(mockGetPostInteractionSets).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.posts[0]).toMatchObject({ isLiked: false, isBookmarked: false, isReposted: false })
    // viewerId が無いのでリポスト状態解決の 2 回目の findMany（repostPostId フィルタ）も呼ばれない
    expect(mockPostFindMany).toHaveBeenCalledTimes(1)
  })

  it('viewerId がある場合: getPostInteractionSets の結果が isLiked/isBookmarked に反映される', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'target@example.com',
    })
    mockPostFindMany.mockResolvedValueOnce([makePostRow({ id: 'post-1' })])
    mockPostFindMany.mockResolvedValueOnce([]) // repostedRows
    mockGetPostInteractionSets.mockResolvedValueOnce({
      likedSet: new Set(['post-1']),
      bookmarkedSet: new Set<string>(),
    })

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, VIEWER_ID)

    expect(mockGetPostInteractionSets).toHaveBeenCalledWith(VIEWER_ID, ['post-1'])
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.posts[0]).toMatchObject({ isLiked: true, isBookmarked: false })
  })

  it('viewerId がリポストしている投稿は isReposted: true になる（N+1 なしの 1 クエリで解決）', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'target@example.com',
    })
    mockPostFindMany.mockResolvedValueOnce([
      makePostRow({ id: 'post-1' }),
      makePostRow({ id: 'post-2' }),
    ])
    mockPostFindMany.mockResolvedValueOnce([{ repostPostId: 'post-1' }])

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, VIEWER_ID)

    expect(mockPostFindMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { userId: VIEWER_ID, repostPostId: { in: ['post-1', 'post-2'] } },
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.posts[0]).toMatchObject({ isReposted: true })
    expect(result.posts[1]).toMatchObject({ isReposted: false })
  })

  it('投稿が 0 件のとき posts は空配列で nextCursor は undefined（getPostInteractionSets/repost 解決は呼ばれない）', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'target@example.com',
    })
    mockPostFindMany.mockResolvedValueOnce([])

    const { fetchUserPosts } = await import('@/lib/services/user-posts-service')
    const result = await fetchUserPosts(TARGET_USER_ID, VIEWER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('ok=false')
    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
    expect(mockGetPostInteractionSets).not.toHaveBeenCalled()
    expect(mockPostFindMany).toHaveBeenCalledTimes(1)
  })
})
