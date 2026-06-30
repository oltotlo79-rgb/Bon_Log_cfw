/**
 * @module app/api/v1/analytics/quotes
 * GET /api/v1/analytics/quotes — 自分の投稿への引用・リポスト分析データを取得する
 *
 * - Bearer 必須・ゲスト 403 GUEST_NOT_ALLOWED
 * - プレミアム限定: 非プレミアムは 403 PREMIUM_REQUIRED
 * - 自分のデータのみ（認証ユーザーの userId を使用）
 * - days パラメータなし（全期間集計）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api/v1/response'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { isPremiumUser } from '@/lib/premium'
import { fetchQuoteAnalytics } from '@/lib/services/analytics-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト拒否）
  const auth = await requireBearerUser(request, { rejectGuest: true })
  if (!auth.ok) return auth.response

  // 2. レート制限（クエリパラメータなし）
  const rl = await checkUserRateLimit(auth.userId, 'analytics_summary')
  if (!rl.success) return apiRateLimited(rl)

  // 3. プレミアム判定（DB から確認。JWT を信頼しない）
  const premium = await isPremiumUser(auth.userId)
  if (!premium) {
    return apiError(MOBILE_API_ERROR_CODES.PREMIUM_REQUIRED, 403)
  }

  // 4. 集計クエリ実行
  const data = await fetchQuoteAnalytics(auth.userId)

  // Prisma が返す Date オブジェクトを ISO 文字列にシリアライズ
  return NextResponse.json({
    totalQuotes: data.totalQuotes,
    totalReposts: data.totalReposts,
    quotes: data.quotes.map((q) => ({
      id: q.id,
      content: q.content,
      user: q.user,
      originalPostId: q.originalPostId,
      originalContent: q.originalContent,
      likeCount: q.likeCount,
      commentCount: q.commentCount,
      createdAt: q.createdAt.toISOString(),
    })),
  })
}
