import { vi } from 'vitest'
import { createMockPrismaClient } from '../../utils/test-utils'
/**
 * Extended draft tests - saveDraft, getDrafts, getDraft, getDraftCount, publishDraft, deleteDraft
 */
export {}

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma = createMockPrismaClient()
const dp = mockPrisma.draftPost
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
    vi.mocked(dp.findMany).mockResolvedValue([
      { id: 'd1', content: 'Draft 1', media: [], genres: [] },
    ] as never)

    const result = await getDrafts()
    expect(result).toMatchObject({ success: true, data: { drafts: expect.any(Array) } })
  })

  it('handles db error', async () => {
    const { getDrafts } = await import('@/lib/actions/draft')
    vi.mocked(dp.findMany).mockRejectedValue(new Error('db'))

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
    vi.mocked(dp.count).mockResolvedValue(3)
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
    vi.mocked(dp.findFirst).mockResolvedValue({
      id: 'd1', content: 'test', userId: 'u1', media: [], genres: [],
    } as never)

    const result = await getDraft('d1')
    expect(result).toMatchObject({ success: true, data: { draft: expect.any(Object) } })
  })

  it('returns error for not found', async () => {
    const { getDraft } = await import('@/lib/actions/draft')
    vi.mocked(dp.findFirst).mockResolvedValue(null)

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
    vi.mocked(dp.create).mockResolvedValue({ id: 'd1', content: 'テスト下書き', media: [], genres: [] } as never)

    const result = await saveDraft({ content: 'テスト下書き' })
    expect(result).toMatchObject({ success: true, data: { draft: expect.any(Object) } })
  })

  it('updates existing draft', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    vi.mocked(dp.findFirst).mockResolvedValue({ id: 'd1', userId: 'u1' } as never)
    vi.mocked(dp.update).mockResolvedValue({ id: 'd1', media: [], genres: [] } as never)
    vi.mocked(mockPrisma.draftPostMedia.deleteMany).mockResolvedValue({} as never)
    vi.mocked(mockPrisma.draftPostGenre.deleteMany).mockResolvedValue({} as never)

    const result = await saveDraft({ id: 'd1', content: '更新内容' })
    expect(result).toBeDefined()
  })

  it('rejects other user draft update', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    vi.mocked(dp.findFirst).mockResolvedValue(null)

    const result = await saveDraft({ id: 'd1', content: 'test' })
    expect(result).toHaveProperty('error')
  })

  it('handles db error', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    vi.mocked(dp.create).mockRejectedValue(new Error('db'))

    const result = await saveDraft({ content: 'test' })
    expect(result).toHaveProperty('error')
  })

  it('saves with media and genres', async () => {
    const { saveDraft } = await import('@/lib/actions/draft')
    vi.mocked(dp.create).mockResolvedValue({ id: 'd1', media: [], genres: [] } as never)

    const result = await saveDraft({
      content: 'テスト',
      mediaUrls: ['/img1.jpg'],
      genreIds: ['g1'],
    })
    expect(result).toBeDefined()
  })

  it('無料会員が動画を含む下書きを保存しようとすると ERR_VIDEO_PREMIUM_ONLY を返す', async () => {
    const { getMembershipLimits } = await import('@/lib/premium')
    vi.mocked(getMembershipLimits).mockResolvedValueOnce({
      maxDailyPosts: 20,
      maxPostLength: 500,
      maxImages: 4,
      maxVideos: 0,
      canSchedulePost: false,
      canViewAnalytics: false,
    })

    const { saveDraft } = await import('@/lib/actions/draft')
    const result = await saveDraft({
      content: 'テスト',
      mediaUrls: ['/video.mp4'],
      mediaTypes: ['video'],
    })

    expect(result).toMatchObject({ success: false, error: '動画の投稿はプレミアム会員限定です' })
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
    vi.mocked(dp.findFirst).mockResolvedValue({ id: 'd1', userId: 'u1', media: [] } as never)
    vi.mocked(dp.delete).mockResolvedValue({} as never)

    const result = await deleteDraft('d1')
    expect(result).toHaveProperty('success', true)
  })

  it('rejects non-existent draft', async () => {
    const { deleteDraft } = await import('@/lib/actions/draft')
    vi.mocked(dp.findFirst).mockResolvedValue(null)

    const result = await deleteDraft('d999')
    expect(result).toHaveProperty('error')
  })

  it('handles db error', async () => {
    const { deleteDraft } = await import('@/lib/actions/draft')
    vi.mocked(dp.findFirst).mockResolvedValue({ id: 'd1', userId: 'u1' } as never)
    vi.mocked(dp.delete).mockRejectedValue(new Error('db'))

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
    vi.mocked(dp.findFirst).mockResolvedValue(null)

    const result = await publishDraft('d999')
    expect(result).toHaveProperty('error')
  })

  it('publishes draft successfully', async () => {
    const { publishDraft } = await import('@/lib/actions/draft')
    vi.mocked(dp.findFirst).mockResolvedValue({
      id: 'd1', userId: 'u1', content: 'テスト投稿',
      media: [{ url: '/img.jpg', type: 'image', sortOrder: 0 }],
      genres: [{ genreId: 'g1' }],
    } as never)
    vi.mocked(mockPrisma.post.count).mockResolvedValue(0)
    vi.mocked(mockPrisma.post.create).mockResolvedValue({ id: 'p1' } as never)
    vi.mocked(dp.delete).mockResolvedValue({} as never)

    const result = await publishDraft('d1')
    expect(result).toMatchObject({ success: true, data: { postId: 'p1' } })
  })

  it('handles db error during publish', async () => {
    const { publishDraft } = await import('@/lib/actions/draft')
    vi.mocked(dp.findFirst).mockResolvedValue({
      id: 'd1', userId: 'u1', content: 'テスト',
      media: [], genres: [],
    } as never)
    vi.mocked(mockPrisma.post.count).mockResolvedValue(0)
    vi.mocked(mockPrisma.post.create).mockRejectedValue(new Error('db'))

    const result = await publishDraft('d1')
    expect(result).toHaveProperty('error')
  })
})
