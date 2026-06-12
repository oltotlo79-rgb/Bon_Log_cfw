/**
 * @module app/api/v1/auth/password-reset/request
 * POST /api/v1/auth/password-reset/request — パスワードリセットメール送信
 *
 * 列挙攻撃対策: メールアドレスの存在有無に関わらず常に 200 を返す。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { apiRateLimited } from '@/lib/api/v1'
import { passwordResetRequestSchema } from '@/lib/api/v1/schemas'
import { checkRateLimit } from '@/lib/rate-limit'
import { requestPasswordResetCore } from '@/lib/services/password-reset-service'
import { getClientIpFromRequest } from '@/lib/utils/client-ip'

export async function POST(request: NextRequest) {
  // 1. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    // 列挙攻撃対策と同様: バリデーション失敗も 200 で返す
    return NextResponse.json({ success: true }, { status: 200 })
  }

  const parsed = passwordResetRequestSchema.safeParse(body)
  if (!parsed.success) {
    // 列挙攻撃対策: 不正入力でも 200
    return NextResponse.json({ success: true }, { status: 200 })
  }
  const { email } = parsed.data

  // 2. レート制限（IP ベース）— Zod 通過後
  const rl = await checkRateLimit(request, 'passwordReset', email)
  if (!rl.success) {
    return apiRateLimited(rl)
  }

  // 3. サービス呼び出し（ユーザー不在でも ok:true を返す設計）
  const clientIp = getClientIpFromRequest(request)
  await requestPasswordResetCore(email, clientIp)

  return NextResponse.json({ success: true }, { status: 200 })
}
