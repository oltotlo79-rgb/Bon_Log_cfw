/**
 * @module app/api/v1/feed
 * GET /api/v1/feed — 認証ユーザーのタイムライン取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchTimeline } from '@/lib/services/feed-service'
import { attachMentionedUsers } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStates } from '@/lib/api/v1/follow-state-resolver'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

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

  // 4. タイムライン取得
  const result = await fetchTimeline(auth.userId, parsed.data.cursor, parsed.data.limit)

  // 5. mentionedUsers を一括解決して付加（N+1 防止: 全投稿を 1 回のバッチで処理）
  const postsWithMentions = await attachMentionedUsers(result.posts)

  // 6. トップレベル投稿者の Block/Mute 状態をバッチ解決（2 クエリ）して付加
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
    isGuest: result.isGuest,
  })
}
