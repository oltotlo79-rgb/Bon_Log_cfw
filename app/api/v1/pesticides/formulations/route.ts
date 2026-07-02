/**
 * @module app/api/v1/pesticides/formulations
 * GET /api/v1/pesticides/formulations — 剤型マスタ一覧
 *
 * ゲスト可（認証任意）。読み取り専用。全件返却（件数少数のためページネーションなし）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { listFormulationTypes } from '@/lib/services/pesticide-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 一覧取得
  const result = await listFormulationTypes()

  return NextResponse.json(result)
}
