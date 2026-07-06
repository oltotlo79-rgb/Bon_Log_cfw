// @vitest-environment node
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockCookieGet = vi.fn()
const mockCookies = vi.fn(() => Promise.resolve({ get: mockCookieGet }))
vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
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

const mockRateLimit = vi.fn().mockResolvedValue({ success: true })
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMITS: { api: { windowMs: 60_000, maxRequests: 60 } },
}))

// cookie は UUID 形式のみ再利用される。テストでは実在形式の UUID を使う。
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000'

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
    mockRateLimit.mockResolvedValue({ success: true })
    mockCookies.mockImplementation(() => Promise.resolve({ get: mockCookieGet }))
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

  it('既存 Cookie が UUID 形式なら再発行せず upsert のみ行う', async () => {
    mockCookieGet.mockReturnValue({ value: VALID_UUID })

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const args = mockUpsert.mock.calls[0]?.[0]
    expect(args?.where?.date_visitorId?.visitorId).toBe(VALID_UUID)
  })

  it('Cookie が UUID 形式でない場合は再利用せず新規 UUID を発行する（squat 対策）', async () => {
    mockCookieGet.mockReturnValue({ value: 'attacker-controlled-value' })

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    // 不正値は採用されず、新しい UUID が Set-Cookie で再発行される
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('bon_log_visitor_id=')
    const usedVisitorId = mockUpsert.mock.calls[0]?.[0]?.where?.date_visitorId?.visitorId
    expect(usedVisitorId).not.toBe('attacker-controlled-value')
    expect(usedVisitorId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('認証中なら userId をバックフィルする', async () => {
    mockCookieGet.mockReturnValue({ value: VALID_UUID })
    mockAuth.mockResolvedValue({ user: { id: 'user-42' } })

    const { POST } = await import('@/app/api/analytics/track/route')
    await POST(makeRequest())
    const args = mockUpsert.mock.calls[0]?.[0]
    expect(args?.create?.userId).toBe('user-42')
    expect(args?.update?.userId).toBe('user-42')
  })

  it('未認証なら create.userId は null', async () => {
    mockCookieGet.mockReturnValue({ value: VALID_UUID })
    mockAuth.mockResolvedValue(null)

    const { POST } = await import('@/app/api/analytics/track/route')
    await POST(makeRequest())
    const args = mockUpsert.mock.calls[0]?.[0]
    expect(args?.create?.userId).toBeNull()
    expect(args?.update).toEqual({})
  })

  it('upsert が失敗してもユーザーへは 200 を返す（fire-and-forget）', async () => {
    mockCookieGet.mockReturnValue({ value: VALID_UUID })
    mockUpsert.mockRejectedValueOnce(new Error('DB down'))

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
  })

  it('auth() が throw しても upsert は実行されて成功する', async () => {
    mockCookieGet.mockReturnValue({ value: VALID_UUID })
    mockAuth.mockRejectedValueOnce(new Error('auth boom'))

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const args = mockUpsert.mock.calls[0]?.[0]
    expect(args?.create?.userId).toBeNull()
  })

  it('IP レート制限超過時は DB に触れず 204 を返す', async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false })

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(204)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it('Cookie 値が最大長を超える場合は再利用せず新規 UUID を発行する', async () => {
    const tooLong = 'a'.repeat(65)
    mockCookieGet.mockReturnValue({ value: tooLong })

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(200)
    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(setCookie).toContain('bon_log_visitor_id=')
    const usedVisitorId = mockUpsert.mock.calls[0]?.[0]?.where?.date_visitorId?.visitorId
    expect(usedVisitorId).not.toBe(tooLong)
  })

  it('cookies() が例外を投げても 204 で握りつぶす（予期しないエラー経路）', async () => {
    mockCookies.mockImplementationOnce(() => {
      throw new Error('cookies boom')
    })

    const { POST } = await import('@/app/api/analytics/track/route')
    const res = await POST(makeRequest())
    expect(res.status).toBe(204)
  })
})
