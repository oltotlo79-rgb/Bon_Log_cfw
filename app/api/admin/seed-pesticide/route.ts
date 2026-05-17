/**
 * 薬剤・病害虫データを本番 DB に反映する管理用 API。
 *
 * 認証: `Authorization: Bearer <SEED_PESTICIDE_SECRET>` のみ。
 * cron / migration secret は受け付けない (信頼境界分離。詳細は `lib/api/seed-auth.ts`)。
 * production では `SEED_ALLOWED_IPS` が必須 (fail-closed)。
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'
import { authorizeSeedRequest, seedErrorResponse } from '@/lib/api/seed-auth'

export const dynamic = 'force-dynamic'

/**
 * 薬剤シードは 7,000 行超 / 428+ の Prisma upsert を含むため、
 * Hobby 10s / Pro 60s では完走できない。Pro プラン上限の 300 秒を許可する。
 */
export const maxDuration = 300

export async function POST(request: NextRequest) {
  const denied = authorizeSeedRequest(request)
  if (denied) return denied

  try {
    // SAFETY: $executeRawUnsafe を使用する理由 — TRUNCATE ... CASCADE は Prisma API に対応する
    // メソッドがなく、生 SQL が必要。入力は固定文字列のみで外部パラメータを含まないため
    // SQL インジェクションのリスクはない。アクセスは Bearer 認証 + IP 許可リストで保護済み。
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE
        pesticide_effects,
        pesticide_active_ingredients,
        pesticides,
        active_ingredients,
        formulation_types,
        disease_pests,
        spreader_types,
        pesticide_columns
      RESTART IDENTITY CASCADE;
    `)

    const { main } = await import('@/prisma/seed/pesticide/seed-pesticide-data')
    await main()
    logger.info('[Admin] Pesticide seed completed successfully')
    return NextResponse.json({ success: true, message: 'Pesticide seed completed' })
  } catch (error) {
    return seedErrorResponse('Pesticide seed', error)
  }
}
