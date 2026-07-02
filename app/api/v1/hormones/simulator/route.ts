/**
 * @module app/api/v1/hormones/simulator
 * GET /api/v1/hormones/simulator — シミュレーター用データ一括取得（H-5）
 *
 * 全ホルモン・全技法効果・全月別活性を 1 リクエストで返す。
 * クライアント側でシミュレーション計算を行うため全件が必要。
 *
 * ゲスト可（認証任意）。全件返却（ページネーションなし）。
 * Next.js は静的セグメント（simulator）を動的セグメント（[slug]）より優先するため
 * /api/v1/hormones/[slug] との衝突は発生しない。
 */

import { type NextRequest, NextResponse } from 'next/server'
import { requireBearerUser, apiRateLimited } from '@/lib/api/v1'
import { checkUserRateLimit } from '@/lib/rate-limit'
import { getHormoneSimulatorData } from '@/lib/services/hormone-read-service'

export async function GET(request: NextRequest) {
  // 1. Bearer 認証（ゲスト可: rejectGuest なし）
  const auth = await requireBearerUser(request)
  if (!auth.ok) return auth.response

  // 2. レート制限
  const rl = await checkUserRateLimit(auth.userId, 'read')
  if (!rl.success) return apiRateLimited(rl)

  // 3. シミュレーターデータ一括取得
  const result = await getHormoneSimulatorData()

  return NextResponse.json(result)
}
