/**
 * @module app/api/v1/notifications
 * GET /api/v1/notifications — 通知一覧取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchNotifications } from '@/lib/services/notification-read-service'

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

  // 4. 通知一覧取得（ミュートユーザーを除外）
  const result = await fetchNotifications(auth.userId, parsed.data.cursor, parsed.data.limit)

  return NextResponse.json({
    items: result.notifications,
    nextCursor: result.nextCursor ?? null,
  })
}
