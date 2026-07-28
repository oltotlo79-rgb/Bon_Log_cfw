/**
 * @module app/api/v1/notifications
 * GET /api/v1/notifications — 通知一覧取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchNotifications } from '@/lib/services/notification-read-service'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可: 通知は認証ユーザー専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = readPaginationQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'api')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 通知一覧取得（ブロック双方向 + ミュートを除外。relation lookup 失敗時は
  //    fail-closed のため例外を捕捉し typed 500 を返す — ブロック済み通知を漏らさない）
  try {
    const result = await fetchNotifications(auth.userId, parsed.data.cursor, parsed.data.limit, {
      excludeBlocked: true,
    })

    return NextResponse.json({
      items: result.notifications,
      nextCursor: result.nextCursor ?? null,
    })
  } catch (error) {
    logger.error('GET /api/v1/notifications failed', {
      error: error instanceof Error ? error.message : String(error),
      userId: auth.userId,
    })
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }
}
