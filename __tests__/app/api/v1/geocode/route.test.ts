// @vitest-environment node
/**
 * GET /api/v1/geocode — 住所ジオコーディング
 *
 * 200 / 400 / 401 / 403 / 404 / 429 の全分岐・ゲスト可を検証する。
 * geocode-service は実装のまま使用し、global.fetch モックで GSI レスポンスを再現する
 * （route ↔ service の統合を確認するため）。
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

const originalFetch = global.fetch

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
  address = '東京都渋谷区',
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  const url = `http://localhost/api/v1/geocode?address=${encodeURIComponent(address)}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/geocode', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 14, resetTime: Date.now() + 60000 })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    global.fetch = originalFetch
  })

  it('正常な住所で 200 { latitude, longitude, formattedAddress } を返す', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        {
          geometry: { coordinates: [139.6503, 35.6762] },
          properties: { title: '東京都渋谷区代々木1-1-1' },
        },
      ]),
    })

    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      latitude: 35.6762,
      longitude: 139.6503,
      formattedAddress: '東京都渋谷区代々木1-1-1',
    })
  })

  it('住所が解決できない場合は 404 NOT_FOUND', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    })

    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', '存在しない住所')
    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('GSI が HTTP エラーを返す場合も 404 NOT_FOUND', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(404)
  })

  it('address 未指定で 400 VALIDATION_ERROR', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-1')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-1', isSuspended: false, email: 'user@example.com' })
    const req = new NextRequest('http://localhost/api/v1/geocode', {
      headers: { authorization: `Bearer ${token}` },
    })

    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('address が上限文字数を超える場合は 400 VALIDATION_ERROR', async () => {
    const { MAX_ADDRESS_LENGTH } = await import('@/lib/constants/limits')
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com', 'あ'.repeat(MAX_ADDRESS_LENGTH + 1))

    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('ゲストユーザーも 200 を返す（読み取り専用のため rejectGuest なし）', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { geometry: { coordinates: [139.0, 35.0] }, properties: { title: '東京都' } },
      ]),
    })

    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/geocode?address=東京都')
    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/geocode?address=東京都', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/geocode?address=東京都', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('レート制限超過で 429 RATE_LIMITED', async () => {
    mockCheckUserRateLimit.mockResolvedValueOnce({
      success: false,
      remaining: 0,
      resetTime: Date.now() + 30000,
    })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/geocode/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
