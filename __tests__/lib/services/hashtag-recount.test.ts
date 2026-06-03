// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('recalculateHashtagCountsCore', () => {
  it('post_hashtags の行数に基づいて hashtags.count を一括 UPDATE する', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(5)
    const { recalculateHashtagCountsCore } = await import('@/lib/services/hashtag-recount')
    await recalculateHashtagCountsCore()
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1)

    // tagged-template の `strings` 配列を取り出して SQL 本体を検証する。
    // SQL injection 対策の観点から、サブクエリ内 hashtag_id 結合と
    // 集計対象テーブルが想定どおりか確認しておく。
    const callArg = mockPrisma.$executeRaw.mock.calls[0]![0] as { raw: string[] } | TemplateStringsArray
    const sql = Array.isArray(callArg) ? (callArg as TemplateStringsArray).join('') : (callArg as { raw: string[] }).raw.join('')
    expect(sql).toMatch(/UPDATE\s+hashtags/i)
    expect(sql).toMatch(/SET\s+count\s*=/i)
    expect(sql).toMatch(/COUNT\(\*\)\s+FROM\s+post_hashtags/i)
    expect(sql).toMatch(/ph\.hashtag_id\s*=\s*h\.id/i)
  })

  it('void を返す (戻り値を呼び出し側に渡さない)', async () => {
    mockPrisma.$executeRaw.mockResolvedValueOnce(42)
    const { recalculateHashtagCountsCore } = await import('@/lib/services/hashtag-recount')
    const result = await recalculateHashtagCountsCore()
    expect(result).toBeUndefined()
  })

  it('Prisma のエラーは例外として呼び出し側に伝播する', async () => {
    mockPrisma.$executeRaw.mockRejectedValueOnce(new Error('DB connection lost'))
    const { recalculateHashtagCountsCore } = await import('@/lib/services/hashtag-recount')
    await expect(recalculateHashtagCountsCore()).rejects.toThrow('DB connection lost')
  })
})
