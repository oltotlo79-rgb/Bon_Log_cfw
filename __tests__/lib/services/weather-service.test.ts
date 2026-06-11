// @vitest-environment node

import { vi, describe, it, expect, beforeEach } from 'vitest'

// Redisモック
const mockRedisClient = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}

vi.mock('@/lib/redis', () => ({
  getRedisClient: () => mockRedisClient,
}))

vi.mock('@/lib/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// グローバルfetchのモック
const mockFetch = vi.fn()
global.fetch = mockFetch

import {
  roundCoord,
  analyzeWeatherForBonsai,
  fetchWeather,
  getCachedWeather,
  setCachedWeather,
  type WeatherData,
} from '@/lib/services/weather-service'

import {
  WEATHER_API_BASE_URL,
  WEATHER_CACHE_TTL_SECONDS,
  WEATHER_MAX_ADVICE_COUNT,
  WEATHER_WIND_THRESHOLD,
  WEATHER_HEAT_THRESHOLD,
  WEATHER_COLD_THRESHOLD,
  WEATHER_UV_THRESHOLD,
  WEATHER_HEAVY_RAIN_THRESHOLD,
  WEATHER_HUMIDITY_THRESHOLD,
  WEATHER_HUMIDITY_TEMP_THRESHOLD,
  WEATHER_DRY_HOT_THRESHOLD,
  WEATHER_WET_RAIN_THRESHOLD,
} from '@/lib/constants/limits'

// ============================================================
// ヘルパー: テスト用天気データ生成
// ============================================================

function createBaseWeatherData(overrides: Partial<{
  temperature: number[]
  humidity: number[]
  precipitation: number[]
  windSpeed: number[]
  uvIndex: number[]
  tempMax: number[]
  tempMin: number[]
  precipitationSum: number[]
}>): WeatherData {
  const hours = Array.from({ length: 72 }, (_, i) => {
    const d = new Date()
    d.setHours(d.getHours() + i)
    return d.toISOString()
  })
  const days = Array.from({ length: 3 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]!
  })

  return {
    hourly: {
      temperature: overrides.temperature ?? Array(72).fill(20),
      humidity: overrides.humidity ?? Array(72).fill(50),
      precipitation: overrides.precipitation ?? Array(72).fill(0),
      windSpeed: overrides.windSpeed ?? Array(72).fill(3),
      uvIndex: overrides.uvIndex ?? Array(72).fill(3),
      time: hours,
    },
    daily: {
      tempMax: overrides.tempMax ?? [20, 20, 20],
      tempMin: overrides.tempMin ?? [15, 15, 15],
      precipitationSum: overrides.precipitationSum ?? [0, 0, 0],
      time: days,
    },
    fetchedAt: new Date().toISOString(),
  }
}

// ============================================================
// テスト
// ============================================================

describe('Weather Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----------------------------------------------------------
  // roundCoord
  // ----------------------------------------------------------
  describe('roundCoord', () => {
    it('小数第2位に丸める（WEATHER_COORD_PRECISION=2）', () => {
      expect(roundCoord(35.6812345)).toBe(35.68)
    })

    it('負の値でも正しく丸める', () => {
      expect(roundCoord(-139.7671)).toBe(-139.77)
    })

    it('整数はそのまま返す', () => {
      expect(roundCoord(35)).toBe(35)
    })

    it('小数第2位で四捨五入する', () => {
      expect(roundCoord(35.685)).toBe(35.69)
      expect(roundCoord(35.684)).toBe(35.68)
    })
  })

  // ----------------------------------------------------------
  // analyzeWeatherForBonsai
  // ----------------------------------------------------------
  describe('analyzeWeatherForBonsai', () => {
    it('通常の天気ではアドバイスを返さない', () => {
      const data = createBaseWeatherData({})
      const advice = analyzeWeatherForBonsai(data)
      expect(advice).toEqual([])
    })

    it('強風（>10m/s）で風アドバイスを返す', () => {
      const data = createBaseWeatherData({
        windSpeed: [3, 3, WEATHER_WIND_THRESHOLD + 1, ...Array(69).fill(3)],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '強風注意')).toBe(true)
      expect(advice.find((a) => a.title === '強風注意')?.severity).toBe('high')
    })

    it('猛暑日（>35°C）で暑さアドバイスを返す', () => {
      const data = createBaseWeatherData({
        temperature: [20, 20, WEATHER_HEAT_THRESHOLD + 1, ...Array(69).fill(20)],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '猛暑日')).toBe(true)
      expect(advice.find((a) => a.title === '猛暑日')?.severity).toBe('high')
    })

    it('低温（<5°C）でムロ取り込みアドバイスを返す', () => {
      const data = createBaseWeatherData({
        temperature: [20, 20, WEATHER_COLD_THRESHOLD - 1, ...Array(69).fill(20)],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '低温注意')).toBe(true)
      expect(advice.find((a) => a.title === '低温注意')?.description).toContain('ムロ')
    })

    it('UV指数が高い（>8）でUVアドバイスを返す', () => {
      const data = createBaseWeatherData({
        uvIndex: [3, 3, WEATHER_UV_THRESHOLD + 1, ...Array(69).fill(3)],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '紫外線非常に強')).toBe(true)
      expect(advice.find((a) => a.title === '紫外線非常に強')?.severity).toBe('medium')
    })

    it('大雨（>15mm/h）で雨アドバイスを返す', () => {
      const data = createBaseWeatherData({
        precipitation: [0, 0, WEATHER_HEAVY_RAIN_THRESHOLD + 1, ...Array(69).fill(0)],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '大雨注意')).toBe(true)
      expect(advice.find((a) => a.title === '大雨注意')?.severity).toBe('high')
    })

    it('高温多湿（湿度>85% + 気温>25°C）で病害アドバイスを返す', () => {
      // 同じ時間帯で高湿度+高温
      const humidity = Array(72).fill(50)
      const temperature = Array(72).fill(20)
      humidity[5] = WEATHER_HUMIDITY_THRESHOLD + 1
      temperature[5] = WEATHER_HUMIDITY_TEMP_THRESHOLD + 1

      const data = createBaseWeatherData({ humidity, temperature })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '病害注意')).toBe(true)
      expect(advice.find((a) => a.title === '病害注意')?.severity).toBe('medium')
    })

    it('高湿度だが低温では病害アドバイスを出さない', () => {
      const humidity = Array(72).fill(50)
      const temperature = Array(72).fill(20)
      // 高湿度だが同じインデックスの温度は低い
      humidity[5] = WEATHER_HUMIDITY_THRESHOLD + 1
      temperature[5] = WEATHER_HUMIDITY_TEMP_THRESHOLD - 1

      const data = createBaseWeatherData({ humidity, temperature })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '病害注意')).toBe(false)
    })

    it('連続3日晴天 + 2日以上25°C超で水切れアドバイスを返す', () => {
      const data = createBaseWeatherData({
        precipitationSum: [0, 0, 0],
        tempMax: [WEATHER_DRY_HOT_THRESHOLD + 1, WEATHER_DRY_HOT_THRESHOLD + 1, 20],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '水切れ注意')).toBe(true)
      expect(advice.find((a) => a.title === '水切れ注意')?.severity).toBe('medium')
    })

    it('連続3日晴天だが高温日が1日だけでは水切れアドバイスを出さない', () => {
      const data = createBaseWeatherData({
        precipitationSum: [0, 0, 0],
        tempMax: [WEATHER_DRY_HOT_THRESHOLD + 1, 20, 20],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '水切れ注意')).toBe(false)
    })

    it('晴天が3日続かない場合は水切れアドバイスを出さない', () => {
      const data = createBaseWeatherData({
        precipitationSum: [0, 5, 0],
        tempMax: [WEATHER_DRY_HOT_THRESHOLD + 1, WEATHER_DRY_HOT_THRESHOLD + 1, WEATHER_DRY_HOT_THRESHOLD + 1],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '水切れ注意')).toBe(false)
    })

    it('連続3日降水1mm以上で長雨アドバイスを返す', () => {
      const data = createBaseWeatherData({
        precipitationSum: [WEATHER_WET_RAIN_THRESHOLD, WEATHER_WET_RAIN_THRESHOLD + 5, WEATHER_WET_RAIN_THRESHOLD],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '長雨注意')).toBe(true)
      expect(advice.find((a) => a.title === '長雨注意')?.severity).toBe('low')
    })

    it('3日間の降水が途切れると長雨アドバイスを出さない', () => {
      const data = createBaseWeatherData({
        precipitationSum: [WEATHER_WET_RAIN_THRESHOLD + 5, 0, WEATHER_WET_RAIN_THRESHOLD + 5],
      })
      const advice = analyzeWeatherForBonsai(data)
      expect(advice.some((a) => a.title === '長雨注意')).toBe(false)
    })

    it('最大 WEATHER_MAX_ADVICE_COUNT 件までしか返さない', () => {
      // 全条件を満たすデータを作成
      const humidity = Array(72).fill(WEATHER_HUMIDITY_THRESHOLD + 1)
      const temperature = Array(72).fill(WEATHER_HEAT_THRESHOLD + 1) // 猛暑 + 病害(高温多湿)
      const data = createBaseWeatherData({
        windSpeed: Array(72).fill(WEATHER_WIND_THRESHOLD + 1),
        temperature,
        humidity,
        precipitation: Array(72).fill(WEATHER_HEAVY_RAIN_THRESHOLD + 1),
        uvIndex: Array(72).fill(WEATHER_UV_THRESHOLD + 1),
        precipitationSum: [WEATHER_WET_RAIN_THRESHOLD + 5, WEATHER_WET_RAIN_THRESHOLD + 5, WEATHER_WET_RAIN_THRESHOLD + 5],
        tempMax: [WEATHER_HEAT_THRESHOLD + 1, WEATHER_HEAT_THRESHOLD + 1, WEATHER_HEAT_THRESHOLD + 1],
      })

      const advice = analyzeWeatherForBonsai(data)
      expect(advice.length).toBeLessThanOrEqual(WEATHER_MAX_ADVICE_COUNT)
    })

    it('重要度順にソートされる（high > medium > low）', () => {
      // UV(medium) + 長雨(low) + 強風(high)
      const data = createBaseWeatherData({
        windSpeed: [WEATHER_WIND_THRESHOLD + 1, ...Array(71).fill(3)],
        uvIndex: [WEATHER_UV_THRESHOLD + 1, ...Array(71).fill(3)],
        precipitationSum: [WEATHER_WET_RAIN_THRESHOLD + 5, WEATHER_WET_RAIN_THRESHOLD + 5, WEATHER_WET_RAIN_THRESHOLD + 5],
      })

      const advice = analyzeWeatherForBonsai(data)
      expect(advice.length).toBeGreaterThanOrEqual(2)
      // high が先に来る
      const highIndex = advice.findIndex((a) => a.severity === 'high')
      const mediumIndex = advice.findIndex((a) => a.severity === 'medium')
      const lowIndex = advice.findIndex((a) => a.severity === 'low')

      if (highIndex >= 0 && mediumIndex >= 0) {
        expect(highIndex).toBeLessThan(mediumIndex)
      }
      if (mediumIndex >= 0 && lowIndex >= 0) {
        expect(mediumIndex).toBeLessThan(lowIndex)
      }
    })
  })

  // ----------------------------------------------------------
  // fetchWeather
  // ----------------------------------------------------------
  describe('fetchWeather', () => {
    it('正しいURLでOpen-Meteo APIを呼び出す', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          hourly: {
            temperature_2m: [20],
            relative_humidity_2m: [50],
            precipitation: [0],
            wind_speed_10m: [3],
            uv_index: [2],
            time: ['2025-01-01T00:00'],
          },
          daily: {
            temperature_2m_max: [25],
            temperature_2m_min: [15],
            precipitation_sum: [0],
            time: ['2025-01-01'],
          },
        }),
      })

      await fetchWeather(35.68, 139.77)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const calledUrl = mockFetch.mock.calls[0]![0]! as string
      expect(calledUrl).toContain(WEATHER_API_BASE_URL)
      expect(calledUrl).toContain('latitude=35.68')
      expect(calledUrl).toContain('longitude=139.77')
      expect(calledUrl).toContain('forecast_days=3')
      expect(calledUrl).toContain('timezone=Asia%2FTokyo')
      expect(calledUrl).toContain('hourly=temperature_2m')
    })

    it('レスポンスを正しい形式に変換する', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          hourly: {
            temperature_2m: [20, 22],
            relative_humidity_2m: [50, 55],
            precipitation: [0, 1],
            wind_speed_10m: [3, 5],
            uv_index: [2, 4],
            time: ['2025-01-01T00:00', '2025-01-01T01:00'],
          },
          daily: {
            temperature_2m_max: [25],
            temperature_2m_min: [15],
            precipitation_sum: [1],
            time: ['2025-01-01'],
          },
        }),
      })

      const result = await fetchWeather(35.68, 139.77)

      expect(result.hourly.temperature).toEqual([20, 22])
      expect(result.hourly.humidity).toEqual([50, 55])
      expect(result.hourly.windSpeed).toEqual([3, 5])
      expect(result.daily.tempMax).toEqual([25])
      expect(result.fetchedAt).toBeDefined()
    })

    it('APIエラー時に例外を投げる', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(fetchWeather(35.68, 139.77)).rejects.toThrow('Open-Meteo API error: 500')
    })
  })

  // ----------------------------------------------------------
  // getCachedWeather / setCachedWeather
  // ----------------------------------------------------------
  describe('getCachedWeather', () => {
    it('キャッシュが存在する場合にデータを返す（文字列）', async () => {
      const weatherData = createBaseWeatherData({})
      mockRedisClient.get.mockResolvedValue(JSON.stringify(weatherData))

      const result = await getCachedWeather(35.68, 139.77)
      expect(result).toEqual(weatherData)
      expect(mockRedisClient.get).toHaveBeenCalledWith('weather:35.68:139.77')
    })

    it('キャッシュが存在する場合にデータを返す（自動パース済みオブジェクト）', async () => {
      const weatherData = createBaseWeatherData({})
      mockRedisClient.get.mockResolvedValue(weatherData) // Upstashが自動パースした場合

      const result = await getCachedWeather(35.68, 139.77)
      expect(result).toEqual(weatherData)
    })

    it('キャッシュが存在しない場合はnullを返す', async () => {
      mockRedisClient.get.mockResolvedValue(null)

      const result = await getCachedWeather(35.68, 139.77)
      expect(result).toBeNull()
    })

    it('Redisエラー時はnullを返す', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis connection error'))

      const result = await getCachedWeather(35.68, 139.77)
      expect(result).toBeNull()
    })

    it('スキーマ不一致のキャッシュデータは null を返して再フェッチを促す', async () => {
      // hourly キーが欠落した破損データ
      mockRedisClient.get.mockResolvedValue(
        JSON.stringify({ daily: { tempMax: [10] }, fetchedAt: '2025-01-01' })
      )

      const result = await getCachedWeather(35.68, 139.77)
      expect(result).toBeNull()
    })

    it('JSON 構文エラーのキャッシュデータも null を返す', async () => {
      mockRedisClient.get.mockResolvedValue('{invalid json')

      const result = await getCachedWeather(35.68, 139.77)
      expect(result).toBeNull()
    })
  })

  describe('setCachedWeather', () => {
    it('天気データをRedisに保存する', async () => {
      const weatherData = createBaseWeatherData({})
      mockRedisClient.set.mockResolvedValue('OK')

      await setCachedWeather(35.68, 139.77, weatherData)

      expect(mockRedisClient.set).toHaveBeenCalledWith(
        'weather:35.68:139.77',
        JSON.stringify(weatherData),
        { ex: WEATHER_CACHE_TTL_SECONDS }
      )
    })

    it('Redisエラー時でも例外を投げない', async () => {
      mockRedisClient.set.mockRejectedValue(new Error('Redis connection error'))
      const weatherData = createBaseWeatherData({})

      await expect(setCachedWeather(35.68, 139.77, weatherData)).resolves.not.toThrow()
    })
  })
})
