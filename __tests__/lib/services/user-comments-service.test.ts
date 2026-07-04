// @vitest-environment node
/**
 * lib/services/user-comments-service のユニットテスト
 *
 * fetchUserComments の正常系（形状・並び順・カーソルページネーション）、
 * isHidden/deletedAt コメントの除外（where 句への反映）、
 * 非公開アカウント／ゲスト／存在しないユーザーの reason 分岐、
 * 投稿の可視性委譲（visiblePostWhere 経由の block/mute 相当フィルタ）を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))

const mockCommentFindMany = vi.fn()
const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    comment: {
      findMany: (...args: unknown[]) => mockCommentFindMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
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
  buildCursorPagination: (cursor: string | undefined, limit: number) => ({
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  }),
}))

const TARGET_USER_ID = 'user-target'
const VIEWER_ID = 'viewer-1'
const VISIBLE_POST_WHERE_STUB = { isHidden: false, user: { isPublic: true } }

const mockCommentRows = [
  {
    id: 'comment-2',
    content: '2件目のコメント',
    createdAt: new Date('2025-02-01T00:00:00Z'),
    post: { id: 'post-2', content: '投稿2' },
    media: [],
  },
  {
    id: 'comment-1',
    content: '1件目のコメント',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    post: { id: 'post-1', content: '投稿1' },
    media: [],
  },
]

describe('fetchUserComments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ isPublic: true, isSuspended: false, email: 'target@example.com' })
    mockCanViewAuthorContent.mockResolvedValue(true)
    mockVisiblePostWhere.mockReturnValue(VISIBLE_POST_WHERE_STUB)
    mockCommentFindMany.mockResolvedValue(mockCommentRows)
  })

  it('正常系: { ok: true, items, nextCursor } を返す', async () => {
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.items).toHaveLength(2)
    expect(result.nextCursor).toBeUndefined()
  })

  it('各 item が { id, content, createdAt, post: { id, content } } の形状を持つ', async () => {
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.items[0]).toMatchObject({
      id: expect.any(String),
      content: expect.any(String),
      createdAt: expect.any(Date),
      post: { id: expect.any(String), content: expect.any(String) },
    })
  })

  it('createdAt desc（新しい順）で orderBy が渡される', async () => {
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
  })

  it('isHidden: false / deletedAt: null が where に含まれる（非表示・削除済みコメントの除外）', async () => {
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: TARGET_USER_ID,
          isHidden: false,
          deletedAt: null,
        }),
      }),
    )
  })

  it('post の可視性フィルタは visiblePostWhere(viewerId) に委譲される（block/mute 相当の投稿除外）', async () => {
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    expect(mockVisiblePostWhere).toHaveBeenCalledWith(VIEWER_ID)
    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ post: VISIBLE_POST_WHERE_STUB }),
      }),
    )
  })

  it('カーソルページネーション: rows.length === limit のとき nextCursor に最後の id を設定する', async () => {
    // safeLimit=20 のデフォルトだが 2 行しか返らないためこのままでは nextCursor は undefined。
    // limit を明示的に 2 に絞ることで「取得件数 === limit」の条件を再現する。
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, VIEWER_ID, undefined, 2)

    if (!result.ok) throw new Error('unreachable')
    expect(result.nextCursor).toBe('comment-1')
  })

  it('cursor / limit が buildCursorPagination 経由で findMany に渡される', async () => {
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    await fetchUserComments(TARGET_USER_ID, VIEWER_ID, 'comment-abc', 5)

    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 5,
        cursor: { id: 'comment-abc' },
        skip: 1,
      }),
    )
  })

  it('対象ユーザーが存在しない場合 reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null)

    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments('no-such-user', VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(mockCommentFindMany).not.toHaveBeenCalled()
  })

  it('対象ユーザーがゲストアカウントの場合 reason: not_found を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: false,
      email: 'guest@example.com',
    })

    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
    expect(mockCommentFindMany).not.toHaveBeenCalled()
  })

  it('非公開アカウントかつ閲覧不可（他人）の場合 reason: private_account を返す', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: false,
      isSuspended: false,
      email: 'private@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(false)

    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'private_account' })
  })

  it('非公開アカウントで viewerId が本人の場合、closeView 判定に関わらず not_found ではなく閲覧可能側に倒れる', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: false,
      isSuspended: false,
      email: 'private@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(true)

    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, TARGET_USER_ID)

    expect(result.ok).toBe(true)
  })

  it('停止ユーザーで canViewAuthorContent が false のとき reason: not_found を返す（isPublic true のため private_account 条件に該当しない）', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      isPublic: true,
      isSuspended: true,
      email: 'suspended@example.com',
    })
    mockCanViewAuthorContent.mockResolvedValueOnce(false)

    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('viewerId が undefined（未認証相当）でも公開アカウントなら閲覧できる', async () => {
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, undefined)

    expect(result.ok).toBe(true)
    expect(mockCanViewAuthorContent).toHaveBeenCalledWith(undefined, TARGET_USER_ID, {
      isPublic: true,
      isSuspended: false,
    })
  })

  it('コメントが 0 件のとき items: [] / nextCursor: undefined を返す', async () => {
    mockCommentFindMany.mockResolvedValueOnce([])

    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.items).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('media が 0 件のコメントは media: [] を返す', async () => {
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.items[0]?.media).toEqual([])
  })

  it('media が複数件あるコメントは { id, url, type, sortOrder } の形状で sortOrder 昇順に返す', async () => {
    mockCommentFindMany.mockResolvedValueOnce([
      {
        id: 'comment-with-media',
        content: 'メディア付きコメント',
        createdAt: new Date('2025-03-01T00:00:00Z'),
        post: { id: 'post-3', content: '投稿3' },
        media: [
          { id: 'media-1', url: 'https://example.com/1.jpg', type: 'image', sortOrder: 0 },
          { id: 'media-2', url: 'https://example.com/2.jpg', type: 'image', sortOrder: 1 },
        ],
      },
    ])

    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    const result = await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    if (!result.ok) throw new Error('unreachable')
    expect(result.items[0]?.media).toEqual([
      { id: 'media-1', url: 'https://example.com/1.jpg', type: 'image', sortOrder: 0 },
      { id: 'media-2', url: 'https://example.com/2.jpg', type: 'image', sortOrder: 1 },
    ])
  })

  it('media を含む select が sortOrder 昇順で prisma に渡される', async () => {
    const { fetchUserComments } = await import('@/lib/services/user-comments-service')
    await fetchUserComments(TARGET_USER_ID, VIEWER_ID)

    expect(mockCommentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          media: { orderBy: { sortOrder: 'asc' } },
        }),
      }),
    )
  })
})
