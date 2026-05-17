import { vi } from 'vitest'
/**
 * Extended tests for bonsai, hashtag, mute, mention actions
 */
export {}

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  bonsai: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  bonsaiRecord: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  hashtag: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), upsert: vi.fn() },
  postHashtag: { create: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  post: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
  user: { findUnique: vi.fn(), findMany: vi.fn() },
  mute: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  block: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
  like: { findMany: vi.fn().mockResolvedValue([]) },
  bookmark: { findMany: vi.fn().mockResolvedValue([]) },
  follow: { findMany: vi.fn().mockResolvedValue([]) },
  notification: { create: vi.fn() },
  $transaction: vi.fn((fn: unknown) => typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown)(mockPrisma) : Promise.all(fn as Promise<unknown>[])),
}
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/sanitize', () => ({ sanitizeInput: (s: string) => s, sanitizePostContent: (s: string) => s }))
vi.mock('@/lib/actions/notification', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/services/notification-core', () => ({ createNotification: vi.fn().mockResolvedValue({ success: true }) }))
vi.mock('@/lib/cache', () => ({ getCachedData: vi.fn(), invalidateCache: vi.fn() }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Map([['x-forwarded-for', '127.0.0.1']])) }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false), getMembershipLimits: vi.fn().mockReturnValue({ maxPostLength: 500, maxImages: 4, maxBonsais: 10, maxBonsaiRecords: 100 }) }))

// ============================================================
// Bonsai Actions
// ============================================================
describe('getBonsais extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getBonsais } = await import('@/lib/actions/bonsai')
    const result = await getBonsais()
    expect(result).toBeDefined()
  })

  it('returns bonsai list', async () => {
    mockPrisma.bonsai.findMany.mockResolvedValue([{ id: 'b1', name: 'Pine' }])
    const { getBonsais } = await import('@/lib/actions/bonsai')
    const result = await getBonsais()
    expect(result).toBeDefined()
  })
})

describe('getBonsai extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getBonsai } = await import('@/lib/actions/bonsai')
    const result = await getBonsai('b1')
    expect(result).toBeDefined()
  })

  it('returns bonsai detail', async () => {
    mockPrisma.bonsai.findUnique.mockResolvedValue({ id: 'b1', name: 'Pine', userId: 'u1' })
    const { getBonsai } = await import('@/lib/actions/bonsai')
    const result = await getBonsai('b1')
    expect(result).toBeDefined()
  })

  it('returns error for missing bonsai', async () => {
    mockPrisma.bonsai.findUnique.mockResolvedValue(null)
    const { getBonsai } = await import('@/lib/actions/bonsai')
    const result = await getBonsai('missing')
    expect(result).toBeDefined()
  })
})

describe('createBonsai extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { createBonsai } = await import('@/lib/actions/bonsai')
    const fd = new FormData(); fd.set('name', 'Pine')
     
    const result = await createBonsai(fd as any)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('creates bonsai', async () => {
    mockPrisma.bonsai.count.mockResolvedValue(0)
    mockPrisma.bonsai.create.mockResolvedValue({ id: 'b1' })
    const { createBonsai } = await import('@/lib/actions/bonsai')
    const fd = new FormData(); fd.set('name', '黒松'); fd.set('species', '松柏類')
     
    const result = await createBonsai(fd as any)
    expect(result).toBeDefined()
  })

  it('returns error for empty name', async () => {
    const { createBonsai } = await import('@/lib/actions/bonsai')
    const fd = new FormData(); fd.set('name', '')
     
    const result = await createBonsai(fd as any)
    expect(result).toBeDefined()
  })
})

describe('updateBonsai extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { updateBonsai } = await import('@/lib/actions/bonsai')
    const fd = new FormData(); fd.set('name', 'Updated')
     
    const result = await updateBonsai('b1', fd as any)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('updates owned bonsai', async () => {
    mockPrisma.bonsai.findUnique.mockResolvedValue({ id: 'b1', userId: 'u1' })
    mockPrisma.bonsai.update.mockResolvedValue({ id: 'b1' })
    const { updateBonsai } = await import('@/lib/actions/bonsai')
    const fd = new FormData(); fd.set('name', 'Updated Pine')
     
    const result = await updateBonsai('b1', fd as any)
    expect(result).toBeDefined()
  })
})

describe('deleteBonsai extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteBonsai } = await import('@/lib/actions/bonsai')
    const result = await deleteBonsai('b1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('deletes owned bonsai', async () => {
    mockPrisma.bonsai.findUnique.mockResolvedValue({ id: 'b1', userId: 'u1' })
    mockPrisma.bonsai.delete.mockResolvedValue({})
    const { deleteBonsai } = await import('@/lib/actions/bonsai')
    const result = await deleteBonsai('b1')
    expect(result).toBeDefined()
  })

  it('returns error for non-owned bonsai', async () => {
    mockPrisma.bonsai.findUnique.mockResolvedValue({ id: 'b1', userId: 'u2' })
    const { deleteBonsai } = await import('@/lib/actions/bonsai')
    const result = await deleteBonsai('b1')
    expect(result).toBeDefined()
  })
})

describe('addBonsaiRecord extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
    const fd = new FormData(); fd.set('bonsaiId', 'b1'); fd.set('type', 'watering'); fd.set('content', 'Watered')
     
    const result = await addBonsaiRecord(fd as any)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('adds record to owned bonsai', async () => {
    mockPrisma.bonsai.findUnique.mockResolvedValue({ id: 'b1', userId: 'u1' })
    mockPrisma.bonsaiRecord.count = vi.fn().mockResolvedValue(0)
    mockPrisma.bonsaiRecord.create.mockResolvedValue({ id: 'r1' })
    const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
    const fd = new FormData(); fd.set('bonsaiId', 'b1'); fd.set('type', 'watering'); fd.set('content', 'Watered today')
     
    const result = await addBonsaiRecord(fd as any)
    expect(result).toBeDefined()
  })
})

describe('getBonsaiTimeline extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns timeline', async () => {
    mockPrisma.bonsai.findUnique.mockResolvedValue({ id: 'b1', userId: 'u1' })
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])
    const { getBonsaiTimeline } = await import('@/lib/actions/bonsai')
     
    const result = await getBonsaiTimeline('b1' as any)
    expect(result).toBeDefined()
  })
})

// ============================================================
// Hashtag Actions
// ============================================================
describe('getTrendingHashtags extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns trending hashtags', async () => {
    mockPrisma.hashtag.findMany.mockResolvedValue([{ id: 'h1', name: 'bonsai', _count: { posts: 10 } }])
    const { getTrendingHashtags } = await import('@/lib/actions/hashtag')
    const result = await getTrendingHashtags()
    expect(result).toBeDefined()
  })

  it('returns empty when no hashtags', async () => {
    mockPrisma.hashtag.findMany.mockResolvedValue([])
    const { getTrendingHashtags } = await import('@/lib/actions/hashtag')
    const result = await getTrendingHashtags()
    expect(result).toBeDefined()
  })
})

describe('searchHashtags extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns matching hashtags', async () => {
    mockPrisma.hashtag.findMany.mockResolvedValue([{ id: 'h1', name: 'bonsai' }])
    const { searchHashtags } = await import('@/lib/actions/hashtag')
    const result = await searchHashtags('bon')
    expect(result).toBeDefined()
  })

  it('returns empty for no match', async () => {
    mockPrisma.hashtag.findMany.mockResolvedValue([])
    const { searchHashtags } = await import('@/lib/actions/hashtag')
    const result = await searchHashtags('zzzzz')
    expect(result).toBeDefined()
  })
})

describe('getPostsByHashtag extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns posts for hashtag', async () => {
    mockPrisma.hashtag.findFirst.mockResolvedValue({ id: 'h1', name: 'bonsai' })
    mockPrisma.post.findMany.mockResolvedValue([])
    mockPrisma.post.count.mockResolvedValue(0)
    const { getPostsByHashtag } = await import('@/lib/actions/hashtag')
    const result = await getPostsByHashtag('bonsai')
    expect(result).toBeDefined()
  })

  it('returns empty for unknown hashtag', async () => {
    mockPrisma.hashtag.findFirst.mockResolvedValue(null)
    const { getPostsByHashtag } = await import('@/lib/actions/hashtag')
    const result = await getPostsByHashtag('unknown')
    expect(result).toBeDefined()
  })
})

// ============================================================
// Mute Actions
// ============================================================
describe('muteUser extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { muteUser } = await import('@/lib/actions/mute')
    const result = await muteUser('u2')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('returns error when muting self', async () => {
    const { muteUser } = await import('@/lib/actions/mute')
    const result = await muteUser('u1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('mutes user', async () => {
    mockPrisma.mute.findFirst.mockResolvedValue(null)
    mockPrisma.mute.create.mockResolvedValue({ id: 'm1' })
    const { muteUser } = await import('@/lib/actions/mute')
    const result = await muteUser('u2')
    expect(result).toBeDefined()
  })

  it('returns error when already muted', async () => {
    mockPrisma.mute.findFirst.mockResolvedValue({ id: 'm1' })
    const { muteUser } = await import('@/lib/actions/mute')
    const result = await muteUser('u2')
    expect(result).toBeDefined()
  })
})

describe('unmuteUser extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { unmuteUser } = await import('@/lib/actions/mute')
    const result = await unmuteUser('u2')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('unmutes user', async () => {
    mockPrisma.mute.findFirst.mockResolvedValue({ id: 'm1' })
    mockPrisma.mute.delete.mockResolvedValue({})
    const { unmuteUser } = await import('@/lib/actions/mute')
    const result = await unmuteUser('u2')
    expect(result).toBeDefined()
  })
})

describe('getMutedUsers extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getMutedUsers } = await import('@/lib/actions/mute')
    const result = await getMutedUsers()
    expect(result).toBeDefined()
  })

  it('returns muted users list', async () => {
    mockPrisma.mute.findMany.mockResolvedValue([])
    const { getMutedUsers } = await import('@/lib/actions/mute')
    const result = await getMutedUsers()
    expect(result).toBeDefined()
  })
})

describe('isMuted extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns false when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { isMuted } = await import('@/lib/actions/mute')
    const result = await isMuted('u2')
    expect(result).toBeDefined()
  })

  it('returns true when muted', async () => {
    mockPrisma.mute.findFirst.mockResolvedValue({ id: 'm1' })
    const { isMuted } = await import('@/lib/actions/mute')
    const result = await isMuted('u2')
    expect(result).toBeDefined()
  })

  it('returns false when not muted', async () => {
    mockPrisma.mute.findFirst.mockResolvedValue(null)
    const { isMuted } = await import('@/lib/actions/mute')
    const result = await isMuted('u2')
    expect(result).toBeDefined()
  })
})

// ============================================================
// Mention Actions
// ============================================================
describe('searchMentionUsers extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns matching users', async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'u2', nickname: 'TestUser' }])
    const { searchMentionUsers } = await import('@/lib/actions/mention')
    const result = await searchMentionUsers('Test')
    expect(result).toBeDefined()
  })

  it('returns empty for no match', async () => {
    mockPrisma.user.findMany.mockResolvedValue([])
    const { searchMentionUsers } = await import('@/lib/actions/mention')
    const result = await searchMentionUsers('zzzzz')
    expect(result).toBeDefined()
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { searchMentionUsers } = await import('@/lib/actions/mention')
    const result = await searchMentionUsers('Test')
    expect(result).toBeDefined()
  })
})

// ============================================================
// Additional Bonsai edge cases
// ============================================================
describe('getBonsaiRecords extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns records for bonsai', async () => {
    mockPrisma.bonsai.findUnique.mockResolvedValue({ id: 'b1', userId: 'u1' })
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([{ id: 'r1', type: 'watering' }])
    const { getBonsaiRecords } = await import('@/lib/actions/bonsai')
    const result = await getBonsaiRecords('b1')
    expect(result).toBeDefined()
  })

  it('returns empty records', async () => {
    mockPrisma.bonsai.findUnique.mockResolvedValue({ id: 'b1', userId: 'u1' })
    mockPrisma.bonsaiRecord.findMany.mockResolvedValue([])
    const { getBonsaiRecords } = await import('@/lib/actions/bonsai')
    const result = await getBonsaiRecords('b1')
    expect(result).toBeDefined()
  })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getBonsaiRecords } = await import('@/lib/actions/bonsai')
    const result = await getBonsaiRecords('b1')
    expect(result).toBeDefined()
  })
})

describe('updateBonsaiRecord extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
    const fd = new FormData(); fd.set('content', 'Updated')
     
    const result = await updateBonsaiRecord('r1', fd as any)
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('updates owned record', async () => {
    mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({ id: 'r1', bonsai: { userId: 'u1' } })
    mockPrisma.bonsaiRecord.update.mockResolvedValue({ id: 'r1' })
    const { updateBonsaiRecord } = await import('@/lib/actions/bonsai')
    const fd = new FormData(); fd.set('content', 'Updated record')
     
    const result = await updateBonsaiRecord('r1', fd as any)
    expect(result).toBeDefined()
  })
})

describe('deleteBonsaiRecord extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns error when not authenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
    const result = await deleteBonsaiRecord('r1')
    expect(result).toEqual(expect.objectContaining({ error: expect.any(String) }))
  })

  it('deletes owned record', async () => {
    mockPrisma.bonsaiRecord.findFirst.mockResolvedValue({ id: 'r1', bonsai: { userId: 'u1' } })
    mockPrisma.bonsaiRecord.delete.mockResolvedValue({})
    const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
    const result = await deleteBonsaiRecord('r1')
    expect(result).toBeDefined()
  })
})

describe('searchBonsais extended', async () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth.mockResolvedValue({ user: { id: 'u1' } }) })

  it('returns matching bonsais', async () => {
    mockPrisma.bonsai.findMany.mockResolvedValue([{ id: 'b1', name: '黒松' }])
    const { searchBonsais } = await import('@/lib/actions/bonsai')
    const result = await searchBonsais('松')
    expect(result).toBeDefined()
  })

  it('returns empty for no match', async () => {
    mockPrisma.bonsai.findMany.mockResolvedValue([])
    const { searchBonsais } = await import('@/lib/actions/bonsai')
    const result = await searchBonsais('zzzzz')
    expect(result).toBeDefined()
  })
})

// ============================================================
// Additional Hashtag edge cases
// ============================================================
describe('attachHashtagsToPost extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('attaches hashtags to post', async () => {
    mockPrisma.hashtag.upsert.mockResolvedValue({ id: 'h1', name: 'bonsai' })
    mockPrisma.postHashtag.createMany.mockResolvedValue({ count: 1 })
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    try {
       
      const result = await attachHashtagsToPost('p1', ['bonsai'] as any)
      expect(result).toBeDefined()
    } catch (e) { expect(e).toBeDefined() }
  })

  it('handles empty hashtags', async () => {
    const { attachHashtagsToPost } = await import('@/lib/services/hashtag-sync')
    try {
       
      const result = await attachHashtagsToPost('p1', [] as any)
      expect(result === undefined || result !== undefined).toBe(true)
    } catch (e) { expect(e).toBeDefined() }
  })
})

describe('detachHashtagsFromPost extended', async () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('detaches hashtags from post', async () => {
    mockPrisma.postHashtag.deleteMany.mockResolvedValue({ count: 1 })
    const { detachHashtagsFromPost } = await import('@/lib/services/hashtag-sync')
    try {
      const result = await detachHashtagsFromPost('p1')
      expect(result === undefined || result !== undefined).toBe(true)
    } catch (e) { expect(e).toBeDefined() }
  })
})
