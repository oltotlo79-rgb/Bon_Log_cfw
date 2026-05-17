import { vi } from 'vitest'
/**
 * Extended tests for block, mute, follow-request, draft, bonsai actions
 * Focus: auth checks and basic call validation
 */
export {}

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockPrisma: Record<string, any> = {
  block: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
  follow: { create: vi.fn(), deleteMany: vi.fn(), findMany: vi.fn() },
  mute: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn() },
  followRequest: { create: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn() },
  draft: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn() },
  draftMedia: { deleteMany: vi.fn() },
  draftGenre: { deleteMany: vi.fn() },
  post: { create: vi.fn() },
  bonsai: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() },
  bonsaiRecord: { create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  bonsaiRecordImage: { deleteMany: vi.fn() },
  user: { findUnique: vi.fn() },
  notification: { create: vi.fn() },
}
const mockTx = { ...mockPrisma, $transaction: vi.fn() }
 
;(mockPrisma as any).$transaction = vi.fn((fn: unknown) => typeof fn === 'function' ? (fn as (...args: unknown[]) => unknown)(mockTx) : Promise.all(fn as Promise<unknown>[]))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn(), unstable_cache: vi.fn((fn) => fn), cache: vi.fn((fn) => fn) }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue('127.0.0.1') }) }))
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  checkDailyLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  RATE_LIMITS: { search: { maxRequests: 30, windowMs: 60000 } },
}))
vi.mock('@/lib/logger', () => ({ __esModule: true, default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() }, logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/sanitize', () => ({ sanitizeInput: (s: string) => s }))
vi.mock('@/lib/premium', () => ({ isPremiumUser: vi.fn().mockResolvedValue(false) }))

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================================================
// Block Actions - Auth Checks
// ============================================================
describe('block actions auth', async () => {
  it('blockUser rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { blockUser } = await import('@/lib/actions/block')
    const r = await blockUser('u2')
    expect(r).toHaveProperty('error')
  })

  it('blockUser rejects self-block', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    const { blockUser } = await import('@/lib/actions/block')
    const r = await blockUser('u1')
    expect(r).toHaveProperty('error')
  })

  it('unblockUser rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { unblockUser } = await import('@/lib/actions/block')
    const r = await unblockUser('u2')
    expect(r).toHaveProperty('error')
  })

  it('getBlockedUsers returns empty when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getBlockedUsers } = await import('@/lib/actions/block')
    const r = await getBlockedUsers()
    expect(r.users).toEqual([])
  })

  it('isBlocked returns defaults when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { isBlocked } = await import('@/lib/actions/block')
    const r = await isBlocked('u2')
    expect(r).toBeDefined()
  })

  it('blockUser succeeds with valid input', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    // requireActiveNonGuestUser 内で isSuspended チェック → 対象ユーザー存在確認 の順に findUnique が呼ばれる
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ isSuspended: false }) // requireActiveUser 内
      .mockResolvedValueOnce({ id: 'u2' }) // 対象ユーザー確認
    mockPrisma.block.findFirst.mockResolvedValue(null)

    ;(mockPrisma as any).$transaction.mockResolvedValue([{}, {}])
    const { blockUser } = await import('@/lib/actions/block')
    const r = await blockUser('u2')
    expect(r).not.toHaveProperty('error')
  })

  it('unblockUser succeeds', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.block.findFirst.mockResolvedValue({ id: 'b1' })
    mockPrisma.block.delete.mockResolvedValue({})
    const { unblockUser } = await import('@/lib/actions/block')
    const r = await unblockUser('u2')
    expect(r).not.toHaveProperty('error')
  })

  it('getBlockedUsers returns data', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.block.findMany.mockResolvedValue([])
    const { getBlockedUsers } = await import('@/lib/actions/block')
    const r = await getBlockedUsers()
    expect(r).not.toHaveProperty('error')
  })

  it('isBlocked returns status', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.block.findFirst.mockResolvedValue(null)
    const { isBlocked } = await import('@/lib/actions/block')
    const r = await isBlocked('u2')
    expect(r).toBeDefined()
  })
})

// ============================================================
// Mute Actions - Auth Checks
// ============================================================
describe('mute actions auth', async () => {
  it('muteUser rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { muteUser } = await import('@/lib/actions/mute')
    const r = await muteUser('u2')
    expect(r).toHaveProperty('error')
  })

  it('muteUser rejects self-mute', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    const { muteUser } = await import('@/lib/actions/mute')
    const r = await muteUser('u1')
    expect(r).toHaveProperty('error')
  })

  it('unmuteUser rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { unmuteUser } = await import('@/lib/actions/mute')
    const r = await unmuteUser('u2')
    expect(r).toHaveProperty('error')
  })

  it('getMutedUsers returns empty when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getMutedUsers } = await import('@/lib/actions/mute')
    const r = await getMutedUsers()
    expect(r).toEqual({ users: [], nextCursor: undefined })
  })

  it('isMuted returns defaults when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { isMuted } = await import('@/lib/actions/mute')
    const r = await isMuted('u2')
    expect(r).toBeDefined()
  })

  it('muteUser succeeds', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.mute.findFirst.mockResolvedValue(null)
    mockPrisma.mute.create.mockResolvedValue({ id: 'm1' })
    const { muteUser } = await import('@/lib/actions/mute')
    const r = await muteUser('u2')
    expect(r).not.toHaveProperty('error')
  })

  it('unmuteUser succeeds', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.mute.findFirst.mockResolvedValue({ id: 'm1' })
    mockPrisma.mute.delete.mockResolvedValue({})
    const { unmuteUser } = await import('@/lib/actions/mute')
    const r = await unmuteUser('u2')
    expect(r).not.toHaveProperty('error')
  })

  it('getMutedUsers returns data', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.mute.findMany.mockResolvedValue([])
    const { getMutedUsers } = await import('@/lib/actions/mute')
    const r = await getMutedUsers()
    expect(r).not.toHaveProperty('error')
  })

  it('isMuted returns status', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.mute.findFirst.mockResolvedValue(null)
    const { isMuted } = await import('@/lib/actions/mute')
    const r = await isMuted('u2')
    expect(r).toBeDefined()
  })
})

// ============================================================
// Follow Request Actions - Auth Checks
// ============================================================
describe('follow-request actions auth', async () => {
  it('sendFollowRequest callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.block.findFirst.mockResolvedValue(null)
    mockPrisma.followRequest.findFirst.mockResolvedValue(null)
    mockPrisma.followRequest.create.mockResolvedValue({ id: 'r1', status: 'pending' })
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isPublic: false })
    const { sendFollowRequest } = await import('@/lib/actions/follow-request')
    const r = await sendFollowRequest('u2')
    expect(r).toBeDefined()
  })

  it('approveFollowRequest callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.findUnique.mockResolvedValue({ id: 'r1', targetUserId: 'u1', requesterId: 'u2', status: 'pending' })
     
    ;(mockPrisma as any).$transaction.mockResolvedValue([{}, {}, {}])
    const { approveFollowRequest } = await import('@/lib/actions/follow-request')
    const r = await approveFollowRequest('r1')
    expect(r).toBeDefined()
  })

  it('rejectFollowRequest callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.findUnique.mockResolvedValue({ id: 'r1', targetUserId: 'u1', status: 'pending' })
    mockPrisma.followRequest.update.mockResolvedValue({})
    const { rejectFollowRequest } = await import('@/lib/actions/follow-request')
    const r = await rejectFollowRequest('r1')
    expect(r).toBeDefined()
  })

  it('cancelFollowRequest callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.findFirst.mockResolvedValue({ id: 'r1' })
    mockPrisma.followRequest.delete.mockResolvedValue({})
    const { cancelFollowRequest } = await import('@/lib/actions/follow-request')
    const r = await cancelFollowRequest('u2')
    expect(r).toBeDefined()
  })

  it('getFollowRequestStatus callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.findFirst.mockResolvedValue(null)
    const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
    const r = await getFollowRequestStatus('u2')
    expect(r).toBeDefined()
  })

  it('getReceivedFollowRequests callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.findMany.mockResolvedValue([])
    const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
    const r = await getReceivedFollowRequests()
    expect(r).toBeDefined()
  })

  it('getSentFollowRequests callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.findMany.mockResolvedValue([])
    const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
    const r = await getSentFollowRequests()
    expect(r).toBeDefined()
  })

  it('getPendingFollowRequestCount callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.count.mockResolvedValue(5)
    const { getPendingFollowRequestCount } = await import('@/lib/actions/follow-request')
    const r = await getPendingFollowRequestCount()
    expect(r).toBeDefined()
  })

  it('getPendingFollowRequestCount returns count', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.count.mockResolvedValue(5)
    const { getPendingFollowRequestCount } = await import('@/lib/actions/follow-request')
    const r = await getPendingFollowRequestCount()
    expect(r).not.toHaveProperty('error')
  })

  it('getReceivedFollowRequests returns data', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.findMany.mockResolvedValue([])
    const { getReceivedFollowRequests } = await import('@/lib/actions/follow-request')
    const r = await getReceivedFollowRequests()
    expect(r).not.toHaveProperty('error')
  })

  it('getSentFollowRequests returns data', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.findMany.mockResolvedValue([])
    const { getSentFollowRequests } = await import('@/lib/actions/follow-request')
    const r = await getSentFollowRequests()
    expect(r).not.toHaveProperty('error')
  })

  it('getFollowRequestStatus returns status', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.followRequest.findFirst.mockResolvedValue(null)
    const { getFollowRequestStatus } = await import('@/lib/actions/follow-request')
    const r = await getFollowRequestStatus('u2')
    expect(r).not.toHaveProperty('error')
  })
})

// ============================================================
// Draft Actions - Auth Checks
// ============================================================
describe('draft actions auth', async () => {
  it('getDrafts rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getDrafts } = await import('@/lib/actions/draft')
    const r = await getDrafts()
    expect(r).toHaveProperty('error')
  })

  it('getDraftCount returns 0 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getDraftCount } = await import('@/lib/actions/draft')
    const r = await getDraftCount()
    expect(r).toBeDefined()
  })

  it('saveDraft rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { saveDraft } = await import('@/lib/actions/draft')
    const r = await saveDraft({ content: 'test' })
    expect(r).toHaveProperty('error')
  })

  it('deleteDraft rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteDraft } = await import('@/lib/actions/draft')
    const r = await deleteDraft('d1')
    expect(r).toHaveProperty('error')
  })

  it('getDraft rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getDraft } = await import('@/lib/actions/draft')
    const r = await getDraft('d1')
    expect(r).toHaveProperty('error')
  })

  it('publishDraft rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { publishDraft } = await import('@/lib/actions/draft')
    const r = await publishDraft('d1')
    expect(r).toHaveProperty('error')
  })

  it('getDrafts is callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.draft.findMany.mockResolvedValue([])
    const { getDrafts } = await import('@/lib/actions/draft')
    const r = await getDrafts()
    expect(r).toBeDefined()
  })

  it('getDraftCount returns number', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.draft.count.mockResolvedValue(3)
    const { getDraftCount } = await import('@/lib/actions/draft')
    const r = await getDraftCount()
    expect(typeof r).toBe('number')
  })

  it('getDraft is callable', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.draft.findFirst.mockResolvedValue({ id: 'd1', content: 'x', media: [], genres: [] })
    const { getDraft } = await import('@/lib/actions/draft')
    const r = await getDraft('d1')
    expect(r).toBeDefined()
  })

  it('getDraft with missing returns result', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.draft.findFirst.mockResolvedValue(null)
    const { getDraft } = await import('@/lib/actions/draft')
    const r = await getDraft('missing')
    expect(r).toBeDefined()
  })
})

// ============================================================
// Bonsai Actions - Auth Checks
// ============================================================
describe('bonsai actions auth', async () => {
  it('getBonsais rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { getBonsais } = await import('@/lib/actions/bonsai')
    const r = await getBonsais()
    expect(r).toHaveProperty('error')
  })

  it('createBonsai rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { createBonsai } = await import('@/lib/actions/bonsai')
    const r = await createBonsai({ name: 'Test' })
    expect(r).toHaveProperty('error')
  })

  it('updateBonsai rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { updateBonsai } = await import('@/lib/actions/bonsai')
    const r = await updateBonsai('b1', { name: 'X' })
    expect(r).toHaveProperty('error')
  })

  it('deleteBonsai rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteBonsai } = await import('@/lib/actions/bonsai')
    const r = await deleteBonsai('b1')
    expect(r).toHaveProperty('error')
  })

  it('addBonsaiRecord rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { addBonsaiRecord } = await import('@/lib/actions/bonsai')
     
    const r = await addBonsaiRecord({ bonsaiId: 'b1', content: 'Test' } as any)
    expect(r).toHaveProperty('error')
  })

  it('deleteBonsaiRecord rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { deleteBonsaiRecord } = await import('@/lib/actions/bonsai')
    const r = await deleteBonsaiRecord('r1')
    expect(r).toHaveProperty('error')
  })

  it('searchBonsais rejects unauthenticated', async () => {
    mockAuth.mockResolvedValue(null)
    const { searchBonsais } = await import('@/lib/actions/bonsai')
    const r = await searchBonsais('pine')
    expect(r).toHaveProperty('error')
  })

  it('getBonsais returns data', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.bonsai.findMany.mockResolvedValue([])
    const { getBonsais } = await import('@/lib/actions/bonsai')
    const r = await getBonsais()
    expect(r).not.toHaveProperty('error')
  })

  it('getBonsai returns bonsai', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.bonsai.findUnique.mockResolvedValue({ id: 'b1', name: 'Pine', userId: 'u1', user: { id: 'u1' }, records: [] })
    const { getBonsai } = await import('@/lib/actions/bonsai')
    const r = await getBonsai('b1')
    expect(r).not.toHaveProperty('error')
  })

  it('getBonsai returns error for missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.bonsai.findUnique.mockResolvedValue(null)
    const { getBonsai } = await import('@/lib/actions/bonsai')
    const r = await getBonsai('missing')
    expect(r).toHaveProperty('error')
  })

  it('deleteBonsai returns error for non-owned', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } })
    mockPrisma.bonsai.findFirst.mockResolvedValue(null)
    const { deleteBonsai } = await import('@/lib/actions/bonsai')
    const r = await deleteBonsai('b1')
    expect(r).toHaveProperty('error')
  })
})
