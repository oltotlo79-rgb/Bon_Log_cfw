// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
// userDevice is not in the default mock client — add it manually
;(mockPrisma as any).userDevice = {
  findMany: vi.fn(),
  count: vi.fn(),
  upsert: vi.fn(),
}
// $queryRaw for detectMultiAccounts
;(mockPrisma as any).$queryRaw = vi.fn().mockResolvedValue([])

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockRevalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

vi.mock('@/lib/rate-limit', () => ({ checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }), RATE_LIMITS: {} }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxDailyPosts: 20 }) }))

// ---------- helpers ----------

const mockAdminUserRecord = {
  id: 'admin-record-id',
  userId: mockUser.id,
  role: 'admin',
  createdAt: new Date(),
}

function setupAdmin() {
  mockAuth.mockResolvedValue({ user: { id: mockUser.id } })
  mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isSuspended: false })
  mockPrisma.adminUser.findUnique.mockResolvedValue(mockAdminUserRecord)
}

function setupNoAuth() {
  mockAuth.mockResolvedValue(null)
}

function setupNonAdmin() {
  mockAuth.mockResolvedValue({ user: { id: 'regular-user-id' } })
  mockPrisma.user.findUnique.mockResolvedValue({ id: 'regular-user-id', isSuspended: false })
  mockPrisma.adminUser.findUnique.mockResolvedValue(null)
}

// ---------- tests ----------

describe('getIpAddresses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-set $queryRaw default after clearAllMocks
    ;(mockPrisma as any).$queryRaw = vi.fn().mockResolvedValue([])
  })

  it('未認証の場合エラーを返す', async () => {
    setupNoAuth()
    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result = await getIpAddresses()
    expect(result).toHaveProperty('error')
  })

  it('管理者でない場合エラーを返す', async () => {
    setupNonAdmin()
    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result = await getIpAddresses()
    expect(result).toHaveProperty('error')
  })

  it('デバイスがない場合は空配列を返す', async () => {
    setupAdmin()
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.count.mockResolvedValue(0)
    mockPrisma.user.findMany.mockResolvedValue([])

    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result: any = await getIpAddresses()

    expect(result).not.toHaveProperty('error')
    expect(result.devices).toEqual([])
    expect(result.total).toBe(0)
  })

  it('デバイス情報にユーザー情報が付与される', async () => {
    setupAdmin()
    const mockDevices = [
      { id: 'd1', ipAddress: '10.0.0.1', userId: 'user-a', userAgent: 'Chrome', lastSeenAt: new Date('2025-01-01') },
      { id: 'd2', ipAddress: '10.0.0.2', userId: 'user-b', userAgent: 'Firefox', lastSeenAt: new Date('2025-01-02') },
    ]
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue(mockDevices)
    ;(mockPrisma as any).userDevice.count.mockResolvedValue(2)
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user-a', nickname: 'UserA', email: 'a@test.com', avatarUrl: null, isSuspended: false },
      { id: 'user-b', nickname: 'UserB', email: 'b@test.com', avatarUrl: null, isSuspended: false },
    ])

    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result: any = await getIpAddresses()

    expect(result.devices).toHaveLength(2)
    expect(result.devices[0].user).toEqual(expect.objectContaining({ id: 'user-a', nickname: 'UserA' }))
    expect(result.devices[1].user).toEqual(expect.objectContaining({ id: 'user-b', nickname: 'UserB' }))
    expect(result.total).toBe(2)
  })

  it('ユーザーが見つからないデバイスはuser=nullになる', async () => {
    setupAdmin()
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([
      { id: 'd1', ipAddress: '10.0.0.1', userId: 'deleted-user', userAgent: 'Chrome', lastSeenAt: new Date() },
    ])
    ;(mockPrisma as any).userDevice.count.mockResolvedValue(1)
    mockPrisma.user.findMany.mockResolvedValue([]) // user not found

    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result: any = await getIpAddresses()

    expect(result.devices[0].user).toBeNull()
  })

  it('searchパラメータでIP検索できる', async () => {
    setupAdmin()
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.count.mockResolvedValue(0)
    mockPrisma.user.findMany.mockResolvedValue([])

    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    await getIpAddresses({ search: '192.168' })

    // Verify findMany was called (the where clause includes search contains)
    expect((mockPrisma as any).userDevice.findMany).toHaveBeenCalled()
  })

  it('cursor ページネーションが適用される', async () => {
    setupAdmin()
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.count.mockResolvedValue(50)
    mockPrisma.user.findMany.mockResolvedValue([])

    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result: any = await getIpAddresses({ limit: 10, cursor: 'ip-cursor' })

    expect((mockPrisma as any).userDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
        cursor: { id: 'ip-cursor' },
        skip: 1,
      })
    )
    expect(result.total).toBe(50)
  })

  it('optionsなしでもデフォルト値で動作する', async () => {
    setupAdmin()
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([])
    ;(mockPrisma as any).userDevice.count.mockResolvedValue(0)
    mockPrisma.user.findMany.mockResolvedValue([])

    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result: any = await getIpAddresses()

    expect(result).not.toHaveProperty('error')
    const call = (mockPrisma as any).userDevice.findMany.mock.calls[0][0]
    expect(call.cursor).toBeUndefined()
    expect(call.skip).toBeUndefined()
  })

  it('同一ユーザーの複数デバイスが返される', async () => {
    setupAdmin()
    const sameUserId = 'user-x'
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([
      { id: 'd1', ipAddress: '10.0.0.1', userId: sameUserId, userAgent: 'Chrome', lastSeenAt: new Date('2025-01-01') },
      { id: 'd2', ipAddress: '10.0.0.2', userId: sameUserId, userAgent: 'Safari', lastSeenAt: new Date('2025-01-02') },
    ])
    ;(mockPrisma as any).userDevice.count.mockResolvedValue(2)
    mockPrisma.user.findMany.mockResolvedValue([
      { id: sameUserId, nickname: 'UserX', email: 'x@test.com', avatarUrl: null, isSuspended: false },
    ])

    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result: any = await getIpAddresses()

    expect(result.devices).toHaveLength(2)
    expect(result.devices[0].user?.id).toBe(sameUserId)
    expect(result.devices[1].user?.id).toBe(sameUserId)
    // findMany should be called with deduplicated userIds
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [sameUserId] } },
      })
    )
  })
})

describe('detectMultiAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockPrisma as any).$queryRaw = vi.fn().mockResolvedValue([])
  })

  it('未認証の場合エラーを返す', async () => {
    setupNoAuth()
    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result = await detectMultiAccounts()
    expect(result).toHaveProperty('error')
  })

  it('管理者でない場合エラーを返す', async () => {
    setupNonAdmin()
    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result = await detectMultiAccounts()
    expect(result).toHaveProperty('error')
  })

  it('不審なIPがない場合は空配列を返す', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    expect(result).not.toHaveProperty('error')
    expect(result.suspiciousIps).toEqual([])
  })

  it('同一IPに複数ユーザーがいる場合に検出される', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([
      { ip_address: '192.168.1.1', user_count: BigInt(3), user_ids: 'user-a,user-b,user-c' },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user-a', nickname: 'A', email: 'a@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'user-b', nickname: 'B', email: 'b@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'user-c', nickname: 'C', email: 'c@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
    ])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    expect(result.suspiciousIps).toHaveLength(1)
    expect(result.suspiciousIps[0].ipAddress).toBe('192.168.1.1')
    expect(result.suspiciousIps[0].userCount).toBe(3)
    expect(result.suspiciousIps[0].users).toHaveLength(3)
  })

  it('user_countのBigIntがNumberに変換される', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([
      { ip_address: '10.0.0.1', user_count: BigInt(2), user_ids: 'u1,u2' },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', nickname: 'U1', email: 'u1@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'u2', nickname: 'U2', email: 'u2@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
    ])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    expect(typeof result.suspiciousIps[0].userCount).toBe('number')
    expect(result.suspiciousIps[0].userCount).toBe(2)
  })

  it('複数の不審IPが検出される', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([
      { ip_address: '10.0.0.1', user_count: BigInt(3), user_ids: 'u1,u2,u3' },
      { ip_address: '10.0.0.2', user_count: BigInt(2), user_ids: 'u4,u5' },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', nickname: 'U1', email: 'u1@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'u2', nickname: 'U2', email: 'u2@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'u3', nickname: 'U3', email: 'u3@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'u4', nickname: 'U4', email: 'u4@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'u5', nickname: 'U5', email: 'u5@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
    ])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    expect(result.suspiciousIps).toHaveLength(2)
    expect(result.suspiciousIps[0].userCount).toBe(3)
    expect(result.suspiciousIps[1].userCount).toBe(2)
  })

  it('ユーザー情報が見つからない場合はフィルタされる', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([
      { ip_address: '10.0.0.1', user_count: BigInt(2), user_ids: 'u1,deleted-user' },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', nickname: 'U1', email: 'u1@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      // deleted-user is not returned
    ])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    // Only u1 should be in the users array (deleted-user filtered by Boolean)
    expect(result.suspiciousIps[0].users).toHaveLength(1)
    expect(result.suspiciousIps[0].users[0].id).toBe('u1')
  })

  it('$queryRaw に MULTI_ACCOUNT_MIN_THRESHOLD と検出上限がパラメータとして渡る', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([])

    const { MULTI_ACCOUNT_MIN_THRESHOLD, MULTI_ACCOUNT_DETECTION_LIMIT } = await import(
      '@/lib/constants/limits'
    )
    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    await detectMultiAccounts()

    expect((mockPrisma as any).$queryRaw).toHaveBeenCalledTimes(1)
    // tagged template: [stringsArray, ...interpolated values]
    const call = (mockPrisma as any).$queryRaw.mock.calls[0]
    // 第1引数は TemplateStringsArray
    expect(Array.isArray(call[0])).toBe(true)
    // SQL に閾値判定句が含まれる
    expect(call[0].join('?')).toMatch(/HAVING COUNT\(DISTINCT user_id\) >=/)
    // 補間値: 閾値, 上限の順
    expect(call[1]).toBe(MULTI_ACCOUNT_MIN_THRESHOLD)
    expect(call[2]).toBe(MULTI_ACCOUNT_DETECTION_LIMIT)
  })

  it('ユーザー情報にcreatedAtが含まれる', async () => {
    setupAdmin()
    const createdDate = new Date('2024-06-01')
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([
      { ip_address: '10.0.0.1', user_count: BigInt(2), user_ids: 'u1,u2' },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', nickname: 'U1', email: 'u1@test.com', avatarUrl: null, isSuspended: false, createdAt: createdDate },
      { id: 'u2', nickname: 'U2', email: 'u2@test.com', avatarUrl: '/avatar.jpg', isSuspended: true, createdAt: createdDate },
    ])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    expect(result.suspiciousIps[0].users[0].createdAt).toEqual(createdDate)
    expect(result.suspiciousIps[0].users[1].isSuspended).toBe(true)
  })
})

// ============================================================
// 品質向上テスト: BigInt変換・ユーザーマップ解決・エッジケース
// ============================================================

describe('detectMultiAccounts - BigInt変換とマップ解決の詳細検証', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockPrisma as any).$queryRaw = vi.fn().mockResolvedValue([])
  })

  it('BigIntが大きな値でもNumberに正しく変換される', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([
      { ip_address: '10.0.0.1', user_count: BigInt(999), user_ids: 'u1,u2' },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', nickname: 'U1', email: 'u1@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'u2', nickname: 'U2', email: 'u2@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
    ])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    expect(result.suspiciousIps[0].userCount).toBe(999)
    expect(typeof result.suspiciousIps[0].userCount).toBe('number')
  })

  it('user_idsに含まれる全ユーザーが存在しない場合はusers配列が空になる', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([
      { ip_address: '10.0.0.1', user_count: BigInt(3), user_ids: 'deleted-1,deleted-2,deleted-3' },
    ])
    mockPrisma.user.findMany.mockResolvedValue([])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    expect(result.suspiciousIps).toHaveLength(1)
    expect(result.suspiciousIps[0].users).toEqual([])
    expect(result.suspiciousIps[0].ipAddress).toBe('10.0.0.1')
  })

  it('ユーザーマップが正しくIDでマッチし、順序が保持される', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([
      { ip_address: '10.0.0.1', user_count: BigInt(3), user_ids: 'u3,u1,u2' },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', nickname: 'First', email: 'u1@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'u2', nickname: 'Second', email: 'u2@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'u3', nickname: 'Third', email: 'u3@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
    ])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    // user_idsの順序(u3,u1,u2)に従ってマッピングされる
    expect(result.suspiciousIps[0].users[0].nickname).toBe('Third')
    expect(result.suspiciousIps[0].users[1].nickname).toBe('First')
    expect(result.suspiciousIps[0].users[2].nickname).toBe('Second')
  })

  it('user_idsの一部のみ存在する場合、存在するユーザーのみ返される', async () => {
    setupAdmin()
    ;(mockPrisma as any).$queryRaw.mockResolvedValue([
      { ip_address: '192.168.0.1', user_count: BigInt(4), user_ids: 'u1,deleted-1,u2,deleted-2' },
    ])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', nickname: 'Exists1', email: 'u1@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
      { id: 'u2', nickname: 'Exists2', email: 'u2@test.com', avatarUrl: null, isSuspended: false, createdAt: new Date() },
    ])

    const { detectMultiAccounts } = await import('@/lib/actions/admin/ip-management')
    const result: any = await detectMultiAccounts()

    expect(result.suspiciousIps[0].users).toHaveLength(2)
    expect(result.suspiciousIps[0].users[0].id).toBe('u1')
    expect(result.suspiciousIps[0].users[1].id).toBe('u2')
  })
})

describe('getIpAddresses - エッジケース', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockPrisma as any).$queryRaw = vi.fn().mockResolvedValue([])
  })

  it('ipAddressがnullのデバイスでもユーザー情報が付与される', async () => {
    setupAdmin()
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([
      { id: 'd1', ipAddress: null, userId: 'user-a', userAgent: 'Chrome', lastSeenAt: new Date() },
    ])
    ;(mockPrisma as any).userDevice.count.mockResolvedValue(1)
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'user-a', nickname: 'UserA', email: 'a@test.com', avatarUrl: null, isSuspended: false },
    ])

    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result: any = await getIpAddresses()

    expect(result.devices).toHaveLength(1)
    expect(result.devices[0].ipAddress).toBeNull()
    expect(result.devices[0].user).toEqual(expect.objectContaining({ id: 'user-a' }))
  })

  it('同一ユーザーが異なるIPで複数デバイスを持つ場合、ユーザーIDの重複が排除される', async () => {
    setupAdmin()
    const userId = 'same-user'
    ;(mockPrisma as any).userDevice.findMany.mockResolvedValue([
      { id: 'd1', ipAddress: '10.0.0.1', userId, userAgent: 'Chrome', lastSeenAt: new Date() },
      { id: 'd2', ipAddress: '10.0.0.2', userId, userAgent: 'Firefox', lastSeenAt: new Date() },
      { id: 'd3', ipAddress: '10.0.0.3', userId, userAgent: 'Safari', lastSeenAt: new Date() },
    ])
    ;(mockPrisma as any).userDevice.count.mockResolvedValue(3)
    mockPrisma.user.findMany.mockResolvedValue([
      { id: userId, nickname: 'SameUser', email: 's@test.com', avatarUrl: null, isSuspended: false },
    ])

    const { getIpAddresses } = await import('@/lib/actions/admin/ip-management')
    const result: any = await getIpAddresses()

    expect(result.devices).toHaveLength(3)
    // user.findManyはユニークなIDのみで呼ばれる
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [userId] } },
      })
    )
    // 全デバイスに同一ユーザー情報が付与される
    result.devices.forEach((d: any) => {
      expect(d.user?.id).toBe(userId)
    })
  })
})
