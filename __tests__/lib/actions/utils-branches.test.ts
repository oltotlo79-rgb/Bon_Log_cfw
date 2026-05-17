// @vitest-environment node

/**
 * utils.ts - 未カバー分岐のテスト
 *
 * 対象: requireActiveNonGuestUser (line 135), checkDailyPostLimit edge cases,
 * validateMediaCounts, getPostInteractionSets
 */

import { vi } from 'vitest'
export {}

// Prismaモック
const mockPrisma = {
  adminUser: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  post: {
    count: vi.fn(),
  },
  like: {
    findMany: vi.fn(),
  },
  bookmark: {
    findMany: vi.fn(),
  },
  follow: {
    findMany: vi.fn(),
  },
  block: {
    findMany: vi.fn(),
  },
  mute: {
    findMany: vi.fn(),
  },
  userHiddenPost: {
    findMany: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

// headersモック
const mockHeadersGet = vi.fn()
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockHeadersGet(...args),
  }),
}))

// rate-limitモック
const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
  RATE_LIMITS: {
    post: { limit: 20, window: 86400 },
    comment: { limit: 100, window: 86400 },
  },
}))

// redisモック
const mockRedis = {
  incr: vi.fn(),
  expire: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}
vi.mock('@/lib/redis', () => ({
  getRedisClient: () => mockRedis,
}))

// premiumモック
const mockGetMembershipLimits = vi.fn().mockResolvedValue({ maxDailyPosts: 20 })
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: (...args: unknown[]) => mockGetMembershipLimits(...args),
}))

// loggerモック
vi.mock('@/lib/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

describe('utils.ts - 未カバー分岐', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'user-1', email: 'user@example.com' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
  })

  // ================================================================
  // requireActiveNonGuestUser: action omitted path (line 123-130)
  // ================================================================
  describe('requireActiveNonGuestUser', () => {
    it('actionが省略された場合、requireAuth + requireNotGuestのみ実施する', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1', email: 'normal@example.com' } })
      const { requireActiveNonGuestUser } = await import('@/lib/actions/utils')
      const result = await requireActiveNonGuestUser()

      expect(result).toEqual({ userId: 'user-1' })
      // requireActiveUser is NOT called (no rate limit check)
      expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    })

    it('actionが省略された場合、未認証ならerrorを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { requireActiveNonGuestUser } = await import('@/lib/actions/utils')
      const result = await requireActiveNonGuestUser()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('actionが省略された場合、ゲストならerrorを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      mockAuth.mockResolvedValue({ user: { id: 'guest-1', email: GUEST_EMAIL } })
      const { requireActiveNonGuestUser } = await import('@/lib/actions/utils')
      const result = await requireActiveNonGuestUser()

      expect(result).toMatchObject({ error: expect.stringContaining('新規登録後') })
    })

    it('requireActiveNonGuestUser はレート制限を含まない (CLAUDE.md ルール3 で auth → Zod → rate limit の順を強制するため呼び出し側で別途実施する)', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1', email: 'normal@example.com' } })
      const { requireActiveNonGuestUser } = await import('@/lib/actions/utils')
      const result = await requireActiveNonGuestUser()

      expect(result).toEqual({ userId: 'user-1' })
      expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    })
  })

  // ================================================================
  // checkDailyPostLimit
  // ================================================================
  describe('checkDailyPostLimit', () => {
    it('Redis INCR成功で上限以内ならnullを返す', async () => {
      mockRedis.incr.mockResolvedValue(5)
      const { checkDailyPostLimit } = await import('@/lib/actions/utils')
      const result = await checkDailyPostLimit('user-1')

      expect(result).toBeNull()
    })

    it('Redis INCR成功で上限超過ならerrorを返す', async () => {
      mockRedis.incr.mockResolvedValue(21)
      const { checkDailyPostLimit } = await import('@/lib/actions/utils')
      const result = await checkDailyPostLimit('user-1')

      expect(result).toMatchObject({ success: false, error: expect.stringContaining('投稿上限') })
    })

    it('Redis INCR count=1の場合にexpireを設定する', async () => {
      mockRedis.incr.mockResolvedValue(1)
      const { checkDailyPostLimit } = await import('@/lib/actions/utils')
      await checkDailyPostLimit('user-1')

      expect(mockRedis.expire).toHaveBeenCalled()
    })

    it('Redis INCR count>1の場合はexpireを呼ばない', async () => {
      mockRedis.incr.mockResolvedValue(2)
      const { checkDailyPostLimit } = await import('@/lib/actions/utils')
      await checkDailyPostLimit('user-1')

      expect(mockRedis.expire).not.toHaveBeenCalled()
    })

    it('Redis障害時はDBカウントにフォールバックし上限以内ならnullを返す', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis error'))
      mockPrisma.post.count.mockResolvedValue(5)
      const { checkDailyPostLimit } = await import('@/lib/actions/utils')
      const result = await checkDailyPostLimit('user-1')

      expect(result).toBeNull()
      expect(mockPrisma.post.count).toHaveBeenCalled()
    })

    it('Redis障害時にDBカウントが上限に達していればerrorを返す', async () => {
      mockRedis.incr.mockRejectedValue(new Error('Redis error'))
      mockPrisma.post.count.mockResolvedValue(20)
      const { checkDailyPostLimit } = await import('@/lib/actions/utils')
      const result = await checkDailyPostLimit('user-1')

      expect(result).toMatchObject({ success: false, error: expect.stringContaining('投稿上限') })
    })
  })

  // ================================================================
  // validateMediaCounts
  // ================================================================
  describe('validateMediaCounts', () => {
    it('mediaUrlsとmediaTypesの長さが異なる場合はerrorを返す', async () => {
      const { validateMediaCounts } = await import('@/lib/actions/utils')
      const result = await validateMediaCounts(['url1', 'url2'], ['image'], { maxImages: 4, maxVideos: 1 })

      expect(result).toMatchObject({ success: false })
    })

    it('画像が上限を超える場合はerrorを返す', async () => {
      const { validateMediaCounts } = await import('@/lib/actions/utils')
      const result = await validateMediaCounts(
        ['u1', 'u2', 'u3'],
        ['image', 'image', 'image'],
        { maxImages: 2, maxVideos: 1 }
      )

      expect(result).toMatchObject({ success: false, error: expect.stringContaining('画像は2枚まで') })
    })

    it('動画が上限を超える場合はerrorを返す', async () => {
      const { validateMediaCounts } = await import('@/lib/actions/utils')
      const result = await validateMediaCounts(
        ['u1', 'u2'],
        ['video', 'video'],
        { maxImages: 4, maxVideos: 1 }
      )

      expect(result).toMatchObject({ success: false, error: expect.stringContaining('動画は1本まで') })
    })

    it('上限以内ならnullを返す', async () => {
      const { validateMediaCounts } = await import('@/lib/actions/utils')
      const result = await validateMediaCounts(
        ['u1', 'u2'],
        ['image', 'video'],
        { maxImages: 4, maxVideos: 1 }
      )

      expect(result).toBeNull()
    })
  })

  // ================================================================
  // getPostInteractionSets
  // ================================================================
  describe('getPostInteractionSets', () => {
    it('空のpostIdsの場合は空のSetを返す', async () => {
      const { getPostInteractionSets } = await import('@/lib/actions/utils')
      const result = await getPostInteractionSets('user-1', [])

      expect(result.likedSet.size).toBe(0)
      expect(result.bookmarkedSet.size).toBe(0)
      expect(mockPrisma.like.findMany).not.toHaveBeenCalled()
    })

    it('いいね・ブックマークデータを正しくSetに変換する', async () => {
      mockPrisma.like.findMany.mockResolvedValue([
        { postId: 'post-1' },
        { postId: 'post-2' },
        { postId: null },
      ])
      mockPrisma.bookmark.findMany.mockResolvedValue([
        { postId: 'post-1' },
      ])
      const { getPostInteractionSets } = await import('@/lib/actions/utils')
      const result = await getPostInteractionSets('user-1', ['post-1', 'post-2'])

      expect(result.likedSet.has('post-1')).toBe(true)
      expect(result.likedSet.has('post-2')).toBe(true)
      expect(result.likedSet.size).toBe(2) // null is filtered out
      expect(result.bookmarkedSet.has('post-1')).toBe(true)
      expect(result.bookmarkedSet.size).toBe(1)
    })
  })

  // ================================================================
  // getUserRelationSets
  // ================================================================
  describe('getUserRelationSets', () => {
    it('Redisキャッシュが文字列の場合はJSONパースして返す', async () => {
      const relations = {
        followingUserIds: ['f1', 'f2'],
        blockedUserIds: ['b1'],
        mutedUserIds: [],
        hiddenPostIds: [],
      }
      mockRedis.get.mockResolvedValue(JSON.stringify(relations))
      const { getUserRelationSets } = await import('@/lib/actions/utils')
      const result = await getUserRelationSets('user-rel-str')

      expect(result).toEqual(relations)
      // DB should not be queried since cache hit
      expect(mockPrisma.follow.findMany).not.toHaveBeenCalled()
    })

    it('Redisキャッシュがオブジェクト（自動パース済み）の場合はそのまま返す', async () => {
      const relations = {
        followingUserIds: ['f1'],
        blockedUserIds: [],
        mutedUserIds: ['m1'],
        hiddenPostIds: [],
      }
      // Upstash RESTクライアントが自動パースする場合のシミュレーション
      mockRedis.get.mockResolvedValue(relations)
      const { getUserRelationSets } = await import('@/lib/actions/utils')
      const result = await getUserRelationSets('user-rel-obj')

      expect(result).toEqual(relations)
      expect(mockPrisma.follow.findMany).not.toHaveBeenCalled()
    })

    it('Redisキャッシュがnullの場合はDBから取得してキャッシュに保存する', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockPrisma.follow.findMany.mockResolvedValue([{ followingId: 'f1' }])
      mockPrisma.block.findMany.mockResolvedValue([{ blockedId: 'b1' }])
      mockPrisma.mute.findMany.mockResolvedValue([{ mutedId: 'm1' }])
      mockPrisma.userHiddenPost.findMany.mockResolvedValue([{ postId: 'hp1' }])

      const { getUserRelationSets } = await import('@/lib/actions/utils')
      const result = await getUserRelationSets('user-rel-miss')

      expect(result).toEqual({
        followingUserIds: ['f1'],
        blockedUserIds: ['b1'],
        mutedUserIds: ['m1'],
        hiddenPostIds: ['hp1'],
      })
      expect(mockRedis.set).toHaveBeenCalledWith(
        'relations:user-rel-miss',
        expect.any(String),
        expect.objectContaining({ ex: expect.any(Number) })
      )
    })

    it('Redis getエラー時はDBフォールバックする', async () => {
      mockRedis.get.mockRejectedValue(new Error('Redis down'))
      mockPrisma.follow.findMany.mockResolvedValue([])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.userHiddenPost.findMany.mockResolvedValue([])

      const { getUserRelationSets } = await import('@/lib/actions/utils')
      const result = await getUserRelationSets('user-rel-err')

      expect(result).toEqual({
        followingUserIds: [],
        blockedUserIds: [],
        mutedUserIds: [],
        hiddenPostIds: [],
      })
    })

    it('Redis setエラー時でもDB結果は正常に返す', async () => {
      mockRedis.get.mockResolvedValue(null)
      mockRedis.set.mockRejectedValue(new Error('Redis write error'))
      mockPrisma.follow.findMany.mockResolvedValue([{ followingId: 'f1' }])
      mockPrisma.block.findMany.mockResolvedValue([])
      mockPrisma.mute.findMany.mockResolvedValue([])
      mockPrisma.userHiddenPost.findMany.mockResolvedValue([])

      const { getUserRelationSets } = await import('@/lib/actions/utils')
      const result = await getUserRelationSets('user-rel-set-err')

      expect(result).toEqual({
        followingUserIds: ['f1'],
        blockedUserIds: [],
        mutedUserIds: [],
        hiddenPostIds: [],
      })
    })
  })

  // ================================================================
  // requireActiveUser
  // ================================================================
  describe('requireActiveUser', () => {
    it('アカウント停止ユーザーの場合はerrorを返す', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })
      const { requireActiveUser } = await import('@/lib/actions/utils')
      const result = await requireActiveUser()

      expect(result).toMatchObject({ error: expect.stringContaining('停止') })
    })

    it('正常時は { userId } を返し、レート制限は呼ばない', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
      const { requireActiveUser } = await import('@/lib/actions/utils')
      const result = await requireActiveUser()

      expect(result).toEqual({ userId: 'user-1' })
      expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    })
  })

  // ================================================================
  // enforceUserRateLimit
  // ================================================================
  describe('enforceUserRateLimit', () => {
    it('レート制限が成功なら null を返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: true })
      const { enforceUserRateLimit } = await import('@/lib/actions/utils')
      const result = await enforceUserRateLimit('user-1', 'post')

      expect(result).toBeNull()
      expect(mockCheckUserRateLimit).toHaveBeenCalledWith('user-1', 'post')
    })

    it('レート制限超過なら { error } を返す', async () => {
      mockCheckUserRateLimit.mockResolvedValue({ success: false })
      const { enforceUserRateLimit } = await import('@/lib/actions/utils')
      const result = await enforceUserRateLimit('user-1', 'post')

      expect(result).toMatchObject({ error: expect.stringContaining('操作') })
    })
  })
})
