/**
 * @module app/api/v1/hormones/interactions
 * GET /api/v1/hormones/interactions — 全ホルモン相互作用一覧（H-3）
 *
 * ゲスト可（認証任意）。全件返却（ページネーションなし。件数は MAX_HORMONE_INTERACTION_LIMIT で上限）。
 * 相互作用一覧画面・ダイアグラム画面で共用する。
 *
 * Next.js は静的セグメント（interactions）を動的セグメント（[slug]）より優先するため
 * /api/v1/hormones/[slug] との衝突は発生しない。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { listHormoneInteractions } from '@/lib/services/hormone-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 3. 全相互作用取得
  const result = await listHormoneInteractions()

  return NextResponse.json(result)
}
