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

// revalidatePathモック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// スクレイピングモック
const mockScrapeAllEvents = vi.fn()
const mockScrapeEventsFromRegion = vi.fn()
vi.mock('@/lib/scraping/bonsai-events', () => ({
  scrapeAllEvents: () => mockScrapeAllEvents(),
  scrapeEventsFromRegion: (...args: unknown[]) => mockScrapeEventsFromRegion(...args),
  BONSAI_EVENT_SOURCES: [
    { region: '関東', url: 'https://www.bonsai.co.jp/event/event_category/kanto/', prefectures: ['東京都'] },
    { region: '近畿', url: 'https://www.bonsai.co.jp/event/event_category/kinki/', prefectures: ['大阪府'] },
  ],
}))

describe('Event Import Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({
      user: { id: mockUser.id },
    })
    // 管理者として認証
    mockPrisma.adminUser.findUnique.mockResolvedValue({ userId: mockUser.id, role: 'admin' })
  })

  describe('scrapeExternalEvents', async () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('管理者権限が必要', async () => {
      mockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result).toMatchObject({ error: '管理者権限が必要です' })
    })

    it('イベントをスクレイピングできる', async () => {
      const mockEvents = [
        {
          title: '盆栽展',
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-03-02'),
          prefecture: '東京都',
          city: null,
          venue: '上野公園',
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: 'テスト',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeAllEvents.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue(null)
      // checkDuplicates用のモック（既存イベントなし）
      mockPrisma.event.findMany.mockResolvedValue([])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.events).toHaveLength(1)
        expect(result.data!.events[0]!.title).toBe('盆栽展')
      }
    })

    it('イベントが見つからない場合はエラー', async () => {
      mockScrapeAllEvents.mockResolvedValue([])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result).toMatchObject({ error: 'イベントが見つかりませんでした' })
    })

    it('スクレイピングエラー時はエラーを返す', async () => {
      mockScrapeAllEvents.mockRejectedValue(new Error('Network error'))

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result).toMatchObject({ error: 'スクレイピング中にエラーが発生しました' })
    })

    it('重複イベントを検出する', async () => {
      const mockEvents = [
        {
          title: '既存の展示会',
          startDate: new Date('2025-03-01'),
          endDate: null,
          prefecture: '東京都',
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeAllEvents.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue({ id: 'existing-event' })
      // checkDuplicates用のモック（類似イベントが存在）
      mockPrisma.event.findMany.mockResolvedValue([
        {
          title: '既存の展示会',
          startDate: new Date('2025-04-01'), // 異なる日付
          endDate: null,
          prefecture: '東京都',
        },
      ])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.events[0]!.isDuplicate).toBe(true)
      }
    })
  })

  describe('scrapeEventsByRegion', async () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
      const result = await scrapeEventsByRegion('関東')

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('指定地方のイベントをスクレイピングできる', async () => {
      const mockEvents = [
        {
          title: '関東盆栽展',
          startDate: new Date('2025-04-01'),
          endDate: null,
          prefecture: '東京都',
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeEventsFromRegion.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue(null)
      // checkDuplicates用のモック（既存イベントなし）
      mockPrisma.event.findMany.mockResolvedValue([])

      const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
      const result = await scrapeEventsByRegion('関東')

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.events).toHaveLength(1)
      }
    })

    it('存在しない地方はエラー', async () => {
      const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
      const result = await scrapeEventsByRegion('存在しない地方')

      expect(result).toMatchObject({ error: '指定された地方が見つかりません' })
    })

    it('イベントが見つからない場合はエラー', async () => {
      mockScrapeEventsFromRegion.mockResolvedValue([])

      const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
      const result = await scrapeEventsByRegion('関東')

      expect(result).toMatchObject({ error: 'イベントが見つかりませんでした' })
    })
  })

  describe('importSelectedEvents', async () => {
    it('認証が必要', async () => {
      mockAuth.mockResolvedValue(null)

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents([])

      expect(result).toMatchObject({ error: '認証が必要です' })
    })

    it('イベントが選択されていない場合はエラー', async () => {
      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents([])

      expect(result).toMatchObject({ error: 'インポートするイベントが選択されていません' })
    })

    it('イベントをインポートできる', async () => {
      // N+1 を避けるため findMany + createMany を使用
      mockPrisma.event.findMany.mockResolvedValue([])
      mockPrisma.event.createMany.mockResolvedValue({ count: 1 })

      const events = [
        {
          id: 'temp-1',
          title: '新しい展示会',
          startDate: '2025-05-01T00:00:00.000Z',
          endDate: '2025-05-02T00:00:00.000Z',
          prefecture: '東京都',
          city: '渋谷区',
          venue: '渋谷ホール',
          organizer: '日本盆栽協会',
          admissionFee: '無料',
          hasSales: true,
          description: '説明文',
          externalUrl: 'https://example.com',
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: false,
          duplicateType: null,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.importedCount).toBe(1)
      }
      expect(mockPrisma.event.createMany).toHaveBeenCalled()
    })

    it('日付がないイベントはスキップ', async () => {
      const events = [
        {
          id: 'temp-1',
          title: '日付なしイベント',
          startDate: null,
          endDate: null,
          prefecture: null,
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: false,
          duplicateType: null,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.importedCount).toBe(0)
      }
      expect(mockPrisma.event.create).not.toHaveBeenCalled()
    })

    it('重複イベントはスキップ', async () => {
      // 既存イベント（title + startDate 一致）を返す。新実装は findMany で一括取得する。
      mockPrisma.event.findMany.mockResolvedValue([
        { title: '既存イベント', startDate: new Date('2025-05-01T00:00:00.000Z') },
      ])
      mockPrisma.event.createMany.mockResolvedValue({ count: 0 })

      const events = [
        {
          id: 'temp-1',
          title: '既存イベント',
          startDate: '2025-05-01T00:00:00.000Z',
          endDate: null,
          prefecture: null,
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: true,
          duplicateType: 'similar' as const,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.importedCount).toBe(0)
      }
      // 既存重複のみの場合は createMany を呼ぶ前に早期リターンするため呼ばれない
      expect(mockPrisma.event.createMany).not.toHaveBeenCalled()
    })

    it('インポートエラー時はエラーを返す', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])
      mockPrisma.event.createMany.mockRejectedValue(new Error('DB error'))

      const events = [
        {
          id: 'temp-1',
          title: 'エラーイベント',
          startDate: '2025-05-01T00:00:00.000Z',
          endDate: null,
          prefecture: null,
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: false,
          duplicateType: null,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect(result).toMatchObject({ error: 'インポート中にエラーが発生しました' })
    })

    it('titleがMAX_EVENT_TITLE_LENGTHを超える場合はZodバリデーションでERR_INVALID_INPUTを返す', async () => {
      const events = [
        {
          id: 'temp-1',
          title: 'あ'.repeat(101),
          startDate: '2025-05-01T00:00:00.000Z',
          endDate: null,
          prefecture: null,
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: false,
          duplicateType: null,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockPrisma.event.createMany).not.toHaveBeenCalled()
    })

    it('型不一致（hasSalesが文字列）の入力はZodバリデーションで弾かれる', async () => {
      const events = [
        {
          id: 'temp-1',
          title: 'テストイベント',
          startDate: '2025-05-01T00:00:00.000Z',
          endDate: null,
          prefecture: null,
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: 'yes' as any,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
          isDuplicate: false,
          duplicateType: null,
        },
      ]

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockPrisma.event.createMany).not.toHaveBeenCalled()
    })

    it('選択イベント数がMAX_IMPORT_EVENTS_COUNTを超える場合はERR_INVALID_INPUTを返す', async () => {
      const makeEvent = (i: number) => ({
        id: `temp-${i}`,
        title: `イベント${i}`,
        startDate: '2025-05-01T00:00:00.000Z',
        endDate: null,
        prefecture: null,
        city: null,
        venue: null,
        organizer: null,
        admissionFee: null,
        hasSales: false,
        description: '',
        externalUrl: null,
        sourceRegion: '関東',
        sourceUrl: 'https://example.com',
        isDuplicate: false,
        duplicateType: null,
      })
      const events = Array.from({ length: 201 }, (_, i) => makeEvent(i))

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect(result).toMatchObject({ error: expect.any(String) })
      expect(mockPrisma.event.createMany).not.toHaveBeenCalled()
    })

    it('選択イベント数がちょうどMAX_IMPORT_EVENTS_COUNTなら成功する（境界値）', async () => {
      mockPrisma.event.findMany.mockResolvedValue([])
      mockPrisma.event.createMany.mockResolvedValue({ count: 200 })

      const makeEvent = (i: number) => ({
        id: `temp-${i}`,
        title: `イベント${i}`,
        startDate: '2025-05-01T00:00:00.000Z',
        endDate: null,
        prefecture: null,
        city: null,
        venue: null,
        organizer: null,
        admissionFee: null,
        hasSales: false,
        description: '',
        externalUrl: null,
        sourceRegion: '関東',
        sourceUrl: 'https://example.com',
        isDuplicate: false,
        duplicateType: null,
      })
      const events = Array.from({ length: 200 }, (_, i) => makeEvent(i))

      const { importSelectedEvents } = await import('@/lib/actions/event-import')
      const result = await importSelectedEvents(events)

      expect(result.success).toBe(true)
    })
  })

  describe('scrapeExternalEvents - 重複チェック詳細', async () => {
    it('startDateがないイベントは重複チェックをスキップする', async () => {
      const mockEvents = [
        {
          title: '日付なし展示会',
          startDate: null,
          endDate: null,
          prefecture: '東京都',
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeAllEvents.mockResolvedValue(mockEvents)
      mockPrisma.event.findMany.mockResolvedValue([])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.events).toHaveLength(1)
        expect(result.data!.events[0]!.isDuplicate).toBe(false)
      }
    })

    it('タイトルが非類似の既存イベントは重複にならない', async () => {
      const mockEvents = [
        {
          title: '新しい盆栽フェア',
          startDate: new Date('2025-06-01'),
          endDate: null,
          prefecture: '東京都',
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeAllEvents.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue(null)
      // 全く異なるタイトルの既存イベント
      mockPrisma.event.findMany.mockResolvedValue([
        {
          title: '陶芸教室のお知らせ',
          startDate: new Date('2025-06-01'),
          endDate: null,
          prefecture: '東京都',
        },
      ])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.events[0]!.isDuplicate).toBe(false)
      }
    })

    it('先頭10文字が一致するタイトルは類似と判定される', async () => {
      const mockEvents = [
        {
          title: '第30回全国盆栽展示会 東京会場',
          startDate: new Date('2025-07-01'),
          endDate: null,
          prefecture: '東京都',
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeAllEvents.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue(null)
      // 先頭10文字が一致する既存イベント（異なる日付）
      mockPrisma.event.findMany.mockResolvedValue([
        {
          title: '第30回全国盆栽展示会 大阪会場',
          startDate: new Date('2025-08-01'),
          endDate: null,
          prefecture: '東京都',
        },
      ])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.events[0]!.isDuplicate).toBe(true)
      }
    })

    it('完全重複イベントはフィルタリングされる', async () => {
      const mockEvents = [
        {
          title: '完全重複展示会',
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-03-02'),
          prefecture: '東京都',
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '関東',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeAllEvents.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue(null)
      // 完全に同じタイトル・日付・都道府県の既存イベント
      mockPrisma.event.findMany.mockResolvedValue([
        {
          title: '完全重複展示会',
          startDate: new Date('2025-03-01'),
          endDate: new Date('2025-03-02'),
          prefecture: '東京都',
        },
      ])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result.success).toBe(true)
      if (result.success) {
        // 完全重複は除外される
        expect(result.data!.events).toHaveLength(0)
        expect(result.data!.filteredCount).toBe(1)
      }
    })

    it('一方が他方を含むタイトルは類似と判定される', async () => {
      const mockEvents = [
        {
          title: '盆栽展',
          startDate: new Date('2025-09-01'),
          endDate: null,
          prefecture: '大阪府',
          city: null,
          venue: null,
          organizer: null,
          admissionFee: null,
          hasSales: false,
          description: '',
          externalUrl: null,
          sourceRegion: '近畿',
          sourceUrl: 'https://example.com',
        },
      ]
      mockScrapeAllEvents.mockResolvedValue(mockEvents)
      mockPrisma.event.findFirst.mockResolvedValue(null)
      // 包含関係のある既存イベント（異なる日付）
      mockPrisma.event.findMany.mockResolvedValue([
        {
          title: '第10回盆栽展覧会',
          startDate: new Date('2025-10-01'),
          endDate: null,
          prefecture: '大阪府',
        },
      ])

      const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
      const result = await scrapeExternalEvents()

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data!.events[0]!.isDuplicate).toBe(true)
      }
    })
  })

  describe('getAvailableRegions', async () => {
    it('利用可能な地方リストを返す', async () => {
      const { getAvailableRegions } = await import('@/lib/actions/event-import')
      const result = await getAvailableRegions()

      expect(result.regions).toHaveLength(2)
      expect(result.regions[0]!.name).toBe('関東')
      expect(result.regions[1]!.name).toBe('近畿')
    })
  })
})
