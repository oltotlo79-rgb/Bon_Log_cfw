// @vitest-environment node
/**
 * GET /api/v1/users/[id] のユニットテスト
 *
 * 200 / 404 / 401 / 429 の全分岐および v1.4.0 で追加された
 * following / requested / isSelf フィールドの検証を行う。
 * 特に email フィールドがレスポンスに含まれないことを確認する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

const mockUserFindUnique = vi.fn()
const mockFollowFindMany = vi.fn()
const mockFollowRequestFindMany = vi.fn()

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

describe('GET /api/v1/users/[id]', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: 'viewer-1', isSuspended: false, email: 'viewer@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFetchUserProfile.mockResolvedValue({ found: true, user: mockUserProfile })
    // デフォルトはフォロー関係なし（空配列）
    mockFollowFindMany.mockResolvedValue([])
    mockFollowRequestFindMany.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと存在するユーザーで 200 とプロフィールを返す', async () => {
    const [req, params] = await makeAuthenticatedRequest('viewer-1')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe('user-target')
    expect(body.nickname).toBe('盆栽花子')
  })

  it('レスポンスに email フィールドが含まれないこと', async () => {
    const [req, params] = await makeAuthenticatedRequest('viewer-1')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect('email' in body).toBe(false)
  })

  it('isSuspended フィールドがレスポンスに含まれないこと', async () => {
    const [req, params] = await makeAuthenticatedRequest('viewer-1')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect('isSuspended' in body).toBe(false)
  })

  it('fetchUserProfile に targetUserId と viewerId が渡される', async () => {
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'target-xyz')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    await GET(req, params)

    expect(mockFetchUserProfile).toHaveBeenCalledWith('target-xyz', 'viewer-1')
  })

  it('ユーザーが見つからない場合（found: false）で 404 NOT_FOUND', async () => {
    mockFetchUserProfile.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('viewer-1')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('停止・非公開ユーザーでも 404 NOT_FOUND（情報漏えい防止）', async () => {
    mockFetchUserProfile.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('viewer-1', 'suspended-user')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: 'viewer-1', isSuspended: true, email: 'u@example.com' })
    const [req, params] = await makeAuthenticatedRequest('viewer-1')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedRequest('viewer-1')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    mockFetchUserProfile.mockResolvedValueOnce({ found: false })
    const [req, params] = await makeAuthenticatedRequest('viewer-1')
    const { GET } = await import('@/app/api/v1/users/[id]/route')
    const res = await GET(req, params)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  // フォロー状態フィールド検証（v1.4.0）
  describe('フォロー状態フィールド', () => {
    it('フォロー確立済みのとき following:true, requested:false を返す', async () => {
      mockFollowFindMany.mockResolvedValueOnce([{ followingId: 'user-target' }])
      mockFollowRequestFindMany.mockResolvedValueOnce([])
      const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
      const { GET } = await import('@/app/api/v1/users/[id]/route')
      const res = await GET(req, params)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.following).toBe(true)
      expect(body.requested).toBe(false)
    })

    it('非公開アカウントへリクエスト中のとき following:false, requested:true を返す', async () => {
      mockFollowFindMany.mockResolvedValueOnce([])
      mockFollowRequestFindMany.mockResolvedValueOnce([{ targetId: 'user-target' }])
      const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
      const { GET } = await import('@/app/api/v1/users/[id]/route')
      const res = await GET(req, params)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.following).toBe(false)
      expect(body.requested).toBe(true)
    })

    it('フォロー関係なし（未フォロー）のとき following:false, requested:false を返す', async () => {
      mockFollowFindMany.mockResolvedValueOnce([])
      mockFollowRequestFindMany.mockResolvedValueOnce([])
      const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
      const { GET } = await import('@/app/api/v1/users/[id]/route')
      const res = await GET(req, params)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.following).toBe(false)
      expect(body.requested).toBe(false)
    })

    it('自分自身を取得したとき isSelf:true を返す', async () => {
      const selfId = 'viewer-self'
      // auth-guard が selfId のユーザーを DB から引けるようにする
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
      expect(body.isSelf).toBe(true)
    })

    it('他人を取得したとき isSelf:false を返す', async () => {
      const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
      const { GET } = await import('@/app/api/v1/users/[id]/route')
      const res = await GET(req, params)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.isSelf).toBe(false)
    })

    it('follow と pending request が両方該当する異常データでは following:true, requested:false（following 優先）', async () => {
      mockFollowFindMany.mockResolvedValueOnce([{ followingId: 'user-target' }])
      mockFollowRequestFindMany.mockResolvedValueOnce([{ targetId: 'user-target' }])
      const [req, params] = await makeAuthenticatedRequest('viewer-1', 'user-target')
      const { GET } = await import('@/app/api/v1/users/[id]/route')
      const res = await GET(req, params)

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.following).toBe(true)
      expect(body.requested).toBe(false)
    })

    it('404 のとき follow 状態を計算せず 404 のまま返す', async () => {
      mockFetchUserProfile.mockResolvedValueOnce({ found: false })
      const [req, params] = await makeAuthenticatedRequest('viewer-1', 'ghost-user')
      const { GET } = await import('@/app/api/v1/users/[id]/route')
      const res = await GET(req, params)

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.code).toBe('NOT_FOUND')
      // 404 の場合は follow クエリが実行されないこと
      expect(mockFollowFindMany).not.toHaveBeenCalled()
      expect(mockFollowRequestFindMany).not.toHaveBeenCalled()
    })
  })
})
