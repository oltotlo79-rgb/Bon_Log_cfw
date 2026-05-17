/* eslint-disable no-console */
/**
 * 効果データのパラメータ誤りを修正するスクリプト。
 *
 * 修正対象:
 * 1. 保護殺菌剤（マンゼブ・キャプタン・TPN・銅系）の treatmentLevel を "none" に修正
 *    - dithane-fl, captan-fl, captan-wdg, daconil-wp/wdg/1000, kasumin-bordeaux,
 *      sankei-copper-fl/wp の全エントリ
 * 2. マシン油 (machine-oil-ec) の persistenceLevel を "fair" に修正
 * 3. dithane-wp の hagare-sho に preventionLevel を追加
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-fix-params.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('=== 効果パラメータ修正を開始します ===\n')

  // ──────────────────────────────────────────────────────
  //  1. 保護殺菌剤の treatmentLevel を "none" に一括修正
  // ──────────────────────────────────────────────────────
  // 保護殺菌剤は菌の感染を物理的に遮断する予防専用剤。
  // すでに感染した病害を治療する能力はない。
  // treatmentLevel は "none" が正しい。
  const protectiveSlugs = [
    // マンゼブ系
    'dithane-fl',
    // キャプタン系
    'captan-fl', 'captan-wdg',
    // TPN（クロロタロニル）系
    'daconil-1000', 'daconil-wp', 'daconil-wdg', 'daconil-dp',
    // 銅系
    'kasumin-bordeaux', 'sankei-copper-fl', 'sankei-copper-wp',
    // マネブ系
    'sankei-maneb-wp',
    // オーソサイド（キャプタン）
    'orthocide-wp',
    // ボルドー液
    'z-bordeaux',
    // サンヨー銅
    'sanyo-copper-wp',
  ]

  console.log('--- 保護殺菌剤の treatmentLevel 修正 ---')
  for (const slug of protectiveSlugs) {
    const pesticide = await prisma.pesticide.findUnique({ where: { slug } })
    if (!pesticide) {
      console.warn(`  ⚠ ${slug} が見つかりません`)
      continue
    }

    const updated = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: pesticide.id,
        treatmentLevel: { not: 'none' },
      },
      data: {
        treatmentLevel: 'none',
      },
    })

    if (updated.count > 0) {
      console.log(`  ✓ ${slug}: ${updated.count}件の treatmentLevel を "none" に修正`)
    }
  }

  // ──────────────────────────────────────────────────────
  //  2. マシン油の persistenceLevel を "fair" に修正
  // ──────────────────────────────────────────────────────
  // マシン油は物理的に害虫を窒息させる。油膜が葉面に残るため
  // 完全な残効なし(poor)ではないが、化学的作用がないため good は過大。
  // "fair" が妥当。
  console.log('\n--- マシン油の persistenceLevel 修正 ---')
  const machineOil = await prisma.pesticide.findUnique({ where: { slug: 'machine-oil-ec' } })
  if (machineOil) {
    const updated = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: machineOil.id,
        persistenceLevel: 'good',
      },
      data: {
        persistenceLevel: 'fair',
      },
    })
    if (updated.count > 0) {
      console.log(`  ✓ machine-oil-ec: ${updated.count}件の persistenceLevel を "fair" に修正`)
    }
  }

  // ──────────────────────────────────────────────────────
  //  3. dithane-wp の hagare-sho に preventionLevel 追加
  // ──────────────────────────────────────────────────────
  console.log('\n--- dithane-wp hagare-sho 修正 ---')
  const dithane = await prisma.pesticide.findUnique({ where: { slug: 'dithane-wp' } })
  const hagareSho = await prisma.diseasePest.findUnique({ where: { slug: 'hagare-sho' } })
  if (dithane && hagareSho) {
    const effect = await prisma.pesticideEffect.findUnique({
      where: { pesticideId_diseasePestId: { pesticideId: dithane.id, diseasePestId: hagareSho.id } },
    })
    if (effect && !effect.preventionLevel) {
      await prisma.pesticideEffect.update({
        where: { id: effect.id },
        data: {
          preventionLevel: 'excellent',
          treatmentLevel: 'none',
        },
      })
      console.log('  ✓ dithane-wp → hagare-sho: preventionLevel=excellent, treatmentLevel=none に修正')
    }
  }

  // ──────────────────────────────────────────────────────
  //  4. dithane-wp 本体の treatmentLevel 確認（"none" のはず）
  // ──────────────────────────────────────────────────────
  console.log('\n--- dithane-wp treatmentLevel 確認 ---')
  if (dithane) {
    const wrongTreatment = await prisma.pesticideEffect.findMany({
      where: {
        pesticideId: dithane.id,
        treatmentLevel: { not: 'none' },
      },
    })
    // dithane-wp は元データで全て "none" のはずだが念のため修正
    if (wrongTreatment.length > 0) {
      await prisma.pesticideEffect.updateMany({
        where: {
          pesticideId: dithane.id,
          treatmentLevel: { not: 'none' },
        },
        data: { treatmentLevel: 'none' },
      })
      console.log(`  ✓ dithane-wp: ${wrongTreatment.length}件修正`)
    } else {
      console.log('  OK: dithane-wp は全て treatmentLevel=none')
    }
  }

  console.log('\n=== 効果パラメータ修正が完了しました ===')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
