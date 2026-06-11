// @vitest-environment node

import { vi } from 'vitest'
import { expectError } from '../../helpers/action-result'
// Prisma モック（maintenance固有）
const mtMockPrisma = {
  user: {
    findUnique: vi.fn(),
  },
  systemSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  adminUser: {
    findUnique: vi.fn(),
  },
  adminLog: {
    create: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({
  prisma: mtMockPrisma,
}))

// NextAuth モック（maintenance固有）
const mtMockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({
  auth: mtMockAuth,
}))

// isAdmin モック（maintenance固有）
const mtMockIsAdmin = vi.fn()
vi.mock('@/lib/actions/admin', () => ({
  isAdmin: mtMockIsAdmin,
}))

// revalidatePath モック
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))

// logger モック
vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), log: vi.fn() },
}))

// redis モック
vi.mock('@/lib/redis', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), expire: vi.fn() },
  getRedisClient: vi.fn(),
}))

describe('Maintenance Actions', async () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  // ============================================================
  // getMaintenanceSettings
  // ============================================================

  describe('getMaintenanceSettings', async () => {
    it('設定がない場合はデフォルト値を返す', async () => {
      mtMockPrisma.systemSetting.findUnique.mockResolvedValue(null)

      const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const settings = await getMaintenanceSettings()

      expect(settings.enabled).toBe(false)
      expect(settings.startTime).toBeNull()
      expect(settings.endTime).toBeNull()
      expect(settings.message).toBeTruthy()
    })

    it('保存された設定を返す', async () => {
      const savedSettings = {
        enabled: true,
        startTime: '2024-01-01T00:00:00Z',
        endTime: '2024-01-02T00:00:00Z',
        message: 'カスタムメッセージ',
      }

      mtMockPrisma.systemSetting.findUnique.mockResolvedValue({
        key: 'maintenance_mode',
        value: savedSettings,
      })

      const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const settings = await getMaintenanceSettings()

      expect(settings.enabled).toBe(true)
      expect(settings.startTime).toBe('2024-01-01T00:00:00Z')
      expect(settings.endTime).toBe('2024-01-02T00:00:00Z')
      expect(settings.message).toBe('カスタムメッセージ')
    })

    it('エラー時はデフォルト値を返す', async () => {
      mtMockPrisma.systemSetting.findUnique.mockRejectedValue(new Error('DB error'))

      const { getMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const settings = await getMaintenanceSettings()

      expect(settings.enabled).toBe(false)
    })
  })

  // ============================================================
  // isMaintenanceMode
  // ============================================================

  describe('isMaintenanceMode', async () => {
    it('無効の場合はfalseを返す', async () => {
      mtMockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: false,
          startTime: null,
          endTime: null,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(false)
    })

    it('有効で時間指定なしの場合はtrueを返す', async () => {
      mtMockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: true,
          startTime: null,
          endTime: null,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(true)
    })

    it('開始時間前の場合はfalseを返す', async () => {
      const futureTime = new Date(Date.now() + 3600000).toISOString() // 1時間後

      mtMockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: true,
          startTime: futureTime,
          endTime: null,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(false)
    })

    it('終了時間後の場合はfalseを返す', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString() // 1時間前

      mtMockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: true,
          startTime: null,
          endTime: pastTime,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(false)
    })

    it('期間内の場合はtrueを返す', async () => {
      const pastTime = new Date(Date.now() - 3600000).toISOString() // 1時間前
      const futureTime = new Date(Date.now() + 3600000).toISOString() // 1時間後

      mtMockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: {
          enabled: true,
          startTime: pastTime,
          endTime: futureTime,
          message: '',
        },
      })

      const { isMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await isMaintenanceMode()

      expect(result).toBe(true)
    })
  })


  // ============================================================
  // updateMaintenanceSettings
  // ============================================================

  describe('updateMaintenanceSettings', async () => {
    it('未認証の場合はエラーを返す', async () => {
      mtMockAuth.mockResolvedValue(null)

      const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const result = await updateMaintenanceSettings({ enabled: true })

      expectError(result)
      expect(result.error).toBe('認証が必要です')
    })

    it('管理者でない場合はエラーを返す', async () => {
      mtMockAuth.mockResolvedValue({ user: { id: 'user-1' } })
      mtMockPrisma.adminUser.findUnique.mockResolvedValue(null)

      const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const result = await updateMaintenanceSettings({ enabled: true })

      expectError(result)
      expect(result.error).toBe('管理者権限が必要です')
    })

    it('管理者の場合は設定を更新する', async () => {
      mtMockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
      mtMockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'admin' })
      mtMockPrisma.systemSetting.findUnique.mockResolvedValue(null)
      mtMockPrisma.systemSetting.upsert.mockResolvedValue({})
      mtMockPrisma.adminLog.create.mockResolvedValue({})

      const { updateMaintenanceSettings } = await import('@/lib/actions/maintenance')
      const result = await updateMaintenanceSettings({
        enabled: true,
        message: '新しいメッセージ',
      })

      expect(result.success).toBe(true)
      expect(mtMockPrisma.systemSetting.upsert).toHaveBeenCalled()
      expect(mtMockPrisma.adminLog.create).toHaveBeenCalled()
    })
  })

  // ============================================================
  // toggleMaintenanceMode
  // ============================================================

  describe('toggleMaintenanceMode', async () => {
    it('メンテナンスモードを有効にする', async () => {
      mtMockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
      mtMockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'admin' })
      mtMockPrisma.systemSetting.findUnique.mockResolvedValue({
        value: { enabled: false, startTime: null, endTime: null, message: '' },
      })
      mtMockPrisma.systemSetting.upsert.mockResolvedValue({})
      mtMockPrisma.adminLog.create.mockResolvedValue({})

      const { toggleMaintenanceMode } = await import('@/lib/actions/maintenance')
      const result = await toggleMaintenanceMode(true)

      expect(result.success).toBe(true)
    })
  })
})

// ============================================================
// MaintenanceSettings型テスト
// ============================================================

describe('MaintenanceSettings 型', () => {
  it('必要なプロパティを持つ', async () => {
    const settings = {
      enabled: true,
      startTime: '2024-01-01T00:00:00Z',
      endTime: '2024-01-02T00:00:00Z',
      message: 'メンテナンス中',
    }

    expect(settings).toHaveProperty('enabled')
    expect(settings).toHaveProperty('startTime')
    expect(settings).toHaveProperty('endTime')
    expect(settings).toHaveProperty('message')
  })

  it('nullの日時も許容する', () => {
    const settings = {
      enabled: true,
      startTime: null,
      endTime: null,
      message: 'メンテナンス中',
    }

    expect(settings.startTime).toBeNull()
    expect(settings.endTime).toBeNull()
  })
})

// ============================================================
// 許可パス判定テスト
// ============================================================

describe('メンテナンス許可パス', () => {
  const allowedPaths = ['/', '/login', '/register', '/password-reset', '/maintenance', '/api/auth']

  it.each(allowedPaths)('%s はメンテナンス中でもアクセス可能', (path) => {
    const isAllowed = allowedPaths.some(
      (p) => path === p || path.startsWith(p + '/')
    )
    expect(isAllowed).toBe(true)
  })

  const blockedPaths = ['/feed', '/posts', '/users/123', '/settings', '/admin']

  it.each(blockedPaths)('%s はメンテナンス中はブロックされる', (path) => {
    const isAllowed = allowedPaths.some(
      (p) => path === p || path.startsWith(p + '/')
    )
    expect(isAllowed).toBe(false)
  })
})
