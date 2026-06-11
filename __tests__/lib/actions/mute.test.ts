// @vitest-environment node
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockMute } from '../../utils/test-utils'

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

describe('Mute Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  })

  // ============================================================
  // muteUser
  // ============================================================

  describe('muteUser', async () => {
    it('ユーザーをミュートできる', async () => {
      mockPrisma.mute.create.mockResolvedValueOnce(mockMute)

      const { muteUser } = await import('@/lib/actions/mute')
      const result = await muteUser('other-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.mute.create).toHaveBeenCalledWith({
        data: {
          muterId: mockUser.id,
          mutedId: 'other-user-id',
        },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { muteUser } = await import('@/lib/actions/mute')
      const result = await muteUser('other-user-id')

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('自分自身をミュートしようとした場合、エラーを返す', async () => {
      const { muteUser } = await import('@/lib/actions/mute')
      const result = await muteUser(mockUser.id)

      expect(result).toEqual({ success: false, error: '自分自身をミュートすることはできません' })
    })

    it('ミュートに失敗した場合、エラーを返す', async () => {
      mockPrisma.mute.create.mockRejectedValueOnce(new Error('Database error'))

      const { muteUser } = await import('@/lib/actions/mute')
      const result = await muteUser('other-user-id')

      expect(result).toEqual({ success: false, error: 'ミュートに失敗しました' })
    })
  })

  // ============================================================
  // unmuteUser
  // ============================================================

  describe('unmuteUser', async () => {
    it('ミュートを解除できる', async () => {
      mockPrisma.mute.delete.mockResolvedValueOnce(mockMute)

      const { unmuteUser } = await import('@/lib/actions/mute')
      const result = await unmuteUser('other-user-id')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.mute.delete).toHaveBeenCalledWith({
        where: {
          muterId_mutedId: {
            muterId: mockUser.id,
            mutedId: 'other-user-id',
          },
        },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { unmuteUser } = await import('@/lib/actions/mute')
      const result = await unmuteUser('other-user-id')

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('ミュート解除に失敗した場合、エラーを返す', async () => {
      mockPrisma.mute.delete.mockRejectedValueOnce(new Error('Database error'))

      const { unmuteUser } = await import('@/lib/actions/mute')
      const result = await unmuteUser('other-user-id')

      expect(result).toEqual({ success: false, error: 'ミュート解除に失敗しました' })
    })
  })

  // ============================================================
  // getMutedUsers
  // ============================================================

  describe('getMutedUsers', async () => {
    it('ミュートしたユーザー一覧を取得できる', async () => {
      const mockMutes = [
        {
          muterId: mockUser.id,
          mutedId: 'muted-user-1',
          muted: {
            id: 'muted-user-1',
            nickname: 'ミュートユーザー1',
            avatarUrl: '/avatar1.jpg',
            bio: '自己紹介1',
          },
        },
        {
          muterId: mockUser.id,
          mutedId: 'muted-user-2',
          muted: {
            id: 'muted-user-2',
            nickname: 'ミュートユーザー2',
            avatarUrl: '/avatar2.jpg',
            bio: '自己紹介2',
          },
        },
      ]
      mockPrisma.mute.findMany.mockResolvedValueOnce(mockMutes)

      const { getMutedUsers } = await import('@/lib/actions/mute')
      const result = await getMutedUsers()

      expect(result.users).toHaveLength(2)
      expect(result.users[0]!.nickname).toBe('ミュートユーザー1')
    })

    it('未認証の場合、空配列を返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getMutedUsers } = await import('@/lib/actions/mute')
      const result = await getMutedUsers()

      expect(result).toEqual({ users: [], nextCursor: undefined })
    })

    it('取得に失敗した場合、空配列を返す', async () => {
      mockPrisma.mute.findMany.mockRejectedValueOnce(new Error('Database error'))

      const { getMutedUsers } = await import('@/lib/actions/mute')
      const result = await getMutedUsers()

      expect(result).toEqual({ users: [], nextCursor: undefined })
    })
  })

  // ============================================================
  // isMuted
  // ============================================================

  describe('isMuted', async () => {
    it('ミュート状態を取得できる', async () => {
      mockPrisma.mute.findUnique.mockResolvedValueOnce(mockMute)

      const { isMuted } = await import('@/lib/actions/mute')
      const result = await isMuted('other-user-id')

      expect(result).toEqual({ muted: true })
    })

    it('ミュートしていない場合、muted: falseを返す', async () => {
      mockPrisma.mute.findUnique.mockResolvedValueOnce(null)

      const { isMuted } = await import('@/lib/actions/mute')
      const result = await isMuted('other-user-id')

      expect(result).toEqual({ muted: false })
    })

    it('未認証の場合、muted: falseを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { isMuted } = await import('@/lib/actions/mute')
      const result = await isMuted('other-user-id')

      expect(result).toEqual({ muted: false })
    })

    it('エラー時はmuted: falseを返す', async () => {
      mockPrisma.mute.findUnique.mockRejectedValueOnce(new Error('Database error'))

      const { isMuted } = await import('@/lib/actions/mute')
      const result = await isMuted('other-user-id')

      expect(result).toEqual({ muted: false })
    })
  })
})
