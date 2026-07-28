// @vitest-environment node
/**
 * GET /api/v1/users/[id] — ブロック/ミュート状態フィールドの検証（v1.5.0）
 *
 * isBlocked / isMuted フィールドが正しくレスポンスに含まれることを検証する。
 * 未ブロック/未ミュートで false、ブロック/ミュート済みで true。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

const mockUserFindUnique = vi.fn()
const mockFollowFindMany = vi.fn()
const mockFollowRequestFindMany = vi.fn()
const mockBlockFindUnique = vi.fn()
const mockMuteFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    follow: {
      findMany: (...args: unknown[]) => mockFollowFindMany(...args),
    },
    followRequest: {
      findMany: (...args: unknown[]) => mockFollowRequestFindMany(...args),
    },
    block: {
      findUnique: (...args: unknown[]) => mockBlockFindUnique(...args),
    },
    mute: {
      findUnique: (...args: unknown[]) => mockMuteFindUnique(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockFetchUserProfile = vi.fn()
vi.mock('@/lib/services/user-read-service', () => ({
  fetchUserProfile: (...args: unknown[]) => mockFetchUserProfile(...args),
}))

const mockUserProfile = {
  id: 'user-target',
  nickname: '盆栽花子',
  avatarUrl: '/avatar.jpg',
  headerUrl: null,
  bio: '盆栽が好き',
  location: '東京',
  isPublic: true,
  bonsaiStartYear: 2020,
  bonsaiStartMonth: 4,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  postsCount: 10,
  followersCount: 5,
  followingCount: 3,
}

async function makeAuthenticatedRequest(
  viewerId: string,
  targetId = 'user-target',
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(viewerId)
  const req = new NextRequest(`http://localhost/api/v1/users/${targetId}`, {
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: targetId }) }]
}

describe('GET /api/v1/users/[id] — isBlocked / isMuted フィールド（v1.5.0）', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'viewer-1', isSuspended: false, email: 'viewer@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchUserProfile.mockResolvedValue({ found: true, user: mockUserProfile })
    mockFollowFindMany.mockResolvedValue([])
    mockFollowRequestFindMany.mockResolvedValue([])
    mockBlockFindUnique.mockResolvedValue(null)
    mockMuteFindUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('未ブロック・未ミュート時は isBlocked:false, isMuted:false を返す', async () => {
    mockBlockFindUnique.mockResolvedValueOnce(null)
    mockMuteFindUnique.mockResolvedValueOnce(null)
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlocked).toBe(false)
    expect(body.isMuted).toBe(false)
  })

  it('ブロック済み時は isBlocked:true を返す', async () => {
    mockBlockFindUnique.mockResolvedValueOnce({ blockerId: 'viewer-1' })
    mockMuteFindUnique.mockResolvedValueOnce(null)
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlocked).toBe(true)
    expect(body.isMuted).toBe(false)
  })

  it('ミュート済み時は isMuted:true を返す', async () => {
    mockBlockFindUnique.mockResolvedValueOnce(null)
    mockMuteFindUnique.mockResolvedValueOnce({ muterId: 'viewer-1' })
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlocked).toBe(false)
    expect(body.isMuted).toBe(true)
  })

  it('ブロックかつミュート済み時は両方 true を返す', async () => {
    mockBlockFindUnique.mockResolvedValueOnce({ blockerId: 'viewer-1' })
    mockMuteFindUnique.mockResolvedValueOnce({ muterId: 'viewer-1' })
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlocked).toBe(true)
    expect(body.isMuted).toBe(true)
  })

  it('自分自身を取得したとき isBlocked:false, isMuted:false を返す（自己操作不可）', async () => {
    const selfId = 'viewer-self'
    mockUserFindUnique.mockResolvedValueOnce({ id: selfId, isSuspended: false, email: 'self@example.com' })
    mockFetchUserProfile.mockResolvedValueOnce({
      found: true,
      user: { ...mockUserProfile, id: selfId },
    })
    const [req, params] = await makeAuthenticatedRequest(selfId, selfId)
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlocked).toBe(false)
    expect(body.isMuted).toBe(false)
  })

  it('isBlocked / isMuted が boolean 型であること', async () => {
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(typeof body.isBlocked).toBe('boolean')
    expect(typeof body.isMuted).toBe('boolean')
  })

  it('404 のとき isBlocked / isMuted クエリが実行されない', async () => {
    mockFetchUserProfile.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'ghost-user')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    expect(mockBlockFindUnique).not.toHaveBeenCalled()
    expect(mockMuteFindUnique).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/users/[id] — isBlockedByUser フィールド（v1.6.0）', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'viewer-1', isSuspended: false, email: 'viewer@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchUserProfile.mockResolvedValue({ found: true, user: mockUserProfile })
    mockFollowFindMany.mockResolvedValue([])
    mockFollowRequestFindMany.mockResolvedValue([])
    mockMuteFindUnique.mockResolvedValue(null)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // 方向マトリクス: viewer→target ブロック（isBlocked）と target→viewer ブロック（isBlockedByUser）は独立
  it('ブロック関係なし: isBlocked:false, isBlockedByUser:false', async () => {
    mockBlockFindUnique.mockResolvedValue(null)
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlocked).toBe(false)
    expect(body.isBlockedByUser).toBe(false)
  })

  it('viewer→target のみブロック: isBlocked:true, isBlockedByUser:false', async () => {
    mockBlockFindUnique.mockImplementation(
      (args: { where: { blockerId_blockedId: { blockerId: string; blockedId: string } } }) => {
        const { blockerId, blockedId } = args.where.blockerId_blockedId
        if (blockerId === 'viewer-1' && blockedId === 'user-target') {
          return Promise.resolve({ blockerId: 'viewer-1' })
        }
        return Promise.resolve(null)
      },
    )
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlocked).toBe(true)
    expect(body.isBlockedByUser).toBe(false)
  })

  it('target→viewer のみブロック: isBlocked:false, isBlockedByUser:true', async () => {
    mockBlockFindUnique.mockImplementation(
      (args: { where: { blockerId_blockedId: { blockerId: string; blockedId: string } } }) => {
        const { blockerId, blockedId } = args.where.blockerId_blockedId
        if (blockerId === 'user-target' && blockedId === 'viewer-1') {
          return Promise.resolve({ blockerId: 'user-target' })
        }
        return Promise.resolve(null)
      },
    )
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlocked).toBe(false)
    expect(body.isBlockedByUser).toBe(true)
  })

  it('双方向ブロック: isBlocked:true, isBlockedByUser:true', async () => {
    mockBlockFindUnique.mockResolvedValue({ blockerId: 'someone' })
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlocked).toBe(true)
    expect(body.isBlockedByUser).toBe(true)
  })

  it('自分自身取得時は isBlockedByUser:false（reverse query 実行なし）', async () => {
    const selfId = 'viewer-self'
    mockUserFindUnique.mockResolvedValueOnce({ id: selfId, isSuspended: false, email: 'self@example.com' })
    mockFetchUserProfile.mockResolvedValueOnce({
      found: true,
      user: { ...mockUserProfile, id: selfId },
    })
    const [req, params] = await makeAuthenticatedRequest(selfId, selfId)
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isBlockedByUser).toBe(false)
    expect(mockBlockFindUnique).not.toHaveBeenCalled()
  })

  it('404 のとき reverse block クエリは実行されない', async () => {
    mockFetchUserProfile.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'ghost-user')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    expect(mockBlockFindUnique).not.toHaveBeenCalled()
  })

  it('reverse block クエリが reject すると 500 を返し、プロフィール本体を含まない（fail-closed）', async () => {
    mockBlockFindUnique.mockRejectedValue(new Error('DB error'))
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
    expect(body.id).toBeUndefined()
    expect(body.nickname).toBeUndefined()
    expect(body.isBlockedByUser).toBeUndefined()
  })

  it('exact query assertion: block.findUnique に blockerId=targetId, blockedId=viewerId の複合キーが渡る', async () => {
    mockBlockFindUnique.mockResolvedValue(null)
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    await GET(req, params)

    expect(mockBlockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { blockerId_blockedId: { blockerId: 'user-target', blockedId: 'viewer-1' } },
      }),
    )
  })
})
