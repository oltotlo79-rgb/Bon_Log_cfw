import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * ヘルスチェックエンドポイント
 *
 * Dockerのヘルスチェックやロードバランサーの死活監視に使用
 *
 * レスポンス:
 * - 200: 正常
 * - 429: レート制限超過
 * - 503: データベース接続エラー
 */
export async function GET(request: NextRequest) {
  // IP-based rate limiting (60 requests per minute)
  const ip = getClientIp(request)
  const rateLimitResult = await rateLimit(`health:${ip}`, RATE_LIMITS.api)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { status: 'rate_limited', timestamp: new Date().toISOString() },
      { status: 429 }
    )
  }

  try {
    // データベース接続確認
    await prisma.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('Health check failed:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    )
  }
}
