/**
 * @module app/api/v1/events
 * GET /api/v1/events  — イベント一覧取得（ゲスト可）
 * POST /api/v1/events — イベント作成（認証必須・ゲスト不可）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  listEventsV1QuerySchema,
  createEventV1Schema,
  listEventsV1,
  createEventV1,
} from '@/lib/services/event-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: イベント一覧は公開）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const searchParams = request.nextUrl.searchParams
  const rawQuery = {
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    region: searchParams.get('region') ?? undefined,
    prefecture: searchParams.get('prefecture') ?? undefined,
    showPast: searchParams.get('showPast') ?? undefined,
    year: searchParams.get('year') ?? undefined,
    month: searchParams.get('month') ?? undefined,
  }
  const parsed = listEventsV1QuerySchema.safeParse(rawQuery)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（read プリセット: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. イベント一覧取得
  const result = await listEventsV1(parsed.data)
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json({ items: result.items, nextCursor: result.nextCursor })
}

export async function POST(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可: 作成は認証必須）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = createEventV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（create_event: 3/分）
  const rl = await checkUserRateLimit(auth.userId, 'create_event')
  if (!rl.success) return apiRateLimited(rl)

  // 4. イベント作成
  const result = await createEventV1(parsed.data, auth.userId)
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json(result.event, { status: 201 })
}
