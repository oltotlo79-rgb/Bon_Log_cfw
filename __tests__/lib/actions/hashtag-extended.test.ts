// @vitest-environment node

import { vi } from 'vitest'
vi.unmock('@/lib/actions/hashtag')

import { createMockPrismaClient } from '../../utils/test-utils'

const mockPrisma = createMockPrismaClient()
vi.mock('@/lib/build/db-availability', () => ({ shouldSkipBuildTimeDbAccess: () => false }))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  mockAuth.mockResolvedValue({ user: { id: 'u1' } })
})

// ============================================================
// attachHashtagsToPost
// ============================================================
describe('attachHashtagsToPost', async () => {
  it('extracts and attaches hashtags from content', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    mockPrisma.hashtag.upsert.mockResolvedValue({ id: 'h1', name: '盆栽', count: 1 })
    mockPrisma.postHashtag.upsert.mockResolvedValue({})

    await attachHashtagsToPost('p1', '今日の #盆栽 です')

    expect(mockPrisma.hashtag.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { name: '盆栽' } })
    )
    expect(mockPrisma.postHashtag.upsert).toHaveBeenCalled()
  })

  it('handles null content', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    await attachHashtagsToPost('p1', null)
    expect(mockPrisma.hashtag.upsert).not.toHaveBeenCalled()
  })

  it('handles empty content with no hashtags', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    await attachHashtagsToPost('p1', 'no tags here')
    expect(mockPrisma.hashtag.upsert).not.toHaveBeenCalled()
  })

  it('handles multiple hashtags', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    mockPrisma.hashtag.upsert.mockResolvedValue({ id: 'h1', name: 'test', count: 1 })
    mockPrisma.postHashtag.upsert.mockResolvedValue({})

    await attachHashtagsToPost('p1', '#bonsai #tree #pine')

    expect(mockPrisma.hashtag.upsert).toHaveBeenCalledTimes(3)
  })

  it('deduplicates hashtags', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    mockPrisma.hashtag.upsert.mockResolvedValue({ id: 'h1', name: 'test', count: 1 })
    mockPrisma.postHashtag.upsert.mockResolvedValue({})

    await attachHashtagsToPost('p1', '#bonsai #Bonsai')

    expect(mockPrisma.hashtag.upsert).toHaveBeenCalledTimes(1)
  })

  it('handles db error silently', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    mockPrisma.hashtag.upsert.mockRejectedValue(new Error('DB error'))

    await expect(attachHashtagsToPost('p1', '#bonsai')).resolves.toBeUndefined()
  })
})

// ============================================================
// detachHashtagsFromPost
// ============================================================
describe('detachHashtagsFromPost', async () => {
  it('detaches hashtags and decrements count', async () => {
    const { detachHashtagsFromPost } = await import('@/lib/services/hashtag-sync')
    mockPrisma.postHashtag.findMany.mockResolvedValue([
      { hashtagId: 'h1', hashtag: { id: 'h1', name: '盆栽' } },
    ])
    mockPrisma.postHashtag.deleteMany.mockResolvedValue({})
    mockPrisma.hashtag.update.mockResolvedValue({})
    mockPrisma.hashtag.deleteMany.mockResolvedValue({})

    await detachHashtagsFromPost('p1')

    expect(mockPrisma.postHashtag.deleteMany).toHaveBeenCalledWith({ where: { postId: 'p1' } })
    expect(mockPrisma.hashtag.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'h1' } })
    )
  })

  it('handles no hashtags', async () => {
    const { detachHashtagsFromPost } = await import('@/lib/services/hashtag-sync')
    mockPrisma.postHashtag.findMany.mockResolvedValue([])
    mockPrisma.postHashtag.deleteMany.mockResolvedValue({})
    mockPrisma.hashtag.deleteMany.mockResolvedValue({})

    await detachHashtagsFromPost('p1')

    expect(mockPrisma.hashtag.update).not.toHaveBeenCalled()
  })

  it('handles db error silently', async () => {
    const { detachHashtagsFromPost } = await import('@/lib/services/hashtag-sync')
    mockPrisma.postHashtag.findMany.mockRejectedValue(new Error('DB error'))

    await expect(detachHashtagsFromPost('p1')).resolves.toBeUndefined()
  })
})

// ============================================================
// getTrendingHashtags
// ============================================================
describe('getTrendingHashtags', async () => {
  it('returns trending hashtags', async () => {
    const { getTrendingHashtags } = await import('@/lib/actions/hashtag')
    const hashtags = [{ id: 'h1', name: '盆栽', count: 50 }]
    mockPrisma.hashtag.findMany.mockResolvedValue(hashtags)

    const result = await getTrendingHashtags()

    expect(result).toEqual(hashtags)
    expect(mockPrisma.hashtag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { count: 'desc' } })
    )
  })

  it('accepts custom limit', async () => {
    const { getTrendingHashtags } = await import('@/lib/actions/hashtag')
    mockPrisma.hashtag.findMany.mockResolvedValue([])

    await getTrendingHashtags(5)

    expect(mockPrisma.hashtag.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    )
  })

  it('returns empty array on error', async () => {
    const { getTrendingHashtags } = await import('@/lib/actions/hashtag')
    mockPrisma.hashtag.findMany.mockRejectedValue(new Error('DB error'))

    const result = await getTrendingHashtags()

    expect(result).toEqual([])
  })
})

// ============================================================
// getPostsByHashtag
// ============================================================
describe('getPostsByHashtag', async () => {
  it('returns posts for hashtag', async () => {
    const { getPostsByHashtag } = await import('@/lib/actions/hashtag')
    const posts = [{ id: 'p1', content: '#盆栽', user: { id: 'u1' } }]
    mockPrisma.post.findMany.mockResolvedValue(posts)

    const result = await getPostsByHashtag('盆栽')

    expect(result.posts).toEqual(posts)
    expect(result.hashtag!.name).toBe('盆栽')
  })

  it('supports pagination with limit', async () => {
    const { getPostsByHashtag } = await import('@/lib/actions/hashtag')
    mockPrisma.post.findMany.mockResolvedValue([])

    await getPostsByHashtag('盆栽', { limit: 5 })

    expect(mockPrisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    )
  })

  it('handles empty results', async () => {
    const { getPostsByHashtag } = await import('@/lib/actions/hashtag')
    mockPrisma.post.findMany.mockResolvedValue([])

    const result = await getPostsByHashtag('nonexistent')

    expect(result.posts).toEqual([])
    expect(result.nextCursor).toBeUndefined()
  })
})

// ============================================================
// searchHashtags
// ============================================================
describe('searchHashtags', async () => {
  it('returns matching hashtags', async () => {
    const { searchHashtags } = await import('@/lib/actions/hashtag')
    const hashtags = [{ id: 'h1', name: '盆栽', count: 10 }]
    mockPrisma.hashtag.findMany.mockResolvedValue(hashtags)

    const result = await searchHashtags('盆')

    expect(result).toEqual(hashtags)
  })

  it('returns empty for empty query', async () => {
    const { searchHashtags } = await import('@/lib/actions/hashtag')

    const result = await searchHashtags('')

    expect(result).toEqual([])
    expect(mockPrisma.hashtag.findMany).not.toHaveBeenCalled()
  })

  it('returns empty on no match', async () => {
    const { searchHashtags } = await import('@/lib/actions/hashtag')
    mockPrisma.hashtag.findMany.mockResolvedValue([])

    const result = await searchHashtags('zzz')

    expect(result).toEqual([])
  })

  it('returns empty on error', async () => {
    const { searchHashtags } = await import('@/lib/actions/hashtag')
    mockPrisma.hashtag.findMany.mockRejectedValue(new Error('DB error'))

    const result = await searchHashtags('盆')

    expect(result).toEqual([])
  })
})

// ============================================================
// getPostsByHashtag: pagination cursor branches
// ============================================================
describe('getPostsByHashtag pagination', async () => {
  it('limit と同じ件数返ったら nextCursor に末尾IDを返す。count は Hashtag テーブルの実数', async () => {
    const { getPostsByHashtag } = await import('@/lib/actions/hashtag')
    const posts = [
      { id: 'p1', content: '#a' },
      { id: 'p2', content: '#a' },
      { id: 'p3', content: '#a' },
    ]
    mockPrisma.post.findMany.mockResolvedValue(posts)
    mockPrisma.hashtag.findUnique.mockResolvedValue({ count: 99 })

    const result = await getPostsByHashtag('a', { limit: 3 })

    expect(result.nextCursor).toBe('p3')
    // posts.length(3) ではなく Hashtag テーブルの count(99) を返すこと
    expect(result.hashtag).toEqual({ name: 'a', count: 99 })
  })

  it('limit より少なければ nextCursor は undefined', async () => {
    const { getPostsByHashtag } = await import('@/lib/actions/hashtag')
    mockPrisma.post.findMany.mockResolvedValue([{ id: 'p1', content: '#a' }])
    mockPrisma.hashtag.findUnique.mockResolvedValue({ count: 1 })

    const result = await getPostsByHashtag('a', { limit: 5 })

    expect(result.nextCursor).toBeUndefined()
  })
})

// ============================================================
// recalculateHashtagCounts (admin-gated)
// ============================================================
describe('recalculateHashtagCounts', async () => {
  it('管理者でない場合は ERR_ADMIN_REQUIRED を返し、再計算は実行しない', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockPrisma.adminUser.findUnique.mockResolvedValue(null)

    const { recalculateHashtagCounts } = await import('@/lib/actions/hashtag')
    const result = await recalculateHashtagCounts()

    expect(result.success).toBe(false)
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('未ログインの場合は error を返し、再計算は実行しない', async () => {
    mockAuth.mockResolvedValue(null)

    const { recalculateHashtagCounts } = await import('@/lib/actions/hashtag')
    const result = await recalculateHashtagCounts()

    expect(result.success).toBe(false)
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('super_admin ロールは再計算を実行し成功を返す', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'super_admin' })
    mockPrisma.$executeRaw.mockResolvedValue(1)

    const { recalculateHashtagCounts } = await import('@/lib/actions/hashtag')
    const result = await recalculateHashtagCounts()

    expect(result.success).toBe(true)
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1)
  })

  it('停止中ユーザーは ERR_ACCOUNT_SUSPENDED で再計算をブロックする', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: true })

    const { recalculateHashtagCounts } = await import('@/lib/actions/hashtag')
    const result = await recalculateHashtagCounts()

    expect(result.success).toBe(false)
    expect(mockPrisma.adminUser.findUnique).not.toHaveBeenCalled()
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
  })

  it('readonly ロールは hashtags:recalculate 権限がないため拒否される', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'admin-1' } })
    mockPrisma.user.findUnique.mockResolvedValue({ isSuspended: false })
    mockPrisma.adminUser.findUnique.mockResolvedValue({ role: 'readonly' })

    const { recalculateHashtagCounts } = await import('@/lib/actions/hashtag')
    const result = await recalculateHashtagCounts()

    expect(result.success).toBe(false)
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled()
  })
})
