/**
 * @module app/api/v1/shops
 * GET  /api/v1/shops  — 盆栽園一覧取得（ゲスト可）
 * POST /api/v1/shops  — 盆栽園登録（認証必須・ゲスト不可）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  listShopsV1QuerySchema,
  createShopV1Schema,
  listShopsV1,
  createShopV1,
} from '@/lib/services/shop-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: 盆栽園一覧は公開）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const searchParams = request.nextUrl.searchParams
  const rawQuery = {
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    search: searchParams.get('search') ?? undefined,
    genreId: searchParams.get('genreId') ?? undefined,
    prefecture: searchParams.get('prefecture') ?? undefined,
    sortBy: searchParams.get('sortBy') ?? undefined,
    region: searchParams.get('region') ?? undefined,
  }
  const parsed = listShopsV1QuerySchema.safeParse(rawQuery)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（read プリセット: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 盆栽園一覧取得
  const result = await listShopsV1(parsed.data, auth.userId)
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json({ items: result.items, nextCursor: result.nextCursor })
}

export async function POST(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可: 登録は認証必須）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = createShopV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（create_shop: 3/分）
  const rl = await checkUserRateLimit(auth.userId, 'create_shop')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 盆栽園登録
  const result = await createShopV1(parsed.data, auth.userId)
  if (!result.ok) {
    if ('existingId' in result && result.existingId) {
      return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json({ id: result.shop.id }, { status: 201 })
}
