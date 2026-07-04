/**
 * @module app/api/v1/users/[id]/comments
 * GET /api/v1/users/{id}/comments — ユーザーのコメント一覧取得
 *
 * post は { id, content } のみを返す（Post に slug/title は存在しないため）。
 * Native は post.id で GET /api/v1/posts/{id} を叩いて遷移する。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { fetchUserComments } from '@/lib/services/user-comments-service'

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

  // 4. コメント一覧取得（可視性チェック込み）
  const result = await fetchUserComments(
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

  return NextResponse.json({
    items: result.items.map((item) => ({
      id: item.id,
      content: item.content,
      createdAt: item.createdAt.toISOString(),
      post: item.post,
      media: item.media,
    })),
    nextCursor: result.nextCursor ?? null,
  })
}
