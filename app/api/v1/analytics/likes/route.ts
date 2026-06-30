/**
 * @module app/api/v1/analytics/likes
 * GET /api/v1/analytics/likes — 期間内のいいね分析データを取得する
 *
 * - Bearer 必須・ゲスト 403 GUEST_NOT_ALLOWED
 * - プレミアム限定: 非プレミアムは 403 PREMIUM_REQUIRED
 * - 自分のデータのみ（認証ユーザーの userId を使用）
 * - days=7|30|90（省略時 30）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api/v1/response'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { isPremiumUser } from '@/lib/premium'
import { fetchLikeAnalytics } from '@/lib/services/analytics-service'
import { analyticsSummaryQuerySchema } from '@/lib/api/v1/schemas/request'
import { isAnalyticsPeriod } from '@/lib/constants/limits'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト拒否）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = analyticsSummaryQuerySchema.safeParse({
    days: searchParams.has('days') ? searchParams.get('days') : undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（Zod 通過後）
  const rl = await checkUserRateLimit(auth.userId, 'analytics_summary')
  if (!rl.success) return apiRateLimited(rl)

  // 4. プレミアム判定（DB から確認。JWT を信頼しない）
  const premium = await isPremiumUser(auth.userId)
  if (!premium) {
    return apiError(MOBILE_API_ERROR_CODES.PREMIUM_REQUIRED, 403)
  }

  // 5. days を数値に変換し AnalyticsPeriod に絞り込む
  const daysNum = Number(parsed.data.days)
  if (!isAnalyticsPeriod(daysNum)) {
    return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 400)
  }

  // 6. 集計クエリ実行（戻り値はすべてプリミティブ / 文字列のため変換不要）
  const data = await fetchLikeAnalytics(auth.userId, daysNum)

  return NextResponse.json(data)
}
