/**
 * @module app/api/v1/posts/[id]/bookmark
 * POST /api/v1/posts/[id]/bookmark — 投稿をブックマークに追加する（冪等）
 * DELETE /api/v1/posts/[id]/bookmark — 投稿のブックマークを解除する（冪等）
 *
 * ゲスト不可（403 GUEST_NOT_ALLOWED）。認証必須（401）。
 * 不存在・不可視投稿は 404 NOT_FOUND。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited, apiZodError } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { addBookmark, removeBookmark } from '@/lib/services/bookmark-service'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可: ブックマークは非ゲスト専用）
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

  // 4. ブックマーク付与（冪等）
  const result = await addBookmark(postId, auth.userId)

  if (!result.found) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json({ bookmarked: result.bookmarked })
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

  // 4. ブックマーク解除（冪等）
  const result = await removeBookmark(postId, auth.userId)

  if (!result.found) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json({ bookmarked: result.bookmarked })
}
