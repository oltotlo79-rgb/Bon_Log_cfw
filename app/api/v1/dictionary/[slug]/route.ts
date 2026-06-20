/**
 * @module app/api/v1/dictionary/[slug]
 * GET /api/v1/dictionary/{slug} — 盆栽用語辞典詳細
 *
 * ゲスト可（認証任意）。slug 不存在は 404 NOT_FOUND。
 * prev/next/related を含む（Web 詳細ページ相当）。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { dictionarySlugSchema, getDictionaryTermBySlug } from '@/lib/services/dictionary-read-service'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { slug } = await params
  const parsedSlug = dictionarySlugSchema.safeParse(slug)
  if (!parsedSlug.success) return apiZodError(parsedSlug.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 詳細取得
  const result = await getDictionaryTermBySlug(parsedSlug.data)
  if (!result.term) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json(result)
}
