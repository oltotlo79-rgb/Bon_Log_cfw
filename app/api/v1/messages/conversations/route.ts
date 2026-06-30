/**
 * @module app/api/v1/messages/conversations
 * GET  /api/v1/messages/conversations — 自分の会話一覧（カーソルページネーション）
 * POST /api/v1/messages/conversations — 会話開始（取得または新規作成）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited, apiPaginationSchema } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { startConversationRequestSchema } from '@/lib/api/v1/schemas/request'
import { listConversations, startConversation } from '@/lib/services/message-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const searchParams = request.nextUrl.searchParams
  const rawQuery = {
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') !== null ? Number(searchParams.get('limit')) : undefined,
  }
  const parsed = apiPaginationSchema.safeParse(rawQuery)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（読み取り: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 会話一覧取得
  const result = await listConversations(
    auth.userId,
    parsed.data.cursor,
    parsed.data.limit,
  )

  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.message)
  }

  const { items, nextCursor } = result.data
  return NextResponse.json({
    items: items.map((conv) => ({
      ...conv,
      updatedAt: conv.updatedAt.toISOString(),
      lastMessage: conv.lastMessage
        ? {
            ...conv.lastMessage,
            createdAt: conv.lastMessage.createdAt.toISOString(),
          }
        : null,
    })),
    nextCursor,
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

  const parsed = startConversationRequestSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（engagement: 30/分）
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 会話開始
  const result = await startConversation(auth.userId, parsed.data.targetUserId)

  if (!result.ok) {
    if (result.code === 'NOT_FOUND') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.message)
    }
    if (result.code === 'FORBIDDEN') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 403, result.message)
    }
    if (result.code === 'VALIDATION_ERROR') {
      return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, result.message)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.message)
  }

  return NextResponse.json(result.data)
}
