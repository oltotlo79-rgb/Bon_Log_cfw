/**
 * @module app/api/v1/posts/[id]
 * GET /api/v1/posts/[id] — 投稿詳細取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited } from '@/lib/api/v1'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { fetchPostDetail } from '@/lib/services/post-read-service'
import { attachMentionedUsersToOne } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStateForOne } from '@/lib/api/v1/follow-state-resolver'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
