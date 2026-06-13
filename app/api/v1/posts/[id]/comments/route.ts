/**
 * @module app/api/v1/posts/[id]/comments
 * GET /api/v1/posts/[id]/comments — 投稿のコメント一覧取得
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchComments } from '@/lib/services/comment-read-service'
import { attachMentionedUsers } from '@/lib/api/v1/mention-resolver'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Bearer 認証
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  const { id: postId } = await params

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

  // 4. コメント一覧取得
  const result = await fetchComments(postId, auth.userId, parsed.data.cursor, parsed.data.limit)

  // 5. mentionedUsers を一括解決して付加（N+1 防止）
  const commentsWithMentions = await attachMentionedUsers(result.comments)

  return NextResponse.json({
    items: commentsWithMentions,
    nextCursor: result.nextCursor ?? null,
  })
}
