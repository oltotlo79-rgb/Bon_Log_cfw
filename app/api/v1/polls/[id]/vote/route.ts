/**
 * @module app/api/v1/polls/[id]/vote
 * POST /api/v1/polls/{id}/vote — アンケートに投票する
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { cuidSchema } from '@/lib/actions/schemas/common'
import { pollVoteRequestSchema } from '@/lib/api/v1/schemas/request'
import { castVote } from '@/lib/services/poll-vote-service'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteContext) {
  // 1. Bearer 認証（ゲスト不可: 投票は非ゲスト専用）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { id } = await params
  const parsedId = cuidSchema.safeParse(id)
  if (!parsedId.success) return apiZodError(parsedId.error)
  const pollId = parsedId.data

  // 3. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = pollVoteRequestSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 4. レート制限（engagement プリセット: 30/分）
  const rl = await checkUserRateLimit(auth.userId, 'engagement')
  if (!rl.success) return apiRateLimited(rl)

  // 5. 投票実行
  const result = await castVote(pollId, parsed.data.optionId, auth.userId)

  if (!result.ok) {
    const httpStatus = result.status === 404 ? 404 : 400
    const code = result.status === 404
      ? MOBILE_API_ERROR_CODES.NOT_FOUND
      : MOBILE_API_ERROR_CODES.VALIDATION_ERROR
    return apiError(code, httpStatus, result.error)
  }

  return NextResponse.json(result.poll)
}
