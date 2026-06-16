/**
 * @module app/api/v1/posts/[id]/comments
 * GET  /api/v1/posts/[id]/comments — 投稿のコメント一覧取得
 * POST /api/v1/posts/[id]/comments — コメント作成
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { fetchComments } from '@/lib/services/comment-read-service'
import { createCommentV1Schema, createCommentV1 } from '@/lib/services/comment-write-service'
import { attachMentionedUsers } from '@/lib/api/v1/mention-resolver'
import { resolveBlockMuteStates } from '@/lib/api/v1/follow-state-resolver'
import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
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

  // 6. コメント投稿者の Block/Mute 状態をバッチ解決（2 クエリ）して付加
  const commenterIds = commentsWithMentions.flatMap((c) => (c.user?.id ? [c.user.id] : []))
  const blockMuteMap = await resolveBlockMuteStates(auth.userId, commenterIds)
  const commentsWithState = commentsWithMentions.map((c) => ({
    ...c,
    user: c.user
      ? {
          ...c.user,
          ...(blockMuteMap.get(c.user.id) ?? { isBlocked: false, isMuted: false }),
        }
      : c.user,
  }))

  return NextResponse.json({
    items: commentsWithState,
    nextCursor: result.nextCursor ?? null,
  })
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
) {
  // 1. Bearer 認証（ゲスト不可: コメントは非ゲスト専用）
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

  const parsed = createCommentV1Schema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限（コメント: 5/分）
  const rl = await checkUserRateLimit(auth.userId, 'comment')
  if (!rl.success) return apiRateLimited(rl)

  // 5. コメント作成（可視性チェック・日次制限・トランザクション込み）
  const result = await createCommentV1(postId, parsed.data, auth.userId)

  if (!result.ok) {
    const code = result.status === 404
      ? MOBILE_API_ERROR_CODES.NOT_FOUND
      : result.status === 429
      ? MOBILE_API_ERROR_CODES.RATE_LIMITED
      : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    return apiError(code, result.status, result.error)
  }

  // 6. 作成後のコメントを取得して返す（Native が楽観挿入に使える）
  const comment = await prisma.comment.findUnique({
    where: { id: result.commentId },
    include: {
      user: { select: USER_MINIMAL_SELECT },
      media: { orderBy: { sortOrder: 'asc' } },
      _count: { select: { likes: true, replies: { where: { deletedAt: null } } } },
    },
  })

  if (!comment) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500)
  }

  const commentForClient = {
    ...comment,
    likeCount: comment._count.likes,
    replyCount: comment._count.replies,
    isLiked: false,
    isDeleted: false,
    isBlockedUser: false,
    mentionedUsers: [],
  }

  return NextResponse.json(commentForClient, { status: 201 })
}
