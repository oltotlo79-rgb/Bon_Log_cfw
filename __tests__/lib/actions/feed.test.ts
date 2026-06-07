// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockPost } from '../../utils/test-utils'

// Prismaモック
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
const mockGetCachedTrendingGenres = vi.fn()
vi.mock('@/lib/cache', () => ({
  getCachedTrendingGenres: (limit: number) => mockGetCachedTrendingGenres(limit),
}))

// next/cacheモック（unstable_cacheはテスト環境で動作しないため）
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// utilsモック（getUserRelationSets / getGuestUserId）
const mockGetUserRelationSets = vi.fn()
const mockGetGuestUserId = vi.fn()
vi.mock('@/lib/actions/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/actions/utils')>()
  return {
    ...actual,
    getUserRelationSets: (...args: unknown[]) => mockGetUserRelationSets(...args),
    getGuestUserId: () => mockGetGuestUserId(),
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

describe('Feed Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockGetExcludedUserIds.mockResolvedValue([])
    mockGetUserRelationSets.mockResolvedValue({
      followingUserIds: [],
      blockedUserIds: [],
      mutedUserIds: [],
      hiddenPostIds: [],
    })
    mockGetGuestUserId.mockResolvedValue(null)
  })

  // ============================================================
  // getTimeline
  // ============================================================

  describe('getTimeline', async () => {
    it('タイムラインを取得できる', async () => {
      const mockPosts = [{
        id: mockPost.id,
        content: mockPost.content,
        userId: mockUser.id,
        createdAt: new Date(),
        user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: mockUser.avatarUrl },
        media: [],
        genres: [{ genre: { id: 'genre-1', name: '黒松' } }],
        _count: { likes: 10, comments: 5 },
        quotePost: null,
        repostPost: null,
      }]

      mockGetUserRelationSets.mockResolvedValueOnce({
        followingUserIds: ['following-user-1'],
        blockedUserIds: [],
        mutedUserIds: [],
        hiddenPostIds: [],
      })
      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
      mockPrisma.like.findMany.mockResolvedValueOnce([{ postId: mockPost.id }])
      mockPrisma.bookmark.findMany.mockResolvedValueOnce([])

      const { getTimeline } = await import('@/lib/actions/feed')
      const result = unwrap(await getTimeline())

      expect(result.posts).toHaveLength(1)
      expect(result.posts[0].likeCount).toBe(10)
      expect(result.posts[0].commentCount).toBe(5)
      expect(result.posts[0].isLiked).toBe(true)
      expect(result.posts[0].isBookmarked).toBe(false)
      expect(result.posts[0].genres[0].name).toBe('黒松')
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getTimeline } = await import('@/lib/actions/feed')
      const result = unwrap(await getTimeline())

      expect(result.error).toBe('認証が必要です')
      expect(result.posts).toEqual([])
      expect(result.nextCursor).toBeUndefined()
      expect(result.isGuest).toBe(false)
    })

    it('ブロック/ミュートした著者を relational filter で除外する（大配列 notIn を使わない）', async () => {
      mockGetUserRelationSets.mockResolvedValueOnce({
        followingUserIds: ['following-user-1', 'blocked-user'],
        blockedUserIds: [],
        mutedUserIds: [],
        hiddenPostIds: [],
      })
      mockPrisma.post.findMany.mockResolvedValueOnce([])
      mockPrisma.like.findMany.mockResolvedValueOnce([])
      mockPrisma.bookmark.findMany.mockResolvedValueOnce([])

      const { getTimeline } = await import('@/lib/actions/feed')
      await getTimeline()

      const call = mockPrisma.post.findMany.mock.calls.at(-1)?.[0]
      // 安全性に関わる除外は DB 側 relational filter で行う（上限到達による silent truncation を排除）
      expect(call?.where?.user).toMatchObject({
        blockedBy: { none: { blockerId: mockUser.id } },
        mutedBy: { none: { muterId: mockUser.id } },
      })
      // 大配列 notIn による除外には依存しない
      expect(call?.where?.userId).not.toHaveProperty('notIn')
    })

    it('カーソルを使用してページネーションできる', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([])
      mockPrisma.like.findMany.mockResolvedValueOnce([])
      mockPrisma.bookmark.findMany.mockResolvedValueOnce([])

      const { getTimeline } = await import('@/lib/actions/feed')
      await getTimeline('cursor-post-id', 10)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-post-id' },
          skip: 1,
        })
      )
    })

    it('巨大な limit は MAX_PAGE_LIMIT にクランプする（DoS 対策）', async () => {
      const { MAX_PAGE_LIMIT } = await import('@/lib/constants/limits')
      mockPrisma.post.findMany.mockResolvedValueOnce([])
      mockPrisma.like.findMany.mockResolvedValueOnce([])
      mockPrisma.bookmark.findMany.mockResolvedValueOnce([])

      const { getTimeline } = await import('@/lib/actions/feed')
      await getTimeline(undefined, 1_000_000)

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: MAX_PAGE_LIMIT }),
      )
    })

    it('不正な文字を含むカーソルは無視して新規取得扱いにする', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([])
      mockPrisma.like.findMany.mockResolvedValueOnce([])
      mockPrisma.bookmark.findMany.mockResolvedValueOnce([])

      const { getTimeline } = await import('@/lib/actions/feed')
      await getTimeline('bad cursor!!', 10)

      const call = mockPrisma.post.findMany.mock.calls.at(-1)?.[0]
      expect(call).toMatchObject({ take: 10 })
      expect(call).not.toHaveProperty('cursor')
    })

    it('次のカーソルを返す', async () => {
      const mockPosts = Array(20).fill(null).map((_, i) => ({
        id: `post-${i}`,
        content: 'テスト',
        userId: mockUser.id,
        createdAt: new Date(),
        user: { id: mockUser.id, nickname: mockUser.nickname, avatarUrl: null },
        media: [],
        genres: [],
        _count: { likes: 0, comments: 0 },
        quotePost: null,
        repostPost: null,
      }))

      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
      mockPrisma.like.findMany.mockResolvedValueOnce([])
      mockPrisma.bookmark.findMany.mockResolvedValueOnce([])

      const { getTimeline } = await import('@/lib/actions/feed')
      const result = unwrap(await getTimeline(undefined, 20))

      expect(result.nextCursor).toBe('post-19')
    })
  })

  // ============================================================
  // getRecommendedUsers
  // ============================================================

  describe('getRecommendedUsers', async () => {
    it('おすすめユーザーを取得できる', async () => {
      const mockFollowing = [{ followingId: 'already-following' }]
      const mockUsers = [
        {
          id: 'recommended-1',
          nickname: 'おすすめユーザー1',
          avatarUrl: '/avatar1.jpg',
          bio: '盆栽愛好家',
          _count: { followers: 100 },
        },
        {
          id: 'recommended-2',
          nickname: 'おすすめユーザー2',
          avatarUrl: '/avatar2.jpg',
          bio: null,
          _count: { followers: 50 },
        },
      ]

      mockPrisma.follow.findMany.mockResolvedValueOnce(mockFollowing)
      mockGetExcludedUserIds.mockResolvedValueOnce([])
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)

      const { getRecommendedUsers } = await import('@/lib/actions/feed')
      const result = await getRecommendedUsers()

      expect(result.users).toHaveLength(2)
      expect(result.users[0].followersCount).toBe(100)
      expect(result.users[1].followersCount).toBe(50)
    })

    it('未認証の場合、空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getRecommendedUsers } = await import('@/lib/actions/feed')
      const result = await getRecommendedUsers()

      expect(result).toEqual({ users: [] })
    })

    it('フォロー中のユーザーを除外する', async () => {
      mockPrisma.follow.findMany.mockResolvedValueOnce([
        { followingId: 'following-1' },
        { followingId: 'following-2' },
      ])
      mockGetExcludedUserIds.mockResolvedValueOnce(['blocked-user'])
      mockPrisma.user.findMany.mockResolvedValueOnce([])

      const { getRecommendedUsers } = await import('@/lib/actions/feed')
      await getRecommendedUsers()

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: {
              notIn: expect.arrayContaining([
                'following-1',
                'following-2',
                mockUser.id,
                'blocked-user',
              ]),
            },
            // 非公開・停止ユーザーはおすすめから除外する
            isPublic: true,
            isSuspended: false,
          }),
        })
      )
    })

    it('指定した件数で取得できる', async () => {
      mockPrisma.follow.findMany.mockResolvedValueOnce([])
      mockGetExcludedUserIds.mockResolvedValueOnce([])
      mockPrisma.user.findMany.mockResolvedValueOnce([])

      const { getRecommendedUsers } = await import('@/lib/actions/feed')
      await getRecommendedUsers(10)

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        })
      )
    })

    it('公開アカウントのみを取得する', async () => {
      mockPrisma.follow.findMany.mockResolvedValueOnce([])
      mockGetExcludedUserIds.mockResolvedValueOnce([])
      mockPrisma.user.findMany.mockResolvedValueOnce([])

      const { getRecommendedUsers } = await import('@/lib/actions/feed')
      await getRecommendedUsers()

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isPublic: true,
          }),
        })
      )
    })
  })

  // ============================================================
  // getTrendingGenres
  // ============================================================

  describe('getTrendingGenres', async () => {
    it('トレンドジャンルを取得できる', async () => {
      const mockGenres = [
        { id: 'genre-1', name: '黒松', count: 100 },
        { id: 'genre-2', name: '五葉松', count: 80 },
      ]
      mockGetCachedTrendingGenres.mockResolvedValueOnce(mockGenres)

      const { getTrendingGenres } = await import('@/lib/actions/feed')
      const result = await getTrendingGenres()

      expect(result).toEqual(mockGenres)
      expect(mockGetCachedTrendingGenres).toHaveBeenCalledWith(5)
    })

    it('指定した件数で取得できる', async () => {
      mockGetCachedTrendingGenres.mockResolvedValueOnce([])

      const { getTrendingGenres } = await import('@/lib/actions/feed')
      await getTrendingGenres(10)

      expect(mockGetCachedTrendingGenres).toHaveBeenCalledWith(10)
    })
  })
})
