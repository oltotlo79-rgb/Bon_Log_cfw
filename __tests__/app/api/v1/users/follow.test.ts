// @vitest-environment node
/**
 * POST /api/v1/users/[id]/follow — フォロー（公開: 確立, 非公開: リクエスト）
 * DELETE /api/v1/users/[id]/follow — フォロー解除 or リクエスト取消
 *
 * 200 / 400 / 401 / 403 / 404 / 429 の全分岐・冪等性・自己フォロー拒否・
 * 解除とリクエスト取消の両ブランチを検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

const mockUserFindUnique = vi.fn()
const mockFollowFindUnique = vi.fn()
const mockFollowRequestFindFirst = vi.fn()
const mockFollowCount = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    follow: {
      findUnique: (...args: unknown[]) => mockFollowFindUnique(...args),
      count: (...args: unknown[]) => mockFollowCount(...args),
    },
    followRequest: {
      findFirst: (...args: unknown[]) => mockFollowRequestFindFirst(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockCheckInteractionEligibility = vi.fn()
vi.mock('@/lib/services/user-eligibility', () => ({
  checkInteractionEligibility: (...args: unknown[]) => mockCheckInteractionEligibility(...args),
}))

const mockFollowUser = vi.fn()
const mockSendFollowRequestPrimitive = vi.fn()
const mockUnfollowUser = vi.fn()
const mockCancelFollowRequestPrimitive = vi.fn()
vi.mock('@/lib/services/follow-service', () => ({
  followUser: (...args: unknown[]) => mockFollowUser(...args),
  sendFollowRequestPrimitive: (...args: unknown[]) => mockSendFollowRequestPrimitive(...args),
  unfollowUser: (...args: unknown[]) => mockUnfollowUser(...args),
  cancelFollowRequestPrimitive: (...args: unknown[]) => mockCancelFollowRequestPrimitive(...args),
}))

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  targetId = 'user-target',
  method: 'POST' | 'DELETE' = 'POST',
): Promise<[NextRequest, { params: Promise<{ id: string }> }]> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const req = new NextRequest(`http://localhost/api/v1/users/${targetId}/follow`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  })
  return [req, { params: Promise.resolve({ id: targetId }) }]
}

describe('POST /api/v1/users/[id]/follow', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockCheckInteractionEligibility.mockResolvedValue({
      ok: true,
      target: { id: 'user-target', isPublic: true },
    })
    mockFollowUser.mockResolvedValue({
      ok: true,
      state: { following: true, requested: false, followerCount: 10 },
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('公開対象をフォローすると 200 { following: true, requested: false, followerCount }', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.following).toBe(true)
    expect(body.requested).toBe(false)
    expect(typeof body.followerCount).toBe('number')
  })

  it('公開対象に対して followUser が呼ばれる', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    await POST(req, params)

    expect(mockFollowUser).toHaveBeenCalledWith('user-1', 'user-target')
    expect(mockSendFollowRequestPrimitive).not.toHaveBeenCalled()
  })

  it('非公開対象をフォロー → 200 { following: false, requested: true, followerCount }', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({
      ok: true,
      target: { id: 'private-user', isPublic: false },
    })
    mockSendFollowRequestPrimitive.mockResolvedValueOnce({
      ok: true,
      state: { following: false, requested: true, followerCount: 5 },
    })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'private-user')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.following).toBe(false)
    expect(body.requested).toBe(true)
    expect(mockSendFollowRequestPrimitive).toHaveBeenCalledWith('user-1', 'private-user')
    expect(mockFollowUser).not.toHaveBeenCalled()
  })

  it('既にフォロー済みでも 200 { following: true } を返す（冪等）', async () => {
    mockFollowUser.mockResolvedValueOnce({
      ok: true,
      state: { following: true, requested: false, followerCount: 11 },
    })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.following).toBe(true)
  })

  it('既にリクエスト済みでも 200 { requested: true } を返す（冪等）', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({
      ok: true,
      target: { id: 'private-user', isPublic: false },
    })
    mockSendFollowRequestPrimitive.mockResolvedValueOnce({
      ok: true,
      state: { following: false, requested: true, followerCount: 5 },
    })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'private-user')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.requested).toBe(true)
  })

  it('自己フォローは 400 VALIDATION_ERROR', async () => {
    const [req, params] = await makeAuthenticatedRequest('user-self', 'self@example.com', 'user-self')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ブロック対象への操作で eligibility が not_found → 404 NOT_FOUND（情報非開示）', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: false, reason: 'blocked' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('不存在ユーザーへの操作で eligibility が not_found → 404', async () => {
    mockCheckInteractionEligibility.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('followUser が ok: false を返した場合でも 404 NOT_FOUND', async () => {
    mockFollowUser.mockResolvedValueOnce({ ok: false, reason: 'not_found' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/follow', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/follow', {
      method: 'POST',
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/users/user-target/follow', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('レート制限超過で 429 RATE_LIMITED + Retry-After ヘッダー', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('エラーレスポンス形式が { error: { code, message, status } } であること', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/follow', { method: 'POST' })
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, { params: Promise.resolve({ id: 'user-target' }) })

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })

  it('followerCount が数値として返される', async () => {
    mockFollowUser.mockResolvedValueOnce({
      ok: true,
      state: { following: true, requested: false, followerCount: 99 },
    })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    const body = await res.json()
    expect(body.followerCount).toBe(99)
  })

  it('不正 id（31文字超）への POST で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', invalidId)
    const { POST } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await POST(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})

describe('DELETE /api/v1/users/[id]/follow', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockFollowFindUnique.mockResolvedValue(null)
    mockFollowRequestFindFirst.mockResolvedValue(null)
    mockFollowCount.mockResolvedValue(7)
    mockUnfollowUser.mockResolvedValue({ followerCount: 6 })
    mockCancelFollowRequestPrimitive.mockResolvedValue({ followerCount: 6 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('フォロー中のユーザーを解除 → 200 { following: false, requested: false, followerCount }', async () => {
    mockFollowFindUnique.mockResolvedValueOnce({ followerId: 'user-1', followingId: 'user-target' })
    mockUnfollowUser.mockResolvedValueOnce({ followerCount: 9 })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.following).toBe(false)
    expect(body.requested).toBe(false)
    expect(body.followerCount).toBe(9)
    expect(mockUnfollowUser).toHaveBeenCalledWith('user-1', 'user-target')
    expect(mockCancelFollowRequestPrimitive).not.toHaveBeenCalled()
  })

  it('リクエスト中のユーザーを取消 → 200 { following: false, requested: false, followerCount }', async () => {
    mockFollowFindUnique.mockResolvedValueOnce(null)
    mockFollowRequestFindFirst.mockResolvedValueOnce({ requesterId: 'user-1', targetId: 'user-target' })
    mockCancelFollowRequestPrimitive.mockResolvedValueOnce({ followerCount: 4 })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.following).toBe(false)
    expect(body.requested).toBe(false)
    expect(body.followerCount).toBe(4)
    expect(mockCancelFollowRequestPrimitive).toHaveBeenCalledWith('user-1', 'user-target')
    expect(mockUnfollowUser).not.toHaveBeenCalled()
  })

  it('フォローもリクエストも無い場合は no-op として 200 { following: false, requested: false, followerCount }', async () => {
    mockFollowFindUnique.mockResolvedValueOnce(null)
    mockFollowRequestFindFirst.mockResolvedValueOnce(null)
    mockFollowCount.mockResolvedValueOnce(5)
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.following).toBe(false)
    expect(body.requested).toBe(false)
    expect(body.followerCount).toBe(5)
    expect(mockUnfollowUser).not.toHaveBeenCalled()
    expect(mockCancelFollowRequestPrimitive).not.toHaveBeenCalled()
  })

  it('フォロー中の場合に unfollowUser が呼ばれ cancelFollowRequestPrimitive は呼ばれない', async () => {
    mockFollowFindUnique.mockResolvedValueOnce({ followerId: 'user-1', followingId: 'user-target' })
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/follow/route')
    await DELETE(req, params)

    expect(mockUnfollowUser).toHaveBeenCalledTimes(1)
    expect(mockCancelFollowRequestPrimitive).not.toHaveBeenCalled()
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/user-target/follow', { method: 'DELETE' })
    const { DELETE } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'user-target' }) })

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const [req, params] = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL, 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('GUEST_NOT_ALLOWED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/users/user-target/follow', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    })
    const { DELETE } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await DELETE(req, { params: Promise.resolve({ id: 'user-target' }) })

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
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', 'user-target', 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('不正 id（31文字超）への DELETE で 400 VALIDATION_ERROR', async () => {
    const invalidId = 'a'.repeat(31)
    const [req, params] = await makeAuthenticatedRequest('user-1', 'user@example.com', invalidId, 'DELETE')
    const { DELETE } = await import('@/app/api/v1/users/[id]/follow/route')
    const res = await DELETE(req, params)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })
})
