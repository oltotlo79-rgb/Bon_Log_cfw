/**
 * @module app/api/v1/hormones/columns
 * GET /api/v1/hormones/columns — ホルモンコラム一覧（H-6）
 *
 * publishedAt が設定済みのコラムをカーソルページネーションで返す。
 * ゲスト可（認証任意）。読み取り専用。
 *
 * Next.js は静的セグメント（columns）を動的セグメント（[slug]）より優先するため
 * /api/v1/hormones/[slug] との衝突は発生しない。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import {
  hormoneColumnListQuerySchema,
  listHormoneColumns,
} from '@/lib/services/hormone-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const rawParams = {
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
  }
  const parsed = hormoneColumnListQuerySchema.safeParse(rawParams)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 一覧取得
  const result = await listHormoneColumns(parsed.data)

  return NextResponse.json(result)
}
