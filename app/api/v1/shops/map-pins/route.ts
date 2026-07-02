/**
 * @module app/api/v1/shops/map-pins
 * GET /api/v1/shops/map-pins — 地図用の全店舗ピン取得（M-1）
 *
 * ゲスト可（認証任意）。位置情報付き店舗を全件返却（ページネーションなし。MAX_MAP_PINS_LIMIT で上限）。
 * lat/lng が null の店舗は除外する。レスポンスは地図マーカー用の軽量形式。
 *
 * Next.js は静的セグメント（map-pins）を動的セグメント（[id]）より優先するため
 * /api/v1/shops/[id] との衝突は発生しない。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { getShopMapPinsV1 } from '@/lib/services/shop-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 3. マップピン全件取得
  const result = await getShopMapPinsV1()
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.INTERNAL_ERROR, 500, result.error)
  }

  return NextResponse.json({ items: result.items })
}
