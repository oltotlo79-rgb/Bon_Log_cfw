/**
 * @module app/api/v1/users/me/blocks
 * GET /api/v1/users/me/blocks — ブロック一覧取得（カーソルページネーション）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited, apiZodError, apiPaginationSchema } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { getBlockedUsersService } from '@/lib/services/block-service'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = apiPaginationSchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)
  const { cursor } = parsed.data
  const limit = parsed.data.limit ?? DEFAULT_PAGE_LIMIT

  // 3. レート制限（読み取りは api プリセット）
  const rl = await checkUserRateLimit(auth.userId, 'api')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ブロック一覧取得
  const blockedUsersResult = await getBlockedUsersService(auth.userId, limit, cursor)

  if (!blockedUsersResult) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  return NextResponse.json({
    items: blockedUsersResult.items,
    nextCursor: blockedUsersResult.nextCursor,
  })
}
