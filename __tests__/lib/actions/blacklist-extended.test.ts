import { vi } from 'vitest'
/**
 * Extended blacklist tests - uncovered device blacklist functions
 */
export {}

const mockAuth = vi.fn()
const _mockIsAdmin = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, Record<string, unknown>> = {
  deviceBlacklist: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn(), createMany: vi.fn() },
  emailBlacklist: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
  userDevice: { findMany: vi.fn(), upsert: vi.fn() },
  user: { findUnique: vi.fn() },
  adminUser: { findUnique: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
  ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'a1', role: 'admin' })
})

describe('removeDeviceFromBlacklist', async () => {
  it('removes device successfully', async () => {
    const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.deviceBlacklist.delete as ReturnType<typeof vi.fn>).mockResolvedValue({})
    const result: any = await removeDeviceFromBlacklist('d1')
    expect(result.success).toBe(true)
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
    const result: any = await removeDeviceFromBlacklist('d1')
    expect(result.error).toBeDefined()
  })

  it('requires admin', async () => {
    ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
    const result: any = await removeDeviceFromBlacklist('d1')
    expect(result.error).toBeDefined()
  })

  it('handles error', async () => {
    const { removeDeviceFromBlacklist } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.deviceBlacklist.delete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'))
    const result: any = await removeDeviceFromBlacklist('d1')
    expect(result.error).toBeDefined()
  })
})

describe('getDeviceBlacklist', async () => {
  it('returns devices for admin', async () => {
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    const items = [{ id: 'd1', fingerprint: 'fp1', createdAt: new Date() }]
    ;(mockPrisma.deviceBlacklist.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(items)
    ;(mockPrisma.deviceBlacklist.count as ReturnType<typeof vi.fn>).mockResolvedValue(1)

    const result: any = await getDeviceBlacklist()
    expect(result.success).toBe(true)
    expect(result.data.items).toHaveLength(1)
    expect(result.data.total).toBe(1)
  })

  it('supports search filter', async () => {
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.deviceBlacklist.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.deviceBlacklist.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await getDeviceBlacklist({ search: 'test' })
    expect(mockPrisma.deviceBlacklist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    )
  })

  it('supports cursor pagination', async () => {
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.deviceBlacklist.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.deviceBlacklist.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)

    await getDeviceBlacklist({ limit: 10, cursor: 'cursor-20' })
    expect(mockPrisma.deviceBlacklist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, cursor: { id: 'cursor-20' }, skip: 1 })
    )
  })

  it('requires admin', async () => {
    ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    const result: any = await getDeviceBlacklist()
    expect(result.error).toBeDefined()
  })

  it('handles error', async () => {
    const { getDeviceBlacklist } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.deviceBlacklist.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'))
    const result: any = await getDeviceBlacklist()
    expect(result.error).toBeDefined()
  })
})

describe('isDeviceBlacklisted', async () => {
  it('returns true for blacklisted device', async () => {
    const { isDeviceBlacklisted } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.deviceBlacklist.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'd1' })
    expect(await isDeviceBlacklisted('fp1')).toBe(true)
  })

  it('returns false for non-blacklisted device', async () => {
    const { isDeviceBlacklisted } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.deviceBlacklist.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    expect(await isDeviceBlacklisted('fp2')).toBe(false)
  })

  it('returns false for empty fingerprint', async () => {
    const { isDeviceBlacklisted } = await import('@/lib/actions/blacklist')
    expect(await isDeviceBlacklisted('')).toBe(false)
  })

  it('returns false on error', async () => {
    const { isDeviceBlacklisted } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.deviceBlacklist.findUnique as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'))
    expect(await isDeviceBlacklisted('fp1')).toBe(false)
  })
})

describe('recordUserDevice', async () => {
  it('records device with upsert', async () => {
    const { recordUserDevice } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.userDevice.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
    await recordUserDevice('u1', 'fp1', 'Chrome', '1.2.3.4')
    expect(mockPrisma.userDevice.upsert).toHaveBeenCalled()
  })

  it('skips empty userId', async () => {
    const { recordUserDevice } = await import('@/lib/actions/blacklist')
    await recordUserDevice('', 'fp1')
    expect(mockPrisma.userDevice.upsert).not.toHaveBeenCalled()
  })

  it('skips empty fingerprint', async () => {
    const { recordUserDevice } = await import('@/lib/actions/blacklist')
    await recordUserDevice('u1', '')
    expect(mockPrisma.userDevice.upsert).not.toHaveBeenCalled()
  })

  it('handles error silently', async () => {
    const { recordUserDevice } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.userDevice.upsert as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'))
    await expect(recordUserDevice('u1', 'fp1')).resolves.not.toThrow()
  })

  it('records without optional params', async () => {
    const { recordUserDevice } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.userDevice.upsert as ReturnType<typeof vi.fn>).mockResolvedValue({})
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
    ;(mockPrisma.userDevice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue(devices)
    const result: any = await getUserDevices('u1')
    expect(result.success).toBe(true)
    expect(result.data).toEqual(devices)
  })

  it('requires admin', async () => {
    ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const { getUserDevices } = await import('@/lib/actions/blacklist')
    const result: any = await getUserDevices('u1')
    expect(result.error).toBeDefined()
  })

  it('handles error', async () => {
    const { getUserDevices } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.userDevice.findMany as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'))
    const result: any = await getUserDevices('u1')
    expect(result.error).toBeDefined()
  })
})

describe('blacklistUserDevices', async () => {
  it('blacklists all user devices', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ email: 'test@example.com' })
    ;(mockPrisma.userDevice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ fingerprint: 'fp1' }, { fingerprint: 'fp2' }])
    ;(mockPrisma.deviceBlacklist.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])
    ;(mockPrisma.deviceBlacklist.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 2 })

    const result: any = await blacklistUserDevices('u1', 'spam')
    expect(result.success).toBe(true)
    expect(result.data.count).toBe(2)
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    const result: any = await blacklistUserDevices('u1')
    expect(result.error).toBeDefined()
  })

  it('requires admin', async () => {
    ;(mockPrisma.adminUser.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    const result: any = await blacklistUserDevices('u1')
    expect(result.error).toBeDefined()
  })

  it('returns error when no devices', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ email: 'test@example.com' })
    ;(mockPrisma.userDevice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const result: any = await blacklistUserDevices('u1')
    expect(result.error).toContain('デバイスがありません')
  })

  it('returns error when all already blacklisted', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ email: 'test@example.com' })
    ;(mockPrisma.userDevice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ fingerprint: 'fp1' }])
    ;(mockPrisma.deviceBlacklist.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ fingerprint: 'fp1' }])

    const result: any = await blacklistUserDevices('u1')
    expect(result.error).toContain('既にブラックリスト')
  })

  it('handles error', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    // admin の suspension チェックが成功した後、本体の user.findUnique で例外を起こさせる
    ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ isSuspended: false })
      .mockRejectedValueOnce(new Error('fail'))
    const result: any = await blacklistUserDevices('u1')
    expect(result.error).toBeDefined()
  })

  it('skips existing blacklisted devices', async () => {
    const { blacklistUserDevices } = await import('@/lib/actions/blacklist')
    ;(mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ email: 'test@example.com' })
    ;(mockPrisma.userDevice.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ fingerprint: 'fp1' }, { fingerprint: 'fp2' }])
    ;(mockPrisma.deviceBlacklist.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([{ fingerprint: 'fp1' }])
    ;(mockPrisma.deviceBlacklist.createMany as ReturnType<typeof vi.fn>).mockResolvedValue({ count: 1 })

    const result: any = await blacklistUserDevices('u1')
    expect(result.success).toBe(true)
    expect(result.data.count).toBe(1)
  })
})
