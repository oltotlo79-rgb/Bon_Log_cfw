// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'

// Prismaモック
const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}))

// 認証モック
const mockRequireAuth = vi.fn()
const mockRequireActiveNonGuestUser = vi.fn()
vi.mock('@/lib/actions/utils', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
  requireActiveNonGuestUser: (...args: unknown[]) => mockRequireActiveNonGuestUser(...args),
  actionSuccess: <T>(data?: T) =>
    data !== undefined ? { success: true, data } : { success: true },
  actionError: (msg: string) => ({ success: false, error: msg }),
  enforceUserRateLimit: vi.fn().mockResolvedValue(null),
}))

// weather-serviceモック
const mockFetchWeather = vi.fn()
const mockGetCachedWeather = vi.fn()
const mockSetCachedWeather = vi.fn()
const mockAnalyzeWeatherForBonsai = vi.fn()
const mockRoundCoord = vi.fn((v: number) => Math.round(v * 100) / 100)

vi.mock('@/lib/services/weather-service', () => ({
  fetchWeather: (...args: unknown[]) => mockFetchWeather(...args),
  getCachedWeather: (...args: unknown[]) => mockGetCachedWeather(...args),
  setCachedWeather: (...args: unknown[]) => mockSetCachedWeather(...args),
  analyzeWeatherForBonsai: (...args: unknown[]) => mockAnalyzeWeatherForBonsai(...args),
  roundCoord: (v: number) => mockRoundCoord(v),
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
  cache: vi.fn((fn: (...args: unknown[]) => unknown) => fn),
}))

describe('Weather Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockRequireAuth.mockResolvedValue({ userId: 'user-1' })
    mockRequireActiveNonGuestUser.mockResolvedValue({ userId: 'user-1' })
  })

  // ----------------------------------------------------------
  // saveWeatherLocation
  // ----------------------------------------------------------
  describe('saveWeatherLocation', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })

      const { saveWeatherLocation } = await import('@/lib/actions/weather')
      const result = await saveWeatherLocation({
        prefecture: '東京都',
        city: '渋谷区',
        latitude: 35.68,
        longitude: 139.77,
      })

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('バリデーションエラー: 空の都道府県', async () => {
      const { saveWeatherLocation } = await import('@/lib/actions/weather')
      const result = await saveWeatherLocation({
        prefecture: '',
        city: '渋谷区',
        latitude: 35.68,
        longitude: 139.77,
      })

      expect(result.success).toBe(false)
      expect(mockPrisma.user.update).not.toHaveBeenCalled()
    })

    it('バリデーションエラー: 空の市区町村', async () => {
      const { saveWeatherLocation } = await import('@/lib/actions/weather')
      const result = await saveWeatherLocation({
        prefecture: '東京都',
        city: '',
        latitude: 35.68,
        longitude: 139.77,
      })

      expect(result.success).toBe(false)
    })

    it('バリデーションエラー: 無効な緯度', async () => {
      const { saveWeatherLocation } = await import('@/lib/actions/weather')
      const result = await saveWeatherLocation({
        prefecture: '東京都',
        city: '渋谷区',
        latitude: 100, // 緯度は -90 ~ 90
        longitude: 139.77,
      })

      expect(result.success).toBe(false)
    })

    it('バリデーションエラー: 無効な経度', async () => {
      const { saveWeatherLocation } = await import('@/lib/actions/weather')
      const result = await saveWeatherLocation({
        prefecture: '東京都',
        city: '渋谷区',
        latitude: 35.68,
        longitude: 200, // 経度は -180 ~ 180
      })

      expect(result.success).toBe(false)
    })

    it('正常に位置情報を保存する', async () => {
      mockPrisma.user.update.mockResolvedValue({})

      const { saveWeatherLocation } = await import('@/lib/actions/weather')
      const result = await saveWeatherLocation({
        prefecture: '東京都',
        city: '渋谷区',
        latitude: 35.68,
        longitude: 139.77,
      })

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          weatherPrefecture: '東京都',
          weatherCity: '渋谷区',
          weatherLatitude: 35.68,
          weatherLongitude: 139.77,
        },
      })
    })
  })

  // ----------------------------------------------------------
  // getWeatherLocation
  // ----------------------------------------------------------
  describe('getWeatherLocation', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getWeatherLocation } = await import('@/lib/actions/weather')
      const result = await getWeatherLocation()

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('位置情報が未設定の場合はnullを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        weatherPrefecture: null,
        weatherCity: null,
        weatherLatitude: null,
        weatherLongitude: null,
      })

      const { getWeatherLocation } = await import('@/lib/actions/weather')
      const result = await getWeatherLocation()

      expect(result).toEqual({ success: true, data: null })
    })

    it('ユーザーが見つからない場合はnullを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const { getWeatherLocation } = await import('@/lib/actions/weather')
      const result = await getWeatherLocation()

      expect(result).toEqual({ success: true, data: null })
    })

    it('位置情報が設定されている場合は返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        weatherPrefecture: '東京都',
        weatherCity: '渋谷区',
        weatherLatitude: 35.68,
        weatherLongitude: 139.77,
      })

      const { getWeatherLocation } = await import('@/lib/actions/weather')
      const result = await getWeatherLocation()

      expect(result).toEqual({
        success: true,
        data: {
          prefecture: '東京都',
          city: '渋谷区',
          latitude: 35.68,
          longitude: 139.77,
        },
      })
    })

    it('weatherCityがnullの場合は空文字を返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        weatherPrefecture: '東京都',
        weatherCity: null,
        weatherLatitude: 35.68,
        weatherLongitude: 139.77,
      })

      const { getWeatherLocation } = await import('@/lib/actions/weather')
      const result = await getWeatherLocation()

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.city).toBe('')
      }
    })
  })

  // ----------------------------------------------------------
  // removeWeatherLocation
  // ----------------------------------------------------------
  describe('removeWeatherLocation', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockRequireActiveNonGuestUser.mockResolvedValue({ error: '認証が必要です' })

      const { removeWeatherLocation } = await import('@/lib/actions/weather')
      const result = await removeWeatherLocation()

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('全フィールドをnullにして保存する', async () => {
      mockPrisma.user.update.mockResolvedValue({})

      const { removeWeatherLocation } = await import('@/lib/actions/weather')
      const result = await removeWeatherLocation()

      expect(result).toEqual({ success: true })
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          weatherPrefecture: null,
          weatherCity: null,
          weatherLatitude: null,
          weatherLongitude: null,
        },
      })
    })
  })

  // ----------------------------------------------------------
  // getWeatherAdvice
  // ----------------------------------------------------------
  describe('getWeatherAdvice', () => {
    it('認証なしの場合はエラーを返す', async () => {
      mockRequireAuth.mockResolvedValue({ error: '認証が必要です' })

      const { getWeatherAdvice } = await import('@/lib/actions/weather')
      const result = await getWeatherAdvice()

      expect(result).toEqual({ success: false, error: '認証が必要です' })
    })

    it('位置情報が未設定の場合は空のアドバイスを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        weatherPrefecture: null,
        weatherCity: null,
        weatherLatitude: null,
        weatherLongitude: null,
      })

      const { getWeatherAdvice } = await import('@/lib/actions/weather')
      const result = await getWeatherAdvice()

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.advice).toEqual([])
        expect(result.data.location).toBe('')
        expect(result.data.temperature).toBeNull()
      }
    })

    it('キャッシュがある場合はキャッシュからアドバイスを返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        weatherPrefecture: '東京都',
        weatherCity: '渋谷区',
        weatherLatitude: 35.68,
        weatherLongitude: 139.77,
      })

      const cachedData = {
        hourly: {
          temperature: [20, 22],
          humidity: [50, 55],
          precipitation: [0, 0],
          windSpeed: [3, 3],
          uvIndex: [2, 2],
          time: [
            new Date(Date.now() + 3600000).toISOString(),
            new Date(Date.now() + 7200000).toISOString(),
          ],
        },
        daily: { tempMax: [25], tempMin: [15], precipitationSum: [0], time: ['2025-01-01'] },
        fetchedAt: new Date().toISOString(),
      }

      mockGetCachedWeather.mockResolvedValue(cachedData)
      mockAnalyzeWeatherForBonsai.mockReturnValue([
        { icon: '🌬️', title: '強風注意', description: 'test', severity: 'high' },
      ])

      const { getWeatherAdvice } = await import('@/lib/actions/weather')
      const result = await getWeatherAdvice()

      expect(result.success).toBe(true)
      expect(mockFetchWeather).not.toHaveBeenCalled()
      expect(mockAnalyzeWeatherForBonsai).toHaveBeenCalledWith(cachedData)
    })

    it('キャッシュがない場合はAPIから取得してキャッシュに保存する', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        weatherPrefecture: '東京都',
        weatherCity: '渋谷区',
        weatherLatitude: 35.68,
        weatherLongitude: 139.77,
      })

      const fetchedData = {
        hourly: {
          temperature: [20],
          humidity: [50],
          precipitation: [0],
          windSpeed: [3],
          uvIndex: [2],
          time: [new Date(Date.now() + 3600000).toISOString()],
        },
        daily: { tempMax: [25], tempMin: [15], precipitationSum: [0], time: ['2025-01-01'] },
        fetchedAt: new Date().toISOString(),
      }

      mockGetCachedWeather.mockResolvedValue(null)
      mockFetchWeather.mockResolvedValue(fetchedData)
      mockSetCachedWeather.mockResolvedValue(undefined)
      mockAnalyzeWeatherForBonsai.mockReturnValue([])

      const { getWeatherAdvice } = await import('@/lib/actions/weather')
      const result = await getWeatherAdvice()

      expect(result.success).toBe(true)
      expect(mockFetchWeather).toHaveBeenCalled()
      expect(mockSetCachedWeather).toHaveBeenCalled()
    })

    it('API取得失敗時は空アドバイスをロケーション付きで返す', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        weatherPrefecture: '東京都',
        weatherCity: '渋谷区',
        weatherLatitude: 35.68,
        weatherLongitude: 139.77,
      })

      mockGetCachedWeather.mockResolvedValue(null)
      mockFetchWeather.mockRejectedValue(new Error('API Error'))

      const { getWeatherAdvice } = await import('@/lib/actions/weather')
      const result = await getWeatherAdvice()

      expect(result.success).toBe(true)
      if (result.success && result.data) {
        expect(result.data.advice).toEqual([])
        expect(result.data.location).toBe('東京都 渋谷区')
        expect(result.data.temperature).toBeNull()
      }
    })
  })
})
