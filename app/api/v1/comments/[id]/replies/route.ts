/**
 * @module app/api/v1/comments/[id]/replies
 * GET /api/v1/comments/[id]/replies — コメントへの返信一覧取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchReplies } from '@/lib/services/comment-read-service'
import { attachMentionedUsers } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStates } from '@/lib/api/v1/follow-state-resolver'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
) {
  // 1. Bearer 認証（ゲスト可: 返信一覧は読み取り専用）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  const { id: commentId } = await params

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = readPaginationQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'api')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 返信一覧取得（親コメントの実 postId で可視性判定。client 申告の postId は使わない）
  const result = await fetchReplies(commentId, auth.userId, parsed.data.cursor, parsed.data.limit)

  // 5. mentionedUsers を一括解決して付加（N+1 防止）
  const repliesWithMentions = await attachMentionedUsers(result.comments)

  // 6. 返信投稿者の Block/Mute 状態をバッチ解決（2 クエリ）して付加
  const replierIds = repliesWithMentions.flatMap((c) => (c.user?.id ? [c.user.id] : []))
  const blockMuteMap = await resolveBlockMuteStates(auth.userId, replierIds)
  const repliesWithState = repliesWithMentions.map((c) => ({
    ...c,
    user: c.user
      ? {
          ...c.user,
          ...(blockMuteMap.get(c.user.id) ?? { isBlocked: false, isMuted: false }),
        }
      : c.user,
  }))

  return NextResponse.json({
    items: repliesWithState,
    nextCursor: result.nextCursor ?? null,
  })
}
