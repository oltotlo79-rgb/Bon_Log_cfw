/**
 * @module app/api/v1/bonsai/care-logs
 * GET  /api/v1/bonsai/care-logs — 自分の手入れログ一覧（認証必須・ゲスト 403）
 * POST /api/v1/bonsai/care-logs — 手入れログ作成
 *
 * BonsaiCareLog はユーザー全体の手入れメモで特定の盆栽に紐付かない
 * （Web の lib/actions/bonsai-care-log.ts と同一設計）。
 * このため /bonsai/{bonsaiId}/care-logs ではなく /bonsai/care-logs パスを採用する。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import {
  listCareLogsV1,
  createCareLogV1,
  createCareLogV1Schema,
  listCareLogsV1QuerySchema,
} from '@/lib/services/bonsai-care-log-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = listCareLogsV1QuerySchema.safeParse({
    from: searchParams.get('from') ?? undefined,
    to: searchParams.get('to') ?? undefined,
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 手入れログ一覧取得
  const result = await listCareLogsV1(auth.userId, parsed.data)
  if (!result.ok) {
    const code =
      result.status === 400
        ? MOBILE_API_ERROR_CODES.VALIDATION_ERROR
        : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json({
    items: result.items.map((l) => ({
      ...l,
      performedAt: l.performedAt.toISOString(),
    })),
    nextCursor: result.nextCursor,
  })
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

  const parsed = createCareLogV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'care_log_write')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 手入れログ作成
  const result = await createCareLogV1(auth.userId, parsed.data)
  if (!result.ok) {
    const code =
      result.status === 400
        ? MOBILE_API_ERROR_CODES.VALIDATION_ERROR
        : MOBILE_API_ERROR_CODES.INTERNAL_ERROR
    return apiError(code, result.status)
  }

  return NextResponse.json({ id: result.id }, { status: 201 })
}
