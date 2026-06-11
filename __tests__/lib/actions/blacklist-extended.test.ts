import { vi } from 'vitest'
import { createMockPrismaClient, MockPrismaClient } from '../../utils/test-utils'
/**
 * Extended blacklist tests - uncovered device blacklist functions
 */
export {}

const mockAuth = vi.fn()
const _mockIsAdmin = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma = createMockPrismaClient() as MockPrismaClient & {
  deviceBlacklist: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
    createMany: ReturnType<typeof vi.fn>
  }
  emailBlacklist: {
    findMany: ReturnType<typeof vi.fn>
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    count: ReturnType<typeof vi.fn>
  }
  userDevice: {
    findMany: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
}
mockPrisma.deviceBlacklist = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  createMany: vi.fn(),
}
mockPrisma.emailBlacklist = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
}
mockPrisma.userDevice = {
  findMany: vi.fn(),
  upsert: vi.fn(),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
  vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue({ id: 'a1', role: 'admin' } as never)
})

describe('removeDeviceFromBlacklist', async () => {
  it('removes device successfully', async () => {
    const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
    mockPrisma.deviceBlacklist.delete.mockResolvedValue({})
    const result = await removeDeviceFromBlacklist('d1')
    expect(result.success).toBe(true)
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
    const result = await removeDeviceFromBlacklist('d1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('requires admin', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue(null)
    const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
    const result = await removeDeviceFromBlacklist('d1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('handles error', async () => {
    const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
    mockPrisma.deviceBlacklist.delete.mockRejectedValue(new Error('DB error'))
    const result = await removeDeviceFromBlacklist('d1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })
})

describe('getDeviceBlacklist', async () => {
  it('returns devices for admin', async () => {
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    const items = [{ id: 'd1', fingerprint: 'fp1', createdAt: new Date() }]
    mockPrisma.deviceBlacklist.findMany.mockResolvedValue(items)
    mockPrisma.deviceBlacklist.count.mockResolvedValue(1)

    const result = await getDeviceBlacklist()
    expect(result.success).toBe(true)
    if (result.success && result.data) {
      expect((result.data as { items: unknown[] }).items).toHaveLength(1)
      expect((result.data as { total: number }).total).toBe(1)
    }
  })

  it('supports search filter', async () => {
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    mockPrisma.deviceBlacklist.findMany.mockResolvedValue([])
    mockPrisma.deviceBlacklist.count.mockResolvedValue(0)

    await getDeviceBlacklist({ search: 'test' })
    expect(mockPrisma.deviceBlacklist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    )
  })

  it('supports cursor pagination', async () => {
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    mockPrisma.deviceBlacklist.findMany.mockResolvedValue([])
    mockPrisma.deviceBlacklist.count.mockResolvedValue(0)

    await getDeviceBlacklist({ limit: 10, cursor: 'cursor-20' })
    expect(mockPrisma.deviceBlacklist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, cursor: { id: 'cursor-20' }, skip: 1 })
    )
  })

  it('requires admin', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue(null)
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    const result = await getDeviceBlacklist()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('handles error', async () => {
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    mockPrisma.deviceBlacklist.findMany.mockRejectedValue(new Error('fail'))
    const result = await getDeviceBlacklist()
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })
})

// isDeviceBlacklisted は server-only サービス `lib/services/blacklist-check` へ移設したため
// `__tests__/lib/services/blacklist-check.test.ts` で検証する。

describe('recordUserDevice', async () => {
  it('records device with upsert', async () => {
    const { recordUserDevice } = await import('@/lib/services/device-tracking')
    mockPrisma.userDevice.upsert.mockResolvedValue({})
    await recordUserDevice('u1', 'fp1', 'Chrome', '1.2.3.4')
    expect(mockPrisma.userDevice.upsert).toHaveBeenCalled()
  })

  it('skips empty userId', async () => {
    const { recordUserDevice } = await import('@/lib/services/device-tracking')
    await recordUserDevice('', 'fp1')
    expect(mockPrisma.userDevice.upsert).not.toHaveBeenCalled()
  })

  it('skips empty fingerprint', async () => {
    const { recordUserDevice } = await import('@/lib/services/device-tracking')
    await recordUserDevice('u1', '')
    expect(mockPrisma.userDevice.upsert).not.toHaveBeenCalled()
  })

  it('handles error silently', async () => {
    const { recordUserDevice } = await import('@/lib/services/device-tracking')
    mockPrisma.userDevice.upsert.mockRejectedValue(new Error('fail'))
    await expect(recordUserDevice('u1', 'fp1')).resolves.not.toThrow()
  })

  it('records without optional params', async () => {
    const { recordUserDevice } = await import('@/lib/services/device-tracking')
    mockPrisma.userDevice.upsert.mockResolvedValue({})
    await recordUserDevice('u1', 'fp1')
    expect(mockPrisma.userDevice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ userAgent: null, ipAddress: null }),
      })
    )
  })
})

describe('getUserDevices', async () => {
  it('returns devices for admin', async () => {
    const { getUserDevices } = await import('@/lib/actions/blacklist')
    const devices = [{ id: 'd1', fingerprint: 'fp1' }]
    mockPrisma.userDevice.findMany.mockResolvedValue(devices)
    const result = await getUserDevices('u1')
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(devices)
    }
  })

  it('requires admin', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue(null)
    const { getUserDevices } = await import('@/lib/actions/blacklist')
    const result = await getUserDevices('u1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('handles error', async () => {
    const { getUserDevices } = await import('@/lib/actions/blacklist')
    mockPrisma.userDevice.findMany.mockRejectedValue(new Error('fail'))
    const result = await getUserDevices('u1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })
})

describe('blacklistUserDevices', async () => {
  it('blacklists all user devices', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({ email: 'test@example.com' } as never)
    mockPrisma.userDevice.findMany.mockResolvedValue([{ fingerprint: 'fp1' }, { fingerprint: 'fp2' }])
    mockPrisma.deviceBlacklist.findMany.mockResolvedValue([])
    mockPrisma.deviceBlacklist.createMany.mockResolvedValue({ count: 2 })

    const result = await blacklistUserDevices('u1', 'spam')
    expect(result.success).toBe(true)
    if (result.success && result.data) {
      expect((result.data as { count: number }).count).toBe(2)
    }
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    const result = await blacklistUserDevices('u1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('requires admin', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue(null)
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    const result = await blacklistUserDevices('u1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('returns error when no devices', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({ email: 'test@example.com' } as never)
    mockPrisma.userDevice.findMany.mockResolvedValue([])

    const result = await blacklistUserDevices('u1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('デバイスがありません')
  })

  it('returns error when all already blacklisted', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({ email: 'test@example.com' } as never)
    mockPrisma.userDevice.findMany.mockResolvedValue([{ fingerprint: 'fp1' }])
    mockPrisma.deviceBlacklist.findMany.mockResolvedValue([{ fingerprint: 'fp1' }])

    const result = await blacklistUserDevices('u1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('既にブラックリスト')
  })

  it('handles error', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    vi.mocked(mockPrisma.user.findUnique)
      .mockResolvedValueOnce({ isSuspended: false } as never)
      .mockRejectedValueOnce(new Error('fail'))
    const result = await blacklistUserDevices('u1')
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('skips existing blacklisted devices', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    vi.mocked(mockPrisma.user.findUnique).mockResolvedValue({ email: 'test@example.com' } as never)
    mockPrisma.userDevice.findMany.mockResolvedValue([{ fingerprint: 'fp1' }, { fingerprint: 'fp2' }])
    mockPrisma.deviceBlacklist.findMany.mockResolvedValue([{ fingerprint: 'fp1' }])
    mockPrisma.deviceBlacklist.createMany.mockResolvedValue({ count: 1 })

    const result = await blacklistUserDevices('u1')
    expect(result.success).toBe(true)
    if (result.success && result.data) {
      expect((result.data as { count: number }).count).toBe(1)
    }
  })
})
