/**
 * 天気情報サービス
 *
 * Open-Meteo APIから天気データを取得し、Redisにキャッシュ、
 * 盆栽の手入れアドバイスを生成する。
 *
 * @module lib/services/weather-service
 */

import 'server-only'

import { getRedisClient } from '@/lib/redis'
import logger from '@/lib/logger'
import { z } from 'zod'
import {
  WEATHER_API_BASE_URL,
  WEATHER_CACHE_TTL_SECONDS,
  WEATHER_COORD_PRECISION,
  WEATHER_MAX_ADVICE_COUNT,
  WEATHER_WIND_THRESHOLD,
  WEATHER_HEAT_THRESHOLD,
  WEATHER_COLD_THRESHOLD,
  WEATHER_UV_THRESHOLD,
  WEATHER_HEAVY_RAIN_THRESHOLD,
  WEATHER_HUMIDITY_THRESHOLD,
  WEATHER_HUMIDITY_TEMP_THRESHOLD,
  WEATHER_DRY_CONSECUTIVE_DAYS,
  WEATHER_DRY_HOT_DAYS,
  WEATHER_DRY_HOT_THRESHOLD,
  WEATHER_WET_CONSECUTIVE_DAYS,
  WEATHER_WET_RAIN_THRESHOLD,
} from '@/lib/constants/limits'

/**
 * Redis キャッシュから読み戻す際に検証するスキーマ。
 * キャッシュ破損・古いバージョンのデータを null 扱いにしてフェッチし直す。
 */
const WeatherDataSchema = z.object({
  hourly: z.object({
    temperature: z.array(z.number()),
    humidity: z.array(z.number()),
    precipitation: z.array(z.number()),
    windSpeed: z.array(z.number()),
    uvIndex: z.array(z.number()),
    time: z.array(z.string()),
  }),
  daily: z.object({
    tempMax: z.array(z.number()),
    tempMin: z.array(z.number()),
    precipitationSum: z.array(z.number()),
    time: z.array(z.string()),
  }),
  fetchedAt: z.string(),
})

export type WeatherData = z.infer<typeof WeatherDataSchema>

export interface WeatherAdvice {
  icon: string
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
}

/**
 * 緯度経度を指定精度で丸める（キャッシュキーの正規化用）
 */
export function roundCoord(value: number): number {
  const factor = Math.pow(10, WEATHER_COORD_PRECISION)
  return Math.round(value * factor) / factor
}

/**
 * Redisキャッシュキーを生成
 */
function cacheKey(lat: number, lon: number): string {
  return `weather:${roundCoord(lat)}:${roundCoord(lon)}`
}

/**
 * Open-Meteo APIから天気データを取得
 *
 * 3日間の時間別データ（気温、湿度、降水量、風速、UV指数）と
 * 日別データ（最高/最低気温、降水量合計）を返す。
 */
export async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,uv_index',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
    forecast_days: '3',
    timezone: 'Asia/Tokyo',
  })

  const url = `${WEATHER_API_BASE_URL}?${params.toString()}`
  const response = await fetch(url, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status} ${response.statusText}`)
  }

  const json = await response.json()

  return {
    hourly: {
      temperature: json.hourly.temperature_2m,
      humidity: json.hourly.relative_humidity_2m,
      precipitation: json.hourly.precipitation,
      windSpeed: json.hourly.wind_speed_10m,
      uvIndex: json.hourly.uv_index,
      time: json.hourly.time,
    },
    daily: {
      tempMax: json.daily.temperature_2m_max,
      tempMin: json.daily.temperature_2m_min,
      precipitationSum: json.daily.precipitation_sum,
      time: json.daily.time,
    },
    fetchedAt: new Date().toISOString(),
  }
}

/**
 * Redis から天気データを取得
 *
 * Zod で形状検証し、スキーマ不一致なら null を返して再フェッチを促す。
 */
export async function getCachedWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    const redis = getRedisClient()
    const cached = await redis.get(cacheKey(lat, lon))
    if (!cached) return null

    // Upstash REST クライアントは自動パースする場合がある
    const raw = typeof cached === 'string' ? JSON.parse(cached) : cached
    const parsed = WeatherDataSchema.safeParse(raw)
    return parsed.success ? parsed.data : null
  } catch (err) {
    logger.error('getCachedWeather: Redis error', err)
    return null
  }
}

/**
 * Redisに天気データを保存
 */
export async function setCachedWeather(lat: number, lon: number, data: WeatherData): Promise<void> {
  try {
    const redis = getRedisClient()
    await redis.set(cacheKey(lat, lon), JSON.stringify(data), { ex: WEATHER_CACHE_TTL_SECONDS })
  } catch (err) {
    logger.error('setCachedWeather: Redis error', err)
  }
}

/**
 * 天気データに基づいて盆栽の手入れアドバイスを生成
 *
 * 重要度順にソートし、最大 WEATHER_MAX_ADVICE_COUNT 件を返す。
 */
export function analyzeWeatherForBonsai(data: WeatherData): WeatherAdvice[] {
  const advice: WeatherAdvice[] = []

  const { temperature, humidity, precipitation, windSpeed, uvIndex } = data.hourly
  const { tempMax, precipitationSum } = data.daily

  // 1. 強風チェック（hourly）
  if (windSpeed.some((v) => v > WEATHER_WIND_THRESHOLD)) {
    advice.push({
      icon: '🌬️',
      title: '強風注意',
      description: '棚場の盆栽を低い位置に移動してください',
      severity: 'high',
    })
  }

  // 2. 猛暑チェック（hourly）
  if (temperature.some((v) => v > WEATHER_HEAT_THRESHOLD)) {
    advice.push({
      icon: '☀️',
      title: '猛暑日',
      description: '遮光ネットの設置と夕方の葉水を推奨',
      severity: 'high',
    })
  }

  // 3. 低温チェック（hourly）
  if (temperature.some((v) => v < WEATHER_COLD_THRESHOLD)) {
    advice.push({
      icon: '❄️',
      title: '低温注意',
      description: '寒さに弱い樹種はムロへの取り込みを検討してください',
      severity: 'high',
    })
  }

  // 4. UVチェック（hourly）
  if (uvIndex.some((v) => v > WEATHER_UV_THRESHOLD)) {
    advice.push({
      icon: '🔆',
      title: '紫外線非常に強',
      description: '葉焼け防止に午後の直射日光を避けてください',
      severity: 'medium',
    })
  }

  // 5. 大雨チェック（hourly）
  if (precipitation.some((v) => v > WEATHER_HEAVY_RAIN_THRESHOLD)) {
    advice.push({
      icon: '🌧️',
      title: '大雨注意',
      description: '小品盆栽は軒下に避難させてください',
      severity: 'high',
    })
  }

  // 6. 高温多湿チェック（hourly: 同じ時間帯で湿度+気温）
  const hasHighHumidityHeat = humidity.some((h, i) => {
    const temp = temperature[i]
    return h > WEATHER_HUMIDITY_THRESHOLD && temp !== undefined && temp > WEATHER_HUMIDITY_TEMP_THRESHOLD
  })
  if (hasHighHumidityHeat) {
    advice.push({
      icon: '🦠',
      title: '病害注意',
      description: '高温多湿で灰色かび病のリスクが高まります',
      severity: 'medium',
    })
  }

  // 7. 水切れ注意（daily: 連続3日晴天 + 2日以上25℃超）
  if (precipitationSum.length >= WEATHER_DRY_CONSECUTIVE_DAYS) {
    const consecutiveSunny = precipitationSum
      .slice(0, WEATHER_DRY_CONSECUTIVE_DAYS)
      .every((v) => v === 0)
    const hotDays = tempMax
      .slice(0, WEATHER_DRY_CONSECUTIVE_DAYS)
      .filter((v) => v >= WEATHER_DRY_HOT_THRESHOLD).length

    if (consecutiveSunny && hotDays >= WEATHER_DRY_HOT_DAYS) {
      advice.push({
        icon: '💧',
        title: '水切れ注意',
        description: '晴天と高温が続いています。朝夕の灌水を忘れずに',
        severity: 'medium',
      })
    }
  }

  // 8. 長雨注意（daily: 連続3日降水1mm以上）
  if (precipitationSum.length >= WEATHER_WET_CONSECUTIVE_DAYS) {
    const consecutiveRainy = precipitationSum
      .slice(0, WEATHER_WET_CONSECUTIVE_DAYS)
      .every((v) => v >= WEATHER_WET_RAIN_THRESHOLD)

    if (consecutiveRainy) {
      advice.push({
        icon: '🌿',
        title: '長雨注意',
        description: '乾燥を好む樹種（松柏類など）は軒下への移動を検討してください',
        severity: 'low',
      })
    }
  }

  // 重要度順にソート（high > medium > low）
  const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  advice.sort((a, b) => (severityOrder[a.severity] ?? 999) - (severityOrder[b.severity] ?? 999))

  return advice.slice(0, WEATHER_MAX_ADVICE_COUNT)
}
