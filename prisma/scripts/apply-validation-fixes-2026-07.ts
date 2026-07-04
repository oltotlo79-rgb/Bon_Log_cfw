/* eslint-disable no-console */
/**
 * @module prisma/scripts/apply-validation-fixes-2026-07
 *
 * 農薬・肥料・ホルモン マスタの検証で確定した誤りレコードのみを本番 DB に適用するワンショット
 * スクリプト。`prisma/seed/*` は全件 deleteMany → 再構築する破壊的方式のため本番では使えない。
 * 本スクリプトは対象レコードだけを update / upsert し、全件削除は一切行わない。
 *
 * 修正内容（詳細は各定数のコメントを参照）:
 * 1. green-king（FertilizerColumn.slug）: NPK表記の誤り（6-10-5 → 6-5-2）と連鎖する説明文を修正
 * 2. magamp-k（FertilizerColumn.slug）: 肥効持続の誤り（大粒約1年/中粒約半年 → 大粒約2年/中粒約1年）を修正
 * 3. tachigaren（Pesticide.slug, MAFF登録番号10331）の PesticideEffect:
 *    negusare-byo は保持、誤リンク7件を削除、正リンク3件を追加
 * 4. hormone の PubChem CID は対象外（スキップ）。
 *    HormoneType にはスキーマ上専用の CID フィールドが存在せず、CID は description の
 *    自由記述内に埋め込まれているのみ（構造化フィールドではない）。要件に従いスキップする。
 *
 * 設計方針（本番データ破壊防止）:
 * - デフォルトは dry-run（読み取りのみ）。`--apply` を指定した場合のみ書き込む。
 * - 対象レコードが存在しない場合は create せず fail-closed でエラー停止する
 *   （tachigaren の追加リンクのみ、対象 diseasePest が存在しなければそのリンクだけスキップして継続）。
 * - 全ての書き込みは単一の `prisma.$transaction` で原子的に実行する。
 * - 冪等: 既に正しい値なら update 自体をスキップし「変更なし」と報告する。再実行しても同じ結果になる。
 *
 * 実行方法（PowerShell）:
 *
 *   `.env.production` に本番の接続情報（DATABASE_URL / DIRECT_URL）を登録済みであれば、
 *   環境変数の手動設定は不要で、そのまま次のコマンドで実行できる。
 *
 *   npx tsx prisma/scripts/apply-validation-fixes-2026-07.ts          # dry-run（既定・書き込みなし・必ず先に実行）
 *   npx tsx prisma/scripts/apply-validation-fixes-2026-07.ts --apply  # 適用
 *
 *   実行直後に表示される「接続先 (masked)」の行で、意図した本番ホストに向いているか
 *   必ず目視確認すること。
 *
 *   シェルで `$env:DATABASE_URL` / `$env:DIRECT_URL` を明示的に設定した場合はそちらが
 *   最優先される（`.env.production` の値には奪われない）。この場合は実行後に
 *   `Remove-Item Env:DATABASE_URL` 等で後片付けすること。
 *
 *   `.env.local` は本スクリプトでは読み込まない（ローカル DB への誤接続混入を防ぐため）。
 *   ローカル検証用 DB に対して実行したい場合は、上記のシェル環境変数を明示的に設定すること。
 *
 *   接続解決・`--apply` 判定は `prisma/scripts/lib/prod-apply-client.ts` を使用。
 *   新規スクリプトを書く場合は `prisma/scripts/_template-oneshot-apply.ts` をコピーすること
 *   （詳細は `prisma/scripts/README.md` 参照）。
 */

import { EffectRating, PrismaClient, type Pesticide } from '@prisma/client'
import {
  createProdApplyClient,
  isApplyMode,
  printConnectionFailureHint,
} from './lib/prod-apply-client'

const isApply = isApplyMode()

// ============================================================
// 1. FertilizerColumn 本文修正（green-king / magamp-k）
// ============================================================

interface FertilizerColumnFix {
  slug: string
  content: string
}

const FERTILIZER_COLUMN_FIXES: FertilizerColumnFix[] = [
  {
    slug: 'magamp-k',
    // 出典: ハイポネックスジャパン公式サイト（肥効持続: 大粒 約2年 / 中粒 約1年）
    content: `マグァンプKは、ハイポネックスジャパンが製造するリン酸主体の化成肥料です。長期間にわたりゆっくり効く緩効性が特徴で、植え替え時の元肥として広く使われています。

━━━ 基本データ ━━━
N-P-K-Mg：6-40-6-15
タイプ：顆粒・緩効性（元肥用）
原料：化成肥料（熔成リン肥ベース）

━━━ 特徴と使い方 ━━━
リン酸含有量が40%と極めて高く、花芽形成や根の充実を強力に促進します。花物盆栽（梅・皐月・長寿梅等）や実物盆栽（柿・姫リンゴ等）に特に効果的です。マグネシウムも15%含有し、葉緑素の生成を助けて葉色を良くする効果もあります。

使い方は植え替え時に新しい用土に混ぜ込むのが基本です。鉢底の用土に少量を混合し、根に直接触れないように注意します。効果は大粒タイプで約2年、中粒で約1年持続します。

盆栽では元肥を入れすぎないのが鉄則です。一般園芸の規定量の半分以下を目安にし、追肥（置き肥・液肥）で補う方が安全です。化成肥料のため、有機肥料と併用して微量要素を補完するのが望ましいです。`,
  },
  {
    slug: 'green-king',
    // 出典: マルタ小泉商事 公式サイト 保証成分 N6:P5:K2
    content: `グリーンキングは、有機質主体のペレット型肥料で、バイオゴールドと並んで盆栽愛好家に人気の製品です。バランスの良い成分比率と扱いやすさが評価されています。

━━━ 基本データ ━━━
N-P-K：6-5-2（有機質主体）
タイプ：ペレット・緩効性（置き肥用）
原料：有機質原料を発酵処理後にペレット成形

━━━ 特徴と使い方 ━━━
チッソ・リン酸・カリをバランスよく含む緩効性の有機肥料で、松柏類から雑木類、花物・実物まで幅広い樹種に使えます。臭いが比較的少なく、ベランダ栽培や室内管理時にも使いやすいのが利点です。

ペレット形状で大きさが均一なため、施肥量の管理がしやすく初心者にも扱いやすい肥料です。置き肥として鉢土の表面に配置し、月1回の交換で管理します。

有機質主体で緩やかに肥効が続くため、幅広い樹種の置き肥として継続的に使用しやすい肥料です。春と秋の施肥期間に継続的に使用し、梅雨時と猛暑期は外します。`,
  },
]

// ============================================================
// 2. tachigaren（MAFF登録番号 10331）の PesticideEffect 修正
// ============================================================

const TACHIGAREN_PESTICIDE_SLUG = 'tachigaren'

// 保持するリンク（変更しない）
const TACHIGAREN_KEEP_SLUG = 'negusare-byo'

// MAFF #10331 適用表に無い誤リンク（削除対象、7件）
const TACHIGAREN_DELETE_SLUGS = [
  'shiromonpa-byo',
  'shimonpa-byo',
  'kuromonpa-byo',
  'nekuchi-byo',
  'nekobu-byo',
  'shinkusare-byo',
  'kabukusare-byo',
] as const

type EffectRatingValue = (typeof EffectRating)[keyof typeof EffectRating]

interface TachigarenAddLink {
  slug: string
  preventionLevel: EffectRatingValue
  treatmentLevel: EffectRatingValue
  efficacyLevel: EffectRatingValue
  persistenceLevel: EffectRatingValue
}

// MAFF #10331 適用表に基づく正しいリンク（追加対象、3件）
const TACHIGAREN_ADD_LINKS: TachigarenAddLink[] = [
  {
    // MAFF #10331 適用表で主用途（登録数最多）
    slug: 'nae-tachigare-byo',
    preventionLevel: EffectRating.excellent,
    treatmentLevel: EffectRating.good,
    efficacyLevel: EffectRating.excellent,
    persistenceLevel: EffectRating.good,
  },
  {
    slug: 'tachigare-byo',
    preventionLevel: EffectRating.good,
    treatmentLevel: EffectRating.good,
    efficacyLevel: EffectRating.good,
    persistenceLevel: EffectRating.good,
  },
  {
    slug: 'shirakinu-byo',
    preventionLevel: EffectRating.good,
    treatmentLevel: EffectRating.fair,
    efficacyLevel: EffectRating.good,
    persistenceLevel: EffectRating.good,
  },
]

// ============================================================
// 3. hormone PubChem CID — 対象外（スキップ）
// ============================================================

function reportHormoneCidSkip(): void {
  console.log('\n[4/4] hormone PubChem CID の修正')
  console.log(
    '  スキップ: HormoneType にはスキーマ上専用の CID フィールドが存在しない。',
  )
  console.log(
    '  CID は description の自由記述内に埋め込まれているのみ（例: "PubChem CID: 6466"）で、',
  )
  console.log('  構造化カラムではないため、要件に従い本スクリプトの対象外とする。')
}

// ============================================================
// 実行本体
// ============================================================

async function planFertilizerColumnFixes(
  prisma: PrismaClient,
): Promise<{ slug: string; current: string; desired: string; needsUpdate: boolean }[]> {
  const plans: { slug: string; current: string; desired: string; needsUpdate: boolean }[] = []

  for (const fix of FERTILIZER_COLUMN_FIXES) {
    const existing = await prisma.fertilizerColumn.findUnique({ where: { slug: fix.slug } })
    if (!existing) {
      throw new Error(
        `[fatal] FertilizerColumn slug="${fix.slug}" が見つかりません。想定外のレコード作成を避けるため停止します。`,
      )
    }
    plans.push({
      slug: fix.slug,
      current: existing.content,
      desired: fix.content,
      needsUpdate: existing.content !== fix.content,
    })
  }

  return plans
}

interface ExistingTachigarenEffect {
  id: string
  diseasePestId: string
  slug: string
  preventionLevel: EffectRatingValue | null
  treatmentLevel: EffectRatingValue | null
  efficacyLevel: EffectRatingValue | null
  persistenceLevel: EffectRatingValue | null
}

interface TachigarenPlan {
  pesticideId: string
  keep: ExistingTachigarenEffect | null
  toDelete: ExistingTachigarenEffect[]
  toAdd: {
    slug: string
    diseasePestId: string | null
    link: TachigarenAddLink
    existing: ExistingTachigarenEffect | null
    action: 'create' | 'update' | 'no-op' | 'skip-missing-disease-pest'
  }[]
}

async function planTachigarenFix(prisma: PrismaClient): Promise<TachigarenPlan> {
  const pesticide: Pesticide | null = await prisma.pesticide.findUnique({
    where: { slug: TACHIGAREN_PESTICIDE_SLUG },
  })
  if (!pesticide) {
    throw new Error(
      `[fatal] Pesticide slug="${TACHIGAREN_PESTICIDE_SLUG}" が見つかりません。想定外のレコード作成を避けるため停止します。`,
    )
  }

  const existingEffects = await prisma.pesticideEffect.findMany({
    where: { pesticideId: pesticide.id },
    include: { diseasePest: { select: { slug: true } } },
  })

  const existingBySlug: ExistingTachigarenEffect[] = existingEffects.map((e) => ({
    id: e.id,
    diseasePestId: e.diseasePestId,
    slug: e.diseasePest.slug,
    preventionLevel: e.preventionLevel,
    treatmentLevel: e.treatmentLevel,
    efficacyLevel: e.efficacyLevel,
    persistenceLevel: e.persistenceLevel,
  }))

  const keep = existingBySlug.find((e) => e.slug === TACHIGAREN_KEEP_SLUG) ?? null

  const toDelete = existingBySlug.filter((e) =>
    (TACHIGAREN_DELETE_SLUGS as readonly string[]).includes(e.slug),
  )

  const toAdd: TachigarenPlan['toAdd'] = []
  for (const link of TACHIGAREN_ADD_LINKS) {
    const diseasePest = await prisma.diseasePest.findUnique({ where: { slug: link.slug } })
    if (!diseasePest) {
      toAdd.push({ slug: link.slug, diseasePestId: null, link, existing: null, action: 'skip-missing-disease-pest' })
      continue
    }
    const existing = existingBySlug.find((e) => e.diseasePestId === diseasePest.id) ?? null
    let action: 'create' | 'update' | 'no-op'
    if (!existing) {
      action = 'create'
    } else if (
      existing.preventionLevel !== link.preventionLevel ||
      existing.treatmentLevel !== link.treatmentLevel ||
      existing.efficacyLevel !== link.efficacyLevel ||
      existing.persistenceLevel !== link.persistenceLevel
    ) {
      action = 'update'
    } else {
      action = 'no-op'
    }
    toAdd.push({ slug: link.slug, diseasePestId: diseasePest.id, link, existing, action })
  }

  return { pesticideId: pesticide.id, keep, toDelete, toAdd }
}

function printFertilizerPlan(
  plans: Awaited<ReturnType<typeof planFertilizerColumnFixes>>,
): void {
  console.log('\n[1-2/4] FertilizerColumn 本文修正（green-king / magamp-k）')
  for (const plan of plans) {
    console.log(`\n  slug="${plan.slug}"`)
    if (!plan.needsUpdate) {
      console.log('    変更なし（既に正しい内容）')
      continue
    }
    console.log('    現在値 → 変更後の値:')
    console.log(`    [現在]\n${indent(plan.current)}`)
    console.log(`    [変更後]\n${indent(plan.desired)}`)
  }
}

function printTachigarenPlan(plan: TachigarenPlan): void {
  console.log('\n[3/4] tachigaren（MAFF #10331）の PesticideEffect 修正')

  console.log('\n  保持（変更なし）:')
  if (plan.keep) {
    console.log(
      `    ${TACHIGAREN_KEEP_SLUG}: prevention=${plan.keep.preventionLevel}, treatment=${plan.keep.treatmentLevel}, efficacy=${plan.keep.efficacyLevel}, persistence=${plan.keep.persistenceLevel}`,
    )
  } else {
    console.log(`    警告: ${TACHIGAREN_KEEP_SLUG} の既存リンクが見つかりません（想定外）`)
  }

  console.log(`\n  削除予定（${plan.toDelete.length}件 / 想定7件）:`)
  if (plan.toDelete.length === 0) {
    console.log('    変更なし（既に削除済み）')
  } else {
    for (const e of plan.toDelete) {
      console.log(`    - ${e.slug}`)
    }
  }
  const missingFromDelete = TACHIGAREN_DELETE_SLUGS.filter(
    (slug) => !plan.toDelete.some((e) => e.slug === slug),
  )
  if (missingFromDelete.length > 0) {
    console.log(`    (既に存在しないため削除不要: ${missingFromDelete.join(', ')})`)
  }

  console.log(`\n  追加予定（${plan.toAdd.length}件 / 想定3件）:`)
  for (const item of plan.toAdd) {
    if (item.action === 'skip-missing-disease-pest') {
      console.log(`    - ${item.slug}: スキップ（diseasePest が見つかりません）`)
      continue
    }
    if (item.action === 'no-op') {
      console.log(`    - ${item.slug}: 変更なし（既に正しい値）`)
      continue
    }
    console.log(`    - ${item.slug}: ${item.action === 'create' ? '新規作成' : '値を修正'}`)
    console.log(
      `      → prevention=${item.link.preventionLevel}, treatment=${item.link.treatmentLevel}, efficacy=${item.link.efficacyLevel}, persistence=${item.link.persistenceLevel}`,
    )
  }
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => `      ${line}`)
    .join('\n')
}

async function applyFixes(
  prisma: PrismaClient,
  fertilizerPlans: Awaited<ReturnType<typeof planFertilizerColumnFixes>>,
  tachigarenPlan: TachigarenPlan,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const plan of fertilizerPlans) {
      if (!plan.needsUpdate) continue
      await tx.fertilizerColumn.update({
        where: { slug: plan.slug },
        data: { content: plan.desired },
      })
    }

    if (tachigarenPlan.toDelete.length > 0) {
      await tx.pesticideEffect.deleteMany({
        where: {
          pesticideId: tachigarenPlan.pesticideId,
          diseasePestId: { in: tachigarenPlan.toDelete.map((e) => e.diseasePestId) },
        },
      })
    }

    for (const item of tachigarenPlan.toAdd) {
      if (item.action === 'skip-missing-disease-pest' || item.diseasePestId === null) continue
      if (item.action === 'no-op') continue

      await tx.pesticideEffect.upsert({
        where: {
          pesticideId_diseasePestId: {
            pesticideId: tachigarenPlan.pesticideId,
            diseasePestId: item.diseasePestId,
          },
        },
        create: {
          pesticideId: tachigarenPlan.pesticideId,
          diseasePestId: item.diseasePestId,
          preventionLevel: item.link.preventionLevel,
          treatmentLevel: item.link.treatmentLevel,
          efficacyLevel: item.link.efficacyLevel,
          persistenceLevel: item.link.persistenceLevel,
        },
        update: {
          preventionLevel: item.link.preventionLevel,
          treatmentLevel: item.link.treatmentLevel,
          efficacyLevel: item.link.efficacyLevel,
          persistenceLevel: item.link.persistenceLevel,
        },
      })
    }
  })
}

async function verifyAfterApply(prisma: PrismaClient): Promise<void> {
  console.log('\n=== 適用後の検証 ===')

  for (const fix of FERTILIZER_COLUMN_FIXES) {
    const record = await prisma.fertilizerColumn.findUnique({ where: { slug: fix.slug } })
    const ok = record?.content === fix.content
    console.log(`  ${fix.slug}: ${ok ? 'OK（正しい内容に一致）' : 'NG（不一致）'}`)
  }

  const pesticide = await prisma.pesticide.findUnique({ where: { slug: TACHIGAREN_PESTICIDE_SLUG } })
  if (!pesticide) {
    console.log(`  ${TACHIGAREN_PESTICIDE_SLUG}: NG（Pesticide レコードが見つかりません）`)
    return
  }
  const effects = await prisma.pesticideEffect.findMany({
    where: { pesticideId: pesticide.id },
    include: { diseasePest: { select: { slug: true } } },
  })
  const slugs = effects.map((e) => e.diseasePest.slug).sort()
  console.log(`  ${TACHIGAREN_PESTICIDE_SLUG} effects (${slugs.length}件): ${slugs.join(', ')}`)
}

async function main(): Promise<void> {
  const prisma = createProdApplyClient()

  console.log(`モード: ${isApply ? '--apply（書き込みあり）' : 'dry-run（読み取りのみ）'}`)

  try {
    const fertilizerPlans = await planFertilizerColumnFixes(prisma).catch((e: unknown) => {
      console.error('\nDB への接続または初回クエリに失敗しました。')
      printConnectionFailureHint()
      throw e
    })
    printFertilizerPlan(fertilizerPlans)

    const tachigarenPlan = await planTachigarenFix(prisma)
    printTachigarenPlan(tachigarenPlan)

    reportHormoneCidSkip()

    if (!isApply) {
      console.log('\ndry-run のため書き込みは行っていません。--apply を付けて実行すると反映されます。')
      return
    }

    console.log('\n--apply が指定されたため、上記の変更をトランザクション内で適用します...')
    await applyFixes(prisma, fertilizerPlans, tachigarenPlan)
    console.log('適用完了。')

    await verifyAfterApply(prisma)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
