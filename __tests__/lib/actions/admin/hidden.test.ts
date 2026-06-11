// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser, mockAdminNotification } from '../../../utils/test-utils'

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
const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

// rate-limitモック
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

// loggerモック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// next/headersモック
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])),
}))

// premiumモック
vi.mock('@/lib/premium', () => ({
  isPremiumUser: vi.fn().mockResolvedValue(false),
  getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }),
}))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockHiddenPost = {
  id: 'hidden-post-id',
  content: '非表示の投稿内容',
  isHidden: true,
  hiddenAt: new Date('2024-01-15'),
  user: { id: mockUser.id, nickname: 'テストユーザー', avatarUrl: null },
  _count: { likes: 0, comments: 0 },
}

const mockHiddenComment = {
  id: 'hidden-comment-id',
  content: '非表示のコメント',
  isHidden: true,
  hiddenAt: new Date('2024-01-15'),
  user: { id: mockUser.id, nickname: 'テストユーザー', avatarUrl: null },
  post: { id: 'post-id-123' },
}

const mockHiddenEvent = {
  id: 'hidden-event-id',
  title: '非表示イベント',
  description: 'イベント説明',
  isHidden: true,
  hiddenAt: new Date('2024-01-15'),
  creator: { id: mockUser.id, nickname: 'テストユーザー', avatarUrl: null },
}

const mockHiddenShop = {
  id: 'hidden-shop-id',
  name: '非表示盆栽園',
  address: '東京都渋谷区',
  isHidden: true,
  hiddenAt: new Date('2024-01-15'),
  creator: { id: mockUser.id, nickname: 'テストユーザー', avatarUrl: null },
}

const mockHiddenReview = {
  id: 'hidden-review-id',
  content: '非表示レビュー',
  isHidden: true,
  hiddenAt: new Date('2024-01-15'),
  user: { id: mockUser.id, nickname: 'テストユーザー', avatarUrl: null },
  shop: { name: 'テスト盆栽園' },
}

describe('管理者向け非表示コンテンツ管理アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    // デフォルトで全タイプの非表示コンテンツを空にする
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.comment.findMany.mockResolvedValue([])
    mockPrisma.event.findMany.mockResolvedValue([])
    mockPrisma.bonsaiShop.findMany.mockResolvedValue([])
    mockPrisma.shopReview.findMany.mockResolvedValue([])
    mockPrisma.report.groupBy.mockResolvedValue([])
  })

  // ============================================================
  // getHiddenContent
  // ============================================================

  describe('getHiddenContent', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('全タイプの非表示コンテンツが空の場合、空配列を返す', async () => {
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent()
      expect(result).toMatchObject({ items: [] })
    })

    it('非表示の投稿を正しくマッピングして返す', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockHiddenPost])
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent()

      if ('error' in result) throw new Error('Expected items, got error')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        type: 'post',
        id: 'hidden-post-id',
        content: '非表示の投稿内容',
      })
    })

    it('非表示のコメントを正しくマッピングして返す', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([mockHiddenComment])
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent()

      if ('error' in result) throw new Error('Expected items, got error')
      const commentItem = result.items.find(i => i.type === 'comment')
      expect(commentItem).toBeDefined()
      expect(commentItem?.id).toBe('hidden-comment-id')
    })

    it('type=postを指定した場合、投稿のみを取得する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockHiddenPost])
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent({ type: 'post' })

      if ('error' in result) throw new Error('Expected items, got error')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.type).toBe('post')
      // タイプ指定時、他のfindManyは呼ばれないか空配列を返す
    })

    it('type=commentを指定した場合、コメントのみを取得する', async () => {
      mockPrisma.comment.findMany.mockResolvedValue([mockHiddenComment])
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent({ type: 'comment' })

      if ('error' in result) throw new Error('Expected items, got error')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.type).toBe('comment')
    })

    it('type=eventを指定した場合、イベントのみを取得する', async () => {
      mockPrisma.event.findMany.mockResolvedValue([mockHiddenEvent])
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent({ type: 'event' })

      if ('error' in result) throw new Error('Expected items, got error')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.type).toBe('event')
      expect(result.items[0]!.content).toContain('非表示イベント')
    })

    it('type=shopを指定した場合、盆栽園のみを取得する', async () => {
      mockPrisma.bonsaiShop.findMany.mockResolvedValue([mockHiddenShop])
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent({ type: 'shop' })

      if ('error' in result) throw new Error('Expected items, got error')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.type).toBe('shop')
      expect(result.items[0]!.content).toContain('非表示盆栽園')
    })

    it('type=reviewを指定した場合、レビューのみを取得する', async () => {
      mockPrisma.shopReview.findMany.mockResolvedValue([mockHiddenReview])
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent({ type: 'review' })

      if ('error' in result) throw new Error('Expected items, got error')
      expect(result.items).toHaveLength(1)
      expect(result.items[0]!.type).toBe('review')
    })

    it('通報件数を取得して各アイテムに設定する', async () => {
      mockPrisma.post.findMany.mockResolvedValue([mockHiddenPost])
      mockPrisma.report.groupBy.mockResolvedValue([
        { targetType: 'post', targetId: 'hidden-post-id', _count: 5 },
      ])
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await getHiddenContent()

      if ('error' in result) throw new Error('Expected items, got error')
      expect(result.items[0]!.reportCount).toBe(5)
    })

    it('limit オプションが指定タイプの findMany に渡される（offset は非対応）', async () => {
      const { getHiddenContent } = await import('@/lib/actions/admin/hidden')
      await getHiddenContent({ type: 'post', limit: 10 })

      expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 })
      )
    })
  })

  // ============================================================
  // restoreContent
  // ============================================================

  describe('restoreContent', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('post', 'post-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('post', 'post-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('投稿を正常に再表示する', async () => {
      mockPrisma.post.update.mockResolvedValue({ id: 'post-id', isHidden: false })
      mockPrisma.report.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('post', 'post-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.post.update).toHaveBeenCalledWith({
        where: { id: 'post-id' },
        data: { isHidden: false, hiddenAt: null },
      })
    })

    it('コメントを正常に再表示する', async () => {
      mockPrisma.comment.update.mockResolvedValue({ id: 'comment-id', isHidden: false })
      mockPrisma.report.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('comment', 'comment-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.comment.update).toHaveBeenCalledWith({
        where: { id: 'comment-id' },
        data: { isHidden: false, hiddenAt: null },
      })
    })

    it('イベントを正常に再表示する', async () => {
      mockPrisma.event.update.mockResolvedValue({ id: 'event-id', isHidden: false })
      mockPrisma.report.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('event', 'event-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.event.update).toHaveBeenCalled()
    })

    it('盆栽園を正常に再表示する', async () => {
      mockPrisma.bonsaiShop.update.mockResolvedValue({ id: 'shop-id', isHidden: false })
      mockPrisma.report.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('shop', 'shop-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.bonsaiShop.update).toHaveBeenCalled()
    })

    it('レビューを正常に再表示する', async () => {
      mockPrisma.shopReview.update.mockResolvedValue({ id: 'review-id', isHidden: false })
      mockPrisma.report.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      const result = await restoreContent('review', 'review-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.shopReview.update).toHaveBeenCalled()
    })

    it('関連する通報のステータスをresolvedに更新する', async () => {
      mockPrisma.post.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 2 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      await restoreContent('post', 'post-id')

      expect(mockPrisma.report.updateMany).toHaveBeenCalledWith({
        where: { targetType: 'post', targetId: 'post-id' },
        data: { status: 'resolved' },
      })
    })

    it('管理者通知を解決済みに更新する', async () => {
      mockPrisma.post.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      await restoreContent('post', 'post-id')

      expect(mockPrisma.adminNotification.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ targetType: 'post', targetId: 'post-id', isResolved: false }),
          data: expect.objectContaining({ isResolved: true }),
        })
      )
    })

    it('管理ログに操作を記録する', async () => {
      mockPrisma.post.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      await restoreContent('post', 'post-id')

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'restore_content',
            targetType: 'post',
            targetId: 'post-id',
          }),
        })
      )
    })

    it('成功後にrevalidatePathを呼ぶ', async () => {
      mockPrisma.post.update.mockResolvedValue({})
      mockPrisma.report.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { restoreContent } = await import('@/lib/actions/admin/hidden')
      await restoreContent('post', 'post-id')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/hidden')
    })
  })

  // ============================================================
  // deleteHiddenContent
  // ============================================================

  describe('deleteHiddenContent', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('post', 'post-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('post', 'post-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('非表示の投稿を完全削除する', async () => {
      mockPrisma.post.delete.mockResolvedValue({ id: 'post-id' })
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('post', 'post-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.post.delete).toHaveBeenCalledWith({ where: { id: 'post-id' } })
    })

    it('非表示のコメントを完全削除する', async () => {
      mockPrisma.comment.delete.mockResolvedValue({ id: 'comment-id' })
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('comment', 'comment-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment-id' } })
    })

    it('非表示のイベントを完全削除する', async () => {
      mockPrisma.event.delete.mockResolvedValue({ id: 'event-id' })
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('event', 'event-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.event.delete).toHaveBeenCalled()
    })

    it('非表示の盆栽園を完全削除する', async () => {
      mockPrisma.bonsaiShop.delete.mockResolvedValue({ id: 'shop-id' })
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('shop', 'shop-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.bonsaiShop.delete).toHaveBeenCalled()
    })

    it('非表示のレビューを完全削除する', async () => {
      mockPrisma.shopReview.delete.mockResolvedValue({ id: 'review-id' })
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      const result = await deleteHiddenContent('review', 'review-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.shopReview.delete).toHaveBeenCalled()
    })

    it('関連する通報を削除する', async () => {
      mockPrisma.post.delete.mockResolvedValue({})
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 3 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      await deleteHiddenContent('post', 'post-id')

      expect(mockPrisma.report.deleteMany).toHaveBeenCalledWith({
        where: { targetType: 'post', targetId: 'post-id' },
      })
    })

    it('管理ログにdelete_hidden_contentアクションを記録する', async () => {
      mockPrisma.post.delete.mockResolvedValue({})
      mockPrisma.report.deleteMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { deleteHiddenContent } = await import('@/lib/actions/admin/hidden')
      await deleteHiddenContent('post', 'post-id')

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'delete_hidden_content',
            targetType: 'post',
            targetId: 'post-id',
          }),
        })
      )
    })
  })

  // ============================================================
  // getAdminNotifications
  // ============================================================

  describe('getAdminNotifications', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      const result = await getAdminNotifications()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      const result = await getAdminNotifications()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('通知一覧と未読件数を返す', async () => {
      mockPrisma.adminNotification.findMany.mockResolvedValue([mockAdminNotification])
      mockPrisma.adminNotification.count.mockResolvedValue(1)

      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      const result = await getAdminNotifications()

      if ('error' in result) throw new Error('Expected notifications, got error')
      expect(result.notifications).toHaveLength(1)
      expect(result.unreadCount).toBe(1)
    })

    it('unreadOnly=trueの場合は未読フィルターを適用する', async () => {
      mockPrisma.adminNotification.findMany.mockResolvedValue([])
      mockPrisma.adminNotification.count.mockResolvedValue(0)

      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      await getAdminNotifications({ unreadOnly: true })

      expect(mockPrisma.adminNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isRead: false }),
        })
      )
    })

    it('unreadOnly=falseの場合は全通知を取得する', async () => {
      mockPrisma.adminNotification.findMany.mockResolvedValue([mockAdminNotification])
      mockPrisma.adminNotification.count.mockResolvedValue(1)

      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      const result = await getAdminNotifications({ unreadOnly: false })

      if ('error' in result) throw new Error('Expected notifications, got error')
      expect(result.notifications).toHaveLength(1)
    })

    it('limitオプションを渡せる', async () => {
      mockPrisma.adminNotification.findMany.mockResolvedValue([])
      mockPrisma.adminNotification.count.mockResolvedValue(0)

      const { getAdminNotifications } = await import('@/lib/actions/admin/hidden')
      await getAdminNotifications({ limit: 5 })

      expect(mockPrisma.adminNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      )
    })
  })

  // ============================================================
  // markAdminNotificationAsRead
  // ============================================================

  describe('markAdminNotificationAsRead', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { markAdminNotificationAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAdminNotificationAsRead('notification-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { markAdminNotificationAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAdminNotificationAsRead('notification-id')
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('通知を既読に更新して成功を返す', async () => {
      mockPrisma.adminNotification.update.mockResolvedValue({ id: 'notification-id', isRead: true })

      const { markAdminNotificationAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAdminNotificationAsRead('notification-id')

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.adminNotification.update).toHaveBeenCalledWith({
        where: { id: 'notification-id' },
        data: { isRead: true },
      })
    })

    it('成功後にrevalidatePathを呼ぶ', async () => {
      mockPrisma.adminNotification.update.mockResolvedValue({})

      const { markAdminNotificationAsRead } = await import('@/lib/actions/admin/hidden')
      await markAdminNotificationAsRead('notification-id')

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/hidden')
    })
  })

  // ============================================================
  // markAllAdminNotificationsAsRead
  // ============================================================

  describe('markAllAdminNotificationsAsRead', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { markAllAdminNotificationsAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAllAdminNotificationsAsRead()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { markAllAdminNotificationsAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAllAdminNotificationsAsRead()
      expect(result).toMatchObject({ error: expect.any(String) })
    })

    it('全未読通知を一括で既読にして成功を返す', async () => {
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 5 })

      const { markAllAdminNotificationsAsRead } = await import('@/lib/actions/admin/hidden')
      const result = await markAllAdminNotificationsAsRead()

      expect(result).toMatchObject({ success: true })
      expect(mockPrisma.adminNotification.updateMany).toHaveBeenCalledWith({
        where: { isRead: false },
        data: { isRead: true },
      })
    })

    it('成功後にrevalidatePathを呼ぶ', async () => {
      mockPrisma.adminNotification.updateMany.mockResolvedValue({ count: 0 })

      const { markAllAdminNotificationsAsRead } = await import('@/lib/actions/admin/hidden')
      await markAllAdminNotificationsAsRead()

      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/hidden')
    })
  })
})
