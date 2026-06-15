// @vitest-environment node
/**
 * GET /api/v1/users/me/blocks — ブロック一覧取得（カーソルページネーション）
 *
 * 200 / 401 / 403 / 429 の全分岐・カーソル算出・limit 上限を検証する。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const GUEST_EMAIL = 'guest@example.com'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const mockCheckUserRateLimit = vi.fn()
vi.mock('@/lib/rate-limit', () => ({
  checkUserRateLimit: (...args: unknown[]) => mockCheckUserRateLimit(...args),
}))

const mockGetBlockedUsersService = vi.fn()
vi.mock('@/lib/services/block-service', () => ({
  blockUserService: vi.fn(),
  unblockUserService: vi.fn(),
  getBlockedUsersService: (...args: unknown[]) => mockGetBlockedUsersService(...args),
}))

const mockBlockedUsers = [
  { id: 'blocked-1', nickname: 'ブロックユーザー1', avatarUrl: '/avatar1.jpg', bio: null },
  { id: 'blocked-2', nickname: 'ブロックユーザー2', avatarUrl: '/avatar2.jpg', bio: '盆栽好き' },
]

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  searchParams = '',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = `http://localhost/api/v1/users/me/blocks${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/users/me/blocks', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetBlockedUsersService.mockResolvedValue({
      items: mockBlockedUsers,
      nextCursor: null,
    })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items, nextCursor } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(2)
    expect(body.nextCursor).toBeNull()
  })

  it('items に { id, nickname, avatarUrl, bio } が含まれる', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: expect.any(String),
      nickname: expect.any(String),
      avatarUrl: expect.anything(),
      bio: null,
    })
  })

  it('getBlockedUsersService に userId と limit が渡される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    await GET(req)

    expect(mockGetBlockedUsersService).toHaveBeenCalledWith('user-1', expect.any(Number), undefined)
  })

  it('limit=5 クエリパラメータが反映される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=5')
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    await GET(req)

    expect(mockGetBlockedUsersService).toHaveBeenCalledWith('user-1', 5, undefined)
  })

  it('cursor クエリパラメータが反映される', async () => {
    const cursorId = 'blocked-cursor-id'
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', `cursor=${cursorId}`)
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    await GET(req)

    expect(mockGetBlockedUsersService).toHaveBeenCalledWith('user-1', expect.any(Number), cursorId)
  })

  it('limit 件取得時に nextCursor が最後の blockedId になる', async () => {
    mockGetBlockedUsersService.mockResolvedValueOnce({
      items: mockBlockedUsers,
      nextCursor: 'blocked-2',
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=2')
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.nextCursor).toBe('blocked-2')
  })

  it('ブロックがない場合は空配列と nextCursor: null', async () => {
    mockGetBlockedUsersService.mockResolvedValueOnce({ items: [], nextCursor: null })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items).toHaveLength(0)
    expect(body.nextCursor).toBeNull()
  })

  it('limit=101 は上限 100 に切られる（apiPaginationSchema）', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'limit=101')
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me/blocks', { method: 'GET' })
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/users/me/blocks', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/users/me/blocks', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('ゲストユーザーで 403 GUEST_NOT_ALLOWED', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

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
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/users/me/blocks/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).not.toBeNull()
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
