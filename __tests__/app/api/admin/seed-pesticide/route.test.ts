// @vitest-environment node
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  prisma: {
    $executeRawUnsafe: vi.fn(),
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
}))

vi.mock('@/prisma/seed/pesticide/seed-pesticide-data', () => ({
  main: vi.fn(),
}))

function makeRequest(token?: string, ip?: string): NextRequest {
  const headers: Record<string, string> = {}
  if (token) headers['authorization'] = `Bearer ${token}`
  if (ip) headers['x-forwarded-for'] = ip
  return new NextRequest('http://localhost:3000/api/admin/seed-pesticide', {
    method: 'POST',
    headers,
  })
}

describe('Admin Seed Pesticide API', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = {
      ...originalEnv,
      SEED_PESTICIDE_SECRET: 'test-secret-123',
      CRON_SECRET: 'cron-secret-456',
      VERCEL_CRON_SECRET: 'vercel-cron-789',
    }
    delete process.env.SEED_ALLOWED_IPS
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 401 when no authorization header provided', async () => {
    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const response = await POST(makeRequest())

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 401 when invalid token provided', async () => {
    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const response = await POST(makeRequest('wrong-token'))

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 401 when non-Bearer authorization format is used', async () => {
    const headers: Record<string, string> = { authorization: 'Basic xyz' }
    const req = new NextRequest('http://localhost:3000/api/admin/seed-pesticide', {
      method: 'POST',
      headers,
    })

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const response = await POST(req)

    expect(response.status).toBe(401)
  })

  it('returns 403 when IP is not in allowlist', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.1,10.0.0.2'

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const response = await POST(makeRequest('test-secret-123', '192.168.1.1'))

    expect(response.status).toBe(403)
    const data = await response.json()
    expect(data.error).toBe('Forbidden')
  })

  it('returns success when valid SEED_PESTICIDE_SECRET is provided', async () => {
    const { prisma } = await import('@/lib/db')
    const seedModule = await import('@/prisma/seed/pesticide/seed-pesticide-data')

    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(undefined as never)
    vi.mocked(seedModule.main).mockResolvedValue(undefined as never)

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const response = await POST(makeRequest('test-secret-123'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toBe('Pesticide seed completed')
    expect(prisma.$executeRawUnsafe).toHaveBeenCalled()
    expect(seedModule.main).toHaveBeenCalled()
  })

  it('CRON_SECRET では認証を通さない (信頼境界の分離)', async () => {
    // 旧実装は SEED_PESTICIDE_SECRET 未設定時 CRON_SECRET でも通したが、現在は seed 専用 secret 必須。
    delete process.env.SEED_PESTICIDE_SECRET

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const response = await POST(makeRequest('cron-secret-456'))

    expect(response.status).toBe(401)
  })

  it('returns 500 when seed operation fails', async () => {
    const { prisma } = await import('@/lib/db')

    vi.mocked(prisma.$executeRawUnsafe).mockRejectedValue(new Error('DB connection failed'))

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const response = await POST(makeRequest('test-secret-123'))

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Pesticide seed failed')
  })

  it('allows request when IP is in allowlist', async () => {
    process.env.SEED_ALLOWED_IPS = '10.0.0.1,192.168.1.1'

    const { prisma } = await import('@/lib/db')
    const seedModule = await import('@/prisma/seed/pesticide/seed-pesticide-data')

    vi.mocked(prisma.$executeRawUnsafe).mockResolvedValue(undefined as never)
    vi.mocked(seedModule.main).mockResolvedValue(undefined as never)

    const { POST } = await import('@/app/api/admin/seed-pesticide/route')
    const response = await POST(makeRequest('test-secret-123', '192.168.1.1'))

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
  })
})
