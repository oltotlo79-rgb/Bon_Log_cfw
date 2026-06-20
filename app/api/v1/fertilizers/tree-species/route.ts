/**
 * @module app/api/v1/fertilizers/tree-species
 * GET /api/v1/fertilizers/tree-species — 樹種一覧
 *
 * ゲスト可（認証任意）。category クエリで TreeCategory フィルタ。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { treeCategoryQuerySchema, listTreeSpecies } from '@/lib/services/fertilizer-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = treeCategoryQuerySchema.safeParse({
    category: searchParams.get('category') ?? undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 一覧取得
  const { category } = parsed.data
  const result = await listTreeSpecies(category !== undefined ? { category } : undefined)

  return NextResponse.json(result.treeSpecies)
}
