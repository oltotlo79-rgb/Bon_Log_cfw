/**
 * @module app/api/v1/posts/[id]/comments/[commentId]
 * DELETE /api/v1/posts/[id]/comments/[commentId] — コメント削除（コメント所有者または投稿所有者）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { deleteCommentV1 } from '@/lib/services/comment-write-service'

type RouteContext = { params: Promise<{ id: string; commentId: string }> }

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { commentId } = await params
  const parsedCommentId = cuidSchema.safeParse(commentId)
  if (!parsedCommentId.success) return apiZodError(parsedCommentId.error)

  // 3. レート制限（コメント削除: 10/分）
  const rl = await checkUserRateLimit(auth.userId, 'delete_comment')
  if (!rl.success) return apiRateLimited(rl)

  // 4. コメント削除（所有者または投稿者確認込み）
  const result = await deleteCommentV1(parsedCommentId.data, auth.userId)

  if (!result.ok) {
    const code = result.status === 404
      ? MOBILE_API_ERROR_CODES.NOT_FOUND
      : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    return apiError(code, result.status, result.error)
  }

  return NextResponse.json({ success: true })
}
