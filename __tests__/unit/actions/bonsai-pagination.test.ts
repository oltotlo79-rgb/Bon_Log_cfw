// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockPrismaClient, mockUser } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/auth', () => ({ auth: () => mockAuthFn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: {},
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('@/lib/logger', () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

const mockAuthFn = vi.fn()

const mockBonsai = {
  id: 'bonsai-1',
  userId: mockUser.id,
  name: '黒松',
  species: 'クロマツ',
  acquiredAt: null,
  description: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  records: [],
  _count: { records: 0 },
}

describe('getBonsais pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthFn.mockResolvedValue({ user: { id: mockUser.id } })
  })

  /** ActionResult 成功レスポンスから data 部を取り出す（型安全） */
  function unwrapOk<T>(result: { success: true; data?: T } | { success: false; error: string }): T {
    if (!result.success) throw new Error(`Expected success, got error: ${result.error}`)
    if (!result.data) throw new Error('Expected data to be defined')
    return result.data
  }

  it('returns bonsais for current user when no userId provided', async () => {
    const { getBonsais } = await import('@/lib/actions/bonsai')
    mockPrisma.bonsai.findMany.mockResolvedValue([mockBonsai])

    const result = await getBonsais()
    const data = unwrapOk<{ bonsais: Array<{ id: string }> }>(result)
    expect(data.bonsais).toHaveLength(1)
    expect(data.bonsais[0].id).toBe('bonsai-1')
  })

  it('returns bonsais for specified userId', async () => {
    const { getBonsais } = await import('@/lib/actions/bonsai')
    mockPrisma.bonsai.findMany.mockResolvedValue([mockBonsai])

    await getBonsais('other-user-id')
    expect(mockPrisma.bonsai.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'other-user-id' },
      })
    )
  })

  it('returns empty array when user has no bonsais', async () => {
    const { getBonsais } = await import('@/lib/actions/bonsai')
    mockPrisma.bonsai.findMany.mockResolvedValue([])

    const result = await getBonsais()
    const data = unwrapOk<{ bonsais: unknown[] }>(result)
    expect(data.bonsais).toHaveLength(0)
  })

  it('returns error when not authenticated and no userId', async () => {
    const { getBonsais } = await import('@/lib/actions/bonsai')
    mockAuthFn.mockResolvedValue(null)

    const result = await getBonsais()
    expect(result).toMatchObject({ success: false })
  })

  it('getBonsaiTimeline returns records with cursor', async () => {
    const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
    const mockRecord = {
      id: 'record-1',
      bonsaiId: 'bonsai-1',
      content: 'テスト記録',
      recordAt: new Date('2024-01-01'),
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      bonsai: {
        ...mockBonsai,
        user: { id: mockUser.id, nickname: 'テストユーザー', avatarUrl: null },
      },
      images: [],
    }
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([mockRecord])

    const result = await getBonsaiTimeline({ cursor: 'cursor-id', limit: 10 })
    const data = unwrapOk<{ records: Array<typeof mockRecord>; nextCursor?: string }>(result)
    expect(data.records).toHaveLength(1)
    expect(mockPrisma.bonsaiRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: 'cursor-id' },
        skip: 1,
        take: 10,
      })
    )
  })

  it('getBonsaiTimeline returns empty records and no nextCursor when empty', async () => {
    const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])

    const result = await getBonsaiTimeline()
    const data = unwrapOk<{ records: unknown[]; nextCursor?: string }>(result)
    expect(data.records).toHaveLength(0)
    expect(data.nextCursor).toBeUndefined()
  })

  it('getBonsaiTimeline sets nextCursor when result equals limit', async () => {
    const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
    const records = Array.from({ length: 20 }, (_, i) => ({
      id: `record-${i}`,
      bonsaiId: 'bonsai-1',
      content: `記録 ${i}`,
      recordAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      bonsai: { ...mockBonsai, user: { id: mockUser.id, nickname: 'テストユーザー', avatarUrl: null } },
      images: [],
    }))
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue(records)

    const result = await getBonsaiTimeline({ limit: 20 })
    const data = unwrapOk<{ records: typeof records; nextCursor?: string }>(result)
    expect(data.nextCursor).toBe('record-19')
  })
})
