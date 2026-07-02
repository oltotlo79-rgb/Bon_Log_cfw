/**
 * @module app/api/v1/pesticides/mixing-data
 * GET /api/v1/pesticides/mixing-data — 混用チェッカー全データ
 *
 * 農薬全件と混用不可ペア全件を 1 リクエストで返す。
 * クライアント側でペア判定を行う混用チェッカー画面向け。
 * ゲスト可（認証任意）。読み取り専用。ページネーションなし。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { getMixingData } from '@/lib/services/pesticide-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 全データ取得（pesticides + incompatibilities を並列）
  const result = await getMixingData()

  return NextResponse.json(result)
}
