/**
 * @module app/api/v1/legal/[slug]
 * GET /api/v1/legal/{slug} — 法的文章詳細取得（ゲスト可）
 *
 * 許可済み slug: tokushoho / terms / privacy
 * 未知 slug → 404 NOT_FOUND
 */

import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireBearerUser, apiError, apiZodError, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { LEGAL_SLUGS } from '@/lib/constants/legal'
import { getLegalDocument } from '@/lib/services/legal-service'

const slugParamSchema = z.object({
  slug: z.enum(LEGAL_SLUGS),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Bearer 認証（ゲスト可: 法的文章は公開）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. slug バリデーション（許可リスト enum）
  const { slug } = await params
  const parsed = slugParamSchema.safeParse({ slug })
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限（read プリセット: 60/分）
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 法的文章取得
  const result = getLegalDocument(parsed.data.slug)
  if (!result.ok) {
    return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)
  }

  return NextResponse.json(result.document)
}
