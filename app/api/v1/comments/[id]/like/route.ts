/**
 * @module app/api/v1/comments/[id]/like
 * POST /api/v1/comments/[id]/like — コメントにいいねを付ける（冪等）
 * DELETE /api/v1/comments/[id]/like — コメントのいいねを解除する（冪等）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited, apiZodError } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { addCommentLike, removeCommentLike } from '@/lib/services/like-service'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可: いいねは非ゲスト専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const commentId = parsedId.data

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'toggle_like')
  if (!rl.success) return apiRateLimited(rl)

  // 4. いいね付与（冪等）
  const result = await addCommentLike(commentId, auth.userId)

  if (!result.found) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json({ liked: result.liked, likeCount: result.likeCount })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const commentId = parsedId.data

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'toggle_like')
  if (!rl.success) return apiRateLimited(rl)

  // 4. いいね解除（冪等）
  const result = await removeCommentLike(commentId, auth.userId)

  if (!result.found) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json({ liked: result.liked, likeCount: result.likeCount })
}
