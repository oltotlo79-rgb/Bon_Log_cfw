/**
 * @module app/api/v1/pesticides/columns/[slug]
 * GET /api/v1/pesticides/columns/{slug} — 農薬コラム詳細
 *
 * ゲスト可（認証任意）。不存在時または未公開時は 404。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiZodError, apiRateLimited, apiError } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { z } from 'zod'
import { getPesticideColumnBySlug } from '@/lib/services/pesticide-read-service'
import { MOBILE_API_ERROR_CODES } from '@/lib/constants/errors/mobile-api'
import { MAX_SLUG_LENGTH } from '@/lib/constants/limits'

const slugParamSchema = z.string().min(1).max(MAX_SLUG_LENGTH)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. パスパラメータ検証
  const { slug } = await params
  const parsed = slugParamSchema.safeParse(slug)
  if (!parsed.success) return apiZodError(parsed.error)

  // 3. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 4. 詳細取得（未公開は null を返すため 404 扱い）
  const item = await getPesticideColumnBySlug(parsed.data)
  if (!item) return apiError(MOBILE_API_ERROR_CODES.NOT_FOUND, 404)

  return NextResponse.json(item)
}
