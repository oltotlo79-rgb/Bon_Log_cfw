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

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// メンション通知は createNotificationsBulk へ delegate
const mockCreateNotificationsBulk = vi.fn()
vi.mock('@/lib/services/notification-bulk', () => ({
  createNotificationsBulk: (...args: unknown[]) => mockCreateNotificationsBulk(...args),
}))

describe('Mention Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockCreateNotificationsBulk.mockResolvedValue({ attempted: 0, filtered: 0 })
  })

  // ============================================================
  // searchMentionUsers
  // ============================================================

  describe('searchMentionUsers', async () => {
    it('メンション候補ユーザーを検索できる', async () => {
      const mockFollowing = [{ followingId: 'following-user-1' }]
      const mockUsers = [
        { id: 'following-user-1', nickname: 'bonsai_user1', avatarUrl: '/avatar1.jpg' },
        { id: 'other-user', nickname: 'bonsai_user2', avatarUrl: '/avatar2.jpg' },
      ]

      mockPrisma.follow.findMany.mockResolvedValueOnce(mockFollowing)
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)

      const { searchMentionUsers } = await import('@/lib/actions/mention')
      const result = await searchMentionUsers('bonsai')

      expect(result).toHaveLength(2)
      // フォロー中のユーザーが先に来る
      expect(result[0].id).toBe('following-user-1')
      expect(result[0].isFollowing).toBe(true)
    })

    it('未認証の場合、空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { searchMentionUsers } = await import('@/lib/actions/mention')
      const result = await searchMentionUsers('bonsai')

      expect(result).toEqual([])
    })

    it('空のクエリの場合、フォロー中ユーザーを返す', async () => {
      mockPrisma.follow.findMany.mockResolvedValueOnce([
        { followingId: 'following-user-1' },
      ])
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'following-user-1', nickname: 'followingUser', avatarUrl: null },
      ])

      const { searchMentionUsers } = await import('@/lib/actions/mention')
      const result = await searchMentionUsers('')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        id: 'following-user-1',
        nickname: 'followingUser',
        isFollowing: true,
      })
    })

    it('空のクエリでフォロー中ユーザーがいない場合、空配列を返す', async () => {
      mockPrisma.follow.findMany.mockResolvedValueOnce([])
      mockPrisma.user.findMany.mockResolvedValueOnce([])

      const { searchMentionUsers } = await import('@/lib/actions/mention')
      const result = await searchMentionUsers('')

      expect(result).toEqual([])
    })

    it('指定した件数で取得できる', async () => {
      mockPrisma.follow.findMany.mockResolvedValueOnce([])
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-1', nickname: 'user1', avatarUrl: null },
        { id: 'user-2', nickname: 'user2', avatarUrl: null },
      ])

      const { searchMentionUsers } = await import('@/lib/actions/mention')
      const result = await searchMentionUsers('user', 2)

      expect(result).toHaveLength(2)
    })
  })

  // ============================================================
  // notifyMentionedUsers
  // ============================================================

  describe('notifyMentionedUsers', async () => {
    it('メンションされたユーザーに通知を送信する（<@userId>形式）', async () => {
      const mockUsers = [
        { id: 'mentioned-user-1' },
        { id: 'mentioned-user-2' },
      ]
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)

      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      // 新形式: <@userId>
      await notifyMentionedUsers(mockPost.id, '<@mentioned-user-1> <@mentioned-user-2> こんにちは', mockUser.id)

      // createNotificationsBulk へ正しい引数で delegate されること
      expect(mockCreateNotificationsBulk).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientIds: expect.arrayContaining(['mentioned-user-1', 'mentioned-user-2']),
          actorId: mockUser.id,
          type: 'mention',
          postId: mockPost.id,
        })
      )
    })

    it('contentがnullの場合、何もしない', async () => {
      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await notifyMentionedUsers(mockPost.id, null, mockUser.id)

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('メンションがない場合、何もしない', async () => {
      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await notifyMentionedUsers(mockPost.id, 'メンションなしの投稿', mockUser.id)

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('旧形式の@mentionはメンションとして認識しない', async () => {
      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      // 旧形式: @nickname（新システムでは認識しない）
      await notifyMentionedUsers(mockPost.id, '@nonexistent_user こんにちは', mockUser.id)

      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('該当ユーザーが見つからない場合、通知を送信しない', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([])

      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await notifyMentionedUsers(mockPost.id, '<@nonexistent-user> こんにちは', mockUser.id)

      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('エラーが発生しても例外をスローしない', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      await expect(notifyMentionedUsers(mockPost.id, '<@user1>', mockUser.id)).resolves.not.toThrow()
    })

    it('重複するメンションは1回だけ通知する', async () => {
      const mockUsers = [{ id: 'user1' }]
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)
      mockPrisma.notification.createMany.mockResolvedValueOnce({ count: 1 })

      const { notifyMentionedUsers } = await import('@/lib/actions/mention')
      // 同じIDへの重複メンション
      await notifyMentionedUsers(mockPost.id, '<@user1> <@user1> <@user1> こんにちは', mockUser.id)

      // 重複が除去されてuser.findManyが呼ばれる（IDベース）
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['user1'] },
          }),
        })
      )
    })
  })

  // ============================================================
  // getRecentMentionedUsers
  // ============================================================

  describe('getRecentMentionedUsers', async () => {
    it('最近メンションしたユーザーを取得できる（<@userId>形式）', async () => {
      const mockPosts = [
        { content: '<@user-1> こんにちは' },
        { content: '<@user-2> <@user-3> 返信' },
      ]
      const mockUsers = [
        { id: 'user-1', nickname: 'user1', avatarUrl: '/avatar1.jpg' },
        { id: 'user-2', nickname: 'user2', avatarUrl: '/avatar2.jpg' },
      ]

      mockPrisma.post.findMany.mockResolvedValueOnce(mockPosts)
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)

      const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
      const result = await getRecentMentionedUsers()

      expect(result).toHaveLength(2)
      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, content: { not: null } },
          take: 50,
        })
      )
    })

    it('未認証の場合、空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
      const result = await getRecentMentionedUsers()

      expect(result).toEqual([])
    })

    it('メンションがない場合、空配列を返す', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([
        { content: 'メンションなし' },
        { content: 'こちらもメンションなし' },
      ])

      const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
      const result = await getRecentMentionedUsers()

      expect(result).toEqual([])
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
    })

    it('旧形式の@mentionは認識しない', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([
        { content: '@user1 @user2 旧形式' },
      ])

      const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
      const result = await getRecentMentionedUsers()

      expect(result).toEqual([])
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
    })

    it('指定した件数で取得できる', async () => {
      mockPrisma.post.findMany.mockResolvedValueOnce([
        { content: '<@user1> <@user2> <@user3> <@user4> <@user5> <@user6>' },
      ])
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'user1', nickname: 'user1', avatarUrl: null },
        { id: 'user2', nickname: 'user2', avatarUrl: null },
        { id: 'user3', nickname: 'user3', avatarUrl: null },
      ])

      const { getRecentMentionedUsers } = await import('@/lib/actions/mention')
      await getRecentMentionedUsers(3)

      // IDベースで検索される
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: { in: ['user1', 'user2', 'user3'] },
          }),
        })
      )
    })
  })

  // ============================================================
  // resolveMentionUsers
  // ============================================================

  describe('resolveMentionUsers', async () => {
    it('ユーザーIDからユーザー情報を解決できる', async () => {
      const mockUsers = [
        { id: 'user-1', nickname: 'user1', avatarUrl: '/avatar1.jpg' },
        { id: 'user-2', nickname: 'user2', avatarUrl: null },
      ]
      mockPrisma.user.findMany.mockResolvedValueOnce(mockUsers)

      const { resolveMentionUsers } = await import('@/lib/actions/mention')
      const result = await resolveMentionUsers(['user-1', 'user-2'])

      expect(result.get('user-1')).toEqual({
        id: 'user-1',
        nickname: 'user1',
        avatarUrl: '/avatar1.jpg',
      })
      expect(result.get('user-2')).toEqual({
        id: 'user-2',
        nickname: 'user2',
        avatarUrl: null,
      })
    })

    it('空の配列の場合、空のMapを返す', async () => {
      const { resolveMentionUsers } = await import('@/lib/actions/mention')
      const result = await resolveMentionUsers([])

      expect(result.size).toBe(0)
    })

    it('存在しないユーザーIDはMapに含まれない', async () => {
      mockPrisma.user.findMany.mockResolvedValueOnce([
        { id: 'user-1', nickname: 'user1', avatarUrl: null },
      ])

      const { resolveMentionUsers } = await import('@/lib/actions/mention')
      const result = await resolveMentionUsers(['user-1', 'nonexistent'])

      expect(result.size).toBe(1)
      expect(result.get('user-1')).toBeDefined()
      expect(result.get('nonexistent')).toBeUndefined()
    })

    it('エラーが発生した場合、空のMapを返す', async () => {
      mockPrisma.user.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { resolveMentionUsers } = await import('@/lib/actions/mention')
      const result = await resolveMentionUsers(['user-1'])

      expect(result.size).toBe(0)
    })
  })
})
