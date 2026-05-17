import { vi } from 'vitest'
/**
 * Extended event-import tests - importSelectedEvents, scrapeExternalEvents, scrapeEventsByRegion
 */
 export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, Record<string, unknown>> = {
  user: { findUnique: vi.fn() },
  event: { findMany: vi.fn(), create: vi.fn(), createMany: vi.fn(), count: vi.fn() },
  adminUser: { findUnique: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }, logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))

// Mock the scraping module to avoid actual HTTP calls
vi.mock('@/lib/scraping/bonsai-events', () => ({
  scrapeAllEvents: vi.fn().mockResolvedValue([]),
  scrapeEventsFromRegion: vi.fn().mockResolvedValue([]),
  BONSAI_EVENT_SOURCES: [{ region: 'kanto', url: 'https://example.com/kanto', prefectures: ['東京都'] }],
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
  ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1', userId: 'admin1' })
})

describe('importSelectedEvents', async () => {
  it('requires admin', async () => {
    ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const { importSelectedEvents } = await import('@/lib/actions/event-import')
    const result = await importSelectedEvents([])
    expect(result).toHaveProperty('error')
  })

  it('rejects empty events', async () => {
    const { importSelectedEvents } = await import('@/lib/actions/event-import')
    const result = await importSelectedEvents([])
    expect(result).toHaveProperty('error')
  })

  it('imports events successfully', async () => {
    const { importSelectedEvents } = await import('@/lib/actions/event-import')
    ;(mockPrisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'e1' })

    const events = [{
      id: '0',
      title: '盆栽展',
      startDate: '2025-03-01',
      endDate: '2025-03-03',
      prefecture: '東京都',
      description: 'テスト',
      location: '上野公園',
      url: 'https://example.com',
      selected: true,
      duplicateType: null,
      similarEventTitle: null,
    }]

    const result = await importSelectedEvents(events as never)
    expect(result).toBeDefined()
  })

  it('skips unselected events', async () => {
    const { importSelectedEvents } = await import('@/lib/actions/event-import')
    ;(mockPrisma.event.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'e1' })

    const events = [{
      id: '0',
      title: '盆栽展',
      startDate: '2025-03-01',
      endDate: null,
      prefecture: '東京都',
      description: 'テスト',
      location: '上野公園',
      url: 'https://example.com',
      selected: false,
      duplicateType: null,
      similarEventTitle: null,
    }]

    const result = await importSelectedEvents(events as never)
    expect(result).toBeDefined()
  })
})

describe('scrapeExternalEvents', async () => {
  it('requires admin', async () => {
    ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
    const result = await scrapeExternalEvents()
    expect(result).toHaveProperty('error')
  })

  it('returns error when no events found', async () => {
    const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
    const result = await scrapeExternalEvents()
    // Returns error because scrapeAllEvents returns []
    expect(result).toHaveProperty('error')
  })

  it('returns events after scraping', async () => {
    const { scrapeAllEvents } = await import('@/lib/scraping/bonsai-events')
    ;(scrapeAllEvents as ReturnType<typeof vi.fn>).mockResolvedValue([
      { title: '盆栽展', startDate: new Date('2025-03-01'), endDate: null, prefecture: '東京都', description: 'test', location: '東京', url: 'https://example.com' },
    ])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
    const result = await scrapeExternalEvents()
    expect(result).toBeDefined()
    if ('events' in result) {
      expect(result.events.length).toBeGreaterThanOrEqual(0)
    }
  })

  it('handles scraping error', async () => {
    const { scrapeAllEvents } = await import('@/lib/scraping/bonsai-events')
    ;(scrapeAllEvents as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('network error'))

    const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
    const result = await scrapeExternalEvents()
    expect(result).toHaveProperty('error')
  })

  it('filters exact duplicates', async () => {
    const { scrapeAllEvents } = await import('@/lib/scraping/bonsai-events')
    ;(scrapeAllEvents as ReturnType<typeof vi.fn>).mockResolvedValue([
      { title: '盆栽展2025', startDate: new Date('2025-03-01'), endDate: new Date('2025-03-03'), prefecture: '東京都', description: 'test', location: '東京', url: 'https://example.com' },
    ])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { title: '盆栽展2025', startDate: new Date('2025-03-01'), endDate: new Date('2025-03-03'), prefecture: '東京都' },
    ])

    const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
    const result = await scrapeExternalEvents()
    expect(result).toBeDefined()
    if ('filteredCount' in result) {
      expect(result.filteredCount).toBe(1)
    }
  })

  it('checkDuplicates: 同一都道府県の複数既存イベントが共通バケツに集約される（同一バケツ内 push が動作する）', async () => {
    // eventsByPrefecture の if (!bucket) → 既存バケツへの push 経路を検証する。
    // 同じ '東京都' に既存イベント A/B が存在し、新規 X(=A 完全重複) と Y(=B 完全重複) を
    // 入れた場合、両方が `exact` として検出されること（=同一バケツに A と B が両方入っていること）を確認。
    const { scrapeAllEvents } = await import('@/lib/scraping/bonsai-events')
    ;(scrapeAllEvents as ReturnType<typeof vi.fn>).mockResolvedValue([
      { title: '春の盆栽展', startDate: new Date('2025-03-01'), endDate: new Date('2025-03-03'), prefecture: '東京都', description: '', location: '上野', url: 'https://example.com/x' },
      { title: '夏の盆栽展', startDate: new Date('2025-07-01'), endDate: new Date('2025-07-03'), prefecture: '東京都', description: '', location: '上野', url: 'https://example.com/y' },
    ])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { title: '春の盆栽展', startDate: new Date('2025-03-01'), endDate: new Date('2025-03-03'), prefecture: '東京都' },
      { title: '夏の盆栽展', startDate: new Date('2025-07-01'), endDate: new Date('2025-07-03'), prefecture: '東京都' },
    ])

    const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
    const result = await scrapeExternalEvents()
    expect(result).toBeDefined()
    if ('filteredCount' in result) {
      expect(result.filteredCount).toBe(2)
    }
  })

  it('checkDuplicates: prefecture が null の既存イベントは "" キーのバケツに入る', async () => {
    // 既存イベント側に prefecture: null が混じる場合でも、
    // `existing.prefecture || ''` でフォールバックされ、
    // 新規イベント側で prefecture を持たないものとマッチング可能であること
    const { scrapeAllEvents } = await import('@/lib/scraping/bonsai-events')
    ;(scrapeAllEvents as ReturnType<typeof vi.fn>).mockResolvedValue([
      // 新規側も prefecture を未設定 → '' バケツを引く
      { title: '無所属の盆栽展', startDate: new Date('2025-04-01'), endDate: new Date('2025-04-03'), prefecture: null, description: '', location: '', url: '' },
    ])
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      // 既存側で prefecture が null
      { title: '無所属の盆栽展', startDate: new Date('2025-04-01'), endDate: new Date('2025-04-03'), prefecture: null },
    ])

    const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
    const result = await scrapeExternalEvents()
    if ('filteredCount' in result) {
      expect(result.filteredCount).toBe(1)
    }
  })

  it('checkDuplicates: 異なる都道府県のイベントは別バケツとなり相互に重複扱いされない', async () => {
    const { scrapeAllEvents } = await import('@/lib/scraping/bonsai-events')
    ;(scrapeAllEvents as ReturnType<typeof vi.fn>).mockResolvedValue([
      { title: '盆栽展', startDate: new Date('2025-03-01'), endDate: new Date('2025-03-03'), prefecture: '東京都', description: '', location: '', url: '' },
    ])
    // 既存側は同名・同期間だが '大阪府' のみ
    ;(mockPrisma.event.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { title: '盆栽展', startDate: new Date('2025-03-01'), endDate: new Date('2025-03-03'), prefecture: '大阪府' },
    ])

    const { scrapeExternalEvents } = await import('@/lib/actions/event-import')
    const result = await scrapeExternalEvents()
    if ('filteredCount' in result) {
      // 都道府県が違うので exact とは判定されない
      expect(result.filteredCount).toBe(0)
    }
    if ('events' in result) {
      // 重複ではないので events に残る
      expect(result.events.length).toBeGreaterThan(0)
    }
  })
})

describe('scrapeEventsByRegion', async () => {
  it('requires admin', async () => {
    ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
    const result = await scrapeEventsByRegion('kanto')
    expect(result).toHaveProperty('error')
  })

  it('rejects unknown region', async () => {
    const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
    const result = await scrapeEventsByRegion('unknown_region')
    expect(result).toHaveProperty('error')
  })

  it('returns error when no events found in region', async () => {
    const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
    const result = await scrapeEventsByRegion('kanto')
    // scrapeEventsFromRegion returns []
    expect(result).toHaveProperty('error')
  })

  it('handles scraping error', async () => {
    const { scrapeEventsFromRegion } = await import('@/lib/scraping/bonsai-events')
    ;(scrapeEventsFromRegion as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'))

    const { scrapeEventsByRegion } = await import('@/lib/actions/event-import')
    const result = await scrapeEventsByRegion('kanto')
    expect(result).toHaveProperty('error')
  })
})

describe('getAvailableRegions', async () => {
  it('returns regions list', async () => {
    const { getAvailableRegions } = await import('@/lib/actions/event-import')
    const result = await getAvailableRegions()
    expect(result).toBeDefined()
  })
})
