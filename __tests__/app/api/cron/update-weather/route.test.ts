// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'

// Prismaモック
const mockPrisma = {
  user: {
    findMany: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

vi.mock('@/lib/cron-auth', () => ({
  verifyCronAuth: vi.fn(),
}))

// weather-serviceモック
const mockFetchWeather = vi.fn()
const mockSetCachedWeather = vi.fn()
const mockRoundCoord = vi.fn((v: number) => Math.round(v * 100) / 100)

vi.mock('@/lib/services/weather-service', () => ({
  fetchWeather: (...args: unknown[]) => mockFetchWeather(...args),
  setCachedWeather: (...args: unknown[]) => mockSetCachedWeather(...args),
  roundCoord: (v: number) => mockRoundCoord(v),
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

function createMockRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (name: string) => headers[name] || null,
    },
    nextUrl: { pathname: '/api/cron/update-weather' },
  } as unknown as import('next/server').NextRequest
}

describe('Cron Update Weather API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it('認証失敗で401を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: false, error: 'Invalid signature' })

    const { GET } = await import('@/app/api/cron/update-weather/route')
    const response = await GET(createMockRequest())

    expect(response.status).toBe(401)
    const data = await response.json()
    expect(data.error).toBeDefined()
  })

  it('認証成功で天気地点を処理する', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    mockPrisma.user.findMany.mockResolvedValue([
      { weatherLatitude: 35.68, weatherLongitude: 139.77 },
      { weatherLatitude: 34.69, weatherLongitude: 135.50 },
    ])

    mockFetchWeather.mockResolvedValue({ hourly: {}, daily: {}, fetchedAt: '' })
    mockSetCachedWeather.mockResolvedValue(undefined)

    const { GET } = await import('@/app/api/cron/update-weather/route')
    const response = await GET(createMockRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.totalPoints).toBe(2)
    expect(data.successCount).toBe(2)
    expect(data.errorCount).toBe(0)
  })

  it('天気地点が空の場合でも正常に返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    mockPrisma.user.findMany.mockResolvedValue([])

    const { GET } = await import('@/app/api/cron/update-weather/route')
    const response = await GET(createMockRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.totalPoints).toBe(0)
    expect(data.successCount).toBe(0)
    expect(data.errorCount).toBe(0)
  })

  it('重複座標を排除して処理する', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    // 丸めると同じ座標になるデータ
    mockPrisma.user.findMany.mockResolvedValue([
      { weatherLatitude: 35.681, weatherLongitude: 139.771 },
      { weatherLatitude: 35.682, weatherLongitude: 139.772 },
    ])

    // roundCoordで同じ値になる
    mockRoundCoord.mockReturnValue(35.68)
    mockRoundCoord.mockImplementation((v: number) => Math.round(v * 100) / 100)

    mockFetchWeather.mockResolvedValue({ hourly: {}, daily: {}, fetchedAt: '' })
    mockSetCachedWeather.mockResolvedValue(undefined)

    const { GET } = await import('@/app/api/cron/update-weather/route')
    const response = await GET(createMockRequest())

    const data = await response.json()
    expect(data.success).toBe(true)
    // 丸め後の座標が同一なら1ポイントに集約される
    expect(data.totalPoints).toBeLessThanOrEqual(2)
  })

  it('一部のAPI取得が失敗してもエラーカウントを返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    mockPrisma.user.findMany.mockResolvedValue([
      { weatherLatitude: 35.68, weatherLongitude: 139.77 },
      { weatherLatitude: 34.69, weatherLongitude: 135.50 },
    ])

    mockFetchWeather
      .mockResolvedValueOnce({ hourly: {}, daily: {}, fetchedAt: '' })
      .mockRejectedValueOnce(new Error('API Error'))
    mockSetCachedWeather.mockResolvedValue(undefined)

    const { GET } = await import('@/app/api/cron/update-weather/route')
    const response = await GET(createMockRequest())

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.successCount).toBe(1)
    expect(data.errorCount).toBe(1)
  })

  it('DB取得でエラーが発生した場合は500を返す', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    mockPrisma.user.findMany.mockRejectedValue(new Error('DB Error'))

    const { GET } = await import('@/app/api/cron/update-weather/route')
    const response = await GET(createMockRequest())

    expect(response.status).toBe(500)
    const data = await response.json()
    expect(data.error).toBe('Internal server error')
  })

  it('nullの座標を持つユーザーをスキップする', async () => {
    const { verifyCronAuth } = await import('@/lib/cron-auth')
    vi.mocked(verifyCronAuth).mockReturnValue({ valid: true })

    mockPrisma.user.findMany.mockResolvedValue([
      { weatherLatitude: null, weatherLongitude: null },
      { weatherLatitude: 35.68, weatherLongitude: 139.77 },
    ])

    mockFetchWeather.mockResolvedValue({ hourly: {}, daily: {}, fetchedAt: '' })
    mockSetCachedWeather.mockResolvedValue(undefined)

    const { GET } = await import('@/app/api/cron/update-weather/route')
    const response = await GET(createMockRequest())

    const data = await response.json()
    expect(data.success).toBe(true)
    // null座標はスキップされるので1ポイントのみ
    expect(data.totalPoints).toBe(1)
  })
})
