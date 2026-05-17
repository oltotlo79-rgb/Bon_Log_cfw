// @vitest-environment node

/**
 * message.ts 並列化・セキュリティテスト
 *
 * sendMessage の Promise.all 並列実行パターンの検証
 * 日次制限・ブロックチェックの並列処理確認
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockRequireAuth = vi.fn()
const mockRequireActiveUser = vi.fn()
vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual('@/lib/actions/utils')
  return {
    ...actual,
    requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
    requireActiveUser: (...args: unknown[]) => mockRequireActiveUser(...args),
  }
})

const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}))

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

vi.mock('@/lib/utils', () => ({
  getStartOfToday: vi.fn(() => new Date('2026-01-01T00:00:00Z')),
}))

vi.mock('@/lib/sanitize', () => ({
  sanitizeMessageContent: vi.fn((s: string) => s),
}))

vi.mock('@/lib/actions/notification', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/services/notification-core', () => ({
  createNotification: vi.fn().mockResolvedValue({ success: true }),
}))

const importModule = () => import('@/lib/actions/message')

describe('Message Parallel Execution Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockRequireAuth.mockResolvedValue({ userId: mockUser.id })
    mockRequireActiveUser.mockResolvedValue({ userId: mockUser.id })
    mockCheckUserRateLimit.mockResolvedValue({ success: true })
    // sendMessage内の通知・会話更新用
    mockPrisma.notification.create.mockResolvedValue({})
    mockPrisma.conversation.update.mockResolvedValue({})
  })

  describe('sendMessage - 並列バリデーション', () => {
    it('参加者確認・日次制限・相手取得が同時にクエリされる', async () => {
      // 参加者確認
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: mockUser.id,
      })
      // 日次メッセージ数: 0件
      mockPrisma.message.count.mockResolvedValue(0)
      // 相手参加者
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: 'p-2',
        userId: 'other-user-id',
      })
      // ブロックなし
      mockPrisma.block.findFirst.mockResolvedValue(null)
      // メッセージ作成成功
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg-1',
        content: 'テスト',
        senderId: mockUser.id,
        sender: { id: mockUser.id, nickname: 'テストユーザー', avatarUrl: null },
      })
      mockPrisma.conversation.update.mockResolvedValue({})

      const { sendMessage } = await importModule()
      const result = await sendMessage('conv-1', 'テスト')

      expect(result).toMatchObject({ success: true })
      // 3つのクエリが全て呼ばれたことを確認
      expect(mockPrisma.conversationParticipant.findUnique).toHaveBeenCalled()
      expect(mockPrisma.message.count).toHaveBeenCalled()
      expect(mockPrisma.conversationParticipant.findFirst).toHaveBeenCalled()
    })

    it('参加者でない場合、日次制限やブロックに関係なくエラー', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue(null)
      mockPrisma.message.count.mockResolvedValue(0)
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)

      const { sendMessage } = await importModule()
      const result = await sendMessage('conv-1', 'テスト')

      expect(result).toMatchObject({ success: false })
      // メッセージは作成されない
      expect(mockPrisma.message.create).not.toHaveBeenCalled()
    })

    it('日次制限超過と同時に参加者でもある場合、日次制限エラーが返る', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: mockUser.id,
      })
      mockPrisma.message.count.mockResolvedValue(100) // 制限超過
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue(null)

      const { sendMessage } = await importModule()
      const result = await sendMessage('conv-1', 'テスト')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.message.create).not.toHaveBeenCalled()
    })

    it('ブロック関係がある場合はメッセージ送信できない', async () => {
      mockPrisma.conversationParticipant.findUnique.mockResolvedValue({
        id: 'p-1',
        userId: mockUser.id,
      })
      mockPrisma.message.count.mockResolvedValue(0)
      mockPrisma.conversationParticipant.findFirst.mockResolvedValue({
        id: 'p-2',
        userId: 'other-user-id',
      })
      mockPrisma.block.findFirst.mockResolvedValue({ id: 'block-1' })

      const { sendMessage } = await importModule()
      const result = await sendMessage('conv-1', 'テスト')

      expect(result).toMatchObject({ success: false })
    })
  })
})
