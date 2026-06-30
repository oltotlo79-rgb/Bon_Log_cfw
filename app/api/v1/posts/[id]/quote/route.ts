/**
 * @module app/api/v1/posts/[id]/quote
 * POST /api/v1/posts/{id}/quote — 引用投稿を作成する
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { createQuoteV1Schema, createQuoteV1, fetchCreatedPost } from '@/lib/services/post-write-service'
import { attachMentionedUsersToOne } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStateForOne } from '@/lib/api/v1/follow-state-resolver'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可: 引用投稿は非ゲスト専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const quotePostId = parsedId.data

  // 3. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = createQuoteV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限（post プリセット: 3/分）
  const rl = await checkUserRateLimit(auth.userId, 'post')
  if (!rl.success) return apiRateLimited(rl)

  // 5. 引用投稿作成（ビジネスルール・認可はサービス層に委譲）
  const result = await createQuoteV1(quotePostId, parsed.data, auth.userId)

  if (!result.ok) {
    const httpStatus = result.status === 429 ? 429 : result.status === 404 ? 404 : 400
    const code =
      result.status === 429
        ? MOBILE_API_ERROR_CODES.RATE_LIMITED
        : result.status === 404
          ? MOBILE_API_ERROR_CODES.NOT_FOUND
          : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    return apiError(code, httpStatus, result.error)
  }

  // 6. 作成後の投稿詳細を返す
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
