/**
 * @module app/api/v1/auth/email/change/request
 * POST /api/v1/auth/email/change/request — ログイン中ユーザーのメールアドレス変更リクエスト
 *
 * body: { newEmail, currentPassword } — 現パスワード確認必須。
 *
 * 列挙攻撃対策: newEmail が既に他ユーザーに使われている場合も常に 200 を返す
 * （メールは送信しない）。現パスワード不一致・OAuth 専用アカウントは本人が既に知っている
 * 自分のアカウント状態であり newEmail の enumeration にはならないため、
 * 401 / 409 でそのまま返してよい（password/change と同じ扱い）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { ERR_NO_PASSWORD_SET, ERR_INCORRECT_PASSWORD } from '@/lib/constants/errors'
import { emailChangeRequestSchema } from '@/lib/api/v1/schemas/request'
import { requestEmailChangeCore } from '@/lib/services/email-change-service'
import { getClientIpFromRequest } from '@/lib/utils/client-ip'

export async function POST(request: NextRequest) {
  // 1. Bearer 認証（ゲスト不可）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. リクエストボディ検証
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = emailChangeRequestSchema.safeParse(body)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（Zod 通過後）
  const rl = await checkUserRateLimit(auth.userId, 'email_change_request')
  if (!rl.success) return apiRateLimited(rl)

  // 4. メールアドレス変更リクエスト実行
  const ip = getClientIpFromRequest(request)
  const result = await requestEmailChangeCore(
    auth.userId,
    parsed.data.currentPassword,
    parsed.data.newEmail,
    ip,
  )
  if (!result.ok) {
    if (result.error === ERR_NO_PASSWORD_SET) {
      return apiError(MOBILE_API_ERROR_CODES.CONFLICT, 409, result.error)
    }
    if (result.error === ERR_INCORRECT_PASSWORD) {
      return apiError(MOBILE_API_ERROR_CODES.AUTH_INVALID_CREDENTIALS, 401, result.error)
    }
    // メール送信失敗等の内部エラーも列挙攻撃対策として 200 に丸める
    // （newEmail 使用状況とは無関係な失敗のため、UI 上は success 表示のままでよい）
  }

  return NextResponse.json({ success: true })
}
