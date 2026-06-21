/**
 * @module app/api/v1/pesticides/products
 * GET /api/v1/pesticides/products — 農薬製品一覧
 *
 * ゲスト可（認証任意）。読み取り専用。
 * type クエリは PesticideType enum + herbicide→other 正規化（Web 互換）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import {
  pesticideListQuerySchema,
  listPesticides,
  parsePesticideTypeParam,
} from '@/lib/services/pesticide-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const typeParam = searchParams.get('type')
  const normalizedType = parsePesticideTypeParam(typeParam)

  const rawParams = {
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
    search: searchParams.get('search') ?? undefined,
    type: normalizedType,
    diseasePestId: searchParams.get('diseasePestId') ?? undefined,
    formulationTypeCode: searchParams.get('formulationTypeCode') ?? undefined,
  }
  const parsed = pesticideListQuerySchema.safeParse(rawParams)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 一覧取得
  const result = await listPesticides(parsed.data)

  return NextResponse.json(result)
}
