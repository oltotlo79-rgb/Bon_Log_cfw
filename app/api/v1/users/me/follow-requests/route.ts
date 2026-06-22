/**
 * @module app/api/v1/users/me/follow-requests
 * GET /api/v1/users/me/follow-requests — 受信フォローリクエスト一覧
 *
 * 認証必須・ゲスト不可。pending 状態のリクエストのみ返す。
 * カーソルベースページネーション。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser } from '@/lib/api/v1/auth-guard'
import { apiZodError, apiRateLimited } from '@/lib/api/v1/response'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { listReceivedFollowRequests } from '@/lib/services/follow-service'
import { readPaginationQuerySchema } from '@/lib/api/v1/schemas/request'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'

export async function GET(request: NextRequest) {
  // 1. 認証
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. Zod バリデーション（クエリパラメータ）
  const { searchParams } = request.nextUrl
  const rawQuery = {
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') !== null ? Number(searchParams.get('limit')) : undefined,
  }
  const parsed = readPaginationQuerySchema.safeParse(rawQuery)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }

  // 3. レート制限（ユーザーベース）
  const rl = await checkUserRateLimit(auth.userId, 'timeline')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ビジネスロジック
  const { cursor, limit } = parsed.data
  const result = await listReceivedFollowRequests(
    auth.userId,
    cursor,
    limit ?? DEFAULT_PAGE_LIMIT,
  )

  return NextResponse.json(
    {
      requests: result.requests.map((r) => ({
        id: r.id,
        createdAt: r.createdAt.toISOString(),
        requester: r.requester,
      })),
      nextCursor: result.nextCursor ?? null,
    },
    { status: 200 },
  )
}
