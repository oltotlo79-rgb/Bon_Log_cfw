// @vitest-environment node
/**
 * GET /api/v1/users/me のユニットテスト
 *
 * Bearer 認証 + ユーザー情報取得 + isPremium の全分岐を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockIsPremiumUser = vi.fn()
vi.mock('@/lib/premium', () => ({
  isPremiumUser: (...args: unknown[]) => mockIsPremiumUser(...args),
}))

async function makeAuthenticatedRequest(userId: string): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  return new NextRequest('http://localhost/api/v1/users/me', {
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/users/me', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockIsPremiumUser.mockResolvedValue(false)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効なトークンと存在するユーザーで 200 とユーザー情報を返す', async () => {
    const userId = 'user-me-1'
    mockUserFindUnique
      .mockResolvedValueOnce({ id: userId, isSuspended: false, email: 'me@example.com' })
      .mockResolvedValueOnce({
        id: userId,
        email: 'me@example.com',
        nickname: '盆栽太郎',
        avatarUrl: '/avatar.jpg',
        bio: '盆栽が好き',
      })
    mockIsPremiumUser.mockResolvedValueOnce(true)

    const req = await makeAuthenticatedRequest(userId)
    const { GET } = await import('@/app/api/v1/users/me/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(userId)
    expect(body.email).toBe('me@example.com')
    expect(body.nickname).toBe('盆栽太郎')
    expect(body.avatarUrl).toBe('/avatar.jpg')
    expect(body.bio).toBe('盆栽が好き')
    expect(body.isPremium).toBe(true)
  })

  it('非プレミアムユーザーで isPremium:false を返す', async () => {
    const userId = 'user-me-2'
    mockUserFindUnique
      .mockResolvedValueOnce({ id: userId, isSuspended: false, email: 'free@example.com' })
      .mockResolvedValueOnce({
        id: userId,
        email: 'free@example.com',
        nickname: 'Free User',
        avatarUrl: null,
        bio: null,
      })
    mockIsPremiumUser.mockResolvedValueOnce(false)

    const req = await makeAuthenticatedRequest(userId)
    const { GET } = await import('@/app/api/v1/users/me/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isPremium).toBe(false)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me')
    const { GET } = await import('@/app/api/v1/users/me/route')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('改ざんトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me', {
      headers: { authorization: 'Bearer invalid.token.value' },
    })
    const { GET } = await import('@/app/api/v1/users/me/route')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const userId = 'suspended-me'
    mockUserFindUnique.mockResolvedValueOnce({
      id: userId,
      isSuspended: true,
      email: 'suspended@example.com',
    })

    const req = await makeAuthenticatedRequest(userId)
    const { GET } = await import('@/app/api/v1/users/me/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('auth-guard 通過後にユーザーが見つからない場合 404 NOT_FOUND', async () => {
    const userId = 'ghost-me'
    mockUserFindUnique
      .mockResolvedValueOnce({ id: userId, isSuspended: false, email: 'ghost@example.com' })
      .mockResolvedValueOnce(null)

    const req = await makeAuthenticatedRequest(userId)
    const { GET } = await import('@/app/api/v1/users/me/route')
    const res = await GET(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('期限切れトークンで 401 AUTH_TOKEN_EXPIRED', async () => {
    vi.useFakeTimers()
    const userId = 'user-exp-me'
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken(userId)
    vi.advanceTimersByTime(901 * 1000)

    const req = new NextRequest('http://localhost/api/v1/users/me', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/users/me/route')
    const res = await GET(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_TOKEN_EXPIRED')
    vi.useRealTimers()
  })
})
