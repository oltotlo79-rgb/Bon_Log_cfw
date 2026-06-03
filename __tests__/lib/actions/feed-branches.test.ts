// @vitest-environment node
/**
 * feed.ts の未カバー行 (115-157) のテスト
 * ゲストユーザーのタイムライン取得ブランチ
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

// Prisma モック
const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// フィルターヘルパーモック
const mockGetExcludedUserIds = vi.fn()
vi.mock('@/lib/actions/filter-helper', () => ({
  getExcludedUserIds: () => mockGetExcludedUserIds(),
}))

// キャッシュモック
vi.mock('@/lib/cache', () => ({
  getCachedTrendingGenres: vi.fn(),
}))

// next/cache モック
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

// utils モック
const mockGetUserRelationSets = vi.fn()
const mockGetGuestUserId = vi.fn()
const mockGetPostInteractionSets = vi.fn()
vi.mock('@/lib/actions/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/actions/utils')>()
  return {
    ...actual,
    getUserRelationSets: (...args: unknown[]) => mockGetUserRelationSets(...args),
    getGuestUserId: () => mockGetGuestUserId(),
    getPostInteractionSets: (...args: unknown[]) => mockGetPostInteractionSets(...args),
  }
})


/**
 * `ActionResult<T>` を旧フラット形状に展開する互換ヘルパー（feed 移行用）。
 * 成功時は data を展開し、失敗時は { error, posts: [], nextCursor: undefined, isGuest: false } を返す。
 * 旧テストの `result.posts` / `result.error` のいずれのスタイルも書き換えずに動作する。
 */
type FeedLegacyShape = {
  success?: boolean
  error?: string
  posts?: unknown[]
  nextCursor?: string
  isGuest?: boolean
}
function unwrap<T>(result: import('@/types/action-result').ActionResult<T>): (T extends object ? T : Record<string, never>) & FeedLegacyShape {
  if (result.success) {
    return { success: true, ...(result.data ?? {}) } as (T extends object ? T : Record<string, never>) & FeedLegacyShape
  }
  return {
    success: false,
    error: result.error,
    posts: [],
    nextCursor: undefined,
    isGuest: false,
  } as (T extends object ? T : Record<string, never>) & FeedLegacyShape
}

describe('getTimeline - ゲストタイムライン (lines 115-157)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // ゲスト判定はゲストユーザーIDとセッションIDの一致で行う
    mockGetGuestUserId.mockResolvedValue('guest-user-id')
  })

  it('ゲストユーザーは全ユーザーの最新10件を取得する', async () => {
    // ゲストユーザーとしてセッション設定
    mockAuth.mockResolvedValueOnce({
      user: { id: 'guest-user-id', email: 'guest@example.com' },
    })

    const mockPosts = [
      {
        id: 'post-1',
        content: 'テスト投稿1',
        userId: 'user-1',
        createdAt: new Date(),
        user: { id: 'user-1', nickname: 'ユーザー1', avatarUrl: null },
        media: [],
        genres: [{ genre: { id: 'genre-1', name: '黒松', category: '松柏類' } }],
        _count: { likes: 5, comments: 2 },
        quotePost: null,
        repostPost: null,
        poll: null,
      },
      {
        id: 'post-2',
        content: 'テスト投稿2',
        userId: 'user-2',
        createdAt: new Date(),
        user: { id: 'user-2', nickname: 'ユーザー2', avatarUrl: '/avatar.jpg' },
        media: [{ id: 'media-1', url: '/img.jpg', sortOrder: 0 }],
        genres: [],
        _count: { likes: 10, comments: 0 },
        quotePost: null,
        repostPost: null,
        poll: null,
      },
    ]

    mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
    mockGetPostInteractionSets.mockResolvedValueOnce({
      likedSet: new Set(['post-1']),
      bookmarkedSet: new Set(['post-2']),
    })

    const { getTimeline } = await import('@/lib/actions/feed')
    const result = unwrap(await getTimeline())

    // ゲストフラグがtrue
    expect(result.isGuest).toBe(true)
    // nextCursorはundefined
    expect(result.nextCursor).toBeUndefined()
    // 投稿が返される
    expect(result.posts).toHaveLength(2)

    // 投稿の整形が正しい
    expect(result.posts[0].likeCount).toBe(5)
    expect(result.posts[0].commentCount).toBe(2)
    expect(result.posts[0].isLiked).toBe(true)
    expect(result.posts[0].isBookmarked).toBe(false)
    expect(result.posts[0].genres).toEqual([{ id: 'genre-1', name: '黒松', category: '松柏類' }])

    expect(result.posts[1].likeCount).toBe(10)
    expect(result.posts[1].commentCount).toBe(0)
    expect(result.posts[1].isLiked).toBe(false)
    expect(result.posts[1].isBookmarked).toBe(true)

    // 非表示投稿に加え、非公開・停止著者の投稿もゲストには出さない
    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isHidden: false, user: { isSuspended: false, OR: [{ isPublic: true }] } },
        take: 10, // GUEST_TIMELINE_LIMIT
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    )
  })

  it('ゲストユーザーでpost.findManyのincludeにquotePost, repostPost, pollが含まれる', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'guest-user-id', email: 'guest@example.com' },
    })

    mockPrisma.post.findMany.mockResolvedValueOnce([])
    mockGetPostInteractionSets.mockResolvedValueOnce({
      likedSet: new Set(),
      bookmarkedSet: new Set(),
    })

    const { getTimeline } = await import('@/lib/actions/feed')
    await getTimeline()

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          quotePost: expect.objectContaining({
            include: expect.objectContaining({
              user: expect.any(Object),
              media: expect.any(Object),
            }),
          }),
          repostPost: expect.objectContaining({
            include: expect.objectContaining({
              user: expect.any(Object),
              media: expect.any(Object),
            }),
          }),
          poll: expect.objectContaining({
            include: expect.any(Object),
          }),
        }),
      })
    )
  })

  it('ゲストユーザーで投稿がない場合、空配列を返す', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'guest-user-id', email: 'guest@example.com' },
    })

    mockPrisma.post.findMany.mockResolvedValueOnce([])
    mockGetPostInteractionSets.mockResolvedValueOnce({
      likedSet: new Set(),
      bookmarkedSet: new Set(),
    })

    const { getTimeline } = await import('@/lib/actions/feed')
    const result = unwrap(await getTimeline())

    expect(result.isGuest).toBe(true)
    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('ゲストユーザーのgetPostInteractionSetsに正しいIDが渡される', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: 'guest-user-id', email: 'guest@example.com' },
    })

    const mockPosts = [
      {
        id: 'post-a',
        content: 'A',
        userId: 'u1',
        createdAt: new Date(),
        user: { id: 'u1', nickname: 'U1', avatarUrl: null },
        media: [],
        genres: [],
        _count: { likes: 0, comments: 0 },
        quotePost: null,
        repostPost: null,
        poll: null,
      },
      {
        id: 'post-b',
        content: 'B',
        userId: 'u2',
        createdAt: new Date(),
        user: { id: 'u2', nickname: 'U2', avatarUrl: null },
        media: [],
        genres: [],
        _count: { likes: 0, comments: 0 },
        quotePost: null,
        repostPost: null,
        poll: null,
      },
    ]

    mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
    mockGetPostInteractionSets.mockResolvedValueOnce({
      likedSet: new Set(),
      bookmarkedSet: new Set(),
    })

    const { getTimeline } = await import('@/lib/actions/feed')
    await getTimeline()

    expect(mockGetPostInteractionSets).toHaveBeenCalledWith(
      'guest-user-id',
      ['post-a', 'post-b']
    )
  })

  it('通常ユーザー（非ゲスト）はゲストブランチに入らない', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: mockUser.id, email: 'regular@example.com' },
    })

    mockGetUserRelationSets.mockResolvedValueOnce({
      followingUserIds: [],
      blockedUserIds: [],
      mutedUserIds: [],
      hiddenPostIds: [],
    })
    mockGetExcludedUserIds.mockResolvedValueOnce([])
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    mockGetPostInteractionSets.mockResolvedValueOnce({
      likedSet: new Set(),
      bookmarkedSet: new Set(),
    })

    const { getTimeline } = await import('@/lib/actions/feed')
    const result = unwrap(await getTimeline())

    expect(result.isGuest).toBe(false)
    // 通常ユーザーの場合、getUserRelationSetsが呼ばれる
    expect(mockGetUserRelationSets).toHaveBeenCalled()
  })

  it('認証済みfeedは停止著者を除外する（自分の投稿は除外しない）', async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: mockUser.id, email: 'regular@example.com' },
    })
    mockGetUserRelationSets.mockResolvedValueOnce({
      followingUserIds: ['u2'],
      blockedUserIds: [],
      mutedUserIds: [],
      hiddenPostIds: [],
    })
    mockGetExcludedUserIds.mockResolvedValueOnce([])
    mockPrisma.post.findMany.mockResolvedValueOnce([])
    mockGetPostInteractionSets.mockResolvedValueOnce({
      likedSet: new Set(),
      bookmarkedSet: new Set(),
    })

    const { getTimeline } = await import('@/lib/actions/feed')
    await getTimeline()

    const where = mockPrisma.post.findMany.mock.calls[0][0].where
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { userId: mockUser.id },
        { user: { isSuspended: false } },
      ]),
    )
  })

  it('session.user.idがない場合エラーを返す', async () => {
    mockAuth.mockResolvedValueOnce({ user: { id: undefined } })

    const { getTimeline } = await import('@/lib/actions/feed')
    const result = unwrap(await getTimeline())

    expect(result.error).toBe('認証が必要です')
    expect(result.isGuest).toBe(false)
  })
})
