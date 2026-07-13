/* eslint-disable no-console */
/**
 * @module prisma/scripts/apply-post-bonsai-ownership-cleanup-2026-07
 *
 * セキュリティ是正スクリプト: Web の `createPost`（`lib/actions/post.ts`）が
 * `bonsaiId` の所有権検証を行っていなかった期間（`lib/actions/post-validation.ts` に
 * `isOwnedBonsai` ガードを追加する修正以前）に作成された投稿の中から、
 * `Post.bonsaiId` が設定されているにもかかわらずその盆栽の所有者と投稿者が
 * 異なる（`post.userId !== bonsai.userId`）レコードを検出する（IDOR による
 * 汚染データの点検）。
 *
 * 汚染された `Post.bonsaiId` は被害者（盆栽所有者）の「マイ盆栽タイムライン」
 * （`getPostsByBonsai`）に他人の投稿を混入させる。投稿自体は削除せず、
 * `bonsaiId` のみ `null` に更新して紐付けを解除する（`Post.content` 等は無傷）。
 *
 * dry-run（既定）では該当件数・投稿ID一覧を表示するのみで書き込みは行わない。
 * 詳細な運用手順・チェックリストは `prisma/scripts/README.md` を参照。
 *
 * 実行方法（PowerShell）:
 *
 *   npx tsx prisma/scripts/apply-post-bonsai-ownership-cleanup-2026-07.ts          # dry-run（既定・必ず先に実行）
 *   npx tsx prisma/scripts/apply-post-bonsai-ownership-cleanup-2026-07.ts --apply  # 適用
 *
 *   実行直後に表示される「接続先 (masked)」の行で、意図した接続先か必ず目視確認すること。
 */

import {
  createProdApplyClient,
  isApplyMode,
  printConnectionFailureHint,
} from './lib/prod-apply-client'
import type { PrismaClient } from '@prisma/client'

interface TaintedPostPlan {
  postId: string
  postUserId: string
  bonsaiId: string
  bonsaiOwnerId: string
}

/**
 * `bonsaiId` が設定されている投稿を全件取得し、紐付け先の盆栽所有者と突合する。
 * この関数は読み取りのみ。書き込みは行わない。
 *
 * Why not a single relational query: Prisma はリレーション先カラムと自カラムの
 * 直接比較（`post.userId != bonsai.userId`）をクエリレベルでサポートしないため、
 * 投稿一覧と盆栽所有者マップをそれぞれ取得し JS 側で突合する。
 */
async function planOwnershipCleanup(prisma: PrismaClient): Promise<TaintedPostPlan[]> {
  const postsWithBonsai = await prisma.post.findMany({
    where: { bonsaiId: { not: null } },
    select: { id: true, userId: true, bonsaiId: true },
  })

  if (postsWithBonsai.length === 0) return []

  const bonsaiIds = [...new Set(postsWithBonsai.map((p) => p.bonsaiId).filter((id): id is string => id !== null))]

  const bonsais = await prisma.bonsai.findMany({
    where: { id: { in: bonsaiIds } },
    select: { id: true, userId: true },
  })
  const bonsaiOwnerById = new Map(bonsais.map((b) => [b.id, b.userId]))

  const plans: TaintedPostPlan[] = []
  for (const post of postsWithBonsai) {
    if (!post.bonsaiId) continue
    const ownerId = bonsaiOwnerById.get(post.bonsaiId)
    if (ownerId === undefined) {
      // onDelete: SetNull のため通常は起こらない（FK が生きている限り bonsai は必ず存在する）。
      // 発生した場合はデータ不整合の兆候のため fail-closed で停止し、原因調査を促す。
      throw new Error(
        `[fatal] postId="${post.id}" の bonsaiId="${post.bonsaiId}" に対応する盆栽が見つかりません。` +
          'FK 制約と矛盾するデータ不整合の可能性があるため、原因調査のため処理を停止します。',
      )
    }
    if (ownerId !== post.userId) {
      plans.push({
        postId: post.id,
        postUserId: post.userId,
        bonsaiId: post.bonsaiId,
        bonsaiOwnerId: ownerId,
      })
    }
  }

  return plans
}

function printPlan(plans: TaintedPostPlan[]): void {
  console.log('\n[plan] IDOR汚染 bonsaiId の検出結果')
  if (plans.length === 0) {
    console.log('  該当なし（post.userId !== bonsai.userId のレコードは見つかりませんでした）。')
    return
  }
  console.log(`  ${plans.length} 件の投稿で bonsaiId の所有者不一致を検出しました。`)
  for (const plan of plans) {
    console.log(
      `\n  postId="${plan.postId}" (投稿者=${plan.postUserId}) → ` +
        `bonsaiId="${plan.bonsaiId}" (所有者=${plan.bonsaiOwnerId})`,
    )
    console.log('    [変更後] bonsaiId を null に更新（投稿本文・メディア等は変更しない）')
  }
}

/**
 * 単一トランザクションで対象投稿の bonsaiId のみを null に更新する。
 * 対象は plan で確定した postId に限定し、全件 update / deleteMany は行わない。
 */
async function applyCleanup(prisma: PrismaClient, plans: TaintedPostPlan[]): Promise<void> {
  if (plans.length === 0) return
  await prisma.$transaction(async (tx) => {
    for (const plan of plans) {
      await tx.post.update({
        where: { id: plan.postId },
        data: { bonsaiId: null },
      })
    }
  })
}

async function verifyAfterApply(prisma: PrismaClient, plans: TaintedPostPlan[]): Promise<void> {
  console.log('\n=== 適用後の検証 ===')
  for (const plan of plans) {
    const post = await prisma.post.findUnique({
      where: { id: plan.postId },
      select: { bonsaiId: true },
    })
    console.log(
      `  postId="${plan.postId}": bonsaiId=${post?.bonsaiId ?? 'null'} ` +
        `(${post?.bonsaiId === null ? 'OK' : 'NG: null になっていません'})`,
    )
  }
}

async function main(): Promise<void> {
  const prisma = createProdApplyClient()
  const apply = isApplyMode()

  console.log(`モード: ${apply ? '--apply（書き込みあり）' : 'dry-run（読み取りのみ）'}`)

  try {
    const plans = await planOwnershipCleanup(prisma).catch((e: unknown) => {
      console.error('\nDB への接続または初回クエリに失敗しました。')
      printConnectionFailureHint()
      throw e
    })
    printPlan(plans)

    if (!apply) {
      console.log('\ndry-run のため書き込みは行っていません。--apply を付けて実行すると反映されます。')
      return
    }

    if (plans.length === 0) {
      console.log('\n適用対象がないため何もしません。')
      return
    }

    console.log('\n--apply が指定されたため、上記の変更をトランザクション内で適用します...')
    await applyCleanup(prisma, plans)
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
