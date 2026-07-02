// @vitest-environment node
/**
 * GET /api/v1/hormones/techniques — 全技法×ホルモン効果一覧（技法単位グループ化、H-4）
 *
 * 200 / 401 / 429 の全分岐・ゲスト可・グループ構造・effects 要素形・空状態を検証する。
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

const mockListHormoneTechniques = vi.fn()
vi.mock('@/lib/services/hormone-read-service', () => ({
  listHormoneTechniques: (...args: unknown[]) => mockListHormoneTechniques(...args),
}))

const mockTechniqueGroups = [
  {
    techniqueKey: 'pruning',
    techniqueNameJa: '剪定',
    techniqueNameEn: 'Pruning',
    effects: [
      {
        hormoneId: 'h1',
        hormoneNameJa: 'オーキシン',
        hormoneSlug: 'auxin',
        effectType: 'promote',
        magnitude: 'moderate',
        mechanism: '頂芽優勢の解除',
      },
      {
        hormoneId: 'h2',
        hormoneNameJa: 'サイトカイニン',
        hormoneSlug: 'cytokinin',
        effectType: 'suppress',
        magnitude: 'low',
        mechanism: null,
      },
    ],
  },
  {
    techniqueKey: 'wiring',
    techniqueNameJa: '針金掛け',
    techniqueNameEn: 'Wiring',
    effects: [
      {
        hormoneId: 'h1',
        hormoneNameJa: 'オーキシン',
        hormoneSlug: 'auxin',
        effectType: 'promote',
        magnitude: 'high',
        mechanism: '機械的ストレス応答',
      },
    ],
  },
]

async function makeAuthenticatedRequest(
  userId: string,
  email: string,
): Promise<NextRequest> {
  const { signAccessToken } = await import('@/lib/api/v1/jwt')
  const token = await signAccessToken(userId)
  mockUserFindUnique.mockResolvedValueOnce({ id: userId, isSuspended: false, email })
  return new NextRequest('http://localhost/api/v1/hormones/techniques', {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` },
  })
}

describe('GET /api/v1/hormones/techniques', () => {
  beforeEach(() => {
    vi.stubEnv('MOBILE_JWT_SECRET', VALID_SECRET)
    vi.clearAllMocks()
    mockCheckUserRateLimit.mockResolvedValue({ success: true, remaining: 59, resetTime: Date.now() + 60000 })
    mockListHormoneTechniques.mockResolvedValue({ items: mockTechniqueGroups })
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('正常取得で 200 { items } を返す', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items).toHaveLength(2)
  })

  it('各グループに { techniqueKey, techniqueNameJa, techniqueNameEn, effects[] } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
    const res = await GET(req)

    const body = await res.json()
    expect(body.items[0]).toMatchObject({
      techniqueKey: 'pruning',
      techniqueNameJa: '剪定',
      techniqueNameEn: 'Pruning',
    })
    expect(Array.isArray(body.items[0]?.effects)).toBe(true)
  })

  it('effects 要素に { hormoneId, hormoneNameJa, hormoneSlug, effectType, magnitude, mechanism } がある', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
    const res = await GET(req)

    const body = await res.json()
    const effect = body.items[0]?.effects[0]
    expect(effect).toMatchObject({
      hormoneId: expect.any(String),
      hormoneNameJa: expect.any(String),
      hormoneSlug: expect.any(String),
      effectType: expect.any(String),
      magnitude: expect.any(String),
    })
  })

  it('mechanism が null のとき null のまま返る', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
    const res = await GET(req)

    const body = await res.json()
    const pruningEffects = body.items[0]?.effects as Array<{ mechanism: unknown }>
    const nullMechanismEffect = pruningEffects.find((e) => e.mechanism === null)
    expect(nullMechanismEffect).toBeDefined()
  })

  it('description フィールドはグループに含まれない', async () => {
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
    const res = await GET(req)

    const body = await res.json()
    for (const group of body.items) {
      expect('description' in group).toBe(false)
    }
  })

  it('ゲストユーザーも 200 を返す', async () => {
    const req = await makeAuthenticatedRequest('guest-id', GUEST_EMAIL)
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
  })

  it('空リスト: 200 { items: [] }', async () => {
    mockListHormoneTechniques.mockResolvedValueOnce({ items: [] })
    const req = await makeAuthenticatedRequest('user-1', 'user@example.com')
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.items).toHaveLength(0)
  })

  it('Bearer ヘッダーなしで 401 AUTH_REQUIRED', async () => {
    const req = new NextRequest('http://localhost/api/v1/hormones/techniques')
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
    const res = await GET(req)

    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error.code).toBe('AUTH_REQUIRED')
  })

  it('停止アカウントで 403 ACCOUNT_SUSPENDED', async () => {
    const { signAccessToken } = await import('@/lib/api/v1/jwt')
    const token = await signAccessToken('user-susp')
    mockUserFindUnique.mockResolvedValueOnce({ id: 'user-susp', isSuspended: true, email: 'u@example.com' })
    const req = new NextRequest('http://localhost/api/v1/hormones/techniques', {
      headers: { authorization: `Bearer ${token}` },
    })
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
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
    const { GET } = await import('@/app/api/v1/hormones/techniques/route')
    const res = await GET(req)

    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error.code).toBe('RATE_LIMITED')
  })
})
