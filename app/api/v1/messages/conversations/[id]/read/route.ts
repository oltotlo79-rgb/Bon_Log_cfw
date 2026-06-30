/**
 * @module app/api/v1/messages/conversations/[id]/read
 * POST /api/v1/messages/conversations/{id}/read — 会話を既読にする（参加者のみ）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { markConversationRead } from '@/lib/services/message-service'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ取得
  const { id: conversationId } = await params

  // 3. レート制限（engagement: 30/分）
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 既読化（参加者のみ）
  const result = await markConversationRead(auth.userId, conversationId)

  if (!result.ok) {
    if (result.code === 'FORBIDDEN') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 403, result.message)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.message)
  }

  return NextResponse.json({ success: true })
}
