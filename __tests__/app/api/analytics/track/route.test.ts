// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCookieGet = vi.fn()
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ get: mockCookieGet }),
  headers: () => Promise.resolve(new Headers()),
}))

const mockAuth = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => mockAuth() }))

const mockUpsert = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    dailyVisitor: { upsert: mockUpsert },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/lib/constants/limits', () => ({
  ONE_DAY_SECONDS: 86400,
  VISITOR_COOKIE_MAX_AGE_DAYS: 365,
  MAX_VISITOR_COOKIE_LENGTH: 64,
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ success: true }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { api: { windowMs: 60_000, maxRequests: 60 } },
}))

function makeRequest() {
  return new NextRequest('http://localhost:3000/api/analytics/track', {
    method: 'POST',
  })
}

describe('POST /api/analytics/track', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockResolvedValue(null)
    mockCookieGet.mockReturnValue(undefined)
    mockUpsert.mockResolvedValue({})
  })

  it('既存 Cookie が無い場合は新規 UUID を生成して Set-Cookie を返す', async () => {
    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('bon_log_visitor_id=')
    expect(setCookie.toLowerCase()).toContain('httponly')
    expect(mockUpsert).toHaveBeenCalledTimes(1)
  })

  it('既存 Cookie がある場合は再発行せず upsert のみ行う', async () => {
    mockCookieGet.mockReturnValue({ value: 'existing-uuid-1234' })

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const args = mockUpsert.mock.calls[0]?.[0]
    expect(args?.where?.date_visitorId?.visitorId).toBe('existing-uuid-1234')
  })

  it('認証中なら userId をバックフィルする', async () => {
    mockCookieGet.mockReturnValue({ value: 'visitor-1' })
    mockAuth.mockResolvedValue({ user: { id: 'user-42' } })

    const { POST } = await import('@/app/api/analytics/track/route')
    await POST(makeRequest())
    const args = mockUpsert.mock.calls[0]?.[0]
    expect(args?.create?.userId).toBe('user-42')
    expect(args?.update?.userId).toBe('user-42')
  })

  it('未認証なら create.userId は null', async () => {
    mockCookieGet.mockReturnValue({ value: 'visitor-1' })
    mockAuth.mockResolvedValue(null)

    const { POST } = await import('@/app/api/analytics/track/route')
    await POST(makeRequest())
    const args = mockUpsert.mock.calls[0]?.[0]
    expect(args?.create?.userId).toBeNull()
    expect(args?.update).toEqual({})
  })

  it('upsert が失敗してもユーザーへは 200 を返す（fire-and-forget）', async () => {
    mockCookieGet.mockReturnValue({ value: 'visitor-1' })
    mockUpsert.mockRejectedValueOnce(new Error('DB down'))

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })

  it('auth() が throw しても upsert は実行されて成功する', async () => {
    mockCookieGet.mockReturnValue({ value: 'visitor-1' })
    mockAuth.mockRejectedValueOnce(new Error('auth boom'))

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const args = mockUpsert.mock.calls[0]?.[0]
    expect(args?.create?.userId).toBeNull()
  })
})
