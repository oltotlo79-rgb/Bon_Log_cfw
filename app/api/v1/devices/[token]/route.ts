/**
 * @module app/api/v1/devices/[token]
 * DELETE /api/v1/devices/{token} — Push 通知デバイストークンを解除（冪等）
 *
 * Expo トークンは "ExponentPushToken[...]" 等で [ ] を含むため URL エンコードされて届く。
 * Next.js の await params でデコード済みの値を受け取り検証する。
 *
 * 自分のトークンのみ削除可。他人のトークン・存在しないトークンも 200 を返す（冪等・fail-safe）。
 * 処理順: 認証 → Zod（token 長のみ）→ レート制限 → removeDevice
 * 成功: 200 + { success: true }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser } from '@/lib/api/v1/auth-guard'
import { apiError, apiRateLimited } from '@/lib/api/v1'
import { removeDevice } from '@/lib/services/device-service'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { MAX_DEVICE_TOKEN_LENGTH } from '@/lib/constants/limits'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  // 1. 認証 (Bearer 必須・ゲスト不可)
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. path param の取り出し + 基本バリデーション
  const { token } = await params
  if (!token || token.length === 0 || token.length > MAX_DEVICE_TOKEN_LENGTH) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  // 3. レート制限 (バリデーション通過後)
  const rl = await checkUserRateLimit(auth.userId, 'remove_device')
  if (!rl.success) {
    return apiRateLimited(rl)
  }

  // 4. デバイス解除（自分のトークンのみ削除。不存在・他人のトークンも成功扱い）
  await removeDevice(auth.userId, token)

  return NextResponse.json({ success: true }, { status: 200 })
}
