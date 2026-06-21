/**
 * @module app/api/v1/bonsai/[id]/records
 * GET  /api/v1/bonsai/{id}/records — 成長記録一覧取得
 * POST /api/v1/bonsai/{id}/records — 成長記録作成
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { apiPaginationSchema } from '@/lib/api/v1/pagination'
import { z } from 'zod'
import {
  listBonsaiRecordsV1,
  createBonsaiRecordV1,
  createBonsaiRecordV1Schema,
} from '@/lib/services/bonsai-record-service'

const idSchema = z.object({ id: z.string().min(1).max(64) })

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteParams) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = idSchema.safeParse({ id })
  if (!parsedId.success) return apiZodError(parsedId.error)

  // 3. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const rawCursor = searchParams.get('cursor') ?? undefined
  const rawLimit = searchParams.get('limit')
  const parsedQuery = apiPaginationSchema.safeParse({
    cursor: rawCursor,
    limit: rawLimit !== null ? Number(rawLimit) : undefined,
  })
  if (!parsedQuery.success) return apiZodError(parsedQuery.error)

  // 4. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 5. 成長記録一覧取得
  const result = await listBonsaiRecordsV1(
    auth.userId,
    parsedId.data.id,
    parsedQuery.data.cursor,
    parsedQuery.data.limit,
  )
  if (!result.ok) {
    const code =
      result.status === 404 ? MOBILE_API_ERROR_CODES.NOT_FOUND : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json({ items: result.items, nextCursor: result.nextCursor })
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = idSchema.safeParse({ id })
  if (!parsedId.success) return apiZodError(parsedId.error)

  // 3. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = createBonsaiRecordV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'create_bonsai_record')
  if (!rl.success) return apiRateLimited(rl)

  // 5. 成長記録作成
  const result = await createBonsaiRecordV1(auth.userId, parsedId.data.id, parsed.data)
  if (!result.ok) {
    const code =
      result.status === 404
        ? MOBILE_API_ERROR_CODES.NOT_FOUND
        : result.status === 400
          ? MOBILE_API_ERROR_CODES.VALIDATION_ERROR
          : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json(result.record, { status: 201 })
}
