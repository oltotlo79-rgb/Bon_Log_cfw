/**
 * @module app/api/v1/scheduled-posts
 * GET  /api/v1/scheduled-posts — 予約投稿一覧（プレミアム限定）
 * POST /api/v1/scheduled-posts — 予約投稿作成（プレミアム限定）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { apiPaginationSchema } from '@/lib/api/v1/pagination'
import {
  scheduledPostCreateV1Schema,
  listScheduledPostsV1,
  createScheduledPostV1,
} from '@/lib/services/scheduled-post-service'
import { ERR_SCHEDULED_POST_PREMIUM_ONLY } from '@/lib/constants/errors'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits/pagination'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const searchParams = request.nextUrl.searchParams
  const parsed = apiPaginationSchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（read: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ビジネスロジック
  const limit = parsed.data.limit ?? DEFAULT_PAGE_LIMIT
  const result = await listScheduledPostsV1(auth.userId, parsed.data.cursor, limit)

  if (!result.ok) {
    const code = result.error === ERR_SCHEDULED_POST_PREMIUM_ONLY
      ? MOBILE_API_ERROR_CODES.PREMIUM_REQUIRED
      : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    return apiError(code, result.status, result.error)
  }

  return NextResponse.json({ items: result.items, nextCursor: result.nextCursor })
}

export async function POST(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = scheduledPostCreateV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（create_scheduled_post: 3/分）
  const rl = await checkUserRateLimit(auth.userId, 'create_scheduled_post')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ビジネスロジック
  const result = await createScheduledPostV1(auth.userId, parsed.data)

  if (!result.ok) {
    const code = result.error === ERR_SCHEDULED_POST_PREMIUM_ONLY
      ? MOBILE_API_ERROR_CODES.PREMIUM_REQUIRED
      : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    return apiError(code, result.status, result.error)
  }

  return NextResponse.json({ id: result.id }, { status: 201 })
}
