/**
 * @module app/api/v1/hormones/techniques
 * GET /api/v1/hormones/techniques — 全技法×ホルモン効果一覧（技法単位グループ化、H-4）
 *
 * ゲスト可（認証任意）。全件返却（ページネーションなし。件数は MAX_HORMONE_TECHNIQUE_LIMIT で上限）。
 * レスポンスは techniqueKey 単位にグループ化したネスト構造（技法とホルモン画面で使用）。
 *
 * Next.js は静的セグメント（techniques）を動的セグメント（[slug]）より優先するため
 * /api/v1/hormones/[slug] との衝突は発生しない。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { listHormoneTechniques } from '@/lib/services/hormone-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 技法グループ一覧取得
  const result = await listHormoneTechniques()

  return NextResponse.json(result)
}
