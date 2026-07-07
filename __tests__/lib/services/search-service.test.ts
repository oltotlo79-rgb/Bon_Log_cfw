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
