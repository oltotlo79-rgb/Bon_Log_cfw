/* eslint-disable no-console */
/**
 * @module prisma/scripts/backfill-premium-entitlements-2026-07
 *
 * PremiumEntitlement 導入（provider 別 entitlement + OR 集約, 2026-07）に伴う既存データ backfill。
 *
 * 対象:
 * - `stripeSubscriptionId` が設定済みの User → provider='stripe' の entitlement を作成する
 *   （status は現在の `isPremium` を反映: true→'active' / false→'inactive'。
 *   expiresAt は現在の `premiumExpiresAt` をそのままコピーする）。
 * - 上記に該当せず `isPremium=true` の User → provider='legacy' の entitlement を作成する
 *   （Stripe 識別子を持たない出自不明な有効ユーザーを、一律 false にせず「現状維持」の
 *   形で明示的に記録する。RevenueCat 由来の可能性があるが、本バックフィル実行時点では
 *   RevenueCat 側の webhook がまだ entitlement を同期していない前提のため、判別できない
 *   出自は 'legacy' として扱う）。
 * - 既に対応する provider の entitlement が存在する User はスキップする（冪等・fail-closed）。
 *
 * 実行方法（PowerShell）:
 *
 *   npx tsx prisma/scripts/backfill-premium-entitlements-2026-07.ts          # dry-run（既定）
 *   npx tsx prisma/scripts/backfill-premium-entitlements-2026-07.ts --apply  # 適用
 *
 *   実行直後に表示される「接続先 (masked)」の行で、意図した接続先か必ず目視確認すること。
 *
 * 推奨デプロイ順序: migration 20260728100000_add_premium_entitlements 適用
 *   → 本スクリプト --apply → webhook/cron の新コードデプロイ
 *   （詳細は当該 migration.sql 冒頭のロールング デプロイ互換性コメントを参照）。
 */

import {
  createProdApplyClient,
  isApplyMode,
  printConnectionFailureHint,
} from './lib/prod-apply-client'
import type { PrismaClient } from '@prisma/client'

const BATCH_SIZE = 500
// dry-run 出力のノイズを抑えるためのサンプル表示上限（全件は必ず処理対象になる。表示のみ制限）。
const PRINT_SAMPLE_LIMIT = 20

interface CandidateUser {
  id: string
  isPremium: boolean
  premiumExpiresAt: Date | null
  stripeSubscriptionId: string | null
}

interface EntitlementPlan {
  userId: string
  provider: 'stripe' | 'legacy'
  status: 'active' | 'inactive'
  providerRef: string | null
  expiresAt: Date | null
  reason: string
  alreadyExists: boolean
}

// ============================================================
// 1. 対象ユーザーの抽出（読み取りのみ、カーソルページネーション）
// ============================================================

async function fetchCandidateUsers(prisma: PrismaClient): Promise<CandidateUser[]> {
  const users: CandidateUser[] = []
  let cursor: string | undefined

  for (;;) {
    const page = await prisma.user.findMany({
      where: {
        OR: [{ stripeSubscriptionId: { not: null } }, { isPremium: true }],
      },
      select: {
        id: true,
        isPremium: true,
        premiumExpiresAt: true,
        stripeSubscriptionId: true,
      },
      take: BATCH_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: 'asc' },
    })
    users.push(...page)
    if (page.length < BATCH_SIZE) break
    cursor = page[page.length - 1]?.id
  }

  return users
}

function planForUser(user: CandidateUser): Omit<EntitlementPlan, 'alreadyExists'> | null {
  if (user.stripeSubscriptionId) {
    return {
      userId: user.id,
      provider: 'stripe',
      status: user.isPremium ? 'active' : 'inactive',
      providerRef: user.stripeSubscriptionId,
      expiresAt: user.premiumExpiresAt,
      reason: 'stripeSubscriptionId が設定済み',
    }
  }
  if (user.isPremium) {
    return {
      userId: user.id,
      provider: 'legacy',
      status: 'active',
      providerRef: null,
      expiresAt: user.premiumExpiresAt,
      reason: 'isPremium=true だが Stripe 識別子なし（出自不明 → legacy）',
    }
  }
  return null
}

// ============================================================
// 2. dry-run 用プランの収集（読み取りのみ）
// ============================================================

async function planBackfill(prisma: PrismaClient): Promise<EntitlementPlan[]> {
  const users = await fetchCandidateUsers(prisma)
  const basePlans = users
    .map(planForUser)
    .filter((p): p is Omit<EntitlementPlan, 'alreadyExists'> => p !== null)

  if (basePlans.length === 0) return []

  const existing = await prisma.premiumEntitlement.findMany({
    where: { userId: { in: basePlans.map((p) => p.userId) } },
    select: { userId: true, provider: true },
  })
  const existingKeys = new Set(existing.map((e) => `${e.userId}:${e.provider}`))

  return basePlans.map((p) => ({
    ...p,
    alreadyExists: existingKeys.has(`${p.userId}:${p.provider}`),
  }))
}

function printPlan(plans: EntitlementPlan[]): void {
  const toCreate = plans.filter((p) => !p.alreadyExists)
  const skipped = plans.filter((p) => p.alreadyExists)
  const stripeCount = toCreate.filter((p) => p.provider === 'stripe').length
  const legacyCount = toCreate.filter((p) => p.provider === 'legacy').length

  console.log('\n[plan] PremiumEntitlement backfill')
  console.log(`  対象 User 総数: ${plans.length}`)
  console.log(`  新規作成予定: ${toCreate.length}（stripe: ${stripeCount} / legacy: ${legacyCount}）`)
  console.log(`  スキップ（既存 entitlement あり）: ${skipped.length}`)

  if (toCreate.length === 0) {
    console.log('  作成対象なし（既に backfill 済み、または対象 User が存在しない）。')
    return
  }

  console.log(`\n  サンプル（先頭 ${Math.min(PRINT_SAMPLE_LIMIT, toCreate.length)} 件）:`)
  for (const plan of toCreate.slice(0, PRINT_SAMPLE_LIMIT)) {
    console.log(
      `    userId=${plan.userId} provider=${plan.provider} status=${plan.status} ` +
        `providerRef=${plan.providerRef ?? 'null'} expiresAt=${plan.expiresAt?.toISOString() ?? 'null'} ` +
        `[${plan.reason}]`,
    )
  }
}

// ============================================================
// 3. 適用本体 — 単一トランザクションで原子的に create のみ行う
//    （既存 entitlement は fail-closed でスキップし、上書きしない）
// ============================================================

async function applyBackfill(prisma: PrismaClient, plans: EntitlementPlan[]): Promise<number> {
  const toCreate = plans.filter((p) => !p.alreadyExists)
  if (toCreate.length === 0) return 0

  await prisma.$transaction(async (tx) => {
    for (const plan of toCreate) {
      await tx.premiumEntitlement.create({
        data: {
          userId: plan.userId,
          provider: plan.provider,
          providerRef: plan.providerRef,
          status: plan.status,
          cancelAtPeriodEnd: false,
          expiresAt: plan.expiresAt,
          // backfill 由来のため provider event の発生時刻・event ID は存在しない。
          // 次回 webhook が到着すれば providerEventAt が設定され、以後の out-of-order
          // 判定基準として機能するようになる。
          providerEventAt: null,
          lastEventId: null,
        },
      })
    }
  })

  return toCreate.length
}

// ============================================================
// 4. 適用後の再クエリ検証
// ============================================================

async function verifyAfterApply(prisma: PrismaClient, plans: EntitlementPlan[]): Promise<void> {
  const toCreate = plans.filter((p) => !p.alreadyExists)
  if (toCreate.length === 0) return

  const created = await prisma.premiumEntitlement.count({
    where: {
      userId: { in: toCreate.map((p) => p.userId) },
      provider: { in: Array.from(new Set(toCreate.map((p) => p.provider))) },
    },
  })

  console.log('\n=== 適用後の検証 ===')
  console.log(`  作成予定件数: ${toCreate.length} / 実際に存在する対象 entitlement 件数: ${created}`)
  if (created < toCreate.length) {
    console.log('  警告: 件数が一致しません。個別に premiumEntitlement テーブルを確認してください。')
  }
}

// ============================================================
// 実行本体（通常はここを変更しなくてよい）
// ============================================================

async function main(): Promise<void> {
  const prisma = createProdApplyClient()
  const apply = isApplyMode()

  console.log(`モード: ${apply ? '--apply（書き込みあり）' : 'dry-run（読み取りのみ）'}`)

  try {
    const plans = await planBackfill(prisma).catch((e: unknown) => {
      console.error('\nDB への接続または初回クエリに失敗しました。')
      printConnectionFailureHint()
      throw e
    })
    printPlan(plans)

    if (!apply) {
      console.log('\ndry-run のため書き込みは行っていません。--apply を付けて実行すると反映されます。')
      return
    }

    console.log('\n--apply が指定されたため、上記の新規作成分をトランザクション内で適用します...')
    const createdCount = await applyBackfill(prisma, plans)
    console.log(`適用完了（${createdCount} 件作成）。`)

    await verifyAfterApply(prisma, plans)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
