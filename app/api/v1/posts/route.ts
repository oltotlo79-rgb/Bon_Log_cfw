/**
 * @module app/api/v1/posts
 * POST /api/v1/posts — 投稿作成
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { createPostV1Schema, createPostV1, fetchCreatedPost } from '@/lib/services/post-write-service'
import { attachMentionedUsersToOne } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStateForOne } from '@/lib/api/v1/follow-state-resolver'

export async function POST(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可: 投稿作成は非ゲスト専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = createPostV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（投稿: 3/分）
  const rl = await checkUserRateLimit(auth.userId, 'post')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 投稿作成（ビジネスルール検証込み）
  const result = await createPostV1(parsed.data, auth.userId)

  if (!result.ok) {
    const code = result.status === 429
      ? MOBILE_API_ERROR_CODES.RATE_LIMITED
      : result.status === 404
        ? MOBILE_API_ERROR_CODES.NOT_FOUND
        : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    return apiError(code, result.status, result.error)
  }

  // 5. 作成後の投稿詳細を取得して返す（Native が楽観挿入に使える）
  const postDetail = await fetchCreatedPost(result.postId, auth.userId)
  if (!postDetail.found) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  const postWithMentions = await attachMentionedUsersToOne(postDetail.post)
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

  return NextResponse.json(postWithState, { status: 201 })
}
