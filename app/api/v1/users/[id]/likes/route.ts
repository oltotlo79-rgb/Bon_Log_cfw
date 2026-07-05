/**
 * @module app/api/v1/users/[id]/likes
 * GET /api/v1/users/{id}/likes — ユーザーがいいねした投稿一覧取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchLikedPosts } from '@/lib/services/user-likes-service'
import { attachMentionedUsers } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStates } from '@/lib/api/v1/follow-state-resolver'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト可: 公開アカウントはゲストでも閲覧可）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  const { id: targetUserId } = await params

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = readPaginationQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'timeline')
  if (!rl.success) return apiRateLimited(rl)

  // 4. いいねした投稿一覧取得（対象ユーザーの可視性チェック込み）
  const result = await fetchLikedPosts(
    targetUserId,
    auth.userId,
    parsed.data.cursor,
    parsed.data.limit,
  )

  if (!result.ok) {
    if (result.reason === 'private_account') {
      return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 403)
    }
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  // 5. mentionedUsers を一括解決
  const postsWithMentions = await attachMentionedUsers(result.posts)

  // 6. Block/Mute 状態をバッチ解決
  const authorIds = postsWithMentions.flatMap((p) => (p.user?.id ? [p.user.id] : []))
  const blockMuteMap = await resolveBlockMuteStates(auth.userId, authorIds)
  const postsWithState = postsWithMentions.map((p) => ({
    ...p,
    user: p.user
      ? {
          ...p.user,
          ...(blockMuteMap.get(p.user.id) ?? { isBlocked: false, isMuted: false }),
        }
      : p.user,
  }))

  return NextResponse.json({
    items: postsWithState,
    nextCursor: result.nextCursor ?? null,
  })
}
