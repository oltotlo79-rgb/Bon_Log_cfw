// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

const mockCheckUserRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({ checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args) }))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

describe('pin-post actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  describe('pinPost', () => {
    it('自分の投稿を固定できる', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: mockUser.id, isHidden: false })
      mockPrisma.user.update.mockResolvedValue({ id: mockUser.id })

      const { pinPost } = await import('@/lib/actions/pin-post')
      const result = await pinPost('post-1')

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { pinnedPostId: 'post-1' },
      })
    })

    it('未認証の場合はエラー', async () => {
      mockAuth.mockResolvedValue(null)

      const { pinPost } = await import('@/lib/actions/pin-post')
      const result = await pinPost('post-1')

      expect(result).toMatchObject({ success: false, error: '認証が必要です' })
    })

    it('他人の投稿は固定できない', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: 'other', isHidden: false })

      const { pinPost } = await import('@/lib/actions/pin-post')
      const result = await pinPost('post-1')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('存在しない/非表示の投稿は固定できない', async () => {
      mockPrisma.post.findUnique.mockResolvedValue(null)

      const { pinPost } = await import('@/lib/actions/pin-post')
      const result = await pinPost('missing')

      expect(result).toMatchObject({ success: false, error: '投稿が見つかりません' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('レート制限超過時はエラーで DB 探索もしない', async () => {
      mockCheckUserRateLimit.mockResolvedValueOnce({ success: false })

      const { pinPost } = await import('@/lib/actions/pin-post')
      const result = await pinPost('post-1')

      expect(result).toMatchObject({ success: false })
      expect(mockPrisma.post.findUnique).not.toHaveBeenCalled()
    })

    it('空の postId は Zod 検証で弾き、レート制限も DB 探索もしない', async () => {
      const { pinPost } = await import('@/lib/actions/pin-post')
      const result = await pinPost('')

      expect(result).toMatchObject({ success: false, error: '入力データが不正です' })
      expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
      expect(mockPrisma.post.findUnique).not.toHaveBeenCalled()
    })

    it('非表示の投稿は固定できない', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: mockUser.id, isHidden: true })

      const { pinPost } = await import('@/lib/actions/pin-post')
      const result = await pinPost('post-1')

      expect(result).toMatchObject({ success: false, error: '投稿が見つかりません' })
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('DB 更新に失敗したら ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.post.findUnique.mockResolvedValue({ userId: mockUser.id, isHidden: false })
      mockPrisma.user.update.mockRejectedValue(new Error('db down'))

      const { pinPost } = await import('@/lib/actions/pin-post')
      const result = await pinPost('post-1')

      expect(result).toMatchObject({ success: false })
      expect(result).not.toMatchObject({ success: true })
    })
  })

  describe('unpinPost', () => {
    it('固定を解除できる', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: mockUser.id })

      const { unpinPost } = await import('@/lib/actions/pin-post')
      const result = await unpinPost()

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { pinnedPostId: null },
      })
    })

    it('未認証の場合はエラー', async () => {
      mockAuth.mockResolvedValue(null)

      const { unpinPost } = await import('@/lib/actions/pin-post')
      const result = await unpinPost()

      expect(result).toMatchObject({ success: false, error: '認証が必要です' })
    })

    it('DB 更新に失敗したら ERR_OPERATION_FAILED を返す', async () => {
      mockPrisma.user.update.mockRejectedValue(new Error('db down'))

      const { unpinPost } = await import('@/lib/actions/pin-post')
      const result = await unpinPost()

      expect(result).toMatchObject({ success: false })
      expect(result).not.toMatchObject({ success: true })
    })
  })
})
