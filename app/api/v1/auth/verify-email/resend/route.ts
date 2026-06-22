/**
 * @module app/api/v1/auth/verify-email/resend
 * POST /api/v1/auth/verify-email/resend — 確認メール再送
 *
 * 列挙攻撃対策: メールアドレスの存在有無・確認済み・バリデーション失敗に関わらず常に 200 を返す。
 * password-reset/request と同一の思想で実装する。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { apiRateLimited } from '@/lib/api/v1'
import { verifyEmailResendRequestSchema } from '@/lib/api/v1/schemas'
import { checkRateLimit } from '@/lib/rate-limit'
import { resendVerificationEmailCore } from '@/lib/services/email-verify-core'

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    // 列挙攻撃対策: JSON パース失敗も 200
    return NextResponse.json({ success: true }, { status: 200 })
  }

  const parsed = verifyEmailResendRequestSchema.safeParse(body)
  if (!parsed.success) {
    // 列挙攻撃対策: 不正入力でも 200
    return NextResponse.json({ success: true }, { status: 200 })
  }
  const { email } = parsed.data

  // 2. レート制限（IP ベース）— Zod 通過後
  // Redis 障害時はフェイルクローズ（verify_email_resend プリセット）
  const rl = await checkRateLimit(request, 'verify_email_resend', email)
  if (!rl.success) {
    return apiRateLimited(rl)
  }

  // 3. コアロジック呼び出し（ユーザー不在・確認済みでも ok:true を返す設計）
  await resendVerificationEmailCore(email)

  return NextResponse.json({ success: true }, { status: 200 })
}
