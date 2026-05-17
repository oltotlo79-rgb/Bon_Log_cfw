import { NextRequest, NextResponse } from 'next/server'
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { API_ERR_TOO_MANY_REQUESTS, API_ERR_PUSH_NOT_CONFIGURED } from '@/lib/constants/errors'

export const dynamic = 'force-dynamic'

/**
 * VAPID 公開鍵を返す。Push API 購読時の `applicationServerKey` 用。
 * 鍵は server-side env から読み、クライアントバンドルには載せない。
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimitResult = await rateLimit(`vapid:${ip}`, RATE_LIMITS.api)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: API_ERR_TOO_MANY_REQUESTS }, { status: 429 })
  }

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!publicKey) {
    return NextResponse.json({ error: API_ERR_PUSH_NOT_CONFIGURED }, { status: 503 })
  }

  return NextResponse.json({ publicKey })
}
