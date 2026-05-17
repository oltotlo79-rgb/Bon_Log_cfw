// @vitest-environment node
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn(),
    bonsaiTerm: { createMany: vi.fn() },
    genre: { upsert: vi.fn() },
    user: { upsert: vi.fn() },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock('@/lib/constants/errors', () => ({
  API_ERR_UNAUTHORIZED: 'Unauthorized',
  API_ERR_FORBIDDEN: 'Forbidden',
  ERR_INVALID_INPUT: '入力が不正です',
}))

vi.mock('@/lib/constants/limits', () => ({
  BCRYPT_SALT_ROUNDS: 12,
}))

vi.mock('@/lib/constants/guest', () => ({
  GUEST_EMAIL: 'guest@example.com',
}))

vi.mock('@/prisma/seed/genre/genre-data', () => ({
  POST_GENRES: [{ name: '黒松', category: '松柏類', type: 'post', sortOrder: 1 }],
  SHOP_GENRES: [{ name: '松柏', category: '松柏類', type: 'shop', sortOrder: 1 }],
}))

vi.mock('@/prisma/seed/dictionary/seed-dictionary', () => ({
  DICTIONARY_TERMS: [{ slug: 'test', term: 'テスト', reading: 'てすと', description: '...', category: '樹形', sortOrder: 1 }],
}))

vi.mock('@/prisma/seed/fertilizer/seed-fertilizer-data', () => ({
  main: vi.fn(),
}))

vi.mock('@/prisma/seed/hormone/seed-hormone-data', () => ({
  seedHormoneData: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed') },
}))

function makeRequest(token?: string, body?: unknown, ip?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['authorization'] = `Bearer ${token}`
  if (ip) headers['x-forwarded-for'] = ip
  return new NextRequest('http://localhost:3000/api/admin/seed', {
    method: 'POST',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

describe('Admin Seed API', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = {
      ...originalEnv,
      SEED_PESTICIDE_SECRET: 'test-secret-123',
      CRON_SECRET: 'cron-secret-456',
      GUEST_PASSWORD: 'GuestPass1!',
    }
    delete process.env.SEED_ALLOWED_IPS
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 401 when no authorization header is provided', async () => {
    const { POST } = await import('@/app/api/admin/seed/route')
    const res = await POST(makeRequest(undefined, { domain: 'all' }))
    expect(res.status).toBe(401)
  })

  it('returns 401 when token is wrong', async () => {
    const { POST } = await import('@/app/api/admin/seed/route')
    const res = await POST(makeRequest('wrong-token', { domain: 'all' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 when IP is not in allowlist', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.1'
    const { POST } = await import('@/app/api/admin/seed/route')
    const res = await POST(makeRequest('test-secret-123', { domain: 'all' }, '192.168.1.1'))
    expect(res.status).toBe(403)
  })

  it('returns 400 when body is missing', async () => {
    const { POST } = await import('@/app/api/admin/seed/route')
    const req = new NextRequest('http://localhost:3000/api/admin/seed', {
      method: 'POST',
      headers: { authorization: 'Bearer test-secret-123' },
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 when domain is invalid', async () => {
    const { POST } = await import('@/app/api/admin/seed/route')
    const res = await POST(makeRequest('test-secret-123', { domain: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('runs only genres when domain="genres"', async () => {
    const { prisma } = await import('@/lib/db')
    const fert = await import('@/prisma/seed/fertilizer/seed-fertilizer-data')
    const horm = await import('@/prisma/seed/hormone/seed-hormone-data')

    vi.mocked(prisma.genre.upsert).mockResolvedValue({} as never)

    const { POST } = await import('@/app/api/admin/seed/route')
    const res = await POST(makeRequest('test-secret-123', { domain: 'genres' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.results.genres).toBeDefined()
    expect(data.results.fertilizer).toBeUndefined()
    expect(prisma.genre.upsert).toHaveBeenCalled()
    expect(fert.main).not.toHaveBeenCalled()
    expect(horm.seedHormoneData).not.toHaveBeenCalled()
  })

  it('runs all domains when domain="all"', async () => {
    const { prisma } = await import('@/lib/db')
    const fert = await import('@/prisma/seed/fertilizer/seed-fertilizer-data')
    const horm = await import('@/prisma/seed/hormone/seed-hormone-data')

    vi.mocked(prisma.genre.upsert).mockResolvedValue({} as never)
    vi.mocked(prisma.user.upsert).mockResolvedValue({} as never)
    vi.mocked(prisma.bonsaiTerm.createMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(undefined as never)
    vi.mocked(fert.main).mockResolvedValue(undefined as never)
    vi.mocked(horm.seedHormoneData).mockResolvedValue(undefined as never)

    const { POST } = await import('@/app/api/admin/seed/route')
    const res = await POST(makeRequest('test-secret-123', { domain: 'all' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.results.genres).toBeDefined()
    expect(data.results.guest).toBeDefined()
    expect(data.results.fertilizer).toBeDefined()
    expect(data.results.dictionary).toBeDefined()
    expect(data.results.hormone).toBeDefined()
    expect(fert.main).toHaveBeenCalled()
    expect(horm.seedHormoneData).toHaveBeenCalled()
  })

  it('skips guest seed when GUEST_PASSWORD is not set but still returns ok=false', async () => {
    delete process.env.GUEST_PASSWORD
    const { prisma } = await import('@/lib/db')

    const { POST } = await import('@/app/api/admin/seed/route')
    const res = await POST(makeRequest('test-secret-123', { domain: 'guest' }))

    expect(res.status).toBe(200)
    const data = await res.json()
    const guest = data.results.guest as { ok: boolean; reason?: string }
    expect(guest.ok).toBe(false)
    expect(guest.reason).toBeDefined()
    expect(prisma.user.upsert).not.toHaveBeenCalled()
  })

  it('returns 500 with detailed error when domain handler throws', async () => {
    const { prisma } = await import('@/lib/db')
    vi.mocked(prisma.$executeRawUnsafe).mockRejectedValue(new Error('Connection failed'))

    const { POST } = await import('@/app/api/admin/seed/route')
    const res = await POST(makeRequest('test-secret-123', { domain: 'dictionary' }))

    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('Seed failed')
    expect(data.message).toContain('Connection failed')
    expect(data.domain).toBe('dictionary')
  })

  it('CRON_SECRET では認証を通さない (信頼境界の分離)', async () => {
    // 旧実装は SEED_PESTICIDE_SECRET 未設定時 CRON_SECRET でも通したが、現在は seed 専用 secret 必須。
    delete process.env.SEED_PESTICIDE_SECRET

    const { POST } = await import('@/app/api/admin/seed/route')
    const res = await POST(makeRequest('cron-secret-456', { domain: 'genres' }))

    expect(res.status).toBe(401)
  })
})
