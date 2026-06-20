/**
 * @module app/api/v1/dictionary
 * GET /api/v1/dictionary — 盆栽用語辞典一覧
 *
 * ゲスト可（認証任意）。cursor/limit によるページネーション + search/category/row フィルタ。
 * row フィルタは in-memory（Web の TermList.tsx と同等）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { dictionaryListQuerySchema, listDictionaryTerms } from '@/lib/services/dictionary-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. クエリパラメータ検証
  const { searchParams } = request.nextUrl
  const parsed = dictionaryListQuerySchema.safeParse({
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined,
    search: searchParams.get('search') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    row: searchParams.get('row') ?? undefined,
  })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 一覧取得
  const result = await listDictionaryTerms(parsed.data)

  return NextResponse.json(result)
}
