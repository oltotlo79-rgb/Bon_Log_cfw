// @vitest-environment node
/**
 * lib/actions/notification.ts の分岐カバレッジを補完するテスト。
 *
 * 既存の notification.test.ts / notification-extended.test.ts は正常系・
 * 未認証・DB エラー（Error インスタンス）はカバー済みだが、以下が未検証だった:
 *   - markAsRead: Zod バリデーション失敗（不正な notificationId）
 *   - markAsRead / markAllAsRead: レート制限超過
 *   - markAsRead / markAllAsRead: catch 内の Error 以外の throw 値
 */
import { vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn) => fn),
  cache: vi.fn((fn) => fn),
}))

const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

describe('notification: 追加分岐カバレッジ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  describe('markAsRead - Zod バリデーション', () => {
    it('空文字の notificationId は ERR_INVALID_INPUT を返し、DB 更新もレート制限も行わない', async () => {
      const { markAsRead } = await import('@/lib/actions/notification')
      const result = await markAsRead('')

      expect(result).toEqual({ success: false, error: '入力データが不正です' })
      expect(mockPrisma.notification.update).not.toHaveBeenCalled()
      expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
    })
  })

  describe('markAsRead - レート制限超過', () => {
    it('Zod 通過後にレート制限超過ならエラーを返し、DB 更新は行わない', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { markAsRead } = await import('@/lib/actions/notification')
      const result = await markAsRead('notification-1')

      expect(result.success).toBe(false)
      expect(mockPrisma.notification.update).not.toHaveBeenCalled()
    })
  })

  describe('markAsRead - catch 内で Error 以外を throw', () => {
    it('文字列 throw でも ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.notification.update.mockRejectedValueOnce('connection lost')

      const { markAsRead } = await import('@/lib/actions/notification')
      const result = await markAsRead('notification-1')

      expect(result).toEqual({ success: false, error: '操作に失敗しました' })
    })
  })

  describe('markAllAsRead - レート制限超過', () => {
    it('レート制限超過ならエラーを返し、updateMany は呼ばれない', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { markAllAsRead } = await import('@/lib/actions/notification')
      const result = await markAllAsRead()

      expect(result.success).toBe(false)
      expect(mockPrisma.notification.updateMany).not.toHaveBeenCalled()
    })
  })

  describe('markAllAsRead - catch 内で Error 以外を throw', () => {
    it('文字列 throw でも ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.notification.updateMany.mockRejectedValueOnce('connection lost')

      const { markAllAsRead } = await import('@/lib/actions/notification')
      const result = await markAllAsRead()

      expect(result).toEqual({ success: false, error: '操作に失敗しました' })
    })
  })
})
