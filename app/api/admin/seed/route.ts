/**
 * 薬剤以外のシードドメイン (ジャンル / 辞典 / 肥料 / ホルモン / ゲストユーザー) を
 * 本番 DB に反映する管理用 API。
 *
 * 認証: `Authorization: Bearer <SEED_PESTICIDE_SECRET>` のみ受け付ける
 * (信頼境界を cron / migration secret と分離するため `lib/api/seed-auth.ts` で
 *  専用 secret 方針。詳細は同モジュールの JSDoc を参照)。
 * production では `SEED_ALLOWED_IPS` が必須 (fail-closed)。
 *
 * リクエストボディ:
 *   { "domain": "genres" | "dictionary" | "fertilizer" | "hormone" | "guest" | "all" }
 */

import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { prisma } from '@/lib/db'
import { BCRYPT_SALT_ROUNDS } from '@/lib/constants/limits'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { ERR_INVALID_INPUT } from '@/lib/constants/errors'
import { POST_GENRES, SHOP_GENRES } from '@/prisma/seed/genre/genre-data'
import { DICTIONARY_TERMS } from '@/prisma/seed/dictionary/seed-dictionary'
import { authorizeSeedRequest, seedErrorResponse } from '@/lib/api/seed-auth'

export const dynamic = 'force-dynamic'

/**
 * 肥料 / ホルモン / 辞典シードは大量レコードを含むため、
 * Hobby 10s / Pro 60s では完走できないことがある。Pro プラン上限の 300 秒を許可する。
 */
export const maxDuration = 300

const seedRequestSchema = z.object({
  domain: z.enum(['genres', 'dictionary', 'fertilizer', 'hormone', 'guest', 'all']),
})

type SeedDomain = z.infer<typeof seedRequestSchema>['domain']

async function runGenresSeed() {
  for (const genre of POST_GENRES) {
    const id = `${genre.category}-${genre.name}`.replace(/[・]/g, '-')
    await prisma.genre.upsert({
      where: { id },
      update: genre,
      create: { id, ...genre },
    })
  }
  for (const genre of SHOP_GENRES) {
    const id = `shop-${genre.category}-${genre.name}`.replace(/[・]/g, '-')
    await prisma.genre.upsert({
      where: { id },
      update: genre,
      create: { id, ...genre },
    })
  }
  return { postGenres: POST_GENRES.length, shopGenres: SHOP_GENRES.length }
}

async function runDictionarySeed() {
  // SAFETY: $executeRawUnsafe を使う理由 — TRUNCATE は Prisma API に対応メソッドが
  // ないため。テーブル名は固定文字列で外部入力なし。エンドポイントは Bearer 認証 +
  // 任意 IP 許可リストで保護されている。
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE bonsai_terms RESTART IDENTITY CASCADE;`)
  await prisma.bonsaiTerm.createMany({ data: DICTIONARY_TERMS })
  return { terms: DICTIONARY_TERMS.length }
}

async function runFertilizerSeed() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      fertilization_plans,
      tree_species,
      fertilizer_nutrients,
      fertilizer_categories,
      fertilizer_columns
    RESTART IDENTITY CASCADE;
  `)
  const { main } = await import('@/prisma/seed/fertilizer/seed-fertilizer-data')
  await main()
  return { ok: true }
}

async function runHormoneSeed() {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      hormone_techniques,
      hormone_columns,
      hormone_interactions,
      hormone_seasonal_levels,
      hormone_effects,
      hormone_types
    RESTART IDENTITY CASCADE;
  `)
  const { seedHormoneData } = await import('@/prisma/seed/hormone/seed-hormone-data')
  await seedHormoneData()
  return { ok: true }
}

/**
 * ゲストユーザー (トップの「のぞいてみる」用共有アカウント)。
 * `GUEST_PASSWORD` 環境変数が設定されている場合のみ実行する。
 */
async function runGuestUserSeed() {
  const guestPassword = process.env.GUEST_PASSWORD?.trim()
  if (!guestPassword) {
    return { ok: false, reason: 'GUEST_PASSWORD env not set' }
  }
  const guestHashed = await bcrypt.hash(guestPassword, BCRYPT_SALT_ROUNDS)
  await prisma.user.upsert({
    where: { email: GUEST_EMAIL },
    update: { password: guestHashed, emailVerified: new Date() },
    create: {
      email: GUEST_EMAIL,
      password: guestHashed,
      nickname: 'ゲスト',
      emailVerified: new Date(),
    },
  })
  return { ok: true }
}

export async function POST(request: NextRequest) {
  const denied = authorizeSeedRequest(request)
  if (denied) return denied

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: ERR_INVALID_INPUT }, { status: 400 })
  }
  const parsed = seedRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: ERR_INVALID_INPUT }, { status: 400 })
  }
  const { domain } = parsed.data

  const results: Record<string, unknown> = {}

  try {
    // 'all' は seed.ts のオーケストレーション順を踏襲 (薬剤は別エンドポイント `/api/admin/seed-pesticide`)。
    const shouldRun = (target: SeedDomain) => domain === 'all' || domain === target

    if (shouldRun('genres')) results.genres = await runGenresSeed()
    if (shouldRun('guest')) results.guest = await runGuestUserSeed()
    if (shouldRun('fertilizer')) results.fertilizer = await runFertilizerSeed()
    if (shouldRun('dictionary')) results.dictionary = await runDictionarySeed()
    if (shouldRun('hormone')) results.hormone = await runHormoneSeed()

    logger.info('[Admin] Seed completed', { domain, results })
    return NextResponse.json({ success: true, domain, results })
  } catch (error) {
    return seedErrorResponse('Seed', error, { domain, partial: results })
  }
}
