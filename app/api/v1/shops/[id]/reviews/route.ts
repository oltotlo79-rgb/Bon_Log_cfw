/**
 * @module app/api/v1/shops/[id]/reviews
 * GET  /api/v1/shops/{id}/reviews  — レビュー一覧取得（ゲスト可）
 * POST /api/v1/shops/{id}/reviews  — レビュー投稿（認証必須・ゲスト不可）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { ERR_SHOP_NOT_FOUND } from '@/lib/constants/errors'
import {
  listReviewsV1QuerySchema,
  createReviewV1Schema,
  listReviewsV1,
  createReviewV1,
} from '@/lib/services/shop-service'
import { z } from 'zod'
import { MAX_NOTIFICATION_ID_LENGTH } from '@/lib/constants/limits'

const shopIdSchema = z.string().min(1).max(MAX_NOTIFICATION_ID_LENGTH)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Bearer 認証（ゲスト可: レビュー一覧は公開）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  const { id } = await params
  const parsedId = shopIdSchema.safeParse(id)
  if (!parsedId.success) return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)

  // 2. クエリパラメータ検証
  const searchParams = request.nextUrl.searchParams
  const rawQuery = {
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
  }
  const parsed = listReviewsV1QuerySchema.safeParse(rawQuery)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（read プリセット: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. レビュー一覧取得
  const result = await listReviewsV1(parsedId.data, parsed.data)
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json({ items: result.items, nextCursor: result.nextCursor })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Bearer 認証（ゲスト不可: レビュー投稿は認証必須）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  const { id } = await params
  const parsedId = shopIdSchema.safeParse(id)
  if (!parsedId.success) return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)

  // 2. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = createReviewV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（create_review: 3/分）
  const rl = await checkUserRateLimit(auth.userId, 'create_review')
  if (!rl.success) return apiRateLimited(rl)

  // 4. レビュー投稿
  const result = await createReviewV1(parsedId.data, parsed.data, auth.userId)
  if (!result.ok) {
    if (result.error === ERR_SHOP_NOT_FOUND) {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.error)
    }
    if ('conflict' in result && result.conflict) {
      return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409, result.error)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json(result.review, { status: 201 })
}
