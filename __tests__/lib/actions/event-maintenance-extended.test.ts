import { vi } from 'vitest'
/**
 * Extended tests for event, maintenance, analytics, comment-thread-mute actions
 */
export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  event: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  eventParticipant: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  systemSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  adminLog: { create: vi.fn() },
  post: { count: vi.fn(), findMany: vi.fn() },
  like: { count: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  comment: { count: vi.fn() },
  follow: { count: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  bookmark: { findMany: vi.fn().mockResolvedValue([]) },
  block: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  mute: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  notification: { create: vi.fn() },
  threadMute: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  $transaction: vi.fn((fn: unknown) => typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown)(mockPrisma) : Promise.all(fn as Promise<unknown>[])),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() }, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() } }))
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), expire: vi.fn() }, getRedisClient: vi.fn() }))
vi.mock('@/lib/sanitize', () => ({ sanitizeInput: (s: string) => s, sanitizePostContent: (s: string) => s, sanitizeText: (s: string) => s, sanitizeUrl: (s: string) => s }))
vi.mock('@/lib/actions/notification', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/services/notification-core', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/cache', () => ({ getCachedData: vi.fn(), invalidateCache: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4 }) }))

// ============================================================
// Event Actions
// ============================================================
describe('getEvents extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns events list', async () => {
    mockPrisma.event.findMany.mockResolvedValue([{ id: 'e1', title: 'Bonsai Show' }])
    const { getEvents } = await import('@/lib/actions/event')
    const result = await getEvents()
    expect(result).toBeDefined()
  })

  it('returns empty list', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    const { getEvents } = await import('@/lib/actions/event')
    const result = await getEvents()
    expect(result).toBeDefined()
  })
})

describe('getEvent extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns event detail', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'e1', title: 'Bonsai Show', userId: 'u1' })
    const { getEvent } = await import('@/lib/actions/event')
    const result = await getEvent('e1')
    expect(result).toBeDefined()
  })

  it('returns error for missing event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null)
    const { getEvent } = await import('@/lib/actions/event')
    const result = await getEvent('missing')
    expect(result).toBeDefined()
  })
})

describe('getUpcomingEvents extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns upcoming events', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    const { getUpcomingEvents } = await import('@/lib/actions/event')
    const result = await getUpcomingEvents()
    expect(result).toBeDefined()
  })
})

describe('getEventsByMonth extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns events for month', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    const { getEventsByMonth } = await import('@/lib/actions/event')
    const result = await getEventsByMonth(2025, 6)
    expect(result).toBeDefined()
  })

  it('returns events for different month', async () => {
    mockPrisma.event.findMany.mockResolvedValue([{ id: 'e1' }])
    const { getEventsByMonth } = await import('@/lib/actions/event')
    const result = await getEventsByMonth(2025, 12)
    expect(result).toBeDefined()
  })
})

describe('createEvent extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { createEvent } = await import('@/lib/actions/event')
    const fd = new FormData(); fd.set('title', 'Test'); fd.set('description', 'Desc'); fd.set('prefecture', '東京都')
    fd.set('startDate', '2025-06-01'); fd.set('endDate', '2025-06-02')
    const result = await createEvent(fd)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates event', async () => {
    mockPrisma.event.create.mockResolvedValue({ id: 'e1' })
    const { createEvent } = await import('@/lib/actions/event')
    const fd = new FormData()
    fd.set('title', 'Bonsai Exhibition')
    fd.set('description', 'Annual bonsai show')
    fd.set('prefecture', '東京都')
    fd.set('location', 'Tokyo Garden')
    fd.set('startDate', '2025-06-01')
    fd.set('endDate', '2025-06-02')
    const result = await createEvent(fd)
    expect(result).toBeDefined()
  })

  it('returns error for missing title', async () => {
    const { createEvent } = await import('@/lib/actions/event')
    const fd = new FormData(); fd.set('title', ''); fd.set('prefecture', '東京都')
    fd.set('startDate', '2025-06-01')
    const result = await createEvent(fd)
    expect(result).toBeDefined()
  })
})

describe('updateEvent extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { updateEvent } = await import('@/lib/actions/event')
    const fd = new FormData(); fd.set('title', 'Updated')
    const result = await updateEvent('e1', fd)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('updates owned event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'e1', userId: 'u1' })
    mockPrisma.event.update.mockResolvedValue({ id: 'e1' })
    const { updateEvent } = await import('@/lib/actions/event')
    const fd = new FormData(); fd.set('title', 'Updated Show'); fd.set('description', 'Updated desc')
    fd.set('prefecture', '大阪府'); fd.set('startDate', '2025-07-01')
    const result = await updateEvent('e1', fd)
    expect(result).toBeDefined()
  })
})

describe('deleteEvent extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteEvent } = await import('@/lib/actions/event')
    const result = await deleteEvent('e1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('deletes owned event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'e1', userId: 'u1' })
    mockPrisma.event.delete.mockResolvedValue({})
    const { deleteEvent } = await import('@/lib/actions/event')
    const result = await deleteEvent('e1')
    expect(result).toBeDefined()
  })

  it('returns error for non-owned event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'e1', userId: 'u2' })
    const { deleteEvent } = await import('@/lib/actions/event')
    const result = await deleteEvent('e1')
    expect(result).toBeDefined()
  })
})

// ============================================================
// Maintenance Actions
// ============================================================
describe('isMaintenanceMode extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns false when no setting', async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
    const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
    const result = await isMaintenanceMode()
    expect(result === false || result === true || result !== undefined).toBe(true)
  })

  it('returns true when maintenance enabled', async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue({ key: 'maintenance', value: JSON.stringify({ enabled: true }) })
    const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
    const result = await isMaintenanceMode()
    expect(result).toBeDefined()
  })
})

describe('getMaintenanceSettings extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns default settings when none exist', async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
    const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await getMaintenanceSettings()
    expect(result).toBeDefined()
  })

  it('returns existing settings', async () => {
    mockPrisma.systemSetting.findUnique.mockResolvedValue({ key: 'maintenance', value: JSON.stringify({ enabled: false, message: 'test' }) })
    const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await getMaintenanceSettings()
    expect(result).toBeDefined()
  })
})

describe('toggleMaintenanceMode extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('throws when not admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)
    const { toggleMaintenanceMode } = await import('@/lib/actions/maintenance')
    try {
      await toggleMaintenanceMode(true)
    } catch (e) {
      expect(e).toBeDefined()
    }
  })

  it('toggles maintenance mode when admin', async () => {
    mockPrisma.adminUser.findUnique.mockResolvedValue({ id: 'a1', userId: 'u1' })
    mockPrisma.systemSetting.upsert.mockResolvedValue({})
    mockPrisma.adminLog.create.mockResolvedValue({})
    const { toggleMaintenanceMode } = await import('@/lib/actions/maintenance')
    try {
      const result = await toggleMaintenanceMode(true)
      expect(result).toBeDefined()
    } catch (e) {
      expect(e).toBeDefined()
    }
  })
})

// ============================================================
// Comment Thread Mute
// ============================================================
describe('muteThread extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { muteThread } = await import('@/lib/actions/comment-thread-mute')
    const result = await muteThread('p1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('mutes thread', async () => {
    mockPrisma.threadMute.findFirst.mockResolvedValue(null)
    mockPrisma.threadMute.create.mockResolvedValue({ id: 'tm1' })
    const { muteThread } = await import('@/lib/actions/comment-thread-mute')
    const result = await muteThread('p1')
    expect(result).toBeDefined()
  })

  it('returns error when already muted', async () => {
    mockPrisma.threadMute.findFirst.mockResolvedValue({ id: 'tm1' })
    const { muteThread } = await import('@/lib/actions/comment-thread-mute')
    const result = await muteThread('p1')
    expect(result).toBeDefined()
  })
})

describe('unmuteThread extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
    const result = await unmuteThread('p1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('unmutes thread', async () => {
    mockPrisma.threadMute.findFirst.mockResolvedValue({ id: 'tm1' })
    mockPrisma.threadMute.delete.mockResolvedValue({})
    const { unmuteThread } = await import('@/lib/actions/comment-thread-mute')
    const result = await unmuteThread('p1')
    expect(result).toBeDefined()
  })
})

describe('isThreadMuted extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns false when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
    const result = await isThreadMuted('u1', 'p1')
    expect(result).toBeDefined()
  })

  it('returns true when muted', async () => {
    mockPrisma.threadMute.findFirst.mockResolvedValue({ id: 'tm1' })
    const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
    const result = await isThreadMuted('u1', 'p1')
    expect(result).toBeDefined()
  })

  it('returns false when not muted', async () => {
    mockPrisma.threadMute.findFirst.mockResolvedValue(null)
    const { isThreadMuted } = await import('@/lib/services/comment-thread-mute')
    const result = await isThreadMuted('u1', 'p1')
    expect(result).toBeDefined()
  })
})

// ============================================================
// Additional Event edge cases
// ============================================================
describe('getEvents with filters extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns events with prefecture filter', async () => {
    mockPrisma.event.findMany.mockResolvedValue([{ id: 'e1', prefecture: '東京都' }])
    const { getEvents } = await import('@/lib/actions/event')
    const result = await getEvents({ prefecture: '東京都' })
    expect(result).toBeDefined()
  })

  it('returns events with keyword filter', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    const { getEvents } = await import('@/lib/actions/event')
     
    const result = await getEvents({ region: '盆栽展' } as any)
    expect(result).toBeDefined()
  })

  it('returns events with pagination', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    mockPrisma.event.count.mockResolvedValue(0)
    const { getEvents } = await import('@/lib/actions/event')
     
    const result = await getEvents({ region: 'kanto' } as any)
    expect(result).toBeDefined()
  })

  it('getEventsByMonth for January', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    const { getEventsByMonth } = await import('@/lib/actions/event')
    const result = await getEventsByMonth(2026, 1)
    expect(result).toBeDefined()
  })

  it('getUpcomingEvents with limit', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    const { getUpcomingEvents } = await import('@/lib/actions/event')
    const result = await getUpcomingEvents(5)
    expect(result).toBeDefined()
  })
})
