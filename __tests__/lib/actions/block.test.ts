// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockBlock } from '../../utils/test-utils'

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
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

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

describe('Block Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // blockUser
  // ============================================================

  describe('blockUser', async () => {
    it('ユーザーをブロックできる', async () => {
      // requireActiveNonGuestUser 内で isSuspended チェック → 対象ユーザー存在確認 の順に findUnique が呼ばれる
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false }) // requireActiveUser 内
        .mockResolvedValueOnce({ id: 'other-user-id' }) // blockUser 内の対象ユーザー確認
      mockPrisma.follow.deleteMany.mockResolvedValue({ count: 2 })
      mockPrisma.block.create.mockResolvedValue(mockBlock)

      const { blockUser } = await import('@/lib/actions/block')
      const result = await blockUser('other-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { blockUser } = await import('@/lib/actions/block')
      const result = await blockUser('other-user-id')

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('自分自身をブロックしようとした場合、エラーを返す', async () => {
      // isSuspended チェックを通過させる
      mockPrisma.user.findUnique.mockResolvedValueOnce({ isSuspended: false })
      const { blockUser } = await import('@/lib/actions/block')
      const result = await blockUser(mockUser.id)

      expect(result).toEqual({ success: false, error: '自分自身をブロックすることはできません' })
    })

    it('ブロックに失敗した場合、エラーを返す', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false }) // requireActiveUser 内
        .mockResolvedValueOnce({ id: 'other-user-id' }) // 対象ユーザー存在確認
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Database error'))

      const { blockUser } = await import('@/lib/actions/block')
      const result = await blockUser('other-user-id')

      expect(result).toEqual({ success: false, error: 'ブロックに失敗しました' })
    })
  })

  // ============================================================
  // unblockUser
  // ============================================================

  describe('unblockUser', async () => {
    it('ブロックを解除できる', async () => {
      mockPrisma.block.delete.mockResolvedValueOnce(mockBlock)

      const { unblockUser } = await import('@/lib/actions/block')
      const result = await unblockUser('other-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.block.delete).toHaveBeenCalledWith({
        where: {
          blockerId_blockedId: {
            blockerId: mockUser.id,
            blockedId: 'other-user-id',
          },
        },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { unblockUser } = await import('@/lib/actions/block')
      const result = await unblockUser('other-user-id')

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('ブロック解除に失敗した場合、エラーを返す', async () => {
      mockPrisma.block.delete.mockRejectedValueOnce(new Error('Database error'))

      const { unblockUser } = await import('@/lib/actions/block')
      const result = await unblockUser('other-user-id')

      expect(result).toEqual({ success: false, error: 'ブロック解除に失敗しました' })
    })
  })

  // ============================================================
  // getBlockedUsers
  // ============================================================

  describe('getBlockedUsers', async () => {
    it('ブロックしたユーザー一覧を取得できる', async () => {
      const mockBlocks = [
        {
          blockerId: mockUser.id,
          blockedId: 'blocked-user-1',
          blocked: {
            id: 'blocked-user-1',
            nickname: 'ブロックユーザー1',
            avatarUrl: '/avatar1.jpg',
            bio: '自己紹介1',
          },
        },
        {
          blockerId: mockUser.id,
          blockedId: 'blocked-user-2',
          blocked: {
            id: 'blocked-user-2',
            nickname: 'ブロックユーザー2',
            avatarUrl: '/avatar2.jpg',
            bio: '自己紹介2',
          },
        },
      ]
      mockPrisma.block.findMany.mockResolvedValueOnce(mockBlocks)

      const { getBlockedUsers } = await import('@/lib/actions/block')
      const result = await getBlockedUsers()

      expect(result.users).toHaveLength(2)
      expect(result.users[0].nickname).toBe('ブロックユーザー1')
    })

    it('未認証の場合、空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getBlockedUsers } = await import('@/lib/actions/block')
      const result = await getBlockedUsers()

      expect(result).toMatchObject({ users: [] })
    })

    it('取得に失敗した場合、エラーを返す', async () => {
      mockPrisma.block.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getBlockedUsers } = await import('@/lib/actions/block')
      const result = await getBlockedUsers()

      expect(result).toMatchObject({ users: [] })
    })

    it('カーソル付きで取得できる', async () => {
      mockPrisma.block.findMany.mockResolvedValueOnce([])

      const { getBlockedUsers } = await import('@/lib/actions/block')
      await getBlockedUsers('cursor-id', 10)

      expect(mockPrisma.block.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: {
            blockerId_blockedId: {
              blockerId: mockUser.id,
              blockedId: 'cursor-id',
            },
          },
          skip: 1,
          take: 10,
        })
      )
    })
  })

  // ============================================================
  // isBlocked
  // ============================================================

  describe('isBlocked', async () => {
    it('ブロック状態を取得できる', async () => {
      mockPrisma.block.findUnique
        .mockResolvedValueOnce(mockBlock) // 自分が相手をブロック
        .mockResolvedValueOnce(null) // 相手から自分はブロックされていない

      const { isBlocked } = await import('@/lib/actions/block')
      const result = await isBlocked('other-user-id')

      expect(result).toEqual({ blocked: true, blockedBy: false })
    })

    it('相手からブロックされている状態を取得できる', async () => {
      mockPrisma.block.findUnique
        .mockResolvedValueOnce(null) // 自分は相手をブロックしていない
        .mockResolvedValueOnce(mockBlock) // 相手から自分がブロックされている

      const { isBlocked } = await import('@/lib/actions/block')
      const result = await isBlocked('other-user-id')

      expect(result).toEqual({ blocked: false, blockedBy: true })
    })

    it('未認証の場合、両方falseを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { isBlocked } = await import('@/lib/actions/block')
      const result = await isBlocked('other-user-id')

      expect(result).toEqual({ blocked: false, blockedBy: false })
    })

    it('エラー時は両方falseを返す', async () => {
      mockPrisma.block.findUnique.mockRejectedValueOnce(new Error('Database error'))

      const { isBlocked } = await import('@/lib/actions/block')
      const result = await isBlocked('other-user-id')

      expect(result).toEqual({ blocked: false, blockedBy: false })
    })
  })
})
