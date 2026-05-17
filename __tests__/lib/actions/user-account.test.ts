// @vitest-environment node
import { vi } from 'vitest'
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

// ロガーモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}))

// next/cacheモック
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
}))

describe('User Account Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id, email: mockUser.email } })
  })

  // ============================================================
  // deleteAccount
  // ============================================================

  describe('deleteAccount', async () => {
    it('アカウントを正常に削除できる', async () => {
      mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          userAnalytics: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          message: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          conversationParticipant: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          user: { delete: vi.fn().mockResolvedValue(mockUser) },
        }
        return callback(tx)
      })

      const { deleteAccount } = await import('@/lib/actions/user-account')
      const result = await deleteAccount()

      expect(result).toEqual({ success: true })
    })

    it('トランザクション内でuserAnalyticsを削除する', async () => {
      const txUserAnalytics = { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) }
      const txMessage = { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) }
      const txConversationParticipant = { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) }
      const txNotification = { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) }
      const txUser = { delete: vi.fn().mockResolvedValue(mockUser) }

      mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback({
          userAnalytics: txUserAnalytics,
          message: txMessage,
          conversationParticipant: txConversationParticipant,
          notification: txNotification,
          user: txUser,
        })
      })

      const { deleteAccount } = await import('@/lib/actions/user-account')
      await deleteAccount()

      expect(txUserAnalytics.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      })
    })

    it('トランザクション内でmessageを削除する', async () => {
      const txUserAnalytics = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txMessage = { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) }
      const txConversationParticipant = { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) }
      const txNotification = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txUser = { delete: vi.fn().mockResolvedValue(mockUser) }

      mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback({
          userAnalytics: txUserAnalytics,
          message: txMessage,
          conversationParticipant: txConversationParticipant,
          notification: txNotification,
          user: txUser,
        })
      })

      const { deleteAccount } = await import('@/lib/actions/user-account')
      await deleteAccount()

      expect(txMessage.deleteMany).toHaveBeenCalledWith({
        where: { senderId: mockUser.id },
      })
    })

    it('トランザクション内でconversationParticipantを削除する', async () => {
      const txUserAnalytics = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txMessage = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txConversationParticipant = { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) }
      const txNotification = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txUser = { delete: vi.fn().mockResolvedValue(mockUser) }

      mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback({
          userAnalytics: txUserAnalytics,
          message: txMessage,
          conversationParticipant: txConversationParticipant,
          notification: txNotification,
          user: txUser,
        })
      })

      const { deleteAccount } = await import('@/lib/actions/user-account')
      await deleteAccount()

      expect(txConversationParticipant.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      })
    })

    it('トランザクション内で自分宛・自分発の通知を削除する', async () => {
      const txUserAnalytics = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txMessage = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txConversationParticipant = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txNotification = { deleteMany: vi.fn().mockResolvedValue({ count: 5 }) }
      const txUser = { delete: vi.fn().mockResolvedValue(mockUser) }

      mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback({
          userAnalytics: txUserAnalytics,
          message: txMessage,
          conversationParticipant: txConversationParticipant,
          notification: txNotification,
          user: txUser,
        })
      })

      const { deleteAccount } = await import('@/lib/actions/user-account')
      await deleteAccount()

      expect(txNotification.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { userId: mockUser.id },
            { actorId: mockUser.id },
          ],
        },
      })
    })

    it('トランザクション内でuser.deleteを呼び出す', async () => {
      const txUserAnalytics = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txMessage = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txConversationParticipant = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txNotification = { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) }
      const txUser = { delete: vi.fn().mockResolvedValue(mockUser) }

      mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        return callback({
          userAnalytics: txUserAnalytics,
          message: txMessage,
          conversationParticipant: txConversationParticipant,
          notification: txNotification,
          user: txUser,
        })
      })

      const { deleteAccount } = await import('@/lib/actions/user-account')
      await deleteAccount()

      expect(txUser.delete).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      })
    })

    it('未認証の場合、エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { deleteAccount } = await import('@/lib/actions/user-account')
      const result = await deleteAccount()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('ゲストの場合、エラーを返す', async () => {
      const { GUEST_EMAIL } = await import('@/lib/constants/guest')
      const { ERR_GUEST_CANNOT_CREATE } = await import('@/lib/constants/errors')
      mockAuth.mockResolvedValue({ user: { id: 'guest-id', email: GUEST_EMAIL } })

      const { deleteAccount } = await import('@/lib/actions/user-account')
      const result = await deleteAccount()

      expect(result).toMatchObject({ error: ERR_GUEST_CANNOT_CREATE })
    })

    it('DBエラーが発生した場合、エラーを返す', async () => {
      mockPrisma.$transaction.mockRejectedValueOnce(new Error('Database error'))

      const { deleteAccount } = await import('@/lib/actions/user-account')
      const result = await deleteAccount()

      expect(result).toMatchObject({ error: 'アカウントの削除に失敗しました' })
    })

    it('トランザクション内でエラーが発生した場合、エラーを返す', async () => {
      mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          userAnalytics: { deleteMany: vi.fn().mockRejectedValue(new Error('TX error')) },
          message: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          conversationParticipant: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          user: { delete: vi.fn().mockResolvedValue(mockUser) },
        }
        return callback(tx)
      })

      const { deleteAccount } = await import('@/lib/actions/user-account')
      const result = await deleteAccount()

      expect(result).toMatchObject({ error: 'アカウントの削除に失敗しました' })
    })

    it('successプロパティがtrueで返る', async () => {
      mockPrisma.$transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
        const tx = {
          userAnalytics: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          message: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          conversationParticipant: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          notification: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
          user: { delete: vi.fn().mockResolvedValue(mockUser) },
        }
        return callback(tx)
      })

      const { deleteAccount } = await import('@/lib/actions/user-account')
      const result = await deleteAccount()

      expect('success' in result && result.success).toBe(true)
    })
  })
})
