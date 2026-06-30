/**
 * @module app/api/v1/posts/[id]/repost
 * POST /api/v1/posts/{id}/repost — リポストを追加する（冪等）
 * DELETE /api/v1/posts/{id}/repost — リポストを解除する（冪等）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { addRepost, removeRepost } from '@/lib/services/repost-service'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可: リポストは非ゲスト専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const postId = parsedId.data

  // 3. レート制限（engagement プリセット: 30/分）
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. リポスト追加（自己リポスト禁止・冪等処理はサービス層に委譲）
  const result = await addRepost(postId, auth.userId)

  if (!result.ok) {
    const status = result.status === 404 ? 404 : result.status === 429 ? 429 : 400
    const code =
      result.status === 429
        ? MOBILE_API_ERROR_CODES.RATE_LIMITED
        : result.status === 404
          ? MOBILE_API_ERROR_CODES.NOT_FOUND
          : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    return apiError(code, status, result.error)
  }

  return NextResponse.json({ reposted: result.reposted, repostCount: result.repostCount })
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const postId = parsedId.data

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 4. リポスト解除（冪等）
  const result = await removeRepost(postId, auth.userId)

  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json({ reposted: result.reposted, repostCount: result.repostCount })
}
