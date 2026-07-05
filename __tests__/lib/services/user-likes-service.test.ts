// @vitest-environment node
/**
 * lib/services/user-likes-service のユニットテスト
 *
 * fetchLikedPostsCore（Web `getLikedPosts` 委譲・可視性チェックなし）と
 * fetchLikedPosts（mobile 専用・対象ユーザーの可視性チェック + isReposted 解決）の
 * 意図的な差異を検証する。カーソル境界・ブロック関係・自分自身の非公開いいね一覧 vs
 * 他人からの閲覧の分岐も検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockLikeFindMany = vi.fn()
const mockUserFindUnique = vi.fn()
const mockPostFindMany = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    like: {
      findMany: (...args: unknown[]) => mockLikeFindMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    post: {
      findMany: (...args: unknown[]) => mockPostFindMany(...args),
    },
  },
}))

const mockGetPostInteractionSets = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  getPostInteractionSets: (...args: unknown[]) => mockGetPostInteractionSets(...args),
}))

const mockFormatPostForClient = vi.fn()
vi.mock('@/lib/actions/post-include', () => ({
  POST_LIST_INCLUDE: {},
  formatPostForClient: (...args: unknown[]) => mockFormatPostForClient(...args),
}))

const mockCanViewAuthorContent = vi.fn()
const mockVisiblePostWhere = vi.fn()
vi.mock('@/lib/services/post-visibility', () => ({
  canViewAuthorContent: (...args: unknown[]) => mockCanViewAuthorContent(...args),
  visiblePostWhere: (...args: unknown[]) => mockVisiblePostWhere(...args),
}))

vi.mock('@/lib/actions/pagination', () => ({
  normalizeCursorPagination: (opts: { cursor?: string; limit?: number }) => ({
    cursor: opts.cursor,
    limit: opts.limit ?? 20,
  }),
}))

vi.mock('@/lib/constants/guest', () => ({
  GUEST_EMAIL: 'guest@example.com',
}))

const TARGET_USER_ID = 'user-target'
const VIEWER_ID = 'viewer-1'
const VISIBLE_POST_WHERE_STUB = { isHidden: false, user: { isPublic: true } }

function makeLikeRow(id: string, postId: string, createdAt: Date) {
  return {
    id,
    postId,
    createdAt,
    post: { id: postId, content: `content-${postId}` },
  }
}

describe('fetchLikedPostsCore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVisiblePostWhere.mockReturnValue(VISIBLE_POST_WHERE_STUB)
    mockLikeFindMany.mockResolvedValue([])
    mockGetPostInteractionSets.mockResolvedValue({ likedSet: new Set(), bookmarkedSet: new Set() })
    mockFormatPostForClient.mockImplementation((post: { id: string }) => ({ id: post.id, isReposted: false }))
  })

  it('正常系: posts と nextCursor を返す', async () => {
    mockLikeFindMany.mockResolvedValueOnce([makeLikeRow('like-1', 'post-1', new Date())])
    const { fetchLikedPostsCore } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPostsCore(TARGET_USER_ID, VIEWER_ID)

    expect(result.posts).toHaveLength(1)
    expect(result.nextCursor).toBeUndefined()
  })

  it('対象ユーザーの可視性チェックを行わない（user.findUnique を呼ばない）', async () => {
    const { fetchLikedPostsCore } = await import('@/lib/services/user-likes-service')
    await fetchLikedPostsCore(TARGET_USER_ID, VIEWER_ID)

    expect(mockUserFindUnique).not.toHaveBeenCalled()
  })

  it('post が null の like 行は除外される（削除済み投稿へのいいね）', async () => {
    mockLikeFindMany.mockResolvedValueOnce([
      { id: 'like-1', postId: 'post-ghost', createdAt: new Date(), post: null },
      makeLikeRow('like-2', 'post-2', new Date()),
    ])
    const { fetchLikedPostsCore } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPostsCore(TARGET_USER_ID, VIEWER_ID)

    expect(result.posts).toHaveLength(1)
  })

  it('rows.length === limit のとき nextCursor が最後の like id になる（カーソル境界）', async () => {
    const rows = [
      makeLikeRow('like-1', 'post-1', new Date()),
      makeLikeRow('like-2', 'post-2', new Date()),
    ]
    mockLikeFindMany.mockResolvedValueOnce(rows)
    const { fetchLikedPostsCore } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPostsCore(TARGET_USER_ID, VIEWER_ID, undefined, 2)

    expect(result.nextCursor).toBe('like-2')
  })

  it('rows.length < limit のとき nextCursor は undefined（最終ページ）', async () => {
    mockLikeFindMany.mockResolvedValueOnce([makeLikeRow('like-1', 'post-1', new Date())])
    const { fetchLikedPostsCore } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPostsCore(TARGET_USER_ID, VIEWER_ID, undefined, 20)

    expect(result.nextCursor).toBeUndefined()
  })

  it('cursor 指定時 like.findMany に { cursor: { id }, skip: 1 } が渡される', async () => {
    const { fetchLikedPostsCore } = await import('@/lib/services/user-likes-service')
    await fetchLikedPostsCore(TARGET_USER_ID, VIEWER_ID, 'like-prev')

    expect(mockLikeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'like-prev' }, skip: 1 }),
    )
  })

  it('post の可視性フィルタは visiblePostWhere(viewerId) に委譲される（ブロック関係含む）', async () => {
    const { fetchLikedPostsCore } = await import('@/lib/services/user-likes-service')
    await fetchLikedPostsCore(TARGET_USER_ID, VIEWER_ID)

    expect(mockVisiblePostWhere).toHaveBeenCalledWith(VIEWER_ID)
    expect(mockLikeFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ post: VISIBLE_POST_WHERE_STUB }),
      }),
    )
  })

  it('viewerId が undefined のとき getPostInteractionSets を呼ばない（likedSet/bookmarkedSet は空）', async () => {
    mockLikeFindMany.mockResolvedValueOnce([makeLikeRow('like-1', 'post-1', new Date())])
    const { fetchLikedPostsCore } = await import('@/lib/services/user-likes-service')
    await fetchLikedPostsCore(TARGET_USER_ID, undefined)

    expect(mockGetPostInteractionSets).not.toHaveBeenCalled()
  })

  it('いいねが 0 件のとき posts: [] / nextCursor: undefined を返す', async () => {
    const { fetchLikedPostsCore } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPostsCore(TARGET_USER_ID, VIEWER_ID)

    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })
})

describe('fetchLikedPosts（mobile 専用: 可視性チェック + isReposted 解決）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: false, email: 'target@example.com' })
    mockCanViewAuthorContent.mockResolvedValue(true)
    mockVisiblePostWhere.mockReturnValue(VISIBLE_POST_WHERE_STUB)
    mockLikeFindMany.mockResolvedValue([])
    mockGetPostInteractionSets.mockResolvedValue({ likedSet: new Set(), bookmarkedSet: new Set() })
    mockFormatPostForClient.mockImplementation((post: { id: string }) => ({ id: post.id }))
    mockPostFindMany.mockResolvedValue([])
  })

  it('正常系: { ok: true, posts, nextCursor } を返す', async () => {
    mockLikeFindMany.mockResolvedValueOnce([makeLikeRow('like-1', 'post-1', new Date())])
    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts(TARGET_USER_ID, VIEWER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.posts).toHaveLength(1)
  })

  it('fetchLikedPostsCore と異なり対象ユーザーの可視性チェックを行う（user.findUnique を呼ぶ）', async () => {
    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    await fetchLikedPosts(TARGET_USER_ID, VIEWER_ID)

    expect(mockUserFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TARGET_USER_ID } }),
    )
  })

  it('対象ユーザーが存在しない場合 reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)
    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts('no-such-user', VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(mockLikeFindMany).not.toHaveBeenCalled()
  })

  it('対象ユーザーがゲストアカウントの場合 reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'guest@example.com',
    })
    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('他人から見た非公開アカウントかつ未フォローの場合 reason: private_account を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: false,
      isSuspended: false,
      email: 'private@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(false)
    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'private_account' })
  })

  it('自分自身が自分の非公開いいね一覧を見る場合は閲覧可能', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: false,
      isSuspended: false,
      email: 'private@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(true)
    mockLikeFindMany.mockResolvedValueOnce([makeLikeRow('like-1', 'post-1', new Date())])

    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts(TARGET_USER_ID, TARGET_USER_ID)

    expect(result.ok).toBe(true)
  })

  it('停止ユーザーで canViewAuthorContent が false のとき reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: true,
      email: 'suspended@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(false)
    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('isReposted 解決: viewer が対象投稿をリポスト済みなら isReposted: true が付与される', async () => {
    mockLikeFindMany.mockResolvedValueOnce([makeLikeRow('like-1', 'post-1', new Date())])
    mockFormatPostForClient.mockReturnValueOnce({ id: 'post-1' })
    mockPostFindMany.mockResolvedValueOnce([{ repostPostId: 'post-1' }])

    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.posts[0]).toMatchObject({ id: 'post-1', isReposted: true })
  })

  it('isReposted 解決: viewer がリポストしていない投稿は isReposted を上書きしない', async () => {
    mockLikeFindMany.mockResolvedValueOnce([makeLikeRow('like-1', 'post-1', new Date())])
    mockFormatPostForClient.mockReturnValueOnce({ id: 'post-1' })
    mockPostFindMany.mockResolvedValueOnce([])

    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.posts[0]).toEqual({ id: 'post-1' })
  })

  it('viewerId が undefined のとき post.findMany（リポスト解決）を呼ばない', async () => {
    mockLikeFindMany.mockResolvedValueOnce([makeLikeRow('like-1', 'post-1', new Date())])
    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    await fetchLikedPosts(TARGET_USER_ID, undefined)

    expect(mockPostFindMany).not.toHaveBeenCalled()
  })

  it('いいねが 0 件のとき posts: [] を返し post.findMany を呼ばない', async () => {
    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.posts).toEqual([])
    expect(mockPostFindMany).not.toHaveBeenCalled()
  })

  it('nextCursor が fetchLikedPostsCore の結果からそのまま引き継がれる', async () => {
    const rows = [makeLikeRow('like-1', 'post-1', new Date()), makeLikeRow('like-2', 'post-2', new Date())]
    mockLikeFindMany.mockResolvedValueOnce(rows)
    const { fetchLikedPosts } = await import('@/lib/services/user-likes-service')
    const result = await fetchLikedPosts(TARGET_USER_ID, VIEWER_ID, undefined, 2)

    if (!result.ok) throw new Error('unreachable')
    expect(result.nextCursor).toBe('like-2')
  })
})
