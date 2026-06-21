/**
 * @module app/api/v1/bonsai
 * GET /api/v1/bonsai  — 盆栽一覧取得
 * POST /api/v1/bonsai — 盆栽作成
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { apiPaginationSchema } from '@/lib/api/v1/pagination'
import {
  listBonsaiV1,
  createBonsaiV1,
  createBonsaiV1Schema,
} from '@/lib/services/bonsai-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const rawCursor = searchParams.get('cursor') ?? undefined
  const rawLimit = searchParams.get('limit')
  const parsedQuery = apiPaginationSchema.safeParse({
    cursor: rawCursor,
    limit: rawLimit !== null ? Number(rawLimit) : undefined,
  })
  if (!parsedQuery.success) return apiZodError(parsedQuery.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 盆栽一覧取得
  const result = await listBonsaiV1(
    auth.userId,
    parsedQuery.data.cursor,
    parsedQuery.data.limit,
  )
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, result.status)
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

  const parsed = createBonsaiV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'create_bonsai')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 盆栽作成
  const result = await createBonsaiV1(auth.userId, parsed.data)
  if (!result.ok) {
    const code =
      result.status === 400
        ? MOBILE_API_ERROR_CODES.VALIDATION_ERROR
        : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json(result.bonsai, { status: 201 })
}
