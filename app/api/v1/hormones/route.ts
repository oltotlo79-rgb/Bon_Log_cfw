/**
 * @module app/api/v1/hormones
 * GET /api/v1/hormones — 植物ホルモン一覧
 *
 * ゲスト可（認証任意）。category クエリで HormoneCategory フィルタ。
 * 全件返却（件数が少ないためカーソル不要）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { hormoneCategoryQuerySchema, listHormones } from '@/lib/services/hormone-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = hormoneCategoryQuerySchema.safeParse({
    category: searchParams.get('category') ?? undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 一覧取得
  const { category } = parsed.data
  const result = await listHormones(category !== undefined ? { category } : undefined)

  return NextResponse.json(result.hormones)
}
