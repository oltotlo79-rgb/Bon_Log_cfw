// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/mute')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
// logger モックは lib/redis.ts が logger.log / logger.debug を呼び出すため全レベルを含める必要がある
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { log: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
})

// ============================================================
// muteUser
// ============================================================
describe('muteUser', async () => {
  it('requires auth', async () => {
    const { muteUser } = await import('@/lib/actions/mute')
    mockAuth.mockResolvedValue(null)

    const result = await muteUser('u2')

    expect(result).toHaveProperty('error')
  })

  it('mutes user successfully', async () => {
    const { muteUser } = await import('@/lib/actions/mute')
    mockPrisma.mute.create.mockResolvedValue({})

    const result = await muteUser('u2')

    expect(result).toEqual({ success: true })
    expect(mockPrisma.mute.create).toHaveBeenCalledWith({
      data: { muterId: 'u1', mutedId: 'u2' },
    })
  })

  it('prevents muting self', async () => {
    const { muteUser } = await import('@/lib/actions/mute')

    const result = await muteUser('u1')

    expect(result).toHaveProperty('error')
    expect(mockPrisma.mute.create).not.toHaveBeenCalled()
  })

  it('handles already muted (db error)', async () => {
    const { muteUser } = await import('@/lib/actions/mute')
    mockPrisma.mute.create.mockRejectedValue(new Error('Unique constraint'))

    const result = await muteUser('u2')

    expect(result).toHaveProperty('error')
  })

  it('handles db error', async () => {
    const { muteUser } = await import('@/lib/actions/mute')
    mockPrisma.mute.create.mockRejectedValue(new Error('DB error'))

    const result = await muteUser('u2')

    expect(result).toHaveProperty('error')
  })
})

// ============================================================
// unmuteUser
// ============================================================
describe('unmuteUser', async () => {
  it('requires auth', async () => {
    const { unmuteUser } = await import('@/lib/actions/mute')
    mockAuth.mockResolvedValue(null)

    const result = await unmuteUser('u2')

    expect(result).toHaveProperty('error')
  })

  it('unmutes user successfully', async () => {
    const { unmuteUser } = await import('@/lib/actions/mute')
    mockPrisma.mute.delete.mockResolvedValue({})

    const result = await unmuteUser('u2')

    expect(result).toEqual({ success: true })
    expect(mockPrisma.mute.delete).toHaveBeenCalledWith({
      where: { muterId_mutedId: { muterId: 'u1', mutedId: 'u2' } },
    })
  })

  it('handles not muted (db error)', async () => {
    const { unmuteUser } = await import('@/lib/actions/mute')
    mockPrisma.mute.delete.mockRejectedValue(new Error('Record not found'))

    const result = await unmuteUser('u2')

    expect(result).toHaveProperty('error')
  })

  it('handles db error', async () => {
    const { unmuteUser } = await import('@/lib/actions/mute')
    mockPrisma.mute.delete.mockRejectedValue(new Error('DB error'))

    const result = await unmuteUser('u2')

    expect(result).toHaveProperty('error')
  })
})

// ============================================================
// getMutedUsers
// ============================================================
describe('getMutedUsers', async () => {
  it('requires auth', async () => {
    const { getMutedUsers } = await import('@/lib/actions/mute')
    mockAuth.mockResolvedValue(null)

    const result = await getMutedUsers()

    expect(result).toEqual({ users: [], nextCursor: undefined })
  })

  it('returns muted users', async () => {
    const { getMutedUsers } = await import('@/lib/actions/mute')
    mockPrisma.mute.findMany.mockResolvedValue([
      { mutedId: 'u2', muted: { id: 'u2', nickname: 'User2', avatarUrl: null, bio: null } },
    ])

    const result = await getMutedUsers()

    expect(result.users).toEqual([{ id: 'u2', nickname: 'User2', avatarUrl: null, bio: null }])
  })

  it('supports cursor pagination', async () => {
    const { getMutedUsers } = await import('@/lib/actions/mute')
    mockPrisma.mute.findMany.mockResolvedValue([])

    await getMutedUsers('u2', 10)

    expect(mockPrisma.mute.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { muterId_mutedId: { muterId: 'u1', mutedId: 'u2' } },
        skip: 1,
      })
    )
  })

  it('returns empty when no mutes', async () => {
    const { getMutedUsers } = await import('@/lib/actions/mute')
    mockPrisma.mute.findMany.mockResolvedValue([])

    const result = await getMutedUsers()

    expect(result.users).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })

  it('handles db error', async () => {
    const { getMutedUsers } = await import('@/lib/actions/mute')
    mockPrisma.mute.findMany.mockRejectedValue(new Error('DB error'))

    const result = await getMutedUsers()

    expect(result).toEqual({ users: [], nextCursor: undefined })
  })
})

// ============================================================
// isMuted
// ============================================================
describe('isMuted', async () => {
  it('returns false when not authenticated', async () => {
    const { isMuted } = await import('@/lib/actions/mute')
    mockAuth.mockResolvedValue(null)

    const result = await isMuted('u2')

    expect(result).toEqual({ muted: false })
  })

  it('returns true when muted', async () => {
    const { isMuted } = await import('@/lib/actions/mute')
    mockPrisma.mute.findUnique.mockResolvedValue({ muterId: 'u1', mutedId: 'u2' })

    const result = await isMuted('u2')

    expect(result).toEqual({ muted: true })
  })

  it('returns false when not muted', async () => {
    const { isMuted } = await import('@/lib/actions/mute')
    mockPrisma.mute.findUnique.mockResolvedValue(null)

    const result = await isMuted('u2')

    expect(result).toEqual({ muted: false })
  })

  it('returns false on error', async () => {
    const { isMuted } = await import('@/lib/actions/mute')
    mockPrisma.mute.findUnique.mockRejectedValue(new Error('DB error'))

    const result = await isMuted('u2')

    expect(result).toEqual({ muted: false })
  })
})
