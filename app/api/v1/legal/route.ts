/**
 * @module app/api/v1/legal
 * GET /api/v1/legal — 利用可能な法的文章の slug/title 一覧（ゲスト可）
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { listLegalDocuments } from '@/lib/services/legal-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: 法的文章一覧は公開）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. レート制限（read プリセット: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 法的文章一覧取得（定数から生成、エラーなし）
  const items = listLegalDocuments()

  return NextResponse.json({ items })
}

export async function POST() {
  return apiError(MOBILE_API_ERROR_CODES.VALIDATION_ERROR, 405, 'Method Not Allowed')
}
