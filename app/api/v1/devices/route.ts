/**
 * @module app/api/v1/devices
 * POST /api/v1/devices — Push 通知デバイストークンを登録（冪等な upsert）
 *
 * 処理順: 認証 → Zod → レート制限 → registerDevice
 * 成功: 200 + { success: true }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser } from '@/lib/api/v1/auth-guard'
import { apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { registerDeviceRequestSchema } from '@/lib/api/v1/schemas/request'
import { registerDevice } from '@/lib/services/device-service'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'

export async function POST(request: NextRequest) {
  // 1. 認証 (Bearer 必須・ゲスト不可)
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. Zod バリデーション
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  const parsed = registerDeviceRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiZodError(parsed.error)
  }

  // 3. レート制限 (Zod 通過後)
  const rl = await checkUserRateLimit(auth.userId, 'register_device')
  if (!rl.success) {
    return apiRateLimited(rl)
  }

  // 4. デバイス登録
  await registerDevice(auth.userId, parsed.data.token, parsed.data.platform)

  return NextResponse.json({ success: true }, { status: 200 })
}
