// @vitest-environment node
/**
 * lib/services/comment-read-service のユニットテスト
 *
 * fetchReplies の可視性ガード（親コメント不存在/非表示/削除済み/閲覧不可）と
 * カーソルページネーション・isLiked・isBlockedUser の付与を検証する。
 * fetchComments との対称性（同じ CommentItem 形状への整形）も検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = {
  comment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  block: {
    findMany: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAssertCanViewPost = vi.fn()
vi.mock('@/lib/services/post-visibility', () => ({
  assertCanViewPost: (...args: unknown[]) => mockAssertCanViewPost(...args),
}))

const mockUser = { id: 'user-1', nickname: 'テストユーザー', avatarUrl: null }

describe('fetchComments（トップレベル）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.block.findMany.mockResolvedValue([])
    mockAssertCanViewPost.mockResolvedValue(true)
  })

  it('表示不可な投稿（assertCanViewPost false）の場合は空を返す', async () => {
    const { fetchComments } = await import('@/lib/services/comment-read-service')
    mockAssertCanViewPost.mockResolvedValueOnce(false)

    const result = await fetchComments('post-1', 'viewer-1')

    expect(result).toEqual({ comments: [], nextCursor: undefined })
    expect(mockPrisma.comment.findMany).not.toHaveBeenCalled()
  })

  it('トップレベルコメントを作成日時降順（desc）で取得する', async () => {
    mockPrisma.comment.findMany.mockResolvedValue([])
    const { fetchComments } = await import('@/lib/services/comment-read-service')

    await fetchComments('post-1', 'viewer-1')

    expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ postId: 'post-1', parentId: null, isHidden: false }),
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      }),
    )
  })

  it('編集済みコメントは editedAt（Date）を CommentItem として返す', async () => {
    const editedAt = new Date('2026-02-01T00:00:00Z')
    mockPrisma.comment.findMany.mockResolvedValue([
      {
        id: 'comment-1',
        postId: 'post-1',
        userId: 'user-1',
        parentId: null,
        content: '編集済みコメント',
        createdAt: new Date('2026-01-01'),
        updatedAt: editedAt,
        deletedAt: null,
        isHidden: false,
        editedAt,
        user: mockUser,
        media: [],
        _count: { likes: 0, replies: 0 },
      },
    ])
    const { fetchComments } = await import('@/lib/services/comment-read-service')

    const result = await fetchComments('post-1', 'viewer-1')

    expect(result.comments[0]!.editedAt).toEqual(editedAt)
  })

  it('未編集コメントは editedAt: null を返す', async () => {
    mockPrisma.comment.findMany.mockResolvedValue([
      {
        id: 'comment-1',
        postId: 'post-1',
        userId: 'user-1',
        parentId: null,
        content: '未編集コメント',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
        isHidden: false,
        editedAt: null,
        user: mockUser,
        media: [],
        _count: { likes: 0, replies: 0 },
      },
    ])
    const { fetchComments } = await import('@/lib/services/comment-read-service')

    const result = await fetchComments('post-1', 'viewer-1')

    expect(result.comments[0]!.editedAt).toBeNull()
  })

  it('コメントが 0 件のとき comments: [] / nextCursor: undefined を返す', async () => {
    mockPrisma.comment.findMany.mockResolvedValue([])
    const { fetchComments } = await import('@/lib/services/comment-read-service')

    const result = await fetchComments('post-1', 'viewer-1')

    expect(result).toEqual({ comments: [], nextCursor: undefined })
  })
})

describe('fetchReplies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.block.findMany.mockResolvedValue([])
    mockAssertCanViewPost.mockResolvedValue(true)
  })

  it('親コメントが不存在の場合は空を返す', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue(null)
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result).toEqual({ comments: [], nextCursor: undefined })
    expect(mockPrisma.comment.findMany).not.toHaveBeenCalled()
  })

  it('親コメントが非表示の場合は空を返す', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: true, deletedAt: null })
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result).toEqual({ comments: [], nextCursor: undefined })
  })

  it('親コメントが削除済みの場合は空を返す', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: new Date() })
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result).toEqual({ comments: [], nextCursor: undefined })
  })

  it('親の所属投稿が閲覧不可（assertCanViewPost false）の場合は空を返す', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockAssertCanViewPost.mockResolvedValueOnce(false)
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result).toEqual({ comments: [], nextCursor: undefined })
  })

  it('client 申告ではなく親コメントの実 postId で可視性判定する', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'real-post-id', isHidden: false, deletedAt: null })
    mockPrisma.comment.findMany.mockResolvedValue([])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    await fetchReplies('parent-id', 'viewer-1')

    expect(mockAssertCanViewPost).toHaveBeenCalledWith('viewer-1', 'real-post-id')
  })

  it('返信一覧を作成日時昇順（asc）で取得する', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockPrisma.comment.findMany.mockResolvedValue([])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    await fetchReplies('parent-id', 'viewer-1')

    expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: 'parent-id', isHidden: false }),
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
    )
  })

  it('返信一覧を CommentItem 形状（likeCount/replyCount/isLiked/isBlockedUser/isDeleted 付き）で返す', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockPrisma.comment.findMany.mockResolvedValue([
      {
        id: 'reply-1',
        postId: 'post-1',
        userId: 'user-1',
        parentId: 'parent-id',
        content: '返信本文',
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        deletedAt: null,
        isHidden: false,
        user: mockUser,
        media: [],
        likes: [{ id: 'like-1' }],
        _count: { likes: 3, replies: 0 },
      },
    ])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result.comments).toEqual([
      expect.objectContaining({
        id: 'reply-1',
        parentId: 'parent-id',
        likeCount: 3,
        replyCount: 0,
        isLiked: true,
        isBlockedUser: false,
        isDeleted: false,
      }),
    ])
  })

  it('編集済みの返信は editedAt（Date）を CommentItem として返す', async () => {
    const editedAt = new Date('2026-02-01T00:00:00Z')
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockPrisma.comment.findMany.mockResolvedValue([
      {
        id: 'reply-1',
        postId: 'post-1',
        userId: 'user-1',
        parentId: 'parent-id',
        content: '編集済み返信',
        createdAt: new Date('2026-01-01'),
        updatedAt: editedAt,
        deletedAt: null,
        isHidden: false,
        editedAt,
        user: mockUser,
        media: [],
        _count: { likes: 0, replies: 0 },
      },
    ])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result.comments[0]!.editedAt).toEqual(editedAt)
  })

  it('未編集の返信は editedAt: null を返す', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockPrisma.comment.findMany.mockResolvedValue([
      {
        id: 'reply-1',
        postId: 'post-1',
        userId: 'user-1',
        parentId: 'parent-id',
        content: '未編集返信',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        isHidden: false,
        editedAt: null,
        user: mockUser,
        media: [],
        _count: { likes: 0, replies: 0 },
      },
    ])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result.comments[0]!.editedAt).toBeNull()
  })

  it('ブロックしたユーザーの返信は isBlockedUser: true になる', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockPrisma.block.findMany.mockResolvedValue([{ blockedId: 'blocked-user' }])
    mockPrisma.comment.findMany.mockResolvedValue([
      {
        id: 'reply-1',
        postId: 'post-1',
        userId: 'blocked-user',
        parentId: 'parent-id',
        content: '返信本文',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        isHidden: false,
        user: { id: 'blocked-user', nickname: 'B', avatarUrl: null },
        media: [],
        _count: { likes: 0, replies: 0 },
      },
    ])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result.comments[0]!.isBlockedUser).toBe(true)
  })

  it('未認証（viewerId undefined）でも取得でき isLiked は false になる', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockPrisma.comment.findMany.mockResolvedValue([
      {
        id: 'reply-1',
        postId: 'post-1',
        userId: 'user-1',
        parentId: 'parent-id',
        content: '返信本文',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        isHidden: false,
        user: mockUser,
        media: [],
        _count: { likes: 0, replies: 0 },
      },
    ])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', undefined)

    expect(result.comments[0]!.isLiked).toBe(false)
    expect(mockAssertCanViewPost).toHaveBeenCalledWith(undefined, 'post-1')
  })

  it('limit と同数の件数を返した場合 nextCursor が末尾要素の id になる（hasMore）', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    const rows = [
      { id: 'reply-0', postId: 'post-1', userId: 'user-1', parentId: 'parent-id', content: 'a', createdAt: new Date(), updatedAt: new Date(), deletedAt: null, isHidden: false, user: mockUser, media: [], _count: { likes: 0, replies: 0 } },
      { id: 'reply-1', postId: 'post-1', userId: 'user-1', parentId: 'parent-id', content: 'b', createdAt: new Date(), updatedAt: new Date(), deletedAt: null, isHidden: false, user: mockUser, media: [], _count: { likes: 0, replies: 0 } },
    ]
    mockPrisma.comment.findMany.mockResolvedValue(rows)
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1', undefined, 2)

    expect(result.nextCursor).toBe('reply-1')
  })

  it('limit より少ない件数の場合 nextCursor は undefined', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 'reply-0', postId: 'post-1', userId: 'user-1', parentId: 'parent-id', content: 'a', createdAt: new Date(), updatedAt: new Date(), deletedAt: null, isHidden: false, user: mockUser, media: [], _count: { likes: 0, replies: 0 } },
    ])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1', undefined, 5)

    expect(result.nextCursor).toBeUndefined()
  })

  it('削除済みで返信が無い返信は結果から除外される', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 'reply-deleted', postId: 'post-1', userId: 'user-1', parentId: 'parent-id', content: '', createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date(), isHidden: false, user: mockUser, media: [], _count: { likes: 0, replies: 0 } },
    ])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result.comments).toEqual([])
  })

  it('削除済みでも子返信が残っている返信はプレースホルダーとして残す', async () => {
    mockPrisma.comment.findUnique.mockResolvedValue({ postId: 'post-1', isHidden: false, deletedAt: null })
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 'reply-deleted', postId: 'post-1', userId: 'user-1', parentId: 'parent-id', content: '', createdAt: new Date(), updatedAt: new Date(), deletedAt: new Date(), isHidden: false, user: mockUser, media: [], _count: { likes: 0, replies: 1 } },
    ])
    const { fetchReplies } = await import('@/lib/services/comment-read-service')

    const result = await fetchReplies('parent-id', 'viewer-1')

    expect(result.comments).toHaveLength(1)
    expect(result.comments[0]!.isDeleted).toBe(true)
  })
})
