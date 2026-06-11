// @vitest-environment node
import { vi } from 'vitest'
import { expectError } from '../../helpers/action-result'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

describe('Notification Preferences Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    // requireActiveNonGuestUser が内部で suspension check のため findUnique を 1 回呼ぶ。
    // 各テストの個別 mockResolvedValueOnce より前に消費される分をデフォルトで満たす。
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  describe('getNotificationPreferences', async () => {
    it('通知設定を取得できる', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({
          notificationPreferences: { like: false, comment: true },
        })

      const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await getNotificationPreferences()

      expect(result.preferences).toEqual({ like: false, comment: true })
    })

    it('未認証の場合、空のpreferencesを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await getNotificationPreferences()

      expect(result).toEqual({ preferences: {} })
    })

    it('設定が未登録の場合、空オブジェクトを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        notificationPreferences: null,
      })

      const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await getNotificationPreferences()

      expect(result.preferences).toEqual({})
    })
  })

  describe('updateNotificationPreferences', async () => {
    it('通知設定を更新できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await updateNotificationPreferences({ like: false, comment: true })

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { notificationPreferences: { like: false, comment: true } },
      })
    })

    it('未認証の場合エラーを返す', async () => {
      mockAuth.mockResolvedValueOnce(null)

      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await updateNotificationPreferences({ like: false })

      expectError(result)
      expect(result.error).toBe('認証が必要です')
    })

    it('不正なキーは無視される（Zod strip）', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
       
      const result = await updateNotificationPreferences({ like: false, invalidKey: true } as any)

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { notificationPreferences: { like: false } },
      })
    })

    it('不正な型の場合はエラーを返す（Zod）', async () => {
      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')

      const result = await updateNotificationPreferences({ like: 'invalid' } as any)

      expectError(result)
      expect(result.error).toBeDefined()
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('部分更新: 一部のフィールドだけ指定できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await updateNotificationPreferences({ follow: true })

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { notificationPreferences: { follow: true } },
      })
    })

    it('全フィールドを同時に指定できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const allPrefs = {
        like: true,
        comment: false,
        reply: true,
        comment_like: false,
        follow: true,
        quote: false,
        follow_request: true,
        follow_request_approved: false,
        mention: true,
        message: false,
        repost: true,
      }
      const result = await updateNotificationPreferences(allPrefs)

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { notificationPreferences: allPrefs },
      })
    })

    it('空オブジェクトで更新できる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await updateNotificationPreferences({})

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { notificationPreferences: {} },
      })
    })

    it('DB更新時にエラーが発生した場合、例外がスローされる', async () => {
      mockPrisma.user.update.mockRejectedValueOnce(new Error('DB connection failed'))

      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      await expect(updateNotificationPreferences({ like: true })).rejects.toThrow('DB connection failed')
    })

    it('mention / message / repost も個別に切り替えできる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({})

      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await updateNotificationPreferences({
        mention: false,
        message: false,
        repost: false,
      })

      expect(result.success).toBe(true)
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { notificationPreferences: { mention: false, message: false, repost: false } },
      })
    })

    it('数値型の値は拒否される（Zod）', async () => {
      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await updateNotificationPreferences({ like: 123 } as any)

      expectError(result)
      expect(result.error).toBeDefined()
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('null値は拒否される（Zod）', async () => {
      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await updateNotificationPreferences({ like: null } as any)

      expectError(result)
      expect(result.error).toBeDefined()
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('revalidatePathが呼ばれる', async () => {
      mockPrisma.user.update.mockResolvedValueOnce({})
      const revalidatePath = (await import('next/cache')).revalidatePath

      const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      await updateNotificationPreferences({ like: true })

      expect(revalidatePath).toHaveBeenCalledWith('/settings/notifications')
    })
  })

  describe('getNotificationPreferences - edge cases', async () => {
    it('ユーザーが存在しない場合、空のpreferencesを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null)

      const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await getNotificationPreferences()

      expect(result.preferences).toEqual({})
    })

    it('notificationPreferencesがundefinedの場合、空のpreferencesを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        notificationPreferences: undefined,
      })

      const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await getNotificationPreferences()

      expect(result.preferences).toEqual({})
    })

    it('DB読み取りエラー時に例外がスローされる', async () => {
      mockPrisma.user.findUnique.mockRejectedValueOnce(new Error('DB read error'))

      const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      await expect(getNotificationPreferences()).rejects.toThrow('DB read error')
    })

    it('保存済みの全フィールドが正しく返される', async () => {
      const fullPrefs = {
        like: true,
        comment: false,
        reply: true,
        comment_like: true,
        follow: false,
        quote: true,
        follow_request: false,
        follow_request_approved: true,
        mention: false,
        message: true,
        repost: false,
      }
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ isSuspended: false })
        .mockResolvedValueOnce({
          notificationPreferences: fullPrefs,
        })

      const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
      const result = await getNotificationPreferences()

      expect(result.preferences).toEqual(fullPrefs)
    })
  })
})
