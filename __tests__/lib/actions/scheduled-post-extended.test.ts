import { vi } from 'vitest'
/**
 * Extended scheduled-post tests - updateScheduledPost uncovered branches
 */
export {};

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockTx = {
  scheduledPostMedia: { deleteMany: vi.fn() },
  scheduledPostGenre: { deleteMany: vi.fn() },
  scheduledPost: { update: vi.fn() },
}
const mockPrisma: Record<string, any> = {
  scheduledPost: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  scheduledPostMedia: { deleteMany: vi.fn() },
  scheduledPostGenre: { deleteMany: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/services/usage', () => ({
  getMembershipLimits: vi.fn().mockResolvedValue({ maxPostLength: 500, maxImages: 4, maxVideos: 1 }),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
})

function makeFormData(overrides: Record<string, string | string[]> = {}) {
  const fd = new FormData()
  fd.set('content', overrides.content as string || 'テスト投稿')
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + 1)
  fd.set('scheduledAt', overrides.scheduledAt as string || futureDate.toISOString())
  if (overrides.genreIds) {
    for (const g of overrides.genreIds as string[]) fd.append('genreIds', g)
  }
  if (overrides.mediaUrls) {
    for (const u of overrides.mediaUrls as string[]) fd.append('mediaUrls', u)
  }
  if (overrides.mediaTypes) {
    for (const t of overrides.mediaTypes as string[]) fd.append('mediaTypes', t)
  }
  return fd
}

describe('updateScheduledPost', async () => {
  it('requires auth', async () => {
    mockAuth.mockResolvedValue(null)
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    const result = await updateScheduledPost('sp1', makeFormData())
    expect(result.error).toContain('認証')
  })

  it('rejects non-existent post', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    const result = await updateScheduledPost('sp1', makeFormData())
    expect(result.error).toContain('見つかりません')
  })

  it('rejects if not owner', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'other', status: 'pending' })
    const result = await updateScheduledPost('sp1', makeFormData())
    expect(result.error).toContain('権限')
  })

  it('rejects non-pending post', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'published' })
    const result = await updateScheduledPost('sp1', makeFormData())
    expect(result.error).toContain('編集できません')
  })

  it('rejects missing scheduledAt', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    const fd = new FormData()
    fd.set('content', 'test')
    const result = await updateScheduledPost('sp1', fd)
    expect(result.error).toContain('予約日時')
  })

  it('rejects past scheduledAt', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    const result = await updateScheduledPost('sp1', makeFormData({ scheduledAt: '2020-01-01T00:00:00Z' }))
    expect(result.error).toContain('未来')
  })

  it('rejects scheduledAt beyond 30 days', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    const farFuture = new Date()
    farFuture.setDate(farFuture.getDate() + 31)
    const result = await updateScheduledPost('sp1', makeFormData({ scheduledAt: farFuture.toISOString() }))
    expect(result.error).toContain('30日')
  })

  it('rejects empty content and no media', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    const fd = new FormData()
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    fd.set('scheduledAt', futureDate.toISOString())
    const result = await updateScheduledPost('sp1', fd)
    expect(result.error).toContain('テキストまたはメディア')
  })

  it('rejects content exceeding max length', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    const result = await updateScheduledPost('sp1', makeFormData({ content: 'x'.repeat(501) }))
    expect(result.error).toContain('文字以内')
  })

  it('rejects more than 3 genres', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    const result = await updateScheduledPost('sp1', makeFormData({ genreIds: ['g1', 'g2', 'g3', 'g4'] }))
    expect(result.error).toContain('3つまで')
  })

  it('rejects too many images', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    const result = await updateScheduledPost('sp1', makeFormData({
      mediaUrls: ['/1.jpg', '/2.jpg', '/3.jpg', '/4.jpg', '/5.jpg'],
      mediaTypes: ['image', 'image', 'image', 'image', 'image'],
    }))
    expect(result.error).toContain('枚まで')
  })

  it('rejects too many videos', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    const result = await updateScheduledPost('sp1', makeFormData({
      mediaUrls: ['/1.mp4', '/2.mp4'],
      mediaTypes: ['video', 'video'],
    }))
    expect(result.error).toContain('本まで')
  })

  it('updates successfully with transaction', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    mockTx.scheduledPostMedia.deleteMany.mockResolvedValue({})
    mockTx.scheduledPostGenre.deleteMany.mockResolvedValue({})
    mockTx.scheduledPost.update.mockResolvedValue({})

    const result = await updateScheduledPost('sp1', makeFormData())
    expect(result.success).toBe(true)
  })

  it('updates with media and genres', async () => {
    const { updateScheduledPost } = await import('@/lib/actions/scheduled-post')
    ;(mockPrisma.scheduledPost.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'u1', status: 'pending' })
    mockTx.scheduledPostMedia.deleteMany.mockResolvedValue({})
    mockTx.scheduledPostGenre.deleteMany.mockResolvedValue({})
    mockTx.scheduledPost.update.mockResolvedValue({})

    const result = await updateScheduledPost('sp1', makeFormData({
      mediaUrls: ['/img.jpg'],
      mediaTypes: ['image'],
      genreIds: ['g1', 'g2'],
    }))
    expect(result.success).toBe(true)
    expect(mockTx.scheduledPost.update).toHaveBeenCalled()
  })
})
