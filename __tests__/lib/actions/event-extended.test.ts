// @vitest-environment node
import { vi } from 'vitest'
/**
 * Extended event tests
 */

vi.unmock('@/lib/actions/event')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
}))
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
  // requireActiveUser needs user.findUnique for suspension check
  mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
})

describe('getEvents', async () => {
  it('returns events list', async () => {
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Bonsai Exhibition', startDate: new Date(), endDate: new Date(), location: 'Tokyo', organizer: { id: 'u2', nickname: 'Org' }, _count: { participants: 5 } },
    ])
    mockPrisma.event.count.mockResolvedValue(1)

    const { getEvents } = await import('@/lib/actions/event')
    const result = await getEvents()
    expect(result).toHaveProperty('events')
  })

  it('returns events with region filter', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    mockPrisma.event.count.mockResolvedValue(0)

    const { getEvents } = await import('@/lib/actions/event')
    const result = await getEvents({ region: '関東' })
    expect(result).toHaveProperty('events')
  })

  it('returns events with genre filter', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    mockPrisma.event.count.mockResolvedValue(0)

    const { getEvents } = await import('@/lib/actions/event')
     
    const result = await getEvents({ genre: '展示会' } as any)
    expect(result).toHaveProperty('events')
  })

  it('supports pagination', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])
    mockPrisma.event.count.mockResolvedValue(0)

    const { getEvents } = await import('@/lib/actions/event')
     
    const result = await getEvents({ page: 2, limit: 10 } as any)
    expect(result).toHaveProperty('events')
  })
})

describe('getUpcomingEvents', async () => {
  it('returns upcoming events', async () => {
    mockPrisma.event.findMany.mockResolvedValue([
      { id: 'e1', title: 'Event', startDate: new Date(Date.now() + 86400000), organizer: { id: 'u2', nickname: 'Org' }, _count: { participants: 3 } },
    ])

    const { getUpcomingEvents } = await import('@/lib/actions/event')
    const result = await getUpcomingEvents()
    expect(result).toHaveProperty('events')
  })

  it('accepts limit parameter', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])

    const { getUpcomingEvents } = await import('@/lib/actions/event')
    const result = await getUpcomingEvents(5)
    expect(result).toHaveProperty('events')
  })

  it('accepts region filter', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])

    const { getUpcomingEvents } = await import('@/lib/actions/event')
    const result = await getUpcomingEvents(10, '関東')
    expect(result).toHaveProperty('events')
  })
})

describe('getEventsByMonth', async () => {
  it('returns events for specified month', async () => {
    mockPrisma.event.findMany.mockResolvedValue([])

    const { getEventsByMonth } = await import('@/lib/actions/event')
    const result = await getEventsByMonth(2026, 1)
    expect(result).toHaveProperty('events')
  })
})

describe('getEvent', async () => {
  it('returns event by id', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({
      id: 'e1', title: 'Event', organizerId: 'u2',
      organizer: { id: 'u2', nickname: 'Org', avatarUrl: null },
      participants: [], _count: { participants: 0 },
    })

    const { getEvent } = await import('@/lib/actions/event')
    const result = await getEvent('e1')
    expect(result).toMatchObject({ success: true, data: { event: expect.any(Object) } })
  })

  it('returns error for non-existent event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null)

    const { getEvent } = await import('@/lib/actions/event')
    const result = await getEvent('e999')
    expect(result).toMatchObject({ success: false, error: expect.any(String) })
  })
})

describe('deleteEvent', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteEvent } = await import('@/lib/actions/event')
    const result = await deleteEvent('e1')
    expect(result).toHaveProperty('error')
  })

  it('deletes own event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'e1', createdBy: 'u1' })
    mockPrisma.event.delete.mockResolvedValue({})

    const { deleteEvent } = await import('@/lib/actions/event')
    const result = await deleteEvent('e1')
    expect(result).toHaveProperty('success', true)
  })

  it('rejects non-organizer', async () => {
    mockPrisma.event.findUnique.mockResolvedValue({ id: 'e1', createdBy: 'other' })

    const { deleteEvent } = await import('@/lib/actions/event')
    const result = await deleteEvent('e1')
    expect(result).toHaveProperty('error')
  })

  it('rejects non-existent event', async () => {
    mockPrisma.event.findUnique.mockResolvedValue(null)

    const { deleteEvent } = await import('@/lib/actions/event')
    const result = await deleteEvent('e999')
    expect(result).toHaveProperty('error')
  })
})
