// @vitest-environment node

/**
 * 構造的隔離テスト: 手入れログ (BonsaiCareLog) は
 * 既存の盆栽タイムライン取得（getBonsaiTimeline）や
 * 個別盆栽の成長記録取得（getBonsaiRecords）に
 * 漏出しないことを保証する。
 *
 * BonsaiCareLog は Bonsai に紐付かないため Prisma の include / select で
 * 引き込めず、構造的に漏出不能だが、将来のリファクタで誤って
 * `bonsai.careLog` リレーションが追加された場合に備えて検証する。
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('@/lib/actions/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/actions/utils')>('@/lib/actions/utils')
  return {
    ...actual,
    requireAuth: vi.fn().mockResolvedValue({ userId: 'user-1' }),
    requireActiveUser: vi.fn().mockResolvedValue({ userId: 'user-1' }),
  }
})

vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: unknown) => fn),
}))

vi.mock('@/lib/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn(), log: vi.fn() },
}))

describe('BonsaiCareLog のタイムライン非漏出', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('getBonsaiTimeline は bonsaiRecord のみを取得し、bonsaiCareLog は触らない', async () => {
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])
    const { getBonsaiTimeline } = await import('@/lib/actions/bonsai-record')
    await getBonsaiTimeline()

    // bonsaiRecord のみ呼ばれる
    expect(mockPrisma.bonsaiRecord.findMany).toHaveBeenCalled()
    expect(mockPrisma.bonsaiCareLog.findMany).not.toHaveBeenCalled()
    // include に careLogs を含まないことを明示検証
    const callArg = mockPrisma.bonsaiRecord.findMany.mock.calls[0]?.[0]
    const includeKeys = Object.keys(callArg?.include ?? {})
    expect(includeKeys).not.toContain('careLogs')
    expect(includeKeys).not.toContain('careLog')
  })

  it('getBonsaiRecords も bonsaiCareLog は触らない', async () => {
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])
    const { getBonsaiRecords } = await import('@/lib/actions/bonsai-record')
    await getBonsaiRecords('bonsai-1')

    expect(mockPrisma.bonsaiCareLog.findMany).not.toHaveBeenCalled()
  })

  it('getBonsais は bonsaiCareLog を一切引き込まない', async () => {
    mockPrisma.bonsai.findMany.mockResolvedValue([])
    const { getBonsais } = await import('@/lib/actions/bonsai')
    await getBonsais()

    expect(mockPrisma.bonsaiCareLog.findMany).not.toHaveBeenCalled()
    const callArg = mockPrisma.bonsai.findMany.mock.calls[0]?.[0]
    const includeKeys = Object.keys(callArg?.include ?? {})
    expect(includeKeys).not.toContain('careLogs')
    expect(includeKeys).not.toContain('careLog')
  })
})
