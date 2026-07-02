/**
 * @module app/api/v1/fertilizers/columns
 * GET /api/v1/fertilizers/columns — 施肥コラム一覧（F-1）
 *
 * publishedAt が設定済みのコラムをカーソルページネーションで返す。
 * ?category= フィルタ対応（想定値: product_guide / trouble 等。省略で全件）。
 * ゲスト可（認証任意）。読み取り専用。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import {
  fertilizerColumnListQuerySchema,
  listFertilizerColumns,
} from '@/lib/services/fertilizer-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const rawParams = {
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    category: searchParams.get('category') ?? undefined,
  }
  const parsed = fertilizerColumnListQuerySchema.safeParse(rawParams)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 一覧取得
  const result = await listFertilizerColumns(parsed.data)

  return NextResponse.json(result)
}
