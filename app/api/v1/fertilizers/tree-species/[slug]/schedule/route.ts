/**
 * @module app/api/v1/fertilizers/tree-species/[slug]/schedule
 * GET /api/v1/fertilizers/tree-species/{slug}/schedule — 樹種別施肥スケジュール
 *
 * ゲスト可（認証任意）。slug 不存在は 404 NOT_FOUND。
 * months は FertilizationPlan を月順で返す（month 1〜12）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { slugQuerySchema, getFertilizationScheduleBySlug } from '@/lib/services/fertilizer-read-service'

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

  // 4. スケジュール取得
  const species = await getFertilizationScheduleBySlug(parsedSlug.data)
  if (!species) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json({
    treeSpeciesName: species.name,
    nameEn: species.nameEn,
    category: species.category,
    description: species.description,
    examples: species.examples,
    fertilizingPolicy: species.fertilizingPolicy,
    slug: species.slug,
    months: species.plans,
  })
}
