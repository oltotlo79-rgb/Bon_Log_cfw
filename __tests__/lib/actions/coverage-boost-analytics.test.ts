// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/analytics')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('@/lib/premium', () => ({
  getMembershipLimits: vi.fn(),
  isPremiumUser: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({

  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))


/**
 * `ActionResult<T>` を旧フラット形状に展開する互換ヘルパー（analytics 移行用）。
 * 成功時は `data` を展開、失敗時は `{ error }` を返す。
 */
function unwrap<T>(result: import('@/types/action-result').ActionResult<T>): (T extends object ? T : Record<string, never>) & { error?: string } {
  if (result.success) {
    return ((result.data ?? {}) as unknown) as (T extends object ? T : Record<string, never>) & { error?: string }
  }
  return { error: result.error } as (T extends object ? T : Record<string, never>) & { error?: string }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
})

describe('analytics - getEngagementTrend daily stats aggregation', async () => {
  it('投稿データが日別統計に正しく集計される (lines 741-743)', async () => {
    // Use the same date generation logic as the source code to avoid timezone issues
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - 6)
    startDate.setHours(0, 0, 0, 0)

    // Generate date keys matching the source's loop (line 728-732)
    const dateKeys: string[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      dateKeys.push(d.toISOString().split('T')[0]!)
    }

    // Use dates that match specific keys in the generated range
    const yesterdayDate = new Date(startDate)
    yesterdayDate.setDate(yesterdayDate.getDate() + 5) // 6th day = yesterday
    const twoDaysAgoDate = new Date(startDate)
    twoDaysAgoDate.setDate(twoDaysAgoDate.getDate() + 4) // 5th day = 2 days ago

    mockPrisma.post.findMany.mockResolvedValue([
      { id: 'p1', createdAt: yesterdayDate, _count: { likes: 5, comments: 3 } },
      { id: 'p2', createdAt: yesterdayDate, _count: { likes: 10, comments: 2 } },
      { id: 'p3', createdAt: twoDaysAgoDate, _count: { likes: 7, comments: 4 } },
    ])

    const { getEngagementTrend } = await import('@/lib/actions/analytics')
    const result = unwrap(await getEngagementTrend(7))

    expect(result).toHaveProperty('trend')
    const trend = result.trend as Array<{ date: string; posts: number; likes: number; comments: number; engagement: number }>
    expect(Array.isArray(trend)).toBe(true)
    expect(trend).toHaveLength(7)

    // Find yesterday's stats - should have 2 posts aggregated
    const yesterdayKey = dateKeys[5]
    const yesterdayStats = trend.find((d) => d.date === yesterdayKey)!
    expect(yesterdayStats).toBeDefined()
    expect(yesterdayStats.posts).toBe(2)
    expect(yesterdayStats.likes).toBe(15)
    expect(yesterdayStats.comments).toBe(5)
    expect(yesterdayStats.engagement).toBe(20)

    const twoDaysAgoKey = dateKeys[4]
    const twoDaysAgoStats = trend.find((d) => d.date === twoDaysAgoKey)!
    expect(twoDaysAgoStats).toBeDefined()
    expect(twoDaysAgoStats.posts).toBe(1)
    expect(twoDaysAgoStats.likes).toBe(7)
    expect(twoDaysAgoStats.comments).toBe(4)
  })
})
