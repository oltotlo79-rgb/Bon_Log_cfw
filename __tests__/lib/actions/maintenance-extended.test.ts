import { vi } from 'vitest'
import { createMockPrismaClient, MockPrismaClient } from '../../utils/test-utils'
/**
 * Extended maintenance tests - getMaintenanceSettings, isMaintenanceMode, updateMaintenanceSettings, toggleMaintenanceMode
 */
export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma = createMockPrismaClient() as MockPrismaClient & {
  systemSetting: {
    findUnique: ReturnType<typeof vi.fn>
    upsert: ReturnType<typeof vi.fn>
  }
}
mockPrisma.systemSetting = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
}

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() }, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() } }))
vi.mock('@/lib/redis', () => ({ redis: { get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), expire: vi.fn() }, getRedisClient: vi.fn() }))
vi.mock('@/lib/actions/admin', () => ({ isAdmin: vi.fn() }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'admin1' } })
})

describe('getMaintenanceSettings', async () => {
  it('returns defaults when no setting exists', async () => {
    const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
    const result = await getMaintenanceSettings()
    expect(result.enabled).toBe(false)
    expect(result.message).toBeDefined()
  })

  it('returns stored settings', async () => {
    const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      key: 'maintenance_mode',
      value: { enabled: true, startTime: null, endTime: null, message: 'メンテ中' },
    })
    const result = await getMaintenanceSettings()
    expect(result.enabled).toBe(true)
  })

  it('handles db error', async () => {
    const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
    mockPrisma.systemSetting.findUnique.mockRejectedValue(new Error('db'))
    const result = await getMaintenanceSettings()
    expect(result.enabled).toBe(false)
  })
})

describe('isMaintenanceMode', async () => {
  it('returns false when disabled', async () => {
    const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
    const result = await isMaintenanceMode()
    expect(result).toBe(false)
  })

  it('returns true when enabled with no time constraints', async () => {
    const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      key: 'maintenance_mode',
      value: { enabled: true, startTime: null, endTime: null, message: 'メンテ中' },
    })
    const result = await isMaintenanceMode()
    expect(result).toBe(true)
  })

  it('returns false when start time is in the future', async () => {
    const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
    const future = new Date(Date.now() + 3600000).toISOString()
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      key: 'maintenance_mode',
      value: { enabled: true, startTime: future, endTime: null, message: 'メンテ中' },
    })
    const result = await isMaintenanceMode()
    expect(result).toBe(false)
  })

  it('returns false when end time is in the past', async () => {
    const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
    const past = new Date(Date.now() - 3600000).toISOString()
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      key: 'maintenance_mode',
      value: { enabled: true, startTime: null, endTime: past, message: 'メンテ中' },
    })
    const result = await isMaintenanceMode()
    expect(result).toBe(false)
  })

  it('returns true when within time window', async () => {
    const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
    const past = new Date(Date.now() - 3600000).toISOString()
    const future = new Date(Date.now() + 3600000).toISOString()
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      key: 'maintenance_mode',
      value: { enabled: true, startTime: past, endTime: future, message: 'メンテ中' },
    })
    const result = await isMaintenanceMode()
    expect(result).toBe(true)
  })
})

describe('updateMaintenanceSettings', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('requires admin', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue(null)
    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })

  it('updates settings successfully', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue({ role: 'admin' } as never)
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
    mockPrisma.systemSetting.upsert.mockResolvedValue({})

    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true, message: 'テスト' })
    expect(result.success).toBe(true)
  })

  it('merges with existing settings', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue({ role: 'admin' } as never)
    mockPrisma.systemSetting.findUnique.mockResolvedValue({
      key: 'maintenance_mode',
      value: { enabled: false, startTime: null, endTime: null, message: '既存' },
    })
    mockPrisma.systemSetting.upsert.mockResolvedValue({})

    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ message: '新しいメッセージ' })
    expect(result.success).toBe(true)
  })

  it('handles db error', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue({ role: 'admin' } as never)
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
    mockPrisma.systemSetting.upsert.mockRejectedValue(new Error('db'))

    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toBeDefined()
  })
})

describe('toggleMaintenanceMode', async () => {
  it('enables maintenance mode', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue({ role: 'admin' } as never)
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
    mockPrisma.systemSetting.upsert.mockResolvedValue({})

    const { toggleMaintenanceMode } = await import('@/lib/actions/maintenance')
    const result = await toggleMaintenanceMode(true)
    expect(result.success).toBe(true)
  })

  it('disables maintenance mode', async () => {
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue({ role: 'admin' } as never)
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
    mockPrisma.systemSetting.upsert.mockResolvedValue({})

    const { toggleMaintenanceMode } = await import('@/lib/actions/maintenance')
    const result = await toggleMaintenanceMode(false)
    expect(result.success).toBe(true)
  })
})
