/* eslint-disable no-console */
/**
 * 本番など既に農薬データがある環境に、不足している農薬（例: ランネート水和剤）のみを追加するスクリプト。
 * 既存データは削除せず、存在しない場合のみ追加する。
 *
 * 実行例（本番DBに接続して追加）:
 *   DATABASE_URL="postgresql://..." npx tsx prisma/seed-pesticide-supplement.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const RANNET_SLUG = 'rannet-wp'

async function main() {
  const existing = await prisma.pesticide.findUnique({ where: { slug: RANNET_SLUG } })
  if (existing) {
    console.log(`ランネート水和剤（${RANNET_SLUG}）は既に登録済みです。`)
    return
  }

  // 剤型 WP（水和剤）
  let ftWp = await prisma.formulationType.findUnique({ where: { code: 'WP' } })
  if (!ftWp) {
    ftWp = await prisma.formulationType.create({
      data: { code: 'WP', name: '水和剤', description: '有効成分を微粉砕し界面活性剤等を加えたもの。水に懸濁させて使用する。', sortOrder: 2 },
    })
    console.log('剤型 WP を追加しました。')
  }

  // 原体 メソミル（ランネートの有効成分。カルバリルはセビンの有効成分であり別物）
  let ingMethomyl = await prisma.activeIngredient.findUnique({ where: { slug: 'methomyl' } })
  if (!ingMethomyl) {
    ingMethomyl = await prisma.activeIngredient.create({
      data: {
        name: 'メソミル',
        nameEn: 'Methomyl',
        iracCode: '1A',
        ingredientGroup: 'カルバメート系',
        slug: 'methomyl',
        description: 'IRACコード1A（カルバメート系）。アセチルコリンエステラーゼを阻害する速効性殺虫剤。ケムシ・ヨコバイ・アザミウマ等の幅広い害虫に有効。浸透移行性があり、食毒・接触毒の両作用を持つ。',
      },
    })
    console.log('原体 メソミル を追加しました。')
  }

  const pesticide = await prisma.pesticide.create({
    data: {
      name: 'ランネート水和剤',
      registrationNumber: null, // 旧値18501はクミアイカスケード乳剤(失効)の番号であり誤り。ランネート45DFは#20863だが製品名・剤型が異なる
      pesticideType: 'insecticide',
      formulationTypeId: ftWp.id,
      slug: RANNET_SLUG,
      description: 'メソミル（カルバメート系）殺虫剤。速効性で浸透移行性があり、ケムシ・ヨコバイ・アザミウマ・シンクイムシ等に有効。',
    },
  })
  console.log('農薬 ランネート水和剤 を追加しました。')

  await prisma.pesticideActiveIngredient.create({
    data: {
      pesticideId: pesticide.id,
      activeIngredientId: ingMethomyl.id,
      contentLabel: '45.0%',
    },
  })
  console.log('農薬-原体リンクを追加しました。')

  const effectTargets = [
    { slug: 'kemushi-imomushi', efficacyLevel: 'excellent' as const, persistenceLevel: 'good' as const },
    { slug: 'yokobai', efficacyLevel: 'good' as const, persistenceLevel: 'fair' as const },
    { slug: 'azamiuma', efficacyLevel: 'good' as const, persistenceLevel: 'fair' as const },
    { slug: 'shinkuimushi', efficacyLevel: 'good' as const, persistenceLevel: 'fair' as const },
  ]

  for (const t of effectTargets) {
    const dp = await prisma.diseasePest.findUnique({ where: { slug: t.slug } })
    if (dp) {
      await prisma.pesticideEffect.create({
        data: {
          pesticideId: pesticide.id,
          diseasePestId: dp.id,
          efficacyLevel: t.efficacyLevel,
          persistenceLevel: t.persistenceLevel,
        },
      })
      console.log(`効果データを追加しました: ${t.slug}`)
    }
  }

  console.log('=== ランネート水和剤の追加が完了しました ===')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
