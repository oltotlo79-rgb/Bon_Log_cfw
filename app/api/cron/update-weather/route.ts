/**
 * 天気データ更新 Cronジョブ
 *
 * 全ユーザーの天気観測地点について、Open-Meteo APIから天気データを取得し
 * Redisにキャッシュする。Vercel Cron Jobsにより毎時自動実行される。
 *
 * 座標は丸めて重複排除し、バッチ処理で効率的にAPIを呼び出す。
 *
 * @module app/api/cron/update-weather
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { verifyCronAuth } from '@/lib/cron-auth'
import { WEATHER_CRON_BATCH_SIZE } from '@/lib/constants/limits'
import { API_ERR_INTERNAL_SERVER_ERROR, API_ERR_UNAUTHORIZED } from '@/lib/constants/errors'
import {
  fetchWeather,
  setCachedWeather,
  roundCoord,
} from '@/lib/services/weather-service'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/update-weather
 *
 * 天気観測地点が設定されている全ユーザーの座標を集約し、
 * 重複排除の上バッチでAPIから天気データを取得してキャッシュ更新する。
 */
export async function GET(request: NextRequest) {
  // 認証チェック（HMAC署名 + タイミング攻撃対策）
  const authResult = verifyCronAuth(
    request.headers.get('authorization'),
    request.headers.get('x-cron-timestamp'),
    request.nextUrl.pathname
  )
  if (!authResult.valid) {
    return NextResponse.json(
      { error: authResult.error || API_ERR_UNAUTHORIZED },
      { status: 401 }
    )
  }

  try {
    // 天気地点が設定されているユーザーの座標を取得
    const users = await prisma.user.findMany({
      where: {
        weatherLatitude: { not: null },
        weatherLongitude: { not: null },
      },
      select: {
        weatherLatitude: true,
        weatherLongitude: true,
      },
      distinct: ['weatherLatitude', 'weatherLongitude'],
    })

    // 座標を丸めて重複排除
    const uniquePoints = new Map<string, { lat: number; lon: number }>()
    for (const user of users) {
      if (!user.weatherLatitude || !user.weatherLongitude) continue
      const lat = roundCoord(Number(user.weatherLatitude))
      const lon = roundCoord(Number(user.weatherLongitude))
      const key = `${lat}:${lon}`
      if (!uniquePoints.has(key)) {
        uniquePoints.set(key, { lat, lon })
      }
    }

    const points = Array.from(uniquePoints.values())
    let successCount = 0
    let errorCount = 0

    // バッチ処理
    for (let i = 0; i < points.length; i += WEATHER_CRON_BATCH_SIZE) {
      const batch = points.slice(i, i + WEATHER_CRON_BATCH_SIZE)
      const results = await Promise.allSettled(
        batch.map(async ({ lat, lon }) => {
          const data = await fetchWeather(lat, lon)
          await setCachedWeather(lat, lon, data)
        })
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          successCount++
        } else {
          errorCount++
          logger.error('[Cron] Weather fetch error:', result.reason)
        }
      }
    }

    logger.info(
      `[Cron] Weather update complete: ${successCount} success, ${errorCount} errors, ${points.length} unique points`
    )

    return NextResponse.json({
      success: true,
      totalPoints: points.length,
      successCount,
      errorCount,
    })
  } catch (error) {
    logger.error('[Cron] Weather update error:', error)
    return NextResponse.json(
      { error: API_ERR_INTERNAL_SERVER_ERROR },
      { status: 500 }
    )
  }
}
