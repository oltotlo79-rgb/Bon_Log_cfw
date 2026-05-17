// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({ checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }), RATE_LIMITS: {} }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }) }))

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

const mockAnnouncement = {
  id: 'announcement-1',
  title: 'テストお知らせ',
  content: 'テスト内容です',
  type: 'banner' as const,
  isActive: true,
  startsAt: new Date('2025-01-01'),
  endsAt: null,
  createdBy: mockUser.id,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-01'),
}

const mockAnnouncement2 = {
  ...mockAnnouncement,
  id: 'announcement-2',
  title: '2番目のお知らせ',
  isActive: false,
}

const mockTransaction = vi.fn((ops: unknown) => {
  if (typeof ops === 'function') {
    return (ops as (...args: unknown[]) => unknown)(mockPrisma)
  }
  return Promise.all(ops as Promise<unknown>[])
})

describe('管理者向けお知らせ管理アクション', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
    mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
    ;(mockPrisma as Record<string, unknown>).$transaction = mockTransaction

    // announcement / notification モデルのモック追加
    ;(mockPrisma as Record<string, unknown>).announcement = {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    }

    // バッチ通知処理のためuser.countのデフォルトモック
    mockPrisma.user.count.mockResolvedValue(0)
  })

  // ============================================================
  // getAnnouncements
  // ============================================================

  describe('getAnnouncements', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { getAnnouncements } = await import('@/lib/actions/admin/announcements')
      const result = await getAnnouncements()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('管理者権限がない場合はエラーを返す', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)
      const { getAnnouncements } = await import('@/lib/actions/admin/announcements')
      const result = await getAnnouncements()
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('空の一覧を正常に返す', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([])
      ;(mockPrisma as Record<string, any>).announcement.count.mockResolvedValue(0)

      const { getAnnouncements } = await import('@/lib/actions/admin/announcements')
      const result = await getAnnouncements()

      expect(result).toEqual({ announcements: [], total: 0 })
    })

    it('お知らせ一覧と総件数を正常に返す', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([mockAnnouncement, mockAnnouncement2])
      ;(mockPrisma as Record<string, any>).announcement.count.mockResolvedValue(2)

      const { getAnnouncements } = await import('@/lib/actions/admin/announcements')
      const result = await getAnnouncements()

      expect(result).toEqual({ announcements: [mockAnnouncement, mockAnnouncement2], total: 2 })
    })

    it('isActiveフィルターで有効なお知らせのみ返す', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([mockAnnouncement])
      ;(mockPrisma as Record<string, any>).announcement.count.mockResolvedValue(1)

      const { getAnnouncements } = await import('@/lib/actions/admin/announcements')
      const result = await getAnnouncements({ isActive: true })

      expect((mockPrisma as Record<string, any>).announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: true },
        })
      )
      expect(result).toMatchObject({ announcements: [mockAnnouncement], total: 1 })
    })

    it('isActive: falseで無効なお知らせのみ返す', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([mockAnnouncement2])
      ;(mockPrisma as Record<string, any>).announcement.count.mockResolvedValue(1)

      const { getAnnouncements } = await import('@/lib/actions/admin/announcements')
      const result = await getAnnouncements({ isActive: false })

      expect((mockPrisma as Record<string, any>).announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isActive: false },
        })
      )
      expect(result).toEqual({ announcements: [mockAnnouncement2], total: 1 })
    })

    it('cursor を指定すると findMany に cursor/skip が渡される', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([])
      ;(mockPrisma as Record<string, any>).announcement.count.mockResolvedValue(0)

      const { getAnnouncements } = await import('@/lib/actions/admin/announcements')
      await getAnnouncements({ limit: 5, cursor: 'ann-cursor' })

      expect((mockPrisma as Record<string, any>).announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          cursor: { id: 'ann-cursor' },
          skip: 1,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
      )
    })

    it('cursor 未指定時は先頭ページとして cursor/skip なし', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([])
      ;(mockPrisma as Record<string, any>).announcement.count.mockResolvedValue(0)

      const { getAnnouncements } = await import('@/lib/actions/admin/announcements')
      await getAnnouncements()

      const call = (mockPrisma as Record<string, any>).announcement.findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
      expect(call.cursor).toBeUndefined()
      expect(call.skip).toBeUndefined()
    })
  })

  // ============================================================
  // createAnnouncement
  // ============================================================

  describe('createAnnouncement', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: 'テスト',
        content: '内容',
        type: 'banner',
        startsAt: '2025-01-01T00:00:00Z',
      })
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('タイトルが空の場合はエラーを返す', async () => {
      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: '',
        content: '内容',
        type: 'banner',
        startsAt: '2025-01-01T00:00:00Z',
      })
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('タイトルが空白のみの場合はエラーを返す', async () => {
      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: '   ',
        content: '内容',
        type: 'banner',
        startsAt: '2025-01-01T00:00:00Z',
      })
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('bannerタイプのお知らせを作成する（通知は作成しない）', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue(mockAnnouncement)
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: 'テストお知らせ',
        content: 'テスト内容です',
        type: 'banner',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect(result).toEqual({ success: true })
      expect((mockPrisma as Record<string, any>).announcement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'テストお知らせ',
          content: 'テスト内容です',
          type: 'banner',
          createdBy: mockUser.id,
        }),
      })
      // bannerタイプでは通知を作成しない
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/announcements')
    })

    it('notificationタイプのお知らせを作成し全ユーザーに通知する', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue({
        ...mockAnnouncement,
        type: 'notification',
      })
      // カーソルベースページング: 1 ページで全ユーザー（3 件）を返し、
      // NOTIFICATION_BATCH_SIZE 未満なのでループ終了する。
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
        { id: 'user-3' },
      ])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: '重要なお知らせ',
        content: '全ユーザーへの通知',
        type: 'notification',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.findMany).toHaveBeenCalled()
      // createNotificationsBulk 経由で createMany を呼び、skipDuplicates=true が付与される
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'user-1', type: 'system' }),
          expect.objectContaining({ userId: 'user-2', type: 'system' }),
          expect.objectContaining({ userId: 'user-3', type: 'system' }),
        ]),
        skipDuplicates: true,
      })
    })

    it('bothタイプのお知らせを作成し全ユーザーに通知する', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue({
        ...mockAnnouncement,
        type: 'both',
      })
      mockPrisma.user.count.mockResolvedValue(99)
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: '両方タイプ',
        content: 'バナーと通知の両方',
        type: 'both',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.createMany).toHaveBeenCalled()
    })

    it('notificationタイプでユーザーが0人の場合は通知を作成しない', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue({
        ...mockAnnouncement,
        type: 'notification',
      })
      mockPrisma.user.count.mockResolvedValue(0)
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: '通知テスト',
        content: 'ユーザーなし',
        type: 'notification',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('endsAt付きのお知らせを作成する', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue(mockAnnouncement)
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: '期限付きお知らせ',
        content: '内容',
        type: 'banner',
        startsAt: '2025-01-01T00:00:00Z',
        endsAt: '2025-12-31T23:59:59Z',
      })

      expect(result).toEqual({ success: true })
      expect((mockPrisma as Record<string, any>).announcement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          endsAt: new Date('2025-12-31T23:59:59Z'),
        }),
      })
    })

    it('endsAtなしの場合はnullが設定される', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue(mockAnnouncement)
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      await createAnnouncement({
        title: '期限なし',
        content: '内容',
        type: 'banner',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect((mockPrisma as Record<string, any>).announcement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          endsAt: null,
        }),
      })
    })

    it('管理者ログが作成される', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue(mockAnnouncement)
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      await createAnnouncement({
        title: 'ログテスト',
        content: '内容',
        type: 'banner',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect(mockPrisma.adminLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminId: mockUser.id,
          action: 'create_announcement',
          targetType: 'announcement',
          targetId: mockAnnouncement.id,
        }),
      })
    })
  })

  // ============================================================
  // updateAnnouncement
  // ============================================================

  describe('updateAnnouncement', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { updateAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await updateAnnouncement('announcement-1', { title: '更新' })
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('存在しないお知らせの場合はエラーを返す', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findUnique.mockResolvedValue(null)

      const { updateAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await updateAnnouncement('non-existent', { title: '更新' })
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('タイトルを更新する', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findUnique.mockResolvedValue(mockAnnouncement)
      ;(mockPrisma as Record<string, any>).announcement.update.mockResolvedValue({
        ...mockAnnouncement,
        title: '更新後のタイトル',
      })

      const { updateAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await updateAnnouncement('announcement-1', { title: '更新後のタイトル' })

      expect(result).toEqual({ success: true })
      expect((mockPrisma as Record<string, any>).announcement.update).toHaveBeenCalledWith({
        where: { id: 'announcement-1' },
        data: expect.objectContaining({
          title: '更新後のタイトル',
        }),
      })
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/announcements')
    })

    it('isActiveを切り替える', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findUnique.mockResolvedValue(mockAnnouncement)
      ;(mockPrisma as Record<string, any>).announcement.update.mockResolvedValue({
        ...mockAnnouncement,
        isActive: false,
      })

      const { updateAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await updateAnnouncement('announcement-1', { isActive: false })

      expect(result).toEqual({ success: true })
      expect((mockPrisma as Record<string, any>).announcement.update).toHaveBeenCalledWith({
        where: { id: 'announcement-1' },
        data: expect.objectContaining({
          isActive: false,
        }),
      })
    })

    it('日付を更新する', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findUnique.mockResolvedValue(mockAnnouncement)
      ;(mockPrisma as Record<string, any>).announcement.update.mockResolvedValue(mockAnnouncement)

      const { updateAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await updateAnnouncement('announcement-1', {
        startsAt: '2025-06-01T00:00:00Z',
        endsAt: '2025-12-31T23:59:59Z',
      })

      expect(result).toEqual({ success: true })
      expect((mockPrisma as Record<string, any>).announcement.update).toHaveBeenCalledWith({
        where: { id: 'announcement-1' },
        data: expect.objectContaining({
          startsAt: new Date('2025-06-01T00:00:00Z'),
          endsAt: new Date('2025-12-31T23:59:59Z'),
        }),
      })
    })

    it('endsAtをnullに設定する', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findUnique.mockResolvedValue({
        ...mockAnnouncement,
        endsAt: new Date('2025-12-31'),
      })
      ;(mockPrisma as Record<string, any>).announcement.update.mockResolvedValue(mockAnnouncement)

      const { updateAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await updateAnnouncement('announcement-1', { endsAt: null })

      expect(result).toEqual({ success: true })
      expect((mockPrisma as Record<string, any>).announcement.update).toHaveBeenCalledWith({
        where: { id: 'announcement-1' },
        data: expect.objectContaining({
          endsAt: null,
        }),
      })
    })

    it('コンテンツとタイプを同時に更新する', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findUnique.mockResolvedValue(mockAnnouncement)
      ;(mockPrisma as Record<string, any>).announcement.update.mockResolvedValue(mockAnnouncement)

      const { updateAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await updateAnnouncement('announcement-1', {
        content: '更新された内容',
        type: 'notification',
      })

      expect(result).toEqual({ success: true })
      expect((mockPrisma as Record<string, any>).announcement.update).toHaveBeenCalledWith({
        where: { id: 'announcement-1' },
        data: expect.objectContaining({
          content: '更新された内容',
          type: 'notification',
        }),
      })
    })
  })

  // ============================================================
  // deleteAnnouncement
  // ============================================================

  describe('deleteAnnouncement', () => {
    it('未認証の場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)
      const { deleteAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await deleteAnnouncement('announcement-1')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('存在しないお知らせの場合はエラーを返す', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findUnique.mockResolvedValue(null)

      const { deleteAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await deleteAnnouncement('non-existent')
      expect(result).toMatchObject({ success: false, error: expect.any(String) })
    })

    it('お知らせを削除し監査ログを作成する', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findUnique.mockResolvedValue(mockAnnouncement)
      ;(mockPrisma as Record<string, any>).announcement.delete.mockResolvedValue(mockAnnouncement)
      mockPrisma.adminLog.create.mockResolvedValue({})
      mockTransaction.mockResolvedValue([mockAnnouncement, {}])

      const { deleteAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await deleteAnnouncement('announcement-1')

      expect(result).toEqual({ success: true })
      expect(mockTransaction).toHaveBeenCalled()
      expect(mockRevalidatePath).toHaveBeenCalledWith('/admin/announcements')
    })
  })

  // ============================================================
  // getActiveAnnouncements
  // ============================================================

  describe('getActiveAnnouncements', () => {
    it('現在有効なお知らせを返す（管理者チェックなし）', async () => {
      // 認証不要の公開関数なので、認証をリセットしてもOK
      mockAuth.mockResolvedValue(null)
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([mockAnnouncement])

      const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
      const result = await getActiveAnnouncements()

      expect(result).toEqual([mockAnnouncement])
      expect((mockPrisma as Record<string, any>).announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            startsAt: expect.objectContaining({ lte: expect.any(Date) }),
            OR: [
              { endsAt: null },
              { endsAt: expect.objectContaining({ gt: expect.any(Date) }) },
            ],
          }),
          orderBy: { startsAt: 'desc' },
          take: 5,
        })
      )
    })

    it('空配列を返す（有効なお知らせなし）', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([])

      const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
      const result = await getActiveAnnouncements()

      expect(result).toEqual([])
    })

    it('endsAtがnullのお知らせも含まれる', async () => {
      const announcementNoEnd = { ...mockAnnouncement, endsAt: null }
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([announcementNoEnd])

      const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
      const result = await getActiveAnnouncements()

      expect(result).toHaveLength(1)
      expect(result[0].endsAt).toBeNull()
    })

    it('最大5件まで取得する', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([])

      const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
      await getActiveAnnouncements()

      expect((mockPrisma as Record<string, any>).announcement.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 })
      )
    })
  })

  // ============================================================
  // 品質向上テスト: 通知配信・フィルタロジック・エッジケース
  // ============================================================

  describe('createAnnouncement - 通知配信の詳細検証', () => {
    it('notificationタイプで通知の type=system / actorId が管理者になる', async () => {
      // 旧テストは存在しない `message` カラムを期待していたため、実スキーマに合わせて検証内容を修正。
      // お知らせ本文は Announcement テーブルから取得する設計のため、Notification 行には保持しない。
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue({
        ...mockAnnouncement,
        type: 'notification',
      })
      mockPrisma.user.count.mockResolvedValue(99)
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      await createAnnouncement({
        title: '  前後に空白あり  ',
        content: '内容',
        type: 'notification',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ userId: 'user-1', type: 'system', actorId: mockUser.id }),
          expect.objectContaining({ userId: 'user-2', type: 'system', actorId: mockUser.id }),
        ]),
        skipDuplicates: true,
      })
    })

    it('notificationタイプで通知のtypeがsystemである', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue({
        ...mockAnnouncement,
        type: 'notification',
      })
      mockPrisma.user.count.mockResolvedValue(99)
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      await createAnnouncement({
        title: 'テスト',
        content: '内容',
        type: 'notification',
        startsAt: '2025-01-01T00:00:00Z',
      })

      const callData = mockPrisma.notification.createMany.mock.calls[0][0].data
      expect(callData).toHaveLength(1)
      expect(callData[0].type).toBe('system')
      expect(callData[0].actorId).toBe(mockUser.id)
    })

    it('bannerタイプではuser.findManyも呼ばれない', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue(mockAnnouncement)
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      await createAnnouncement({
        title: 'バナーのみ',
        content: '内容',
        type: 'banner',
        startsAt: '2025-01-01T00:00:00Z',
      })

      // bannerタイプではユーザー取得自体が不要
      expect(mockPrisma.user.findMany).not.toHaveBeenCalled()
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('bothタイプで全ユーザーに通知が配信される', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue({
        ...mockAnnouncement,
        type: 'both',
      })
      mockPrisma.user.count.mockResolvedValue(4)
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-a' },
        { id: 'user-b' },
        { id: 'user-c' },
        { id: 'user-d' },
      ])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 4 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: '両方タイプ通知確認',
        content: '内容',
        type: 'both',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect(result).toEqual({ success: true })
      const callData = mockPrisma.notification.createMany.mock.calls[0][0].data
      expect(callData).toHaveLength(4)
      const userIds = callData.map((d: any) => d.userId)
      expect(userIds).toEqual(['user-a', 'user-b', 'user-c', 'user-d'])
    })
  })

  describe('getActiveAnnouncements - フィルタロジックの詳細検証', () => {
    it('startsAtがnowより後のお知らせは含まれない（whereのlte条件）', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([])

      const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
      await getActiveAnnouncements()

      const callArgs = (mockPrisma as Record<string, any>).announcement.findMany.mock.calls[0][0]
      // startsAt lte now が設定されていることを確認
      expect(callArgs.where.startsAt.lte).toBeInstanceOf(Date)
      // endsAt の OR 条件が正しく構成されている
      expect(callArgs.where.OR).toEqual([
        { endsAt: null },
        { endsAt: { gt: expect.any(Date) } },
      ])
    })

    it('isActive: falseのお知らせはフィルタされる（where条件にisActive: trueが含まれる）', async () => {
      ;(mockPrisma as Record<string, any>).announcement.findMany.mockResolvedValue([])

      const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
      await getActiveAnnouncements()

      const callArgs = (mockPrisma as Record<string, any>).announcement.findMany.mock.calls[0][0]
      expect(callArgs.where.isActive).toBe(true)
    })
  })

  describe('createAnnouncement - エッジケース', () => {
    it('ユーザー0人でnotificationタイプの場合、notification.createManyは呼ばれない', async () => {
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue({
        ...mockAnnouncement,
        type: 'notification',
      })
      // カーソルベースページング: 初回 findMany が空配列なら即ループ終了
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: 'ユーザー0人テスト',
        content: '内容',
        type: 'notification',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect(result).toEqual({ success: true })
      // user.findMany が初回に空配列を返したため createMany は呼ばれない
      expect(mockPrisma.user.findMany).toHaveBeenCalled()
      expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
    })

    it('非常に長いtitleでもエラーにならず作成できる', async () => {
      const longTitle = 'あ'.repeat(200)
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue({
        ...mockAnnouncement,
        title: longTitle,
      })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      const result = await createAnnouncement({
        title: longTitle,
        content: 'い'.repeat(5000),
        type: 'banner',
        startsAt: '2025-01-01T00:00:00Z',
      })

      expect(result).toEqual({ success: true })
      expect((mockPrisma as Record<string, any>).announcement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: longTitle,
          content: 'い'.repeat(5000),
        }),
      })
    })

    it('notificationタイプでtitleの前後空白がtrimされる（Announcement本体）', async () => {
      // 旧テストは存在しない `message` カラムを Notification に書き込む期待があったため、
      // 実スキーマに合わせて Announcement 本体の trim 検証のみに変更。
      ;(mockPrisma as Record<string, any>).announcement.create.mockResolvedValue({
        ...mockAnnouncement,
        type: 'notification',
      })
      mockPrisma.user.count.mockResolvedValue(99)
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }])
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 })
      mockPrisma.adminLog.create.mockResolvedValue({})

      const { createAnnouncement } = await import('@/lib/actions/admin/announcements')
      await createAnnouncement({
        title: '  trim確認  ',
        content: '内容',
        type: 'notification',
        startsAt: '2025-01-01T00:00:00Z',
      })

      // お知らせ本体のtitleもtrimされる
      expect((mockPrisma as Record<string, any>).announcement.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ title: 'trim確認' }),
      })
    })
  })
})
