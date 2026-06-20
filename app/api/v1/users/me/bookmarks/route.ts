/**
 * @module app/api/v1/users/me/bookmarks
 * GET /api/v1/users/me/bookmarks — ブックマーク投稿一覧（カーソルページネーション）
 *
 * ゲスト不可（403 GUEST_NOT_ALLOWED）。認証必須（401）。
 * 可視性フィルタ: ブロック/非公開著者/停止著者の投稿を除外する。
 * items は既存 feed の投稿形（postSchema）と同等（mentionedUsers / isBlocked / isMuted 付き）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchBookmarkedPosts } from '@/lib/services/bookmark-service'
import { attachMentionedUsers } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStates } from '@/lib/api/v1/follow-state-resolver'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可: ブックマーク一覧は非ゲスト専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = readPaginationQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ブックマーク一覧取得
  const result = await fetchBookmarkedPosts(auth.userId, parsed.data.cursor, parsed.data.limit)

  // 5. mentionedUsers を一括解決して付加（N+1 防止）
  const postsWithMentions = await attachMentionedUsers(result.items)

  // 6. トップレベル投稿者の Block/Mute 状態をバッチ解決して付加
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
    nextCursor: result.nextCursor,
  })
}
