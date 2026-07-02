// @vitest-environment node
/**
 * GET /api/v1/shops/map-pins — 地図用の全店舗ピン取得（M-1）
 *
 * 200 / 401 / 429 / 500 の全分岐・ゲスト可・
 * { items[] } 形・lat/lng number 変換・lat/lng null 除外・
 * averageRating/reviewCount 付与・上限・空状態を検証する。
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

const mockGetShopMapPinsV1 = vi.fn()
vi.mock('@/lib/services/shop-service', () => ({
  getShopMapPinsV1: (...args: unknown[]) => mockGetShopMapPinsV1(...args),
}))

const mockMapPins = [
  {
    id: 'shop-1',
    name: 'テスト盆栽園1',
    latitude: 35.6895,
    longitude: 139.6917,
    address: '東京都渋谷区テスト1-1-1',
    averageRating: 4.2,
    reviewCount: 10,
  },
  {
    id: 'shop-2',
    name: 'テスト盆栽園2',
    latitude: 34.6937,
    longitude: 135.5023,
    address: '大阪府大阪市1-1-1',
    averageRating: null,
    reviewCount: 0,
  },
]

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/shops/map-pins', {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/shops/map-pins', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetShopMapPinsV1.mockResolvedValue({ ok: true, items: mockMapPins })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
  })

  it('各 item に { id, name, latitude, longitude, address, averageRating, reviewCount } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      id: 'shop-1',
      name: 'テスト盆栽園1',
      address: '東京都渋谷区テスト1-1-1',
    })
  })

  it('latitude/longitude は number 型で返る', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    const body = await res.json()
    expect(typeof body.items[0]?.latitude).toBe('number')
    expect(typeof body.items[0]?.longitude).toBe('number')
  })

  it('評価データがある店舗: averageRating と reviewCount が付与される', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    const body = await res.json()
    const shop1 = body.items.find((i: { id: string }) => i.id === 'shop-1')
    expect(shop1?.averageRating).toBe(4.2)
    expect(shop1?.reviewCount).toBe(10)
  })

  it('評価データがない店舗: averageRating=null, reviewCount=0', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    const body = await res.json()
    const shop2 = body.items.find((i: { id: string }) => i.id === 'shop-2')
    expect(shop2?.averageRating).toBeNull()
    expect(shop2?.reviewCount).toBe(0)
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('空リスト: 200 { items: [] }', async () => {
    mockGetShopMapPinsV1.mockResolvedValueOnce({ ok: true, items: [] })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/shops/map-pins')
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('不正なトークンで 401 AUTH_INVALID_TOKEN', async () => {
    const req = new NextRequest('http://localhost/api/v1/shops/map-pins', {
      headers: { authorization: 'Bearer invalid.token' },
    })
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_INVALID_TOKEN')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/shops/map-pins', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
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
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })

  it('service が ok: false を返した場合 500 INTERNAL_ERROR', async () => {
    mockGetShopMapPinsV1.mockResolvedValueOnce({ ok: false, error: '内部エラーが発生しました' })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('INTERNAL_ERROR')
  })

  it('エラーレスポンス形式が { error: { code, message, status } }', async () => {
    const req = new NextRequest('http://localhost/api/v1/shops/map-pins')
    const { GET } = await import('@/app/api/v1/shops/map-pins/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.error).toMatchObject({
      code: expect.any(String),
      message: expect.any(String),
      status: expect.any(Number),
    })
  })
})
