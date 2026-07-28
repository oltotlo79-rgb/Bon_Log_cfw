// @vitest-environment node
/**
 * lib/services/search-service のユニットテスト
 *
 * fetchSearchPosts / fetchSearchUsers の trgm/bigm/like モードでの
 * nextCursor 発行有無（keyset pagination 不整合の回帰防止）を中心に検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockFulltextSearchPosts = vi.fn()
const mockFulltextSearchUsers = vi.fn()
const mockGetSearchMode = vi.fn().mockReturnValue('like')
vi.mock('@/lib/search/fulltext', () => ({
  fulltextSearchPosts: (...args: unknown[]) => mockFulltextSearchPosts(...args),
  fulltextSearchUsers: (...args: unknown[]) => mockFulltextSearchUsers(...args),
  getSearchMode: () => mockGetSearchMode(),
}))

vi.mock('@/lib/actions/filter-helper', () => ({
  getExcludedUserIds: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/actions/post-include', () => ({
  POST_LIST_INCLUDE: {},
  formatPostForClient: (post: unknown) => post,
}))

vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual('@/lib/actions/utils')
  return {
    ...actual,
    getPostInteractionSets: vi.fn().mockResolvedValue({ likedSet: new Set(), bookmarkedSet: new Set() }),
    getGuestUserId: vi.fn().mockResolvedValue(null),
  }
})

const VIEWER_ID = 'viewer-1'

function makePost(id: string) {
  return {
    id,
    content: id,
    createdAt: new Date(),
    user: { id: 'author-1', isPublic: true, isSuspended: false },
  }
}

function makeUser(id: string) {
  return {
    id,
    nickname: id,
    avatarUrl: null,
    bio: null,
    _count: { followers: 0, following: 0 },
  }
}

describe('fetchSearchPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSearchMode.mockReturnValue('like')
  })

  it('trgmモード: 結果がsafeLimit件でもnextCursorは常にundefined', async () => {
    mockGetSearchMode.mockReturnValue('trgm')
    const postIds = Array.from({ length: 20 }, (_, i) => `post-${i}`)
    mockFulltextSearchPosts.mockResolvedValue(postIds)
    mockPrisma.post.findMany.mockResolvedValue(postIds.map(makePost))

    const { fetchSearchPosts } = await import('@/lib/services/search-service')
    const result = await fetchSearchPosts('盆栽', VIEWER_ID, undefined, undefined, 20)

    expect(result.posts).toHaveLength(20)
    expect(result.nextCursor).toBeUndefined()
  })

  it('bigmモード: 結果がsafeLimit件の場合は従来通りnextCursorを返す（回帰確認）', async () => {
    mockGetSearchMode.mockReturnValue('bigm')
    const postIds = Array.from({ length: 20 }, (_, i) => `post-${i}`)
    mockFulltextSearchPosts.mockResolvedValue(postIds)
    mockPrisma.post.findMany.mockResolvedValue(postIds.map(makePost))

    const { fetchSearchPosts } = await import('@/lib/services/search-service')
    const result = await fetchSearchPosts('盆栽', VIEWER_ID, undefined, undefined, 20)

    expect(result.nextCursor).toBe('post-19')
  })

  it('likeモード: 結果がsafeLimit件の場合は従来通りnextCursorを返す（回帰確認）', async () => {
    mockGetSearchMode.mockReturnValue('like')
    const posts = Array.from({ length: 20 }, (_, i) => makePost(`post-${i}`))
    mockPrisma.post.findMany.mockResolvedValue(posts)

    const { fetchSearchPosts } = await import('@/lib/services/search-service')
    const result = await fetchSearchPosts('盆栽', VIEWER_ID, undefined, undefined, 20)

    expect(result.nextCursor).toBe('post-19')
  })

  it('trgmモード: 結果件数がsafeLimit未満でもnextCursorはundefinedのまま', async () => {
    mockGetSearchMode.mockReturnValue('trgm')
    mockFulltextSearchPosts.mockResolvedValue(['post-1'])
    mockPrisma.post.findMany.mockResolvedValue([makePost('post-1')])

    const { fetchSearchPosts } = await import('@/lib/services/search-service')
    const result = await fetchSearchPosts('盆栽', VIEWER_ID, undefined, undefined, 20)

    expect(result.posts).toHaveLength(1)
    expect(result.nextCursor).toBeUndefined()
  })

  it('trgmモードでも全文検索結果が0件なら空配列を返す', async () => {
    mockGetSearchMode.mockReturnValue('trgm')
    mockFulltextSearchPosts.mockResolvedValue([])

    const { fetchSearchPosts } = await import('@/lib/services/search-service')
    const result = await fetchSearchPosts('盆栽', VIEWER_ID, undefined, undefined, 20)

    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  describe('genreIds OR-any semantics（フィクスチャ、LIKEモード）', () => {
    // 投稿 A: genre a のみ / B: genre b のみ / AB: a と b の両方 / C: genre c のみ
    const fixturePosts = [
      { id: 'post-a', genreIds: ['a'] },
      { id: 'post-b', genreIds: ['b'] },
      { id: 'post-ab', genreIds: ['a', 'b'] },
      { id: 'post-c', genreIds: ['c'] },
    ]

    function makeFixturePost(fixture: (typeof fixturePosts)[number]) {
      return {
        ...makePost(fixture.id),
        genres: fixture.genreIds.map((genreId) => ({ genreId })),
      }
    }

    beforeEach(() => {
      // where.AND に含まれる `genres.some.genreId.in` 条件で OR-any にフィルタする簡易実装。
      // 実 DB の Prisma `some`/`in` 意味論を最小限にシミュレートする（フィクスチャ検証専用）。
      mockPrisma.post.findMany.mockImplementation(
        (args: { where?: { AND?: Array<Record<string, unknown>> } }) => {
          const andConditions = args.where?.AND ?? []
          const genreCondition = andConditions.find(
            (c): c is { genres: { some: { genreId: { in: string[] } } } } =>
              typeof c === 'object' && c !== null && 'genres' in c,
          )
          const allowedGenreIds = genreCondition?.genres.some.genreId.in
          const matched = fixturePosts.filter(
            (p) => !allowedGenreIds || p.genreIds.some((g) => allowedGenreIds.includes(g)),
          )
          return Promise.resolve(matched.map(makeFixturePost))
        },
      )
    })

    it('genreIds=[a, b] で OR-any 検索すると A・B・AB が返り C は返らない', async () => {
      const { fetchSearchPosts } = await import('@/lib/services/search-service')
      const result = await fetchSearchPosts('', VIEWER_ID, ['a', 'b'], undefined, 20)

      const ids = result.posts.map((p) => p.id).sort()
      expect(ids).toEqual(['post-a', 'post-ab', 'post-b'])
    })

    it('genreIds=[c] のみでは C だけが返る', async () => {
      const { fetchSearchPosts } = await import('@/lib/services/search-service')
      const result = await fetchSearchPosts('', VIEWER_ID, ['c'], undefined, 20)

      const ids = result.posts.map((p) => p.id)
      expect(ids).toEqual(['post-c'])
    })

    it('genreIds 未指定では全件が返る（フィルタなし）', async () => {
      const { fetchSearchPosts } = await import('@/lib/services/search-service')
      const result = await fetchSearchPosts('', VIEWER_ID, undefined, undefined, 20)

      expect(result.posts).toHaveLength(4)
    })
  })
})

describe('fetchSearchUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetSearchMode.mockReturnValue('like')
  })

  it('trgmモード: 結果がsafeLimit件でもnextCursorは常にundefined', async () => {
    mockGetSearchMode.mockReturnValue('trgm')
    const userIds = Array.from({ length: 20 }, (_, i) => `user-${i}`)
    mockFulltextSearchUsers.mockResolvedValue(userIds)
    mockPrisma.user.findMany.mockResolvedValue(userIds.map(makeUser))

    const { fetchSearchUsers } = await import('@/lib/services/search-service')
    const result = await fetchSearchUsers('盆栽太郎', VIEWER_ID, undefined, 20)

    expect(result.users).toHaveLength(20)
    expect(result.nextCursor).toBeUndefined()
  })

  it('bigmモード: 結果がsafeLimit件の場合は従来通りnextCursorを返す（回帰確認）', async () => {
    mockGetSearchMode.mockReturnValue('bigm')
    const userIds = Array.from({ length: 20 }, (_, i) => `user-${i}`)
    mockFulltextSearchUsers.mockResolvedValue(userIds)
    mockPrisma.user.findMany.mockResolvedValue(userIds.map(makeUser))

    const { fetchSearchUsers } = await import('@/lib/services/search-service')
    const result = await fetchSearchUsers('盆栽太郎', VIEWER_ID, undefined, 20)

    expect(result.nextCursor).toBe('user-19')
  })

  it('likeモード: 結果がsafeLimit件の場合は従来通りnextCursorを返す（回帰確認）', async () => {
    mockGetSearchMode.mockReturnValue('like')
    const users = Array.from({ length: 20 }, (_, i) => makeUser(`user-${i}`))
    mockPrisma.user.findMany.mockResolvedValue(users)

    const { fetchSearchUsers } = await import('@/lib/services/search-service')
    const result = await fetchSearchUsers('盆栽太郎', VIEWER_ID, undefined, 20)

    expect(result.nextCursor).toBe('user-19')
  })

  it('trgmモードでも全文検索結果が0件なら空配列を返す', async () => {
    mockGetSearchMode.mockReturnValue('trgm')
    mockFulltextSearchUsers.mockResolvedValue([])

    const { fetchSearchUsers } = await import('@/lib/services/search-service')
    const result = await fetchSearchUsers('盆栽太郎', VIEWER_ID, undefined, 20)

    expect(result.users).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })
})
