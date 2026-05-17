// @vitest-environment node
import { vi } from 'vitest'

// モック
vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { api: { windowMs: 60000, maxRequests: 60 } },
}))

describe('Health Check API', async () => {
  const { prisma } = await import('@/lib/db')

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('正常時に200とhealthyを返す', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }] as { '?column?': number }[])

    const { GET } = await import('@/app/api/health/route')
    const response = await GET(new Request('http://localhost/api/health') as unknown as import('next/server').NextRequest)

    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.status).toBe('healthy')
    expect(data.timestamp).toBeDefined()
  })

  it('DBエラー時に503とunhealthyを返す', async () => {
    const error = new Error('Connection failed')
    prisma.$queryRaw.mockRejectedValue(error)

    const { GET } = await import('@/app/api/health/route')
    const response = await GET(new Request('http://localhost/api/health') as unknown as import('next/server').NextRequest)

    expect(response.status).toBe(503)

    const data = await response.json()
    expect(data.status).toBe('unhealthy')
    expect(data.timestamp).toBeDefined()
  })

  it('不明なエラー時も503を返す', async () => {
    prisma.$queryRaw.mockRejectedValue('Unknown error')

    const { GET } = await import('@/app/api/health/route')
    const response = await GET(new Request('http://localhost/api/health') as unknown as import('next/server').NextRequest)

    expect(response.status).toBe(503)

    const data = await response.json()
    expect(data.status).toBe('unhealthy')
  })

  it('タイムスタンプがISO形式で返される', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }] as { '?column?': number }[])

    const { GET } = await import('@/app/api/health/route')
    const response = await GET(new Request('http://localhost/api/health') as unknown as import('next/server').NextRequest)
    const data = await response.json()

    // ISO 8601形式のチェック
    const timestamp = new Date(data.timestamp)
    expect(timestamp.toISOString()).toBe(data.timestamp)
  })

  it('Content-Typeがapplication/jsonである', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }] as { '?column?': number }[])

    const { GET } = await import('@/app/api/health/route')
    const response = await GET(new Request('http://localhost/api/health') as unknown as import('next/server').NextRequest)

    expect(response.headers.get('Content-Type')).toContain('application/json')
  })

  it('503レスポンスでもContent-Typeがapplication/jsonである', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('DB error'))

    const { GET } = await import('@/app/api/health/route')
    const response = await GET(new Request('http://localhost/api/health') as unknown as import('next/server').NextRequest)

    expect(response.status).toBe(503)
    expect(response.headers.get('Content-Type')).toContain('application/json')
  })
})
