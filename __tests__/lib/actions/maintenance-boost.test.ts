// @vitest-environment node
import { vi } from 'vitest'
import { expectError } from '../../helpers/action-result'
import { createMockPrismaClient, MockPrismaClient } from '../../utils/test-utils'

/**
 * メンテナンスアクション - ブランチカバレッジ向上テスト
 * DB upsertエラー、adminLogエラー、Redis障害、トップレベルエラーハンドリングのパスをカバー
 */

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

const mockLogger = { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() }
vi.mock('@/lib/logger', () => ({ __esModule: true, default: mockLogger }))

const mockRedisClient = { set: vi.fn(), get: vi.fn(), del: vi.fn(), incr: vi.fn(), expire: vi.fn() }
vi.mock('@/lib/redis', () => ({ redis: { client: mockRedisClient, get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), expire: vi.fn() }, getRedisClient: vi.fn() }))
vi.mock('@/lib/actions/admin', () => ({ isAdmin: vi.fn() }))

describe('updateMaintenanceSettings - エラーハンドリングブランチ', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    vi.mocked(mockPrisma.adminUser.findUnique).mockResolvedValue({ role: 'admin' } as never)
    mockPrisma.systemSetting.findUnique.mockResolvedValue(null)
  })

  it('systemSetting.upsertがError以外の値をthrowした場合のエラーメッセージ', async () => {
    mockPrisma.systemSetting.upsert.mockRejectedValue('string error')

    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true })

    expect(result.success).toBe(false)
    expectError(result)
    expect(typeof result.error).toBe('string')
  })

  it('systemSetting.upsertがErrorインスタンスをthrowした場合のエラーメッセージ', async () => {
    mockPrisma.systemSetting.upsert.mockRejectedValue(new Error('unique constraint'))

    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true })

    expect(result.success).toBe(false)
    expectError(result)
    expect(typeof result.error).toBe('string')
  })

  it('adminLog.createが失敗しても設定自体は成功する', async () => {
    mockPrisma.systemSetting.upsert.mockResolvedValue({})
    vi.mocked(mockPrisma.adminLog.create).mockRejectedValue(new Error('log write failed'))

    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true })

    expect(result.success).toBe(true)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to create adminLog (non-fatal):',
      expect.any(Error)
    )
  })

  it('Redis同期が失敗しても設定自体は成功する', async () => {
    mockPrisma.systemSetting.upsert.mockResolvedValue({})
    vi.mocked(mockPrisma.adminLog.create).mockResolvedValue({} as never)
    mockRedisClient.set.mockRejectedValue(new Error('Redis connection refused'))

    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true })

    expect(result.success).toBe(true)
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'Failed to sync maintenance status to Redis (non-fatal):',
      expect.any(Error)
    )
  })

  it('トップレベルの予期しないエラーでエラーメッセージを返す（DB詳細は漏洩しない）', async () => {
    mockAuth.mockRejectedValue(new Error('unexpected auth failure'))

    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true })

    expect(result.success).toBe(false)
    expectError(result)
    expect(result.error).toBe('設定の更新に失敗しました')
    expect(result.error).not.toContain('unexpected auth failure')
  })

  it('トップレベルでError以外がthrowされた場合もDB詳細は漏洩しない', async () => {
    mockAuth.mockRejectedValue(42)

    const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
    const result = await updateMaintenanceSettings({ enabled: true })

    expect(result.success).toBe(false)
    expectError(result)
    expect(result.error).toBe('設定の更新に失敗しました')
    expect(result.error).not.toContain('42')
  })
})
