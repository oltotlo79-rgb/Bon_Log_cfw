/**
 * 天気関連 Server Actions
 *
 * ユーザーの天気観測地点の保存・取得・削除、
 * およびキャッシュ済み天気データに基づくアドバイス取得を提供する。
 *
 * @module lib/actions/weather
 */

'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { requireAuth, requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit, type ActionResult } from '@/lib/actions/utils'
import { actionZodError } from '@/lib/actions/schemas/common'
import {
  fetchWeather,
  getCachedWeather,
  setCachedWeather,
  analyzeWeatherForBonsai,
  roundCoord,
  type WeatherAdvice,
} from '@/lib/services/weather-service'
import {
  ERR_WEATHER_LOCATION_SAVE_FAILED,
  ERR_WEATHER_PREFECTURE_REQUIRED,
  ERR_WEATHER_CITY_REQUIRED,
} from '@/lib/constants/errors'
import { ROUTE_SETTINGS } from '@/lib/constants/routes'
import logger from '@/lib/logger'

const weatherLocationSchema = z.object({
  prefecture: z.string().min(1, ERR_WEATHER_PREFECTURE_REQUIRED).max(10),
  city: z.string().min(1, ERR_WEATHER_CITY_REQUIRED).max(50),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

/**
 * 天気観測地点を保存
 */
export async function saveWeatherLocation(
  data: { prefecture: string; city: string; latitude: number; longitude: number }
): Promise<ActionResult> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)

  const parsed = weatherLocationSchema.safeParse(data)
  if (!parsed.success) {
    return actionZodError(parsed.error)
  }

  const rl = await enforceUserRateLimit(authResult.userId, 'engagement')
  if (rl) return actionError(rl.error)

  const { prefecture, city, latitude, longitude } = parsed.data

  try {
    await prisma.user.update({
      where: { id: authResult.userId },
      data: {
        weatherPrefecture: prefecture,
        weatherCity: city,
        weatherLatitude: latitude,
        weatherLongitude: longitude,
      },
    })
  } catch (err) {
    logger.error('saveWeatherLocation: DB update failed', err)
    return actionError(ERR_WEATHER_LOCATION_SAVE_FAILED)
  }

  revalidatePath(ROUTE_SETTINGS)

  return actionSuccess()
}

/**
 * 天気観測地点を取得
 */
export async function getWeatherLocation(): Promise<
  ActionResult<{
    prefecture: string
    city: string
    latitude: number
    longitude: number
  } | null>
> {
  const authResult = await requireAuth()
  if ('error' in authResult) return actionError(authResult.error)

  const user = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: {
      weatherPrefecture: true,
      weatherCity: true,
      weatherLatitude: true,
      weatherLongitude: true,
    },
  })

  if (!user || !user.weatherPrefecture || !user.weatherLatitude || !user.weatherLongitude) {
    return actionSuccess(null)
  }

  return actionSuccess({
    prefecture: user.weatherPrefecture,
    city: user.weatherCity ?? '',
    latitude: Number(user.weatherLatitude),
    longitude: Number(user.weatherLongitude),
  })
}

/**
 * 天気観測地点を削除（全フィールドをnullに設定）
 */
export async function removeWeatherLocation(): Promise<ActionResult> {
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)

  const rl = await enforceUserRateLimit(authResult.userId, 'engagement')
  if (rl) return actionError(rl.error)

  await prisma.user.update({
    where: { id: authResult.userId },
    data: {
      weatherPrefecture: null,
      weatherCity: null,
      weatherLatitude: null,
      weatherLongitude: null,
    },
  })

  revalidatePath(ROUTE_SETTINGS)

  return actionSuccess()
}

/**
 * 天気アドバイスを取得
 *
 * キャッシュ済み天気データからアドバイスを生成して返す。
 * キャッシュがない場合はAPIから取得してキャッシュに保存する。
 */
export async function getWeatherAdvice(): Promise<
  ActionResult<{
    advice: WeatherAdvice[]
    location: string
    temperature: number | null
  }>
> {
  const authResult = await requireAuth()
  if ('error' in authResult) return actionError(authResult.error)

  const user = await prisma.user.findUnique({
    where: { id: authResult.userId },
    select: {
      weatherPrefecture: true,
      weatherCity: true,
      weatherLatitude: true,
      weatherLongitude: true,
    },
  })

  if (!user || !user.weatherLatitude || !user.weatherLongitude) {
    return actionSuccess({
      advice: [],
      location: '',
      temperature: null,
    })
  }

  const lat = Number(user.weatherLatitude)
  const lon = Number(user.weatherLongitude)
  const roundedLat = roundCoord(lat)
  const roundedLon = roundCoord(lon)

  // キャッシュから取得、なければAPIから取得
  let weatherData = await getCachedWeather(roundedLat, roundedLon)
  if (!weatherData) {
    try {
      weatherData = await fetchWeather(roundedLat, roundedLon)
      await setCachedWeather(roundedLat, roundedLon, weatherData)
    } catch (err) {
      logger.error('getWeatherAdvice: Failed to fetch weather', err)
      return actionSuccess({
        advice: [],
        location: `${user.weatherPrefecture} ${user.weatherCity ?? ''}`.trim(),
        temperature: null,
      })
    }
  }

  const advice = analyzeWeatherForBonsai(weatherData)

  // 現在の気温（最新の時間帯のデータ）
  const now = new Date()
  const currentHourIndex = weatherData.hourly.time.findIndex((t) => {
    const hourTime = new Date(t)
    return hourTime > now
  })
  const tempIndex = currentHourIndex > 0 ? currentHourIndex - 1 : 0
  const temperature = weatherData.hourly.temperature[tempIndex] ?? null

  return actionSuccess({
    advice,
    location: `${user.weatherPrefecture} ${user.weatherCity ?? ''}`.trim(),
    temperature,
  })
}
