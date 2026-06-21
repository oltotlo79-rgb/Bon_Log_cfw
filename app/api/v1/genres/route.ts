/**
 * @module app/api/v1/genres
 * GET /api/v1/genres?type=shop|post — ジャンル一覧取得（ゲスト可）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  listGenresV1QuerySchema,
  listGenresV1,
} from '@/lib/services/shop-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: ジャンル一覧は公開）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const searchParams = request.nextUrl.searchParams
  const rawQuery = {
    type: searchParams.get('type') ?? undefined,
  }
  const parsed = listGenresV1QuerySchema.safeParse(rawQuery)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（read プリセット: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ジャンル一覧取得
  const result = await listGenresV1(parsed.data)
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json({ items: result.items })
}
