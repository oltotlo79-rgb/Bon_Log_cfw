// @vitest-environment node
/**
 * GET /api/v1/shops — region フィルタのテスト（E）
 *
 * 有効な region → 200、不正な region → 400 VALIDATION_ERROR、
 * region のみ（prefecture なし）→ region が listShopsV1 に渡される、
 * prefecture + region → prefecture が設定されていても Zod は両方 parse する（優先度は service 層）。
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

const VALID_SECRET = 'a'.repeat(64)
const USER_ID = 'user-shops-region'

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

const mockListShopsV1 = vi.fn()

// REGION_NAME_LIST の代表値（lib/prefectures から抜粋）
const VALID_REGIONS = [
  '北海道・東北',
  '関東',
  '中部',
  '近畿',
  '中国・四国',
  '九州・沖縄',
]

vi.mock('@/lib/services/shop-service', () => ({
  listShopsV1QuerySchema: {
    safeParse: (data: unknown) => {
      const d = data as Record<string, string | undefined>
      const region = d?.['region']
      const prefecture = d?.['prefecture']
      const sortBy = d?.['sortBy']
      const validSortBy = ['rating', 'name', 'newest', 'location']
      if (sortBy !== undefined && !validSortBy.includes(sortBy)) {
        return { success: false, error: { issues: [{ message: '不正な sortBy です' }] } }
      }
      const limit = d?.['limit'] !== undefined ? Number(d['limit']) : undefined
      if (limit !== undefined && (isNaN(limit) || limit < 1 || limit > 100)) {
        return { success: false, error: { issues: [{ message: 'limit は1-100の範囲で指定してください' }] } }
      }
      if (region !== undefined && !VALID_REGIONS.includes(region)) {
        return { success: false, error: { issues: [{ message: '不正な地方ブロックです' }] } }
      }
      return {
        success: true,
        data: {
          cursor: d?.['cursor'],
          limit,
          search: d?.['search'],
          genreId: d?.['genreId'],
          prefecture,
          sortBy: sortBy as 'rating' | 'name' | 'newest' | 'location' | undefined,
          region,
        },
      }
    },
  },
  createShopV1Schema: {
    safeParse: () => ({ success: false, error: { issues: [] } }),
  },
  listShopsV1: (...args: unknown[]) => mockListShopsV1(...args),
  createShopV1: vi.fn(),
  SHOP_SORT_BY_VALUES: ['rating', 'name', 'newest', 'location'],
  SHOP_REGION_VALUES: VALID_REGIONS,
}))

async function makeBearerRequest(userId: string, searchParams = ''): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  const url = `http://localhost/api/v1/shops${searchParams ? `?${searchParams}` : ''}`
  return new NextRequest(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/shops — region フィルタ（E）', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isSuspended: false, email: 'user@example.com' })
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 9, resetTime: Date.now() + 60000 })
    mockListShopsV1.mockResolvedValue({ ok: true, items: [], nextCursor: undefined })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('有効な region（関東）で 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'region=%E9%96%A2%E6%9D%B1')
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('有効な region が listShopsV1 に渡される', async () => {
    const req = await makeBearerRequest(USER_ID, 'region=%E9%96%A2%E6%9D%B1')
    const { GET } = await import('@/app/api/v1/shops/route')
    await GET(req)

    const call = mockListShopsV1.mock.calls[0]
    expect(call?.[0].region).toBe('関東')
  })

  it('近畿 region で 200 を返す', async () => {
    const req = await makeBearerRequest(USER_ID, 'region=%E8%BF%91%E7%95%BF')
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('不正な region で 400 VALIDATION_ERROR', async () => {
    const req = await makeBearerRequest(USER_ID, 'region=InvalidRegion')
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('不正な region ではレート制限を消費しない（Zod エラー優先）', async () => {
    const req = await makeBearerRequest(USER_ID, 'region=NotARegion')
    const { GET } = await import('@/app/api/v1/shops/route')
    await GET(req)

    expect(mockCheckUserRateLimit).not.toHaveBeenCalled()
  })

  it('不正な region では listShopsV1 が呼ばれない', async () => {
    const req = await makeBearerRequest(USER_ID, 'region=NotARegion')
    const { GET } = await import('@/app/api/v1/shops/route')
    await GET(req)

    expect(mockListShopsV1).not.toHaveBeenCalled()
  })

  it('region なしで通常の 200 を返す（既存動作を維持）', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const call = mockListShopsV1.mock.calls[0]
    expect(call?.[0].region).toBeUndefined()
  })

  it('prefecture + region を両方指定すると両方が parsed.data に含まれる', async () => {
    const req = await makeBearerRequest(USER_ID, 'prefecture=%E6%9D%B1%E4%BA%AC%E9%83%BD&region=%E9%96%A2%E6%9D%B1')
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const call = mockListShopsV1.mock.calls[0]
    expect(call?.[0].prefecture).toBe('東京都')
    expect(call?.[0].region).toBe('関東')
  })

  it('listShopsV1 がエラーを返した場合 500 INTERNAL_ERROR', async () => {
    mockListShopsV1.mockResolvedValueOnce({ ok: false, error: 'DB error' })
    const req = await makeBearerRequest(USER_ID, 'region=%E9%96%A2%E6%9D%B1')
    const { GET } = await import('@/app/api/v1/shops/route')
    const res = await GET(req)

    expect(res.status).toBe(500)
  })

  it('listShopsV1 が正常に呼ばれる（1 回）', async () => {
    const req = await makeBearerRequest(USER_ID)
    const { GET } = await import('@/app/api/v1/shops/route')
    await GET(req)

    expect(mockListShopsV1).toHaveBeenCalledOnce()
  })
})
