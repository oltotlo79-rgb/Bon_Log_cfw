// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { api: { limit: 60, window: 60 } },
}))

const mockRequest = new Request('http://localhost/api/push/vapid-key')

beforeEach(() => {
  vi.unstubAllEnvs()
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
})
