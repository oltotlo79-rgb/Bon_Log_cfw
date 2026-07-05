/**
 * @module app/api/v1/geocode
 * GET /api/v1/geocode?address= — 住所ジオコーディング（ゲスト可・読み取り専用）
 *
 * 国土地理院 (GSI) 住所検索 API を用いて単一の最良候補を返す
 * (Web の Server Action と同じ lib/services/geocode-service を使用)。
 * 住所が解決できない場合は 404 NOT_FOUND。レート制限: geocode（15/分）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { geocodeQuerySchema } from '@/lib/api/v1/schemas/request'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { geocodeAddress } from '@/lib/services/geocode-service'
import type { GeocodeResponse } from '@/lib/api/v1/schemas/response'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = geocodeQuerySchema.safeParse({
    address: searchParams.get('address') ?? '',
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'geocode')
  if (!rl.success) return apiRateLimited(rl)

  // 4. ジオコーディング
  const result = await geocodeAddress(parsed.data.address)
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  const body: GeocodeResponse = {
    latitude: result.latitude,
    longitude: result.longitude,
    formattedAddress: result.displayName,
  }

  return NextResponse.json(body)
}
