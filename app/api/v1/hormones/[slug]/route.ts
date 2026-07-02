/**
 * @module app/api/v1/hormones/[slug]
 * GET /api/v1/hormones/{slug} — 植物ホルモン詳細
 *
 * ゲスト可（認証任意）。slug 不存在は 404 NOT_FOUND。
 * effects, seasonalLevels, interactions（A/B 両方向をマージ）、techniques を含む。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { slugQuerySchema, getHormoneBySlug } from '@/lib/services/hormone-read-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { slug } = await params
  const parsedSlug = slugQuerySchema.safeParse(slug)
  if (!parsedSlug.success) return apiZodError(parsedSlug.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 詳細取得
  const hormone = await getHormoneBySlug(parsedSlug.data)
  if (!hormone) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json(hormone)
}
