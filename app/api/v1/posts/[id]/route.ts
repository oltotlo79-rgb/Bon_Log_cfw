/**
 * @module app/api/v1/posts/[id]
 * GET    /api/v1/posts/[id] — 投稿詳細取得
 * PATCH  /api/v1/posts/[id] — 投稿編集（所有者のみ）
 * DELETE /api/v1/posts/[id] — 投稿削除（所有者のみ）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { fetchPostDetail } from '@/lib/services/post-read-service'
import { updatePostV1Schema, updatePostV1, deletePostV1, fetchCreatedPost } from '@/lib/services/post-write-service'
import { attachMentionedUsersToOne } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStateForOne } from '@/lib/api/v1/follow-state-resolver'
import { cuidSchema } from '@/lib/actions/schemas/common'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  // 1. Bearer 認証
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  const { id: postId } = await params

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'api')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 投稿詳細取得（可視性チェック込み）
  const result = await fetchPostDetail(postId, auth.userId)

  if (!result.found) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  // 4. mentionedUsers を付加
  const postWithMentions = await attachMentionedUsersToOne(result.post)

  // 5. トップレベル投稿者の Block/Mute 状態を付加（単一ユーザー: 2 クエリ並列）
  const authorId = postWithMentions.user?.id
  const blockMuteState = authorId
    ? await resolveBlockMuteStateForOne(auth.userId, authorId)
    : { isBlocked: false, isMuted: false }
  const postWithState = {
    ...postWithMentions,
    user: postWithMentions.user
      ? { ...postWithMentions.user, ...blockMuteState }
      : postWithMentions.user,
  }

  return NextResponse.json(postWithState)
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext,
) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const postId = parsedId.data

  // 3. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = updatePostV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限（編集: engagement 30/分）
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 5. 投稿編集（所有者確認・ビジネスルール検証込み）
  const result = await updatePostV1(postId, parsed.data, auth.userId)

  if (!result.ok) {
    const code = result.status === 404
      ? MOBILE_API_ERROR_CODES.NOT_FOUND
      : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    const httpStatus = result.status
    return apiError(code, httpStatus, result.error)
  }

  // 6. 編集後の投稿詳細を返す
  const postDetail = await fetchCreatedPost(result.postId, auth.userId)
  if (!postDetail.found) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  const postWithMentions = await attachMentionedUsersToOne(postDetail.post)
  const authorId = postWithMentions.user?.id
  const blockMuteState = authorId
    ? await resolveBlockMuteStateForOne(auth.userId, authorId)
    : { isBlocked: false, isMuted: false }

  return NextResponse.json({
    ...postWithMentions,
    user: postWithMentions.user
      ? { ...postWithMentions.user, ...blockMuteState }
      : postWithMentions.user,
  })
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteContext,
) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const postId = parsedId.data

  // 3. レート制限（削除: 5/分）
  const rl = await checkUserRateLimit(auth.userId, 'delete_post')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 投稿削除（所有者確認・R2 メディア削除込み）
  const result = await deletePostV1(postId, auth.userId)

  if (!result.ok) {
    const code = result.status === 404
      ? MOBILE_API_ERROR_CODES.NOT_FOUND
      : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    return apiError(code, result.status, result.error)
  }

  return NextResponse.json({ success: true })
}
