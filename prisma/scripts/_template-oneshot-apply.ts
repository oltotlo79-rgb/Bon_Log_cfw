/* eslint-disable no-console */
/**
 * @module prisma/scripts/_template-oneshot-apply
 *
 * 本番マスタデータのピンポイント修正スクリプトの雛形。コピーして
 * `prisma/scripts/apply-<topic>-<yyyy-mm>.ts` として使う。
 * 詳細な運用手順・チェックリストは `prisma/scripts/README.md` を参照。
 *
 * このファイル自体は対象が空のため、そのまま実行しても何も変更しない（安全）。
 *
 * 実行方法（PowerShell）:
 *
 *   npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts          # dry-run（既定・必ず先に実行）
 *   npx tsx prisma/scripts/apply-<topic>-<yyyy-mm>.ts --apply  # 適用
 *
 *   実行直後に表示される「接続先 (masked)」の行で、意図した接続先か必ず目視確認すること。
 */

import {
  createProdApplyClient,
  isApplyMode,
  printConnectionFailureHint,
} from './lib/prod-apply-client'
import type { PrismaClient } from '@prisma/client'

// ============================================================
// 1. 対象の「正しい値」定数
//    TODO: 修正対象のレコードと正しい値をここに記入する。
//    必ず出典（MAFF 登録番号 / 公式サイト URL 等）をコメントで残すこと。
// ============================================================

interface ExampleFix {
  slug: string
  // TODO: 修正したいフィールドをここに追加する
  desiredValue: string
}

// TODO: 対象を記入する（空のままなら dry-run/--apply とも何もしない）
const EXAMPLE_FIXES: ExampleFix[] = []

// ============================================================
// 2. dry-run 用プラン（現在値 → 変更後）を収集して表示する
//    この関数は読み取りのみ。書き込みは行わない。
// ============================================================

interface ExampleFixPlan {
  slug: string
  current: string | null
  desired: string
  needsUpdate: boolean
}

// TODO: 対象モデルの findUnique に置き換える。戻り値の型を明示することで、
// 下の呼び出し側で `if (!existing) throw` 後の narrowing が正しく効く。
async function findExampleRecord(
  _prisma: PrismaClient,
  _slug: string,
): Promise<{ someField: string } | null> {
  // const existing = await prisma.someModel.findUnique({ where: { slug } })
  // return existing
  return null
}

async function planExampleFixes(prisma: PrismaClient): Promise<ExampleFixPlan[]> {
  const plans: ExampleFixPlan[] = []

  for (const fix of EXAMPLE_FIXES) {
    const existing = await findExampleRecord(prisma, fix.slug)

    if (!existing) {
      // fail-closed: 対象が存在しない場合は create せず停止する
      throw new Error(
        `[fatal] slug="${fix.slug}" が見つかりません。想定外のレコード作成を避けるため停止します。`,
      )
    }

    plans.push({
      slug: fix.slug,
      current: existing.someField,
      desired: fix.desiredValue,
      needsUpdate: existing.someField !== fix.desiredValue,
    })
  }

  return plans
}

function printPlan(plans: ExampleFixPlan[]): void {
  console.log('\n[plan] 修正内容')
  if (plans.length === 0) {
    console.log('  対象が設定されていません（EXAMPLE_FIXES が空）。TODO を記入してください。')
    return
  }
  for (const plan of plans) {
    console.log(`\n  slug="${plan.slug}"`)
    if (!plan.needsUpdate) {
      console.log('    変更なし（既に正しい値）')
      continue
    }
    console.log(`    [現在] ${plan.current}`)
    console.log(`    [変更後] ${plan.desired}`)
  }
}

// ============================================================
// 3. 適用本体 — 単一トランザクションで原子的に実行する
//    対象は具体的なキー（slug / id）で限定する。全件 deleteMany は絶対に使わない。
// ============================================================

async function applyFixes(prisma: PrismaClient, plans: ExampleFixPlan[]): Promise<void> {
  await prisma.$transaction(async (_tx) => {
    for (const plan of plans) {
      if (!plan.needsUpdate) continue
      // TODO: 対象モデルの update に置き換える（具体的なキーで限定すること）
      // await tx.someModel.update({ where: { slug: plan.slug }, data: { someField: plan.desired } })
      console.log(`  (TODO) update slug="${plan.slug}"`)
    }
  })
}

// ============================================================
// 4. 適用後の再クエリ検証
// ============================================================

async function verifyAfterApply(prisma: PrismaClient, plans: ExampleFixPlan[]): Promise<void> {
  console.log('\n=== 適用後の検証 ===')
  for (const plan of plans) {
    // TODO: 対象モデルの findUnique で再取得し、期待値と一致するか確認する
    console.log(`  ${plan.slug}: (TODO) 再クエリして desired と一致するか確認`)
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
    const plans = await planExampleFixes(prisma).catch((e: unknown) => {
      console.error('\nDB への接続または初回クエリに失敗しました。')
      printConnectionFailureHint()
      throw e
    })
    printPlan(plans)

    if (!apply) {
      console.log('\ndry-run のため書き込みは行っていません。--apply を付けて実行すると反映されます。')
      return
    }

    console.log('\n--apply が指定されたため、上記の変更をトランザクション内で適用します...')
    await applyFixes(prisma, plans)
    console.log('適用完了。')

    await verifyAfterApply(prisma, plans)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
