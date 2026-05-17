/**
 * 日次の実訪問者ログを記録する Route Handler。
 *
 * クライアントの `<VisitorBeacon />` がページマウント時に POST する。
 * - HttpOnly Cookie `bon_log_visitor_id` (UUID) で訪問者を識別
 * - `(date, visitor_id)` UNIQUE で同日重複を抑止
 * - 認証中なら `user_id` をバックフィル
 *
 * 個人特定情報 (IP / User-Agent / Referer 等) は格納しない。
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import {
  ONE_DAY_SECONDS,
  VISITOR_COOKIE_MAX_AGE_DAYS,
  MAX_VISITOR_COOKIE_LENGTH,
} from '@/lib/constants/limits'

export const dynamic = 'force-dynamic'

const VISITOR_COOKIE_NAME = 'bon_log_visitor_id'

const VISITOR_COOKIE_MAX_AGE_SECONDS = VISITOR_COOKIE_MAX_AGE_DAYS * ONE_DAY_SECONDS

/** UTC 起点の今日 (DB の `DATE` カラム用に時刻を 0 に切り捨てた Date) */
function todayUtcDate(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
}

export async function POST(request: NextRequest) {
  // IP ベースの軽量 rate limit。cookie のない新規 client が DB write を誘発するのを抑止する。
  // fire-and-forget なので超過時は 204 で静かに落とす。
  const ip = getClientIp(request)
  const rl = await rateLimit(`analytics-track:${ip}`, RATE_LIMITS.api)
  if (!rl.success) {
    return new NextResponse(null, { status: 204 })
  }

  try {
    const cookieStore = await cookies()
    const existing = cookieStore.get(VISITOR_COOKIE_NAME)?.value
    const visitorId =
      existing && existing.length > 0 && existing.length <= MAX_VISITOR_COOKIE_LENGTH
        ? existing
        : crypto.randomUUID()

    // 認証情報があれば userId をバックフィル (失敗しても 200 を返す)
    let userId: string | null = null
    try {
      const session = await auth()
      userId = session?.user?.id ?? null
    } catch {
      userId = null
    }

    const date = todayUtcDate()

    // upsert で同日重複を抑止しつつ、未認証→認証済の昇格時は userId をバックフィル
    try {
      await prisma.dailyVisitor.upsert({
        where: { date_visitorId: { date, visitorId } },
        update: userId ? { userId } : {},
        create: { date, visitorId, userId },
      })
    } catch (err) {
      logger.warn('[analytics/track] upsert failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
      })
    }

    const response = NextResponse.json({ ok: true })
    if (!existing) {
      response.cookies.set(VISITOR_COOKIE_NAME, visitorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: VISITOR_COOKIE_MAX_AGE_SECONDS,
        path: '/',
      })
    }
    return response
  } catch (error) {
    logger.error('[analytics/track] unexpected error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new NextResponse(null, { status: 204 })
  }
}
