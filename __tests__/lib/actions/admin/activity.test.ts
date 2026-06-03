// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
// userDevice is not in the default mock client — add it manually
;(mockPrisma as any).userDevice = {
  findMany: vi.fn(),
  count: vi.fn(),
  upsert: vi.fn(),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({ checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }), RATE_LIMITS: {} }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }) }))

// ---------- helpers ----------

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

function setupAdmin() {
  mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isSuspended: false })
  mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
}

function setupNoAuth() {
  mockAuth.mockResolvedValue(null)
}

function setupNonAdmin() {
  mockAuth.mockResolvedValue({ user: { id: 'regular-user-id' } })
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'regular-user-id', isSuspended: false })
  mockPrisma.adminUser.findUnique.mockResolvedValue(null)
}

// ---------- tests ----------

describe('getUserActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証の場合エラーを返す', async () => {
    setupNoAuth()
    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result = await getUserActivity('user-1')
    expect(result).toHaveProperty('error')
  })

  it('管理者でない場合エラーを返す', async () => {
    setupNonAdmin()
    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result = await getUserActivity('user-1')
    expect(result).toHaveProperty('error')
  })

  it('ユーザーが見つからない場合エラーを返す', async () => {
    setupAdmin()
    // requireAdmin does NOT call user.findUnique (only adminUser.findUnique).
    // getUserActivity calls user.findUnique for the target user — return null to trigger not-found.
    mockPrisma.user.findUnique.mockResolvedValue(null)

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result = await getUserActivity('nonexistent-user')
    expect(result).toHaveProperty('error')
  })

  it('アクティビティが空の場合は空配列を返す', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result).not.toHaveProperty('error')
    expect(result.activities).toEqual([])
    expect(result.total).toBe(0)
    expect(result.user).toEqual({ id: 'target-user', nickname: 'Target' })
  })

  it('巨大な limit は MAX_PAGE_LIMIT にクランプして各クエリに渡す（L-1）', async () => {
    setupAdmin()
    const { MAX_PAGE_LIMIT } = await import('@/lib/constants/limits')
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    await getUserActivity('target-user', { limit: 1_000_000 })

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: MAX_PAGE_LIMIT }),
    )
  })

  it('投稿アクティビティを正しく変換する', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'post-1', content: 'Hello world', createdAt: new Date('2025-01-15') },
    ])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities).toHaveLength(1)
    expect(result.activities[0].type).toBe('post')
    expect(result.activities[0].description).toContain('投稿')
    expect(result.activities[0].description).toContain('Hello world')
  })

  it('コメントアクティビティにメタデータが含まれる', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 'comment-1', content: 'Nice post', createdAt: new Date('2025-01-14'), postId: 'post-99' },
    ])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities).toHaveLength(1)
    expect(result.activities[0].type).toBe('comment')
    expect(result.activities[0].metadata).toEqual({ postId: 'post-99' })
  })

  it('投稿へのいいねアクティビティを正しく変換する', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([
      { id: 'like-1', postId: 'post-1', commentId: null, createdAt: new Date('2025-01-13') },
    ])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities[0].type).toBe('like')
    expect(result.activities[0].description).toBe('投稿にいいね')
  })

  it('コメントへのいいねは「コメントにいいね」と表示される', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([
      { id: 'like-2', postId: 'post-1', commentId: 'comment-1', createdAt: new Date('2025-01-13') },
    ])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities[0].description).toBe('コメントにいいね')
  })

  it('フォローアクティビティのIDがfollowerId-followingIdになる', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([
      { followerId: 'target-user', followingId: 'followed-user-id', createdAt: new Date('2025-01-12') },
    ])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities[0].type).toBe('follow')
    expect(result.activities[0].id).toBe('target-user-followed-user-id')
    expect(result.activities[0].description).toContain('フォロー')
  })

  it('ログインアクティビティにIP情報が含まれる', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([
      { id: 'device-1', ipAddress: '192.168.1.1', userAgent: 'Chrome', lastSeenAt: new Date('2025-01-11') },
    ])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities[0].type).toBe('login')
    expect(result.activities[0].description).toContain('192.168.1.1')
    expect(result.activities[0].metadata).toEqual({ ip: '192.168.1.1', userAgent: 'Chrome' })
  })

  it('IPが不明なデバイスには「不明」と表示される', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([
      { id: 'device-2', ipAddress: null, userAgent: null, lastSeenAt: new Date('2025-01-10') },
    ])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities[0].description).toContain('不明')
  })

  it('複数種類のアクティビティが時系列でソートされる', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'post-1', content: 'Post', createdAt: new Date('2025-01-10') },
    ])
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 'comment-1', content: 'Comment', createdAt: new Date('2025-01-15'), postId: 'p1' },
    ])
    mockPrisma.like.findMany.mockResolvedValue([
      { id: 'like-1', postId: 'p1', commentId: null, createdAt: new Date('2025-01-12') },
    ])
    mockPrisma.follow.findMany.mockResolvedValue([
      { followerId: 'target-user', followingId: 'u2', createdAt: new Date('2025-01-08') },
    ])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([
      { id: 'device-1', ipAddress: '1.2.3.4', userAgent: 'UA', lastSeenAt: new Date('2025-01-20') },
    ])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities).toHaveLength(5)
    // Newest first: login(Jan20) > comment(Jan15) > like(Jan12) > post(Jan10) > follow(Jan8)
    expect(result.activities[0].type).toBe('login')
    expect(result.activities[1].type).toBe('comment')
    expect(result.activities[2].type).toBe('like')
    expect(result.activities[3].type).toBe('post')
    expect(result.activities[4].type).toBe('follow')
  })

  it('limitパラメータでアクティビティ数が制限される', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: 'A', createdAt: new Date('2025-01-05') },
      { id: 'p2', content: 'B', createdAt: new Date('2025-01-04') },
      { id: 'p3', content: 'C', createdAt: new Date('2025-01-03') },
    ])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user', { limit: 2 })

    // The result should be sliced to limit
    expect(result.activities.length).toBeLessThanOrEqual(2)
    expect(result.total).toBe(3)
  })

  it('投稿のcontentがnullの場合でもエラーにならない', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: null, createdAt: new Date('2025-01-01') },
    ])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities).toHaveLength(1)
    expect(result.activities[0].description).toContain('投稿')
  })

  it('長いコンテンツは50文字に切り詰められる', async () => {
    setupAdmin()
    const longContent = 'あ'.repeat(100)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: longContent, createdAt: new Date('2025-01-01') },
    ])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    // "投稿: " prefix + 50 chars from content
    const descriptionContentPart = result.activities[0].description.replace('投稿: ', '')
    expect(descriptionContentPart.length).toBeLessThanOrEqual(50)
  })

  it('userオブジェクトが結果に含まれる', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'TestNick' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.user).toEqual({ id: 'target-user', nickname: 'TestNick' })
  })
})

describe('detectSuspiciousBehavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証の場合エラーを返す', async () => {
    setupNoAuth()
    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result = await detectSuspiciousBehavior('user-1')
    expect(result).toHaveProperty('error')
  })

  it('管理者でない場合エラーを返す', async () => {
    setupNonAdmin()
    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result = await detectSuspiciousBehavior('user-1')
    expect(result).toHaveProperty('error')
  })

  it('正常なユーザーの場合はフラグなし', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(5)
    mockPrisma.post.count.mockResolvedValue(3)
    mockPrisma.report.count.mockResolvedValue(0)
    mockPrisma.follow.count.mockResolvedValue(2)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.flags).toEqual([])
    expect(result.isSuspicious).toBe(false)
    expect(result.userId).toBe('user-1')
  })

  it('mass_likesフラグが検出される（閾値50超）', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(60)
    mockPrisma.post.count.mockResolvedValue(1)
    mockPrisma.report.count.mockResolvedValue(0)
    mockPrisma.follow.count.mockResolvedValue(0)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.isSuspicious).toBe(true)
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ type: 'mass_likes', value: 60, threshold: 50 })
  })

  it('mass_postsフラグが検出される（閾値30超）', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(0)
    mockPrisma.post.count.mockResolvedValue(35)
    mockPrisma.report.count.mockResolvedValue(0)
    mockPrisma.follow.count.mockResolvedValue(0)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.isSuspicious).toBe(true)
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ type: 'mass_posts', value: 35, threshold: 30 })
  })

  it('many_reportsフラグが検出される（閾値5超）', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(0)
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.report.count.mockResolvedValue(8)
    mockPrisma.follow.count.mockResolvedValue(0)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.isSuspicious).toBe(true)
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ type: 'many_reports', value: 8, threshold: 5 })
  })

  it('mass_followsフラグが検出される（閾値30超）', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(0)
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.report.count.mockResolvedValue(0)
    mockPrisma.follow.count.mockResolvedValue(40)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.isSuspicious).toBe(true)
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ type: 'mass_follows', value: 40, threshold: 30 })
  })

  it('複数のフラグが同時に検出される', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(100)
    mockPrisma.post.count.mockResolvedValue(50)
    mockPrisma.report.count.mockResolvedValue(10)
    mockPrisma.follow.count.mockResolvedValue(60)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.isSuspicious).toBe(true)
    expect(result.flags).toHaveLength(4)
    const flagTypes = result.flags.map((f: any) => f.type)
    expect(flagTypes).toContain('mass_likes')
    expect(flagTypes).toContain('mass_posts')
    expect(flagTypes).toContain('many_reports')
    expect(flagTypes).toContain('mass_follows')
  })

  it('ちょうど閾値の場合はフラグなし（50いいね）', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(50)
    mockPrisma.post.count.mockResolvedValue(30)
    mockPrisma.report.count.mockResolvedValue(5)
    mockPrisma.follow.count.mockResolvedValue(30)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.isSuspicious).toBe(false)
    expect(result.flags).toEqual([])
  })

  it('userIdが結果に含まれる', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(0)
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.report.count.mockResolvedValue(0)
    mockPrisma.follow.count.mockResolvedValue(0)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('specific-user-id')

    expect(result.userId).toBe('specific-user-id')
  })
})

// ============================================================
// 品質向上テスト: ソート・閾値境界・コンテンツ切り詰め
// ============================================================

describe('getUserActivity - ソートと切り詰めの詳細検証', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('同じタイムスタンプのアクティビティが安定してソートされる', async () => {
    setupAdmin()
    const sameTime = new Date('2025-01-15T12:00:00Z')
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'post-1', content: 'Post A', createdAt: sameTime },
    ])
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 'comment-1', content: 'Comment A', createdAt: sameTime, postId: 'p1' },
    ])
    mockPrisma.like.findMany.mockResolvedValue([
      { id: 'like-1', postId: 'p1', commentId: null, createdAt: sameTime },
    ])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    // 同じタイムスタンプでも3件全て返される（欠落しない）
    expect(result.activities).toHaveLength(3)
    // 全てのcreatedAtが同じ
    result.activities.forEach((a: any) => {
      expect(a.createdAt.getTime()).toBe(sameTime.getTime())
    })
  })

  it('複数種類のアクティビティが厳密に時系列降順で返される', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: 'First', createdAt: new Date('2025-01-01T10:00:00Z') },
      { id: 'p2', content: 'Second', createdAt: new Date('2025-01-03T10:00:00Z') },
    ])
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 'c1', content: 'Comment', createdAt: new Date('2025-01-02T10:00:00Z'), postId: 'p1' },
    ])
    mockPrisma.like.findMany.mockResolvedValue([
      { id: 'l1', postId: 'p1', commentId: null, createdAt: new Date('2025-01-04T10:00:00Z') },
    ])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    expect(result.activities).toHaveLength(4)
    // 降順を確認: like(Jan4) > post-p2(Jan3) > comment(Jan2) > post-p1(Jan1)
    for (let i = 0; i < result.activities.length - 1; i++) {
      expect(result.activities[i].createdAt.getTime()).toBeGreaterThanOrEqual(
        result.activities[i + 1].createdAt.getTime()
      )
    }
  })

  it('50文字ちょうどのcontentはそのまま表示される（切り詰めなし）', async () => {
    setupAdmin()
    const exactContent = 'あ'.repeat(50)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: exactContent, createdAt: new Date('2025-01-01') },
    ])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    // "投稿: " + 50文字 = 完全なコンテンツが含まれる
    expect(result.activities[0].description).toBe(`投稿: ${exactContent}`)
  })

  it('51文字のcontentは50文字で切り詰められる', async () => {
    setupAdmin()
    const longContent = 'あ'.repeat(51)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', content: longContent, createdAt: new Date('2025-01-01') },
    ])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    const contentPart = result.activities[0].description.replace('投稿: ', '')
    expect(contentPart.length).toBe(50)
    expect(contentPart).toBe('あ'.repeat(50))
  })

  it('コメントの長いcontentも50文字で切り詰められる', async () => {
    setupAdmin()
    const longComment = 'い'.repeat(80)
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([
      { id: 'c1', content: longComment, createdAt: new Date('2025-01-01'), postId: 'p1' },
    ])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user')

    const contentPart = result.activities[0].description.replace('コメント: ', '')
    expect(contentPart.length).toBe(50)
  })

  it('totalはスライス前の全アクティビティ数を返す', async () => {
    setupAdmin()
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'target-user', nickname: 'Target' })
    // 5件の投稿を用意
    mockPrisma.post.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({
        id: `p${i}`,
        content: `Post ${i}`,
        createdAt: new Date(`2025-01-${10 + i}`),
      }))
    )
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.like.findMany.mockResolvedValue([])
    mockPrisma.follow.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])

    const { getUserActivity } = await import('@/lib/actions/admin/activity')
    const result: any = await getUserActivity('target-user', { limit: 2 })

    expect(result.activities.length).toBeLessThanOrEqual(2)
    expect(result.total).toBe(5)
  })
})

describe('detectSuspiciousBehavior - 閾値境界の詳細検証', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('likesLastHourが50の場合はmass_likesフラグが立たない', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(50)
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.report.count.mockResolvedValue(0)
    mockPrisma.follow.count.mockResolvedValue(0)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.isSuspicious).toBe(false)
    expect(result.flags.find((f: any) => f.type === 'mass_likes')).toBeUndefined()
  })

  it('likesLastHourが51の場合はmass_likesフラグが立つ', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(51)
    mockPrisma.post.count.mockResolvedValue(0)
    mockPrisma.report.count.mockResolvedValue(0)
    mockPrisma.follow.count.mockResolvedValue(0)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.isSuspicious).toBe(true)
    expect(result.flags).toHaveLength(1)
    expect(result.flags[0]).toEqual({ type: 'mass_likes', value: 51, threshold: 50 })
  })

  it('全ての閾値をちょうど1超えた場合に全4フラグが立つ', async () => {
    setupAdmin()
    mockPrisma.like.count.mockResolvedValue(51)
    mockPrisma.post.count.mockResolvedValue(31)
    mockPrisma.report.count.mockResolvedValue(6)
    mockPrisma.follow.count.mockResolvedValue(31)

    const { detectSuspiciousBehavior } = await import('@/lib/actions/admin/activity')
    const result: any = await detectSuspiciousBehavior('user-1')

    expect(result.isSuspicious).toBe(true)
    expect(result.flags).toHaveLength(4)
    const flagTypes = result.flags.map((f: any) => f.type).sort()
    expect(flagTypes).toEqual(['many_reports', 'mass_follows', 'mass_likes', 'mass_posts'])
  })
})
