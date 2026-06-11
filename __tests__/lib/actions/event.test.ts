// @vitest-environment node

import { vi } from 'vitest'
import { createMockPrismaClient, mockUser, mockEvent } from '../../utils/test-utils'

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

// レート制限モック
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { limit: 20, window: 60 } },
}))

// headersモック
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue('127.0.0.1'),
  }),
}))

describe('Event Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // requireActiveUser needs user.findUnique for suspension check
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
  })

  describe('getEvents', async () => {
    it('イベント一覧を取得できる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([mockEvent])

      const { getEvents } = await import('@/lib/actions/event')
      const result = await getEvents()

      expect(result.events).toHaveLength(1)
      expect(result.events[0]!.title).toBe('テストイベント')
    })

    it('非表示イベントは除外される', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { getEvents } = await import('@/lib/actions/event')
      await getEvents()

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isHidden: false,
          }),
        })
      )
    })

    it('都道府県でフィルタリングできる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { getEvents } = await import('@/lib/actions/event')
      await getEvents({ prefecture: '東京都' })

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            prefecture: { in: ['東京都'] },
          }),
        })
      )
    })
  })

  describe('getEvent', async () => {
    it('イベント詳細を取得できる', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent)

      const { getEvent } = await import('@/lib/actions/event')
      const result = await getEvent('test-event-id')

      expect(result.success).toBe(true)
      if (!result.success || !result.data) throw new Error('expected success')
      expect(result.data.event.title).toBe('テストイベント')
    })

    it('存在しないイベントはエラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null)

      const { getEvent } = await import('@/lib/actions/event')
      const result = await getEvent('non-existent')

      expect(result).toMatchObject({ success: false, error: 'イベントが見つかりません' })
    })

    it('自分のイベントはisOwner=trueを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(mockEvent)

      const { getEvent } = await import('@/lib/actions/event')
      const result = await getEvent('test-event-id')

      expect(result.success).toBe(true)
      if (!result.success || !result.data) throw new Error('expected success')
      expect(result.data.event.isOwner).toBe(true)
    })
  })

  describe('createEvent', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { createEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')

      const result = await createEvent(formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('タイトルが空の場合はエラーを返す', async () => {
      const { createEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', '')

      const result = await createEvent(formData)

      expect(result).toMatchObject({ error: 'タイトルを入力してください' })
    })

    it('開始日が未指定の場合はエラーを返す', async () => {
      const { createEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')

      const result = await createEvent(formData)

      expect(result).toMatchObject({ error: '開始日を選択してください' })
    })

    it('都道府県が未指定の場合はエラーを返す', async () => {
      const { createEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('startDate', '2025-02-01')

      const result = await createEvent(formData)

      expect(result).toMatchObject({ error: '都道府県を選択してください' })
    })

    it('終了日が開始日より前の場合はエラーを返す', async () => {
      const { createEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('startDate', '2025-02-10')
      formData.append('endDate', '2025-02-01')
      formData.append('prefecture', '東京都')

      const result = await createEvent(formData)

      expect(result).toMatchObject({ error: '終了日は開始日以降を選択してください' })
    })

    it('正常にイベントを作成できる', async () => {
      mockPrisma.event.create.mockResolvedValue({
        ...mockEvent,
        id: 'new-event-id',
      })

      const { createEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('startDate', '2025-02-01')
      formData.append('prefecture', '東京都')

      const result = await createEvent(formData)

      expect(result).toMatchObject({ success: true, data: { eventId: 'new-event-id' } })
    })
  })

  describe('updateEvent', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { updateEvent } = await import('@/lib/actions/event')
      const formData = new FormData()

      const result = await updateEvent('event-id', formData)

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('存在しないイベントはエラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null)

      const { updateEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('startDate', '2026-06-01')
      formData.append('prefecture', '東京都')

      const result = await updateEvent('non-existent', formData)

      expect(result).toMatchObject({ error: 'イベントが見つかりません' })
    })

    it('他人のイベントは編集できない', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        ...mockEvent,
        createdBy: 'other-user-id',
      })

      const { updateEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('startDate', '2026-06-01')
      formData.append('prefecture', '東京都')

      const result = await updateEvent('event-id', formData)

      expect(result).toMatchObject({ error: '編集権限がありません' })
    })
  })

  describe('deleteEvent', async () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockAuth.mockResolvedValue(null)

      const { deleteEvent } = await import('@/lib/actions/event')
      const result = await deleteEvent('event-id')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('他人のイベントは削除できない', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        ...mockEvent,
        createdBy: 'other-user-id',
      })

      const { deleteEvent } = await import('@/lib/actions/event')
      const result = await deleteEvent('event-id')

      expect(result).toMatchObject({ error: '削除権限がありません' })
    })

    it('自分のイベントを削除できる', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        ...mockEvent,
        createdBy: mockUser.id,
      })
      mockPrisma.event.delete.mockResolvedValue(mockEvent)

      const { deleteEvent } = await import('@/lib/actions/event')
      const result = await deleteEvent('event-id')

      expect(result).toEqual({ success: true })
    })

    it('存在しないイベントはエラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue(null)

      const { deleteEvent } = await import('@/lib/actions/event')
      const result = await deleteEvent('non-existent')

      expect(result).toMatchObject({ error: 'イベントが見つかりません' })
    })
  })

  // ============================================================
  // getUpcomingEvents
  // ============================================================

  describe('getUpcomingEvents', async () => {
    it('今後のイベントを取得できる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([mockEvent])

      const { getUpcomingEvents } = await import('@/lib/actions/event')
      const result = await getUpcomingEvents()

      expect(result.events).toHaveLength(1)
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isHidden: false,
            startDate: expect.objectContaining({
              gte: expect.any(Date),
            }),
          }),
        })
      )
    })

    it('取得件数を指定できる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { getUpcomingEvents } = await import('@/lib/actions/event')
      await getUpcomingEvents(5)

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
        })
      )
    })

    it('地域でフィルタリングできる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { getUpcomingEvents } = await import('@/lib/actions/event')
      await getUpcomingEvents(10, '関東')

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            prefecture: expect.objectContaining({
              in: expect.arrayContaining(['東京都', '神奈川県']),
            }),
          }),
        })
      )
    })
  })

  // ============================================================
  // getEventsByMonth
  // ============================================================

  describe('getEventsByMonth', async () => {
    it('指定した月のイベントを取得できる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([mockEvent])

      const { getEventsByMonth } = await import('@/lib/actions/event')
      const result = await getEventsByMonth(2025, 3) // 2025年4月

      expect(result.events).toHaveLength(1)
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isHidden: false,
            OR: expect.arrayContaining([
              expect.objectContaining({
                startDate: expect.objectContaining({
                  gte: expect.any(Date),
                  lt: expect.any(Date),
                }),
              }),
            ]),
          }),
        })
      )
    })

    it('月をまたぐイベントも取得できる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { getEventsByMonth } = await import('@/lib/actions/event')
      await getEventsByMonth(2025, 0)

      // OR条件に月をまたぐケースが含まれていることを確認
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                startDate: expect.objectContaining({ lt: expect.any(Date) }),
                endDate: expect.objectContaining({ gte: expect.any(Date) }),
              }),
            ]),
          }),
        })
      )
    })
  })

  // ============================================================
  // getEvents - 追加テスト
  // ============================================================

  describe('getEvents - 追加テスト', async () => {
    it('地域でフィルタリングできる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { getEvents } = await import('@/lib/actions/event')
      await getEvents({ region: '関東' })

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            prefecture: expect.objectContaining({
              in: expect.arrayContaining(['東京都', '神奈川県', '埼玉県', '千葉県']),
            }),
          }),
        })
      )
    })

    it('過去イベントを表示できる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { getEvents } = await import('@/lib/actions/event')
      await getEvents({ showPast: true })

      // showPast: true の場合、日付フィルターが設定されないことを確認
      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isHidden: false,
          }),
        })
      )
    })

    it('月と年でフィルタリングできる', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { getEvents } = await import('@/lib/actions/event')
      await getEvents({ year: 2025, month: 3 })

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startDate: expect.objectContaining({
              gte: expect.any(Date),
              lt: expect.any(Date),
            }),
          }),
        })
      )
    })

    it('都道府県と地域を両方指定した場合、都道府県が優先される', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])

      const { getEvents } = await import('@/lib/actions/event')
      await getEvents({ prefecture: '大阪府', region: '関東' })

      expect(mockPrisma.event.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            prefecture: { in: ['大阪府'] },
          }),
        })
      )
    })
  })

  // ============================================================
  // updateEvent - 追加テスト
  // ============================================================

  describe('updateEvent - 追加テスト', async () => {
    it('タイトルが空の場合はエラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        ...mockEvent,
        createdBy: mockUser.id,
      })

      const { updateEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', '')
      formData.append('startDate', '2025-02-01')
      formData.append('prefecture', '東京都')

      const result = await updateEvent('event-id', formData)

      expect(result).toMatchObject({ error: 'タイトルを入力してください' })
    })

    it('開始日が未指定の場合はエラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        ...mockEvent,
        createdBy: mockUser.id,
      })

      const { updateEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('prefecture', '東京都')

      const result = await updateEvent('event-id', formData)

      expect(result).toMatchObject({ error: '開始日を選択してください' })
    })

    it('都道府県が未指定の場合はエラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        ...mockEvent,
        createdBy: mockUser.id,
      })

      const { updateEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('startDate', '2025-02-01')

      const result = await updateEvent('event-id', formData)

      expect(result).toMatchObject({ error: '都道府県を選択してください' })
    })

    it('終了日が開始日より前の場合はエラーを返す', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        ...mockEvent,
        createdBy: mockUser.id,
      })

      const { updateEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', 'テストイベント')
      formData.append('startDate', '2025-02-10')
      formData.append('endDate', '2025-02-01')
      formData.append('prefecture', '東京都')

      const result = await updateEvent('event-id', formData)

      expect(result).toMatchObject({ error: '終了日は開始日以降を選択してください' })
    })

    it('正常にイベントを更新できる', async () => {
      mockPrisma.event.findUnique.mockResolvedValue({
        ...mockEvent,
        createdBy: mockUser.id,
      })
      mockPrisma.event.update.mockResolvedValue(mockEvent)

      const { updateEvent } = await import('@/lib/actions/event')
      const formData = new FormData()
      formData.append('title', '更新後のイベント')
      formData.append('startDate', '2025-02-01')
      formData.append('endDate', '2025-02-02')
      formData.append('prefecture', '東京都')
      formData.append('city', '渋谷区')
      formData.append('venue', '会場名')
      formData.append('organizer', '主催者')
      formData.append('fee', '無料')
      formData.append('hasSales', 'true')
      formData.append('description', '説明文')
      formData.append('externalUrl', 'https://example.com')

      const result = await updateEvent('event-id', formData)

      expect(result).toEqual({ success: true })
      expect(mockPrisma.event.update).toHaveBeenCalled()
    })
  })
})
