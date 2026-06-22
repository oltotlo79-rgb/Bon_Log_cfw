// @vitest-environment node
/**
 * lib/services/follow-service のユニットテスト
 *
 * followUser / sendFollowRequestPrimitive / unfollowUser /
 * cancelFollowRequestPrimitive の正常系・冪等性・エラー系を検証する。
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = {
  follow: {
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
  followRequest: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  $transaction: vi.fn(),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockCheckInteractionEligibility = vi.fn()
vi.mock('@/lib/services/user-eligibility', () => ({
  checkInteractionEligibility: (...args: unknown[]) => mockCheckInteractionEligibility(...args),
}))

const mockCreateNotification = vi.fn()
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}))

const mockRecordNewFollowerService = vi.fn()
vi.mock('@/lib/services/analytics-recording', () => ({
  recordNewFollowerService: (...args: unknown[]) => mockRecordNewFollowerService(...args),
}))

vi.mock('@/lib/logger', () => ({
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const ACTOR = 'actor-id'
const TARGET = 'target-id'

describe('followUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckInteractionEligibility.mockResolvedValue({
      ok: true,
      target: { id: TARGET, isPublic: true },
    })
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.follow.findUnique.mockResolvedValue(null)
    mockPrisma.follow.create.mockResolvedValue({})
    mockPrisma.follow.count.mockResolvedValue(10)
    mockCreateNotification.mockResolvedValue(undefined)
    mockRecordNewFollowerService.mockResolvedValue(undefined)
  })

  it('フォロー成功 → { ok: true, state: { following: true, requested: false, followerCount } }', async () => {
    const { followUser } = await import('@/lib/services/follow-service')
    const result = await followUser(ACTOR, TARGET)

    expect(result).toEqual({
      ok: true,
      state: { following: true, requested: false, followerCount: 10 },
    })
  })

  it('自己フォロー → { ok: false, reason: self }', async () => {
    const { followUser } = await import('@/lib/services/follow-service')
    const result = await followUser(ACTOR, ACTOR)

    expect(result).toEqual({ ok: false, reason: 'self' })
    expect(mockCheckInteractionEligibility).not.toHaveBeenCalled()
  })

  it('ブロック対象 → { ok: false, reason: blocked }', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: false, reason: 'blocked' })
    const { followUser } = await import('@/lib/services/follow-service')
    const result = await followUser(ACTOR, TARGET)

    expect(result).toEqual({ ok: false, reason: 'blocked' })
  })

  it('不存在ユーザー → { ok: false, reason: not_found }', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const { followUser } = await import('@/lib/services/follow-service')
    const result = await followUser(ACTOR, TARGET)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('既にフォロー済みでも follow.create を呼ばず { ok: true, following: true } を返す（冪等）', async () => {
    mockPrisma.follow.findUnique.mockResolvedValueOnce({ followerId: ACTOR, followingId: TARGET })
    const { followUser } = await import('@/lib/services/follow-service')
    const result = await followUser(ACTOR, TARGET)

    expect(result).toMatchObject({ ok: true, state: { following: true } })
    expect(mockPrisma.follow.create).not.toHaveBeenCalled()
  })

  it('新規フォロー時に createNotification が follow タイプで呼ばれる', async () => {
    mockCreateNotification.mockResolvedValue(undefined)
    const { followUser } = await import('@/lib/services/follow-service')
    await followUser(ACTOR, TARGET)

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'follow', userId: TARGET, actorId: ACTOR }),
    )
  })

  it('followerCount が follow.count の戻り値と一致する', async () => {
    mockPrisma.follow.count.mockResolvedValueOnce(99)
    const { followUser } = await import('@/lib/services/follow-service')
    const result = await followUser(ACTOR, TARGET)

    expect((result as { ok: true; state: { followerCount: number } }).state.followerCount).toBe(99)
  })

  it('新規フォロー時は recordNewFollowerService が1回呼ばれる', async () => {
    mockRecordNewFollowerService.mockResolvedValue(undefined)
    const { followUser } = await import('@/lib/services/follow-service')
    await followUser(ACTOR, TARGET)

    await new Promise((r) => setTimeout(r, 10))
    expect(mockRecordNewFollowerService).toHaveBeenCalledTimes(1)
    expect(mockRecordNewFollowerService).toHaveBeenCalledWith(TARGET)
  })

  it('既にフォロー済みの再送では createNotification が呼ばれない（冪等副作用ゼロ）', async () => {
    mockPrisma.follow.findUnique.mockResolvedValueOnce({ followerId: ACTOR, followingId: TARGET })
    const { followUser } = await import('@/lib/services/follow-service')
    await followUser(ACTOR, TARGET)

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).toHaveBeenCalledTimes(0)
  })

  it('既にフォロー済みの再送では recordNewFollowerService が呼ばれない（冪等副作用ゼロ）', async () => {
    mockPrisma.follow.findUnique.mockResolvedValueOnce({ followerId: ACTOR, followingId: TARGET })
    const { followUser } = await import('@/lib/services/follow-service')
    await followUser(ACTOR, TARGET)

    await new Promise((r) => setTimeout(r, 10))
    expect(mockRecordNewFollowerService).toHaveBeenCalledTimes(0)
  })
})

describe('sendFollowRequestPrimitive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckInteractionEligibility.mockResolvedValue({
      ok: true,
      target: { id: TARGET, isPublic: false },
    })
    mockPrisma.followRequest.findUnique.mockResolvedValue(null)
    mockPrisma.followRequest.create.mockResolvedValue({})
    mockPrisma.follow.count.mockResolvedValue(3)
    mockCreateNotification.mockResolvedValue(undefined)
  })

  it('リクエスト送信 → { ok: true, state: { following: false, requested: true, followerCount } }', async () => {
    const { sendFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    const result = await sendFollowRequestPrimitive(ACTOR, TARGET)

    expect(result).toEqual({
      ok: true,
      state: { following: false, requested: true, followerCount: 3 },
    })
  })

  it('自己フォローリクエスト → { ok: false, reason: self }', async () => {
    const { sendFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    const result = await sendFollowRequestPrimitive(ACTOR, ACTOR)

    expect(result).toEqual({ ok: false, reason: 'self' })
  })

  it('既にリクエスト済みでも followRequest.create を呼ばず { ok: true, requested: true } を返す（冪等）', async () => {
    mockPrisma.followRequest.findUnique.mockResolvedValueOnce({ requesterId: ACTOR, targetId: TARGET })
    const { sendFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    const result = await sendFollowRequestPrimitive(ACTOR, TARGET)

    expect(result).toMatchObject({ ok: true, state: { requested: true } })
    expect(mockPrisma.followRequest.create).not.toHaveBeenCalled()
  })

  it('新規リクエスト時に createNotification が follow_request タイプで呼ばれる', async () => {
    const { sendFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    await sendFollowRequestPrimitive(ACTOR, TARGET)

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'follow_request', userId: TARGET, actorId: ACTOR }),
    )
  })

  it('ブロック対象 → { ok: false, reason: blocked }', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: false, reason: 'blocked' })
    const { sendFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    const result = await sendFollowRequestPrimitive(ACTOR, TARGET)

    expect(result).toEqual({ ok: false, reason: 'blocked' })
  })

  it('followerCount が follow.count の戻り値と一致する', async () => {
    mockPrisma.follow.count.mockResolvedValueOnce(15)
    const { sendFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    const result = await sendFollowRequestPrimitive(ACTOR, TARGET)

    expect((result as { ok: true; state: { followerCount: number } }).state.followerCount).toBe(15)
  })
})

describe('unfollowUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.follow.deleteMany.mockResolvedValue({ count: 1 })
    mockPrisma.follow.count.mockResolvedValue(8)
  })

  it('フォロー解除 → { followerCount }', async () => {
    const { unfollowUser } = await import('@/lib/services/follow-service')
    const result = await unfollowUser(ACTOR, TARGET)

    expect(result).toEqual({ followerCount: 8 })
  })

  it('フォローしていない場合も no-op として followerCount を返す（冪等）', async () => {
    mockPrisma.follow.deleteMany.mockResolvedValueOnce({ count: 0 })
    const { unfollowUser } = await import('@/lib/services/follow-service')
    const result = await unfollowUser(ACTOR, TARGET)

    expect(result).toHaveProperty('followerCount')
    expect(typeof result.followerCount).toBe('number')
  })

  it('follow.deleteMany に正しい where 条件が渡される', async () => {
    const { unfollowUser } = await import('@/lib/services/follow-service')
    await unfollowUser(ACTOR, TARGET)

    expect(mockPrisma.follow.deleteMany).toHaveBeenCalledWith({
      where: { followerId: ACTOR, followingId: TARGET },
    })
  })
})

describe('cancelFollowRequestPrimitive', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.followRequest.deleteMany.mockResolvedValue({ count: 1 })
    mockPrisma.follow.count.mockResolvedValue(5)
  })

  it('リクエスト取消 → { followerCount }', async () => {
    const { cancelFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    const result = await cancelFollowRequestPrimitive(ACTOR, TARGET)

    expect(result).toEqual({ followerCount: 5 })
  })

  it('リクエストがない場合も no-op として followerCount を返す（冪等）', async () => {
    mockPrisma.followRequest.deleteMany.mockResolvedValueOnce({ count: 0 })
    const { cancelFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    const result = await cancelFollowRequestPrimitive(ACTOR, TARGET)

    expect(result).toHaveProperty('followerCount')
  })

  it('followRequest.deleteMany に正しい where 条件が渡される', async () => {
    const { cancelFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    await cancelFollowRequestPrimitive(ACTOR, TARGET)

    expect(mockPrisma.followRequest.deleteMany).toHaveBeenCalledWith({
      where: { requesterId: ACTOR, targetId: TARGET },
    })
  })

  it('followerCount が follow.count の戻り値と一致する', async () => {
    mockPrisma.follow.count.mockResolvedValueOnce(22)
    const { cancelFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    const result = await cancelFollowRequestPrimitive(ACTOR, TARGET)

    expect(result.followerCount).toBe(22)
  })
})

// ──────────────────────────────────────────────────
// approveFollowRequestCore — モバイル API v1 / Web 共有
// ──────────────────────────────────────────────────

const mockFollowUpsert = vi.fn()
const mockFollowRequestDelete = vi.fn()

describe('approveFollowRequestCore', () => {
  const REQUEST_ID = 'req-001'

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          follow: { upsert: mockFollowUpsert },
          followRequest: { delete: mockFollowRequestDelete },
        }
        return fn(tx)
      },
    )
    mockPrisma.followRequest.findUnique.mockResolvedValue({
      id: REQUEST_ID,
      requesterId: ACTOR,
      targetId: TARGET,
      status: 'pending',
      requester: { id: ACTOR },
    })
    mockFollowUpsert.mockResolvedValue({})
    mockFollowRequestDelete.mockResolvedValue({})
    mockCreateNotification.mockResolvedValue(undefined)
    mockRecordNewFollowerService.mockResolvedValue(undefined)
  })

  it('正常承認 → { ok: true, requesterId }', async () => {
    const { approveFollowRequestCore } = await import('@/lib/services/follow-service')
    const result = await approveFollowRequestCore(TARGET, REQUEST_ID)

    expect(result).toEqual({ ok: true, requesterId: ACTOR })
  })

  it('リクエスト不存在 → { ok: false, reason: not_found }', async () => {
    mockPrisma.followRequest.findUnique.mockResolvedValueOnce(null)
    const { approveFollowRequestCore } = await import('@/lib/services/follow-service')
    const result = await approveFollowRequestCore(TARGET, REQUEST_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('所有権違反（actorId !== request.targetId）→ { ok: false, reason: forbidden }', async () => {
    mockPrisma.followRequest.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      requesterId: ACTOR,
      targetId: 'other-user',
      status: 'pending',
      requester: { id: ACTOR },
    })
    const { approveFollowRequestCore } = await import('@/lib/services/follow-service')
    const result = await approveFollowRequestCore(TARGET, REQUEST_ID)

    expect(result).toEqual({ ok: false, reason: 'forbidden' })
  })

  it('status が PENDING 以外 → { ok: false, reason: already_processed }（冪等）', async () => {
    mockPrisma.followRequest.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      requesterId: ACTOR,
      targetId: TARGET,
      status: 'approved',
      requester: { id: ACTOR },
    })
    const { approveFollowRequestCore } = await import('@/lib/services/follow-service')
    const result = await approveFollowRequestCore(TARGET, REQUEST_ID)

    expect(result).toEqual({ ok: false, reason: 'already_processed' })
  })

  it('承認時に Follow が upsert される', async () => {
    const { approveFollowRequestCore } = await import('@/lib/services/follow-service')
    await approveFollowRequestCore(TARGET, REQUEST_ID)

    expect(mockFollowUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ followerId: ACTOR, followingId: TARGET }),
      }),
    )
  })

  it('承認時に FollowRequest が削除される', async () => {
    const { approveFollowRequestCore } = await import('@/lib/services/follow-service')
    await approveFollowRequestCore(TARGET, REQUEST_ID)

    expect(mockFollowRequestDelete).toHaveBeenCalledWith({ where: { id: REQUEST_ID } })
  })

  it('承認時に follow_request_approved 通知が送られる', async () => {
    const { approveFollowRequestCore } = await import('@/lib/services/follow-service')
    await approveFollowRequestCore(TARGET, REQUEST_ID)

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'follow_request_approved', userId: ACTOR, actorId: TARGET }),
    )
  })
})

// ──────────────────────────────────────────────────
// rejectFollowRequestCore — モバイル API v1 / Web 共有
// ──────────────────────────────────────────────────

describe('rejectFollowRequestCore', () => {
  const REQUEST_ID = 'req-002'

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.followRequest.findUnique.mockResolvedValue({
      id: REQUEST_ID,
      requesterId: ACTOR,
      targetId: TARGET,
      status: 'pending',
    })
    mockPrisma.followRequest.delete = vi.fn().mockResolvedValue({})
  })

  it('正常拒否 → { ok: true }', async () => {
    const { rejectFollowRequestCore } = await import('@/lib/services/follow-service')
    const result = await rejectFollowRequestCore(TARGET, REQUEST_ID)

    expect(result).toEqual({ ok: true })
  })

  it('リクエスト不存在 → { ok: false, reason: not_found }', async () => {
    mockPrisma.followRequest.findUnique.mockResolvedValueOnce(null)
    const { rejectFollowRequestCore } = await import('@/lib/services/follow-service')
    const result = await rejectFollowRequestCore(TARGET, REQUEST_ID)

    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })

  it('所有権違反（actorId !== request.targetId）→ { ok: false, reason: forbidden }', async () => {
    mockPrisma.followRequest.findUnique.mockResolvedValueOnce({
      id: REQUEST_ID,
      requesterId: ACTOR,
      targetId: 'other-user',
      status: 'pending',
    })
    const { rejectFollowRequestCore } = await import('@/lib/services/follow-service')
    const result = await rejectFollowRequestCore(TARGET, REQUEST_ID)

    expect(result).toEqual({ ok: false, reason: 'forbidden' })
  })

  it('拒否時に FollowRequest が削除される', async () => {
    const { rejectFollowRequestCore } = await import('@/lib/services/follow-service')
    await rejectFollowRequestCore(TARGET, REQUEST_ID)

    expect(mockPrisma.followRequest.delete).toHaveBeenCalledWith({ where: { id: REQUEST_ID } })
  })

  it('拒否時に通知は送られない', async () => {
    const { rejectFollowRequestCore } = await import('@/lib/services/follow-service')
    await rejectFollowRequestCore(TARGET, REQUEST_ID)

    await new Promise((r) => setTimeout(r, 10))
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────
// listReceivedFollowRequests — モバイル API v1 / Web 共有
// ──────────────────────────────────────────────────

describe('listReceivedFollowRequests', () => {
  const makeRequest = (overrides: Record<string, unknown> = {}) => ({
    id: 'req-001',
    createdAt: new Date('2024-01-01'),
    requester: { id: 'user-a', nickname: 'ユーザーA', avatarUrl: null, bio: null },
    ...overrides,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.followRequest.findMany = vi.fn().mockResolvedValue([makeRequest()])
  })

  it('一覧を返す', async () => {
    const { listReceivedFollowRequests } = await import('@/lib/services/follow-service')
    const result = await listReceivedFollowRequests(TARGET)

    expect(result.requests).toHaveLength(1)
    expect(result.requests[0].id).toBe('req-001')
  })

  it('件数がリミット未満の場合は nextCursor が undefined', async () => {
    mockPrisma.followRequest.findMany = vi.fn().mockResolvedValue([makeRequest()])
    const { listReceivedFollowRequests } = await import('@/lib/services/follow-service')
    const result = await listReceivedFollowRequests(TARGET, undefined, 20)

    expect(result.nextCursor).toBeUndefined()
  })

  it('件数がリミットに等しい場合は nextCursor が最後の id', async () => {
    const items = Array.from({ length: 3 }, (_, i) =>
      makeRequest({ id: `req-${i + 1}` }),
    )
    mockPrisma.followRequest.findMany = vi.fn().mockResolvedValue(items)
    const { listReceivedFollowRequests } = await import('@/lib/services/follow-service')
    const result = await listReceivedFollowRequests(TARGET, undefined, 3)

    expect(result.nextCursor).toBe('req-3')
  })

  it('cursor 指定時は findMany に cursor: { id: cursor } と skip: 1 が渡される', async () => {
    mockPrisma.followRequest.findMany = vi.fn().mockResolvedValue([])
    const { listReceivedFollowRequests } = await import('@/lib/services/follow-service')
    await listReceivedFollowRequests(TARGET, 'cursor-abc', 10)

    expect(mockPrisma.followRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'cursor-abc' },
        skip: 1,
      }),
    )
  })

  it('空配列の場合は requests:[] nextCursor:undefined', async () => {
    mockPrisma.followRequest.findMany = vi.fn().mockResolvedValue([])
    const { listReceivedFollowRequests } = await import('@/lib/services/follow-service')
    const result = await listReceivedFollowRequests(TARGET)

    expect(result.requests).toHaveLength(0)
    expect(result.nextCursor).toBeUndefined()
  })
})

// ──────────────────────────────────────────────────
// fire-and-forget エラーハンドラのカバレッジ
// createNotification / recordNewFollowerService が reject しても
// 呼び出し元は正常終了し、エラーがログに記録される
// ──────────────────────────────────────────────────

describe('followUser — fire-and-forget エラーハンドラ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckInteractionEligibility.mockResolvedValue({
      ok: true,
      target: { id: TARGET, isPublic: true },
    })
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    )
    mockPrisma.follow.findUnique.mockResolvedValue(null)
    mockPrisma.follow.create.mockResolvedValue({})
    mockPrisma.follow.count.mockResolvedValue(5)
  })

  it('createNotification が reject しても followUser は正常終了する', async () => {
    mockCreateNotification.mockRejectedValue(new Error('notification service down'))
    mockRecordNewFollowerService.mockResolvedValue(undefined)

    const { followUser } = await import('@/lib/services/follow-service')
    const result = await followUser(ACTOR, TARGET)

    expect(result).toMatchObject({ ok: true })
    // catch ハンドラが実行されるまで待つ
    await new Promise((r) => setTimeout(r, 20))
  })

  it('recordNewFollowerService が reject しても followUser は正常終了する', async () => {
    mockCreateNotification.mockResolvedValue(undefined)
    mockRecordNewFollowerService.mockRejectedValue(new Error('analytics service down'))

    const { followUser } = await import('@/lib/services/follow-service')
    const result = await followUser(ACTOR, TARGET)

    expect(result).toMatchObject({ ok: true })
    await new Promise((r) => setTimeout(r, 20))
  })
})

describe('sendFollowRequestPrimitive — fire-and-forget エラーハンドラ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCheckInteractionEligibility.mockResolvedValue({
      ok: true,
      target: { id: TARGET, isPublic: false },
    })
    mockPrisma.followRequest.findUnique.mockResolvedValue(null)
    mockPrisma.followRequest.create.mockResolvedValue({})
    mockPrisma.follow.count.mockResolvedValue(3)
  })

  it('createNotification が reject しても sendFollowRequestPrimitive は正常終了する', async () => {
    mockCreateNotification.mockRejectedValue(new Error('notification service down'))

    const { sendFollowRequestPrimitive } = await import('@/lib/services/follow-service')
    const result = await sendFollowRequestPrimitive(ACTOR, TARGET)

    expect(result).toMatchObject({ ok: true })
    await new Promise((r) => setTimeout(r, 20))
  })
})

describe('approveFollowRequestCore — fire-and-forget エラーハンドラ', () => {
  const REQUEST_ID = 'req-003'

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          follow: { upsert: mockFollowUpsert },
          followRequest: { delete: mockFollowRequestDelete },
        }
        return fn(tx)
      },
    )
    mockPrisma.followRequest.findUnique.mockResolvedValue({
      id: REQUEST_ID,
      requesterId: ACTOR,
      targetId: TARGET,
      status: 'pending',
      requester: { id: ACTOR },
    })
    mockFollowUpsert.mockResolvedValue({})
    mockFollowRequestDelete.mockResolvedValue({})
  })

  it('createNotification が reject しても approveFollowRequestCore は正常終了する', async () => {
    mockCreateNotification.mockRejectedValue(new Error('notification service down'))
    mockRecordNewFollowerService.mockResolvedValue(undefined)

    const { approveFollowRequestCore } = await import('@/lib/services/follow-service')
    const result = await approveFollowRequestCore(TARGET, REQUEST_ID)

    expect(result).toMatchObject({ ok: true })
    await new Promise((r) => setTimeout(r, 20))
  })

  it('recordNewFollowerService が reject しても approveFollowRequestCore は正常終了する', async () => {
    mockCreateNotification.mockResolvedValue(undefined)
    mockRecordNewFollowerService.mockRejectedValue(new Error('analytics service down'))

    const { approveFollowRequestCore } = await import('@/lib/services/follow-service')
    const result = await approveFollowRequestCore(TARGET, REQUEST_ID)

    expect(result).toMatchObject({ ok: true })
    await new Promise((r) => setTimeout(r, 20))
  })
})
