import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockPrisma = {
  announcement: {
    findMany: vi.fn(),
  },
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

// unstable_cache は本番で 60 秒キャッシュを返すが、テストではそのまま呼び出したい
vi.mock('next/cache', () => ({
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  cache: vi.fn((fn: unknown) => fn),
}))

vi.mock('@/lib/logger', () => ({
  logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

describe('getActiveAnnouncements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('有効なお知らせのみを取得する', async () => {
    const now = new Date('2026-04-22')
    vi.useFakeTimers().setSystemTime(now)

    const items = [
      { id: 'a1', title: '更新', startsAt: new Date('2026-04-01'), endsAt: null, isActive: true },
    ]
    mockPrisma.announcement.findMany.mockResolvedValue(items)

    const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
    const result = await getActiveAnnouncements()

    expect(result).toEqual(items)
    expect(mockPrisma.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        }),
      }),
    )

    vi.useRealTimers()
  })

  it('DBエラー発生時は空配列にフォールバックする', async () => {
    mockPrisma.announcement.findMany.mockRejectedValue(new Error('DB down'))

    const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
    const result = await getActiveAnnouncements()

    expect(result).toEqual([])
  })

  it('Error 以外（非 Error 値）で reject された場合も空配列を返す', async () => {
    mockPrisma.announcement.findMany.mockRejectedValueOnce('boom-string')

    const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
    const result = await getActiveAnnouncements()

    expect(result).toEqual([])
  })

  it('endsAt が将来の通知も対象に含まれる（OR 分岐の片側）', async () => {
    const now = new Date('2026-04-22T00:00:00.000Z')
    vi.useFakeTimers().setSystemTime(now)
    const future = { id: 'a2', startsAt: new Date('2026-04-01'), endsAt: new Date('2099-01-01'), isActive: true }
    mockPrisma.announcement.findMany.mockResolvedValueOnce([future])

    const { getActiveAnnouncements } = await import('@/lib/actions/announcement')
    const result = await getActiveAnnouncements()

    expect(result).toEqual([future])
    vi.useRealTimers()
  })
})
