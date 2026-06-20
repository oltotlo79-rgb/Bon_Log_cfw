// @vitest-environment node
/**
 * lib/services/explore-service のユニットテスト
 *
 * fetchTrendingHashtags / fetchTrendingGenres / fetchRecommendedUsers の
 * 正常系・ゲスト挙動・limit クランプ・除外ロジックを検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

// --- Prisma モック ---
const mockPrisma = {
  hashtag: {
    findMany: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  follow: {
    findMany: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

// --- cache モック（getCachedTrendingGenres）---
const mockGetCachedTrendingGenres = vi.fn()
vi.mock('@/lib/cache', () => ({
  getCachedTrendingGenres: (...args: unknown[]) => mockGetCachedTrendingGenres(...args),
}))

// --- filter-helper モック ---
const mockGetExcludedUserIds = vi.fn()
vi.mock('@/lib/actions/filter-helper', () => ({
  getExcludedUserIds: (...args: unknown[]) => mockGetExcludedUserIds(...args),
}))

// --- pagination モック ---
vi.mock('@/lib/actions/pagination', () => ({
  clampLimit: (val: number, max: number) => Math.min(val, max),
}))

// --- utils モック (getGuestUserId) ---
const mockGetGuestUserId = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  getGuestUserId: (...args: unknown[]) => mockGetGuestUserId(...args),
}))

// --- shared-includes モック ---
vi.mock('@/lib/prisma/shared-includes', () => ({
  USER_MINIMAL_WITH_BIO_SELECT: {
    id: true,
    nickname: true,
    avatarUrl: true,
    bio: true,
  },
}))

// --- server-only モック ---
vi.mock('server-only', () => ({}))

// ===================================================================
// fetchTrendingHashtags
// ===================================================================
describe('fetchTrendingHashtags', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.hashtag.findMany.mockResolvedValue([
      { id: 'h1', name: '盆栽', count: 100 },
      { id: 'h2', name: '松', count: 80 },
      { id: 'h3', name: '黒松', count: 60 },
    ])
  })

  it('正常系: ハッシュタグ一覧を返す', async () => {
    const { fetchTrendingHashtags } = await import('@/lib/services/explore-service')
    const result = await fetchTrendingHashtags()

    expect(result).toHaveLength(3)
  })

  it('各アイテムが { id, name, count } の形を持つ', async () => {
    const { fetchTrendingHashtags } = await import('@/lib/services/explore-service')
    const result = await fetchTrendingHashtags()

    expect(result[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      count: expect.any(Number),
    })
  })

  it('count > 0 のみ返す where 条件が渡される', async () => {
    const { fetchTrendingHashtags } = await import('@/lib/services/explore-service')
    await fetchTrendingHashtags()

    const call = mockPrisma.hashtag.findMany.mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({ count: { gt: 0 } })
  })

  it('count 降順でソートされる', async () => {
    const { fetchTrendingHashtags } = await import('@/lib/services/explore-service')
    await fetchTrendingHashtags()

    const call = mockPrisma.hashtag.findMany.mock.calls[0]?.[0]
    expect(call?.orderBy).toMatchObject({ count: 'desc' })
  })

  it('limit パラメータが take に渡される', async () => {
    const { fetchTrendingHashtags } = await import('@/lib/services/explore-service')
    await fetchTrendingHashtags(5)

    const call = mockPrisma.hashtag.findMany.mock.calls[0]?.[0]
    expect(call?.take).toBe(5)
  })

  it('空配列の場合は空配列を返す', async () => {
    mockPrisma.hashtag.findMany.mockResolvedValueOnce([])
    const { fetchTrendingHashtags } = await import('@/lib/services/explore-service')
    const result = await fetchTrendingHashtags()

    expect(result).toHaveLength(0)
  })

  it('select に id, name, count が含まれる', async () => {
    const { fetchTrendingHashtags } = await import('@/lib/services/explore-service')
    await fetchTrendingHashtags()

    const call = mockPrisma.hashtag.findMany.mock.calls[0]?.[0]
    expect(call?.select).toMatchObject({ id: true, name: true, count: true })
  })
})

// ===================================================================
// fetchTrendingGenres
// ===================================================================
describe('fetchTrendingGenres', () => {
  const mockGenres = [
    { id: 'g1', name: '松柏類', category: '松柏類', postCount: 50 },
    { id: 'g2', name: '雑木類', category: '雑木類', postCount: 30 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCachedTrendingGenres.mockResolvedValue({ genres: mockGenres })
  })

  it('正常系: ジャンル一覧を返す', async () => {
    const { fetchTrendingGenres } = await import('@/lib/services/explore-service')
    const result = await fetchTrendingGenres()

    expect(result).toHaveLength(2)
  })

  it('各アイテムが { id, name, category, postCount } の形を持つ', async () => {
    const { fetchTrendingGenres } = await import('@/lib/services/explore-service')
    const result = await fetchTrendingGenres()

    expect(result[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      category: expect.any(String),
      postCount: expect.any(Number),
    })
  })

  it('postCount が number 型（整数）である', async () => {
    const { fetchTrendingGenres } = await import('@/lib/services/explore-service')
    const result = await fetchTrendingGenres()

    for (const item of result) {
      expect(typeof item.postCount).toBe('number')
      expect(Number.isInteger(item.postCount)).toBe(true)
    }
  })

  it('getCachedTrendingGenres に limit が渡される', async () => {
    const { fetchTrendingGenres } = await import('@/lib/services/explore-service')
    await fetchTrendingGenres(5)

    expect(mockGetCachedTrendingGenres).toHaveBeenCalledWith(5)
  })

  it('空配列の場合は空配列を返す', async () => {
    mockGetCachedTrendingGenres.mockResolvedValueOnce({ genres: [] })
    const { fetchTrendingGenres } = await import('@/lib/services/explore-service')
    const result = await fetchTrendingGenres()

    expect(result).toHaveLength(0)
  })
})

// ===================================================================
// fetchRecommendedUsers
// ===================================================================
describe('fetchRecommendedUsers', () => {
  const mockUsers = [
    { id: 'u1', nickname: 'ユーザー1', avatarUrl: '/a.jpg', bio: '盆栽好き', _count: { followers: 100 } },
    { id: 'u2', nickname: 'ユーザー2', avatarUrl: null, bio: null, _count: { followers: 50 } },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.follow.findMany.mockResolvedValue([])
    mockGetExcludedUserIds.mockResolvedValue([])
    mockGetGuestUserId.mockResolvedValue(null)
    mockPrisma.user.findMany.mockResolvedValue(mockUsers)
  })

  it('正常系: ユーザー一覧を返す', async () => {
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    const result = await fetchRecommendedUsers('user-1')

    expect(result).toHaveLength(2)
  })

  it('各アイテムが { id, nickname, avatarUrl, bio, followersCount } の形を持つ', async () => {
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    const result = await fetchRecommendedUsers('user-1')

    expect(result[0]).toMatchObject({
      id: expect.any(String),
      nickname: expect.any(String),
      avatarUrl: expect.anything(),
      followersCount: expect.any(Number),
    })
  })

  it('_count.followers が followersCount にマッピングされる', async () => {
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    const result = await fetchRecommendedUsers('user-1')

    expect(result[0]?.followersCount).toBe(100)
    expect(result[1]?.followersCount).toBe(50)
  })

  it('ゲスト（userId=null）は空配列を返す', async () => {
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    const result = await fetchRecommendedUsers(null)

    expect(result).toHaveLength(0)
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
  })

  it('ゲスト（userId=undefined）は空配列を返す', async () => {
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    const result = await fetchRecommendedUsers(undefined)

    expect(result).toHaveLength(0)
  })

  it('userId が excludeIds に含まれる（自分自身を除外）', async () => {
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    await fetchRecommendedUsers('user-self')

    const call = mockPrisma.user.findMany.mock.calls[0]?.[0]
    expect(call?.where?.id?.notIn).toContain('user-self')
  })

  it('既フォロー中ユーザーが excludeIds に含まれる', async () => {
    mockPrisma.follow.findMany.mockResolvedValueOnce([
      { followingId: 'already-followed' },
    ])
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    await fetchRecommendedUsers('user-1')

    const call = mockPrisma.user.findMany.mock.calls[0]?.[0]
    expect(call?.where?.id?.notIn).toContain('already-followed')
  })

  it('ブロック中ユーザーが excludeIds に含まれる', async () => {
    mockGetExcludedUserIds.mockResolvedValueOnce(['blocked-user'])
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    await fetchRecommendedUsers('user-1')

    const call = mockPrisma.user.findMany.mock.calls[0]?.[0]
    expect(call?.where?.id?.notIn).toContain('blocked-user')
  })

  it('isPublic: true かつ isSuspended: false の条件が含まれる', async () => {
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    await fetchRecommendedUsers('user-1')

    const call = mockPrisma.user.findMany.mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({ isPublic: true, isSuspended: false })
  })

  it('limit が take として渡される', async () => {
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    await fetchRecommendedUsers('user-1', 5)

    const call = mockPrisma.user.findMany.mock.calls[0]?.[0]
    expect(call?.take).toBe(5)
  })

  it('ゲストユーザー ID が存在する場合は excludeIds に含まれる', async () => {
    mockGetGuestUserId.mockResolvedValueOnce('guest-user-id')
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    await fetchRecommendedUsers('user-1')

    const call = mockPrisma.user.findMany.mock.calls[0]?.[0]
    expect(call?.where?.id?.notIn).toContain('guest-user-id')
  })

  it('users が空の場合は空配列を返す', async () => {
    mockPrisma.user.findMany.mockResolvedValueOnce([])
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    const result = await fetchRecommendedUsers('user-1')

    expect(result).toHaveLength(0)
  })

  it('フォロワー数降順でソートされる（orderBy 条件の確認）', async () => {
    const { fetchRecommendedUsers } = await import('@/lib/services/explore-service')
    await fetchRecommendedUsers('user-1')

    const call = mockPrisma.user.findMany.mock.calls[0]?.[0]
    expect(call?.orderBy).toMatchObject({ followers: { _count: 'desc' } })
  })
})
