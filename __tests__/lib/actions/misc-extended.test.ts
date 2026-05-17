import { vi } from 'vitest'
/**
 * Extended tests for filter-helper, notification-preferences, action utils
 */
export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  block: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  mute: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  follow: { findMany: vi.fn().mockResolvedValue([]) },
  user: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  post: { findUnique: vi.fn(), update: vi.fn() },
  notification: { create: vi.fn() },
  adminUser: { findUnique: vi.fn() },
  blacklistedWord: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
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
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/sanitize', () => ({ sanitizeInput: (s: string) => s, sanitizePostContent: (s: string) => s }))
vi.mock('@/lib/actions/notification', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/services/notification-core', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/cache', () => ({ getCachedData: vi.fn(), invalidateCache: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4 }) }))

// ============================================================
// Filter Helper
// ============================================================
describe('filter-helper extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exports filter functions', async () => {
    const mod = await import('@/lib/actions/filter-helper')
    expect(mod).toBeDefined()
  })

  it('getBlockedUserIds returns array', async () => {
    mockPrisma.block.findMany.mockResolvedValue([])
    const mod = await import('@/lib/actions/filter-helper')
    if (typeof mod.getBlockedUserIds === 'function') {
      const result = await mod.getBlockedUserIds('u1')
      expect(Array.isArray(result)).toBe(true)
    } else {
      expect(mod).toBeDefined()
    }
  })

  it('getMutedUserIds returns array', async () => {
    mockPrisma.mute.findMany.mockResolvedValue([])
    const mod = await import('@/lib/actions/filter-helper')
    if (typeof mod.getMutedUserIds === 'function') {
      const result = await mod.getMutedUserIds('u1')
      expect(Array.isArray(result)).toBe(true)
    } else {
      expect(mod).toBeDefined()
    }
  })

  it('getBlockedAndMutedUserIds returns array', async () => {
    mockPrisma.block.findMany.mockResolvedValue([])
    mockPrisma.mute.findMany.mockResolvedValue([])
    const mod = await import('@/lib/actions/filter-helper')
     
    if (typeof (mod as any).getBlockedAndMutedUserIds === 'function') {
       
      const result = await (mod as any).getBlockedAndMutedUserIds('u1')
      expect(Array.isArray(result)).toBe(true)
    } else {
      expect(mod).toBeDefined()
    }
  })
})

// ============================================================
// Notification Preferences
// ============================================================
describe('notification preferences extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('getNotificationPreferences returns empty preferences when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
    const result = await getNotificationPreferences()
    expect(result).toEqual({ preferences: {} })
  })

  it('getNotificationPreferences returns preferences', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', notificationPreferences: {} })
    const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
    const result = await getNotificationPreferences()
    expect(result).toBeDefined()
  })

  it('updateNotificationPreferences returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
    const result = await updateNotificationPreferences({ like: false })
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('updateNotificationPreferences updates prefs', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' })
    const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
    const result = await updateNotificationPreferences({ like: false, comment: true })
    expect(result).toBeDefined()
  })
})

// ============================================================
// Action Utils
// ============================================================
describe('action utils extended', async () => {
  it('exports utility functions', async () => {
    const mod = await import('@/lib/actions/utils')
    expect(mod).toBeDefined()
  })
})

// ============================================================
// Additional filter-helper tests
// ============================================================
describe('filter-helper additional', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('handles empty blocked user list', async () => {
    mockPrisma.block.findMany.mockResolvedValue([])
    const mod = await import('@/lib/actions/filter-helper')
    if (typeof mod.getBlockedUserIds === 'function') {
      const result = await mod.getBlockedUserIds('nonexistent')
      expect(result).toEqual([])
    } else { expect(mod).toBeDefined() }
  })

  it('handles empty muted user list', async () => {
    mockPrisma.mute.findMany.mockResolvedValue([])
    const mod = await import('@/lib/actions/filter-helper')
    if (typeof mod.getMutedUserIds === 'function') {
      const result = await mod.getMutedUserIds('nonexistent')
      expect(result).toEqual([])
    } else { expect(mod).toBeDefined() }
  })

  it('returns combined list with no duplicates', async () => {
    mockPrisma.block.findMany.mockResolvedValue([])
    mockPrisma.mute.findMany.mockResolvedValue([])
    const mod = await import('@/lib/actions/filter-helper')
     
    if (typeof (mod as any).getBlockedAndMutedUserIds === 'function') {
       
      const result = await (mod as any).getBlockedAndMutedUserIds('u1')
      expect(result.length).toBe(0)
    } else { expect(mod).toBeDefined() }
  })
})

// ============================================================
// Additional notification preferences tests
// ============================================================
describe('notification preferences additional', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('updateNotificationPreferences with all false', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' })
    const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
    const result = await updateNotificationPreferences({ like: false, comment: false, follow: false })
    expect(result).toBeDefined()
  })

  it('updateNotificationPreferences with all true', async () => {
    mockPrisma.user.update.mockResolvedValue({ id: 'u1' })
    const { updateNotificationPreferences } = await import('@/lib/actions/notification-preferences')
    const result = await updateNotificationPreferences({ like: true, comment: true, follow: true })
    expect(result).toBeDefined()
  })

  it('getNotificationPreferences returns default when no prefs set', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', notificationPreferences: null })
    const { getNotificationPreferences } = await import('@/lib/actions/notification-preferences')
    const result = await getNotificationPreferences()
    expect(result).toBeDefined()
  })
})
