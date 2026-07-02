// @vitest-environment node
/**
 * GET /api/v1/hormones/simulator — シミュレーター用データ一括取得（H-5）
 *
 * 200 / 401 / 429 の全分岐・ゲスト可・
 * { hormones, techniques, seasonalLevels } の形・nameEn null 許容を検証する。
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

const mockGetHormoneSimulatorData = vi.fn()
vi.mock('@/lib/services/hormone-read-service', () => ({
  getHormoneSimulatorData: (...args: unknown[]) => mockGetHormoneSimulatorData(...args),
}))

const mockSimulatorData = {
  hormones: [
    { id: 'h1', slug: 'auxin', name: 'オーキシン', nameEn: 'Auxin' },
    { id: 'h2', slug: 'cytokinin', name: 'サイトカイニン', nameEn: null },
  ],
  techniques: [
    {
      techniqueKey: 'pruning',
      nameJa: '剪定',
      nameEn: 'Pruning',
      effects: [
        { hormoneId: 'h1', effectType: 'promote', magnitude: 'moderate' },
        { hormoneId: 'h2', effectType: 'suppress', magnitude: 'low' },
      ],
    },
  ],
  seasonalLevels: [
    { hormoneId: 'h1', month: 3, level: 'high' },
    { hormoneId: 'h1', month: 6, level: 'balanced' },
    { hormoneId: 'h2', month: 3, level: 'low' },
  ],
}

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/hormones/simulator', {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/hormones/simulator', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockGetHormoneSimulatorData.mockResolvedValue(mockSimulatorData)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { hormones, techniques, seasonalLevels } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.hormones)).toBe(true)
    expect(Array.isArray(body.techniques)).toBe(true)
    expect(Array.isArray(body.seasonalLevels)).toBe(true)
  })

  it('hormones 要素に { id, slug, name, nameEn } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.hormones[0]).toMatchObject({
      id: 'h1',
      slug: 'auxin',
      name: 'オーキシン',
      nameEn: 'Auxin',
    })
  })

  it('hormones の nameEn は null 許容', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.hormones[1]?.nameEn).toBeNull()
  })

  it('techniques 要素に { techniqueKey, nameJa, nameEn, effects[] } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.techniques[0]).toMatchObject({
      techniqueKey: 'pruning',
      nameJa: '剪定',
      nameEn: 'Pruning',
    })
    expect(Array.isArray(body.techniques[0]?.effects)).toBe(true)
  })

  it('techniques.effects 要素に { hormoneId, effectType, magnitude } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.techniques[0]?.effects[0]).toMatchObject({
      hormoneId: 'h1',
      effectType: 'promote',
      magnitude: 'moderate',
    })
  })

  it('seasonalLevels 要素に { hormoneId, month, level } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.seasonalLevels).toHaveLength(3)
    expect(body.seasonalLevels[0]).toMatchObject({
      hormoneId: 'h1',
      month: 3,
      level: 'high',
    })
  })

  it('ゲストユーザーも 200 を返す（rejectGuest なし）', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('空データ: hormones/techniques/seasonalLevels が全て空配列', async () => {
    mockGetHormoneSimulatorData.mockResolvedValueOnce({ hormones: [], techniques: [], seasonalLevels: [] })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.hormones).toHaveLength(0)
    expect(body.techniques).toHaveLength(0)
    expect(body.seasonalLevels).toHaveLength(0)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones/simulator')
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/hormones/simulator', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
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
    const { GET } = await import('@/app/api/v1/hormones/simulator/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
