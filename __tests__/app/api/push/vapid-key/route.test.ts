// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { api: { limit: 60, window: 60 } },
}))

const mockRequest = new Request('http://localhost/api/push/vapid-key')

beforeEach(() => {
  vi.unstubAllEnvs()
  mockRateLimit.mockResolvedValue({ success: true })
})

describe('GET /api/push/vapid-key', () => {
  it('returns 503 when VAPID key is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', '')
    vi.resetModules()

    const { GET } = await import('@/app/api/push/vapid-key/route')
    const response = await GET(mockRequest as never)

    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body).toEqual({ error: 'Push notifications not configured' })
  })

  it('returns publicKey when VAPID key is configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'test-vapid-public-key-123')
    vi.resetModules()

    const { GET } = await import('@/app/api/push/vapid-key/route')
    const response = await GET(mockRequest as never)

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ publicKey: 'test-vapid-public-key-123' })
  })

  it('returns 503 when env var is undefined', async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    vi.resetModules()

    const { GET } = await import('@/app/api/push/vapid-key/route')
    const response = await GET(mockRequest as never)

    expect(response.status).toBe(503)
  })

  it('returns 429 when IP rate limit is exceeded (VAPID key not checked)', async () => {
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'test-vapid-public-key-123')
    mockRateLimit.mockResolvedValueOnce({ success: false })
    vi.resetModules()

    const { GET } = await import('@/app/api/push/vapid-key/route')
    const response = await GET(mockRequest as never)

    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body).toEqual({ error: 'Too many requests' })
  })
})
