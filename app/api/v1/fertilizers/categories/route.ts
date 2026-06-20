/**
 * @module app/api/v1/fertilizers/categories
 * GET /api/v1/fertilizers/categories — 肥料カテゴリ一覧
 *
 * ゲスト可（認証任意）。全件返却（件数が少ないためカーソル不要）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { listFertilizerCategories } from '@/lib/services/fertilizer-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. レート制限（クエリパラメータなしのため Zod 検証不要）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 一覧取得
  const result = await listFertilizerCategories()

  return NextResponse.json(result.categories)
}
