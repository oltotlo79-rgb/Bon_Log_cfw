/**
 * @module app/api/v1/messages/conversations/[id]/messages/[messageId]
 * DELETE /api/v1/messages/conversations/{id}/messages/{messageId} — メッセージ削除（送信者のみ）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { deleteDirectMessage } from '@/lib/services/message-service'

type RouteContext = { params: Promise<{ id: string; messageId: string }> }

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ取得（id は会話 ID、messageId はメッセージ ID）
  const { messageId } = await params

  // 3. レート制限（engagement: 30/分）
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. メッセージ削除（送信者のみ）
  const result = await deleteDirectMessage(auth.userId, messageId)

  if (!result.ok) {
    if (result.code === 'NOT_FOUND') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404, result.message)
    }
    if (result.code === 'FORBIDDEN') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 403, result.message)
    }
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.message)
  }

  return NextResponse.json({ success: true })
}
