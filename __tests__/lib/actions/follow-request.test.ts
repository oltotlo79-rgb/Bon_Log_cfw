// @vitest-environment node

import { vi } from 'vitest'
// グローバルモックを無効化してから独自のモックを設定
vi.unmock('@/lib/actions/follow-request')

import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

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

// revalidatePathモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn), cache: vi.fn((fn: (...a: unknown[]) => unknown) => fn) }))

// notificationモック（createNotificationが内部でfilter-helper→block.findManyを呼ぶため）
vi.mock('@/lib/actions/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
  deleteNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
  deleteNotification: vi.fn().mockResolvedValue({ success: true }),
}))

// rate-limitモック
const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

// analyticsモック
vi.mock('@/lib/actions/analytics', () => ({
  recordNewFollower: vi.fn().mockResolvedValue(undefined),
}))

describe('Follow Request Actions', async () => {
  const targetUserId = 'target-user-id'
  const requestId = 'request-id'

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
  })

  describe('sendFollowRequest', async () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('自分自身へのリクエストは拒否', async () => {
      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(mockUser.id)

      expect(result).toMatchObject({ error: '自分自身にフォローリクエストを送ることはできません' })
    })

    it('ユーザーが見つからない場合はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toMatchObject({ error: 'ユーザーが見つかりません' })
    })

    it('公開アカウントへのリクエストはエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: true,
        nickname: 'Target User',
      })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toMatchObject({ error: 'このユーザーは公開アカウントです。直接フォローしてください' })
    })

    it('ブロックされている場合はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue({ id: 'block-id' })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toMatchObject({ error: 'フォローリクエストを送信できません' })
    })

    it('既にフォロー中の場合はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue(null)
      mockPrisma.follow.findUnique.mockResolvedValue({ id: 'follow-id' })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toMatchObject({ error: '既にフォロー中です' })
    })

    it('既にリクエスト送信済み（pending）の場合はエラー', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue(null)
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        status: 'pending',
      })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toMatchObject({ error: '既にフォローリクエストを送信済みです' })
    })

    it('拒否されたリクエストは再送信可能', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue(null)
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        status: 'rejected',
      })
      mockPrisma.followRequest.delete.mockResolvedValue({})
      mockPrisma.followRequest.create.mockResolvedValue({})
      mockPrisma.notification.create.mockResolvedValue({})

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ success: true, data: { status: 'pending' } })
      expect(mockPrisma.followRequest.delete).toHaveBeenCalled()
      expect(mockPrisma.followRequest.create).toHaveBeenCalled()
    })

    it('フォローリクエストを正常に送信できる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })
      mockPrisma.block.findUnique.mockResolvedValue(null)
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)
      mockPrisma.followRequest.create.mockResolvedValue({})

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const { createNotification } = await import('@/lib/services/notification-core')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ success: true, data: { status: 'pending' } })
      expect(mockPrisma.followRequest.create).toHaveBeenCalledWith({
        data: {
          requesterId: mockUser.id,
          targetId: targetUserId,
          status: 'pending',
        },
      })
      expect(createNotification).toHaveBeenCalledWith({
        userId: targetUserId,
        actorId: mockUser.id,
        type: 'follow_request',
      })
    })

    it('レート制限に達した場合はエラー', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'Target User',
      })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toMatchObject({ error: '操作が多すぎます。しばらく待ってから再試行してください' })
    })
  })

  describe('approveFollowRequest', async () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('リクエストが見つからない場合はエラー', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toMatchObject({ error: 'フォローリクエストが見つかりません' })
    })

    it('自分宛てでないリクエストは承認できない', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: 'another-user',
        status: 'pending',
        requester: { id: 'other-user', nickname: 'Other User' },
      })

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toMatchObject({ error: 'このリクエストを承認する権限がありません' })
    })

    it('既に処理済みのリクエストはエラー', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: mockUser.id,
        status: 'approved',
        requester: { id: 'other-user', nickname: 'Other User' },
      })

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toMatchObject({ error: 'このリクエストは既に処理されています' })
    })

    it('リクエストを正常に承認できる', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: mockUser.id,
        status: 'pending',
        requester: { id: 'other-user', nickname: 'Other User' },
      })
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          follow: { create: vi.fn().mockResolvedValue({}) },
          followRequest: { delete: vi.fn().mockResolvedValue({}) },
          notification: { create: vi.fn().mockResolvedValue({}) },
        }
        return callback(tx)
      })

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toEqual({ success: true, data: { status: 'approved' } })
    })
  })

  describe('rejectFollowRequest', async () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await rejectFollowRequest(requestId)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('リクエストが見つからない場合はエラー', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)

      const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await rejectFollowRequest(requestId)

      expect(result).toMatchObject({ error: 'フォローリクエストが見つかりません' })
    })

    it('自分宛てでないリクエストは拒否できない', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: 'another-user',
        status: 'pending',
      })

      const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await rejectFollowRequest(requestId)

      expect(result).toMatchObject({ error: 'このリクエストを拒否する権限がありません' })
    })

    it('リクエストを正常に拒否できる', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'other-user',
        targetId: mockUser.id,
        status: 'pending',
      })
      mockPrisma.followRequest.delete.mockResolvedValue({})

      const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await rejectFollowRequest(requestId)

      expect(result).toEqual({ success: true, data: { status: 'rejected' } })
      expect(mockPrisma.followRequest.delete).toHaveBeenCalled()
    })
  })

  describe('cancelFollowRequest', async () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await cancelFollowRequest(targetUserId)

      expect('error' in result && result.error).toBe('認証が必要です')
    })

    it('リクエストが見つからない場合はエラー', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)

      const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await cancelFollowRequest(targetUserId)

      expect('error' in result && result.error).toBe('フォローリクエストが見つかりません')
    })

    it('リクエストを正常にキャンセルできる', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: mockUser.id,
        targetId: targetUserId,
      })
      mockPrisma.followRequest.delete.mockResolvedValue({})

      const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await cancelFollowRequest(targetUserId)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.followRequest.delete).toHaveBeenCalled()
    })
  })

  describe('getFollowRequestStatus', async () => {
    it('未認証の場合はリクエストなしを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
      const result = await getFollowRequestStatus(targetUserId)

      expect(result).toEqual({ hasRequest: false, status: null })
    })

    it('リクエストがない場合はhasRequest: falseを返す', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue(null)

      const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
      const result = await getFollowRequestStatus(targetUserId)

      expect(result).toEqual({ hasRequest: false, status: null })
    })

    it('リクエストがある場合はステータスを返す', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        status: 'pending',
      })

      const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
      const result = await getFollowRequestStatus(targetUserId)

      expect(result).toEqual({ hasRequest: true, status: 'pending' })
    })
  })

  describe('getReceivedFollowRequests', async () => {
    it('未認証の場合は空配列を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getReceivedFollowRequests()

      expect(result).toEqual({ requests: [], nextCursor: undefined })
    })

    it('受信したリクエスト一覧を返す', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          requesterId: 'user-1',
          targetId: mockUser.id,
          status: 'pending',
          createdAt: new Date(),
          requester: {
            id: 'user-1',
            nickname: 'User 1',
            avatarUrl: null,
            bio: null,
          },
        },
      ]
      mockPrisma.followRequest.findMany.mockResolvedValue(mockRequests)

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getReceivedFollowRequests()

      expect(result.requests).toHaveLength(1)
      expect(result.requests[0].user.nickname).toBe('User 1')
    })

    it('カーソルベースのページネーションをサポート', async () => {
      mockPrisma.followRequest.findMany.mockResolvedValue([])

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      await getReceivedFollowRequests('cursor-id', 10)

      expect(mockPrisma.followRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'cursor-id' },
          skip: 1,
          take: 10,
        })
      )
    })
  })

  describe('getSentFollowRequests', async () => {
    it('未認証の場合は空配列を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getSentFollowRequests()

      expect(result).toEqual({ requests: [], nextCursor: undefined })
    })

    it('送信したリクエスト一覧を返す', async () => {
      const mockRequests = [
        {
          id: 'request-1',
          requesterId: mockUser.id,
          targetId: 'user-1',
          status: 'pending',
          createdAt: new Date(),
          target: {
            id: 'user-1',
            nickname: 'Target User',
            avatarUrl: null,
            bio: null,
          },
        },
      ]
      mockPrisma.followRequest.findMany.mockResolvedValue(mockRequests)

      const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getSentFollowRequests()

      expect(result.requests).toHaveLength(1)
      expect(result.requests[0].user.nickname).toBe('Target User')
    })
  })

  describe('getPendingFollowRequestCount', async () => {
    it('未認証の場合は0を返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { getPendingFollowRequestCount } = await import('@/lib/actions/follow-request')
      const result = await getPendingFollowRequestCount()

      expect(result).toEqual({ count: 0 })
    })

    it('未処理リクエスト数を返す', async () => {
      mockPrisma.followRequest.count.mockResolvedValue(5)

      const { getPendingFollowRequestCount } = await import('@/lib/actions/follow-request')
      const result = await getPendingFollowRequestCount()

      expect(result).toEqual({ count: 5 })
    })

    it('DBエラー時は0を返す', async () => {
      mockPrisma.followRequest.count.mockRejectedValue(new Error('DB error'))

      const { getPendingFollowRequestCount } = await import('@/lib/actions/follow-request')
      const result = await getPendingFollowRequestCount()

      expect(result).toEqual({ count: 0 })
    })
  })

  describe('getFollowRequestStatus - error handling', async () => {
    it('DBエラー時はデフォルト値を返す', async () => {
      mockPrisma.followRequest.findUnique.mockRejectedValue(new Error('DB error'))

      const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
      const result = await getFollowRequestStatus(targetUserId)

      expect(result).toEqual({ hasRequest: false, status: null })
    })
  })

  describe('getReceivedFollowRequests - error handling', async () => {
    it('DBエラー時は空配列を返す', async () => {
      mockPrisma.followRequest.findMany.mockRejectedValue(new Error('DB error'))

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getReceivedFollowRequests()

      expect(result).toEqual({ requests: [], nextCursor: undefined })
    })
  })

  describe('getSentFollowRequests - error handling', async () => {
    it('DBエラー時は空配列を返す', async () => {
      mockPrisma.followRequest.findMany.mockRejectedValue(new Error('DB error'))

      const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getSentFollowRequests()

      expect(result).toEqual({ requests: [], nextCursor: undefined })
    })
  })

  // ============================================================
  // getReceivedFollowRequests - カーソルページネーション
  // ============================================================

  describe('getReceivedFollowRequests - ページネーション', async () => {
    it('カーソル付きでリクエストを取得できる', async () => {
      mockPrisma.followRequest.findMany.mockResolvedValue([])

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      await getReceivedFollowRequests('cursor-id', 10)

      expect(mockPrisma.followRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('limit件取得時にnextCursorが返る', async () => {
      const requests = Array(20).fill(null).map((_, i) => ({
        id: `req-${i}`,
        requesterId: `user-${i}`,
        targetId: mockUser.id,
        status: 'pending',
        createdAt: new Date(),
        requester: {
          id: `user-${i}`,
          nickname: `ユーザー${i}`,
          avatarUrl: null,
          bio: null,
        },
      }))
      mockPrisma.followRequest.findMany.mockResolvedValue(requests)

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getReceivedFollowRequests()

      expect(result.nextCursor).toBe('req-19')
      expect(result.requests).toHaveLength(20)
    })

    it('limit未満の場合はnextCursorがundefined', async () => {
      const requests = [
        {
          id: 'req-1',
          requesterId: 'user-1',
          targetId: mockUser.id,
          status: 'pending',
          createdAt: new Date(),
          requester: {
            id: 'user-1',
            nickname: 'ユーザー1',
            avatarUrl: null,
            bio: null,
          },
        },
      ]
      mockPrisma.followRequest.findMany.mockResolvedValue(requests)

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getReceivedFollowRequests()

      expect(result.nextCursor).toBeUndefined()
      expect(result.requests).toHaveLength(1)
    })

    it('未認証の場合は空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getReceivedFollowRequests()

      expect(result).toEqual({ requests: [], nextCursor: undefined })
    })
  })

  // ============================================================
  // getSentFollowRequests - カーソルページネーション
  // ============================================================

  describe('getSentFollowRequests - ページネーション', async () => {
    it('カーソル付きでリクエストを取得できる', async () => {
      mockPrisma.followRequest.findMany.mockResolvedValue([])

      const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
      await getSentFollowRequests('cursor-id', 10)

      expect(mockPrisma.followRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          cursor: { id: 'cursor-id' },
          skip: 1,
        })
      )
    })

    it('limit件取得時にnextCursorが返る', async () => {
      const requests = Array(20).fill(null).map((_, i) => ({
        id: `req-${i}`,
        requesterId: mockUser.id,
        targetId: `user-${i}`,
        status: 'pending',
        createdAt: new Date(),
        target: {
          id: `user-${i}`,
          nickname: `ユーザー${i}`,
          avatarUrl: null,
          bio: null,
        },
      }))
      mockPrisma.followRequest.findMany.mockResolvedValue(requests)

      const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getSentFollowRequests()

      expect(result.nextCursor).toBe('req-19')
      expect(result.requests).toHaveLength(20)
    })

    it('未認証の場合は空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
      const result = await getSentFollowRequests()

      expect(result).toEqual({ requests: [], nextCursor: undefined })
    })
  })

  // ============================================================
  // sendFollowRequest - 追加テスト
  // ============================================================

  describe('sendFollowRequest - 追加テスト', async () => {
    it('拒否されたリクエストの再送信ができる', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'テスト',
      })
      mockPrisma.block.findUnique.mockResolvedValue(null)
      mockPrisma.follow.findUnique.mockResolvedValue(null)
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: 'old-request',
        status: 'rejected',
        requesterId: mockUser.id,
        targetId: targetUserId,
      })
      mockPrisma.followRequest.delete.mockResolvedValue({})
      mockPrisma.followRequest.create.mockResolvedValue({
        id: 'new-request',
        status: 'pending',
      })
      mockPrisma.notification.create.mockResolvedValue({})

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toEqual({ success: true, data: { status: 'pending' } })
      expect(mockPrisma.followRequest.delete).toHaveBeenCalled()
    })

    it('ブロックされている場合はエラーを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: targetUserId,
        isPublic: false,
        nickname: 'テスト',
      })
      mockPrisma.block.findUnique.mockResolvedValue({
        blockerId: targetUserId,
        blockedId: mockUser.id,
      })

      const { sendFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await sendFollowRequest(targetUserId)

      expect(result).toMatchObject({ error: 'フォローリクエストを送信できません' })
    })
  })

  // ============================================================
  // approveFollowRequest - 追加テスト
  // ============================================================

  describe('approveFollowRequest - 追加テスト', async () => {
    it('他人のリクエストは承認できない', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'requester-id',
        targetId: 'other-user-id',
        status: 'pending',
        requester: { id: 'requester-id', nickname: 'テスト' },
      })

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toMatchObject({ error: 'このリクエストを承認する権限がありません' })
    })

    it('処理済みリクエストは承認できない', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'requester-id',
        targetId: mockUser.id,
        status: 'approved',
        requester: { id: 'requester-id', nickname: 'テスト' },
      })

      const { approveFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await approveFollowRequest(requestId)

      expect(result).toMatchObject({ error: 'このリクエストは既に処理されています' })
    })
  })

  // ============================================================
  // rejectFollowRequest - 追加テスト
  // ============================================================

  describe('rejectFollowRequest - 追加テスト', async () => {
    it('他人のリクエストは拒否できない', async () => {
      mockPrisma.followRequest.findUnique.mockResolvedValue({
        id: requestId,
        requesterId: 'requester-id',
        targetId: 'other-user-id',
        status: 'pending',
      })

      const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
      const result = await rejectFollowRequest(requestId)

      expect(result).toMatchObject({ error: 'このリクエストを拒否する権限がありません' })
    })
  })
})
