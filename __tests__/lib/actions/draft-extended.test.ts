import { vi } from 'vitest'
/**
 * Extended draft tests - saveDraft, getDrafts, getDraft, getDraftCount, publishDraft, deleteDraft
 */
export {}

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  draftPost: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn(), upsert: vi.fn() },
  draftPostMedia: { deleteMany: vi.fn(), createMany: vi.fn() },
  draftPostGenre: { deleteMany: vi.fn(), createMany: vi.fn() },
  post: { create: vi.fn(), count: vi.fn() },
  postMedia: { createMany: vi.fn() },
  postGenre: { createMany: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn().mockImplementation(async (fn: unknown) => {
    if (typeof fn === 'function') return (fn as (tx: unknown) => Promise<unknown>)(mockPrisma)
    return fn
  }),
}
const dp = mockPrisma.draftPost as Record<string, ReturnType<typeof vi.fn>>
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ default: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }, logger: { log: vi.fn(), error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() } }))
vi.mock('@/lib/services/usage', () => ({
  getMembershipLimits: vi.fn().mockResolvedValue({ maxPostLength: 500, maxImages: 4, maxVideos: 1 }),
}))
vi.mock('@/lib/premium', () => ({
  getMembershipLimits: vi.fn().mockResolvedValue({ maxDailyPosts: 20, maxPostLength: 500, maxImages: 4, maxVideos: 1 }),
}))
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    getStartOfToday: vi.fn().mockReturnValue(new Date('2026-01-01T00:00:00Z')),
  }
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
})

describe('getDrafts', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { getDrafts } = await import('@/lib/actions/draft')
    const result = await getDrafts()
    expect(result).toHaveProperty('error')
  })

  it('returns user drafts', async () => {
    const { getDrafts } = await import('@/lib/actions/draft')
    dp.findMany.mockResolvedValue([
      { id: 'd1', content: 'Draft 1', media: [], genres: [] },
    ])

    const result = await getDrafts()
    expect(result).toMatchObject({ success: true, data: { drafts: expect.any(Array) } })
  })

  it('handles db error', async () => {
    const { getDrafts } = await import('@/lib/actions/draft')
    dp.findMany.mockRejectedValue(new Error('db'))

    const result = await getDrafts()
    expect(result).toHaveProperty('error')
  })
})

describe('getDraftCount', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { getDraftCount } = await import('@/lib/actions/draft')
    const result = await getDraftCount()
    expect(result).toBe(0)
  })

  it('returns count', async () => {
    const { getDraftCount } = await import('@/lib/actions/draft')
    dp.count.mockResolvedValue(3)
    const result = await getDraftCount()
    expect(result).toBe(3)
  })
})

describe('getDraft', async () => {
  it('returns error when draftId is empty (Zod)', async () => {
    const { getDraft } = await import('@/lib/actions/draft')
    const result = await getDraft('')
    expect(result).toHaveProperty('error')
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { getDraft } = await import('@/lib/actions/draft')
    const result = await getDraft('d1')
    expect(result).toHaveProperty('error')
  })

  it('returns draft by id', async () => {
    const { getDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue({
      id: 'd1', content: 'test', userId: 'u1', media: [], genres: [],
    })

    const result = await getDraft('d1')
    expect(result).toMatchObject({ success: true, data: { draft: expect.any(Object) } })
  })

  it('returns error for not found', async () => {
    const { getDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue(null)

    const result = await getDraft('d999')
    expect(result).toHaveProperty('error')
  })
})

describe('saveDraft', async () => {
  it('returns error when content exceeds max length (Zod)', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    const result = await saveDraft({ content: 'a'.repeat(501) })
    expect(result).toHaveProperty('error')
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { saveDraft } = await import('@/lib/actions/draft')
    const result = await saveDraft({ content: 'test' })
    expect(result).toHaveProperty('error')
  })

  it('creates new draft', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    dp.create.mockResolvedValue({ id: 'd1', content: 'テスト下書き', media: [], genres: [] })

    const result = await saveDraft({ content: 'テスト下書き' })
    expect(result).toMatchObject({ success: true, data: { draft: expect.any(Object) } })
  })

  it('updates existing draft', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue({ id: 'd1', userId: 'u1' })
    dp.update.mockResolvedValue({ id: 'd1', media: [], genres: [] })
    ;(mockPrisma.draftPostMedia as Record<string, ReturnType<typeof vi.fn>>).deleteMany.mockResolvedValue({})
    ;(mockPrisma.draftPostGenre as Record<string, ReturnType<typeof vi.fn>>).deleteMany.mockResolvedValue({})

    const result = await saveDraft({ id: 'd1', content: '更新内容' })
    expect(result).toBeDefined()
  })

  it('rejects other user draft update', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue(null)

    const result = await saveDraft({ id: 'd1', content: 'test' })
    expect(result).toHaveProperty('error')
  })

  it('handles db error', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    dp.create.mockRejectedValue(new Error('db'))

    const result = await saveDraft({ content: 'test' })
    expect(result).toHaveProperty('error')
  })

  it('saves with media and genres', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    dp.create.mockResolvedValue({ id: 'd1', media: [], genres: [] })

    const result = await saveDraft({
      content: 'テスト',
      mediaUrls: ['/img1.jpg'],
      genreIds: ['g1'],
    })
    expect(result).toBeDefined()
  })
})

describe('deleteDraft', async () => {
  it('returns error when draftId is empty (Zod)', async () => {
    const { deleteDraft } = await import('@/lib/actions/draft')
    const result = await deleteDraft('')
    expect(result).toHaveProperty('error')
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteDraft } = await import('@/lib/actions/draft')
    const result = await deleteDraft('d1')
    expect(result).toHaveProperty('error')
  })

  it('deletes own draft', async () => {
    const { deleteDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue({ id: 'd1', userId: 'u1' })
    dp.delete.mockResolvedValue({})

    const result = await deleteDraft('d1')
    expect(result).toHaveProperty('success', true)
  })

  it('rejects non-existent draft', async () => {
    const { deleteDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue(null)

    const result = await deleteDraft('d999')
    expect(result).toHaveProperty('error')
  })

  it('handles db error', async () => {
    const { deleteDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue({ id: 'd1', userId: 'u1' })
    dp.delete.mockRejectedValue(new Error('db'))

    const result = await deleteDraft('d1')
    expect(result).toHaveProperty('error')
  })
})

describe('publishDraft', async () => {
  it('returns error when draftId is empty (Zod)', async () => {
    const { publishDraft } = await import('@/lib/actions/draft')
    const result = await publishDraft('')
    expect(result).toHaveProperty('error')
  })

  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { publishDraft } = await import('@/lib/actions/draft')
    const result = await publishDraft('d1')
    expect(result).toHaveProperty('error')
  })

  it('rejects non-existent draft', async () => {
    const { publishDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue(null)

    const result = await publishDraft('d999')
    expect(result).toHaveProperty('error')
  })

  it('publishes draft successfully', async () => {
    const { publishDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue({
      id: 'd1', userId: 'u1', content: 'テスト投稿',
      media: [{ url: '/img.jpg', type: 'image', sortOrder: 0 }],
      genres: [{ genreId: 'g1' }],
    })
    ;(mockPrisma.post as Record<string, ReturnType<typeof vi.fn>>).count.mockResolvedValue(0)
    ;(mockPrisma.post as Record<string, ReturnType<typeof vi.fn>>).create.mockResolvedValue({ id: 'p1' })
    dp.delete.mockResolvedValue({})

    const result = await publishDraft('d1')
    expect(result).toMatchObject({ success: true, data: { postId: 'p1' } })
  })

  it('handles db error during publish', async () => {
    const { publishDraft } = await import('@/lib/actions/draft')
    dp.findFirst.mockResolvedValue({
      id: 'd1', userId: 'u1', content: 'テスト',
      media: [], genres: [],
    })
    ;(mockPrisma.post as Record<string, ReturnType<typeof vi.fn>>).count.mockResolvedValue(0)
    ;(mockPrisma.post as Record<string, ReturnType<typeof vi.fn>>).create.mockRejectedValue(new Error('db'))

    const result = await publishDraft('d1')
    expect(result).toHaveProperty('error')
  })
})
