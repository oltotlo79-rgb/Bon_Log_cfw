/**
 * @module app/api/v1/pesticides/spreader-products
 * GET /api/v1/pesticides/spreader-products — 展着剤製品一覧
 *
 * spreaderTypes を 1 件以上持つ農薬製品をカーソルページネーションで返す。
 * ゲスト可（認証任意）。読み取り専用。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import {
  spreaderProductListQuerySchema,
  listSpreaderProducts,
} from '@/lib/services/pesticide-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const rawParams = {
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  }
  const parsed = spreaderProductListQuerySchema.safeParse(rawParams)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 一覧取得
  const result = await listSpreaderProducts(parsed.data)

  return NextResponse.json(result)
}
