/**
 * @module app/api/v1/messages/conversations/[id]/messages
 * GET  /api/v1/messages/conversations/{id}/messages — メッセージ一覧（カーソルページネーション）
 * POST /api/v1/messages/conversations/{id}/messages — メッセージ送信
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited, apiPaginationSchema } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { sendMessageRequestSchema } from '@/lib/api/v1/schemas/request'
import { listConversationMessages, sendDirectMessage } from '@/lib/services/message-service'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ + クエリパラメータ検証
  const { id: conversationId } = await params
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

  // 4. メッセージ一覧取得（参加者検証・既読更新を含む）
  const result = await listConversationMessages(
    auth.userId,
    conversationId,
    parsed.data.cursor,
    parsed.data.limit,
  )

  if (!result.ok) {
    if (result.code === 'FORBIDDEN') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 403, result.message)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.message)
  }

  const { items, nextCursor } = result.data
  return NextResponse.json({
    items: items.map((msg) => ({
      ...msg,
      createdAt: msg.createdAt.toISOString(),
    })),
    nextCursor,
  })
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id: conversationId } = await params

  // 3. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = sendMessageRequestSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限（send_message: 20/分）
  const rl = await checkUserRateLimit(auth.userId, 'send_message')
  if (!rl.success) return apiRateLimited(rl)

  // 5. メッセージ送信（参加者検証・日次上限・ブロックチェック含む）
  const result = await sendDirectMessage(auth.userId, conversationId, parsed.data.content)

  if (!result.ok) {
    if (result.code === 'FORBIDDEN') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 403, result.message)
    }
    if (result.code === 'VALIDATION_ERROR') {
      return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400, result.message)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.message)
  }

  const msg = result.data.message
  return NextResponse.json(
    {
      ...msg,
      createdAt: msg.createdAt.toISOString(),
    },
    { status: 201 },
  )
}
