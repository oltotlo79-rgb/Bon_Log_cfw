/* eslint-disable no-console */
/**
 * スプレー型農薬の効果データ詳細を追加するシードスクリプト。
 * 製品定義・成分リンクは seed-pesticide-additions2.ts に定義。
 * 既存データは削除せず、存在しない場合のみ追加する（冪等）。
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-spray.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// ── ヘルパー ──────────────────────────────────────────────

async function ensureFormulationType(code: string, name: string, description: string, sortOrder: number) {
  let ft = await prisma.formulationType.findUnique({ where: { code } })
  if (!ft) {
    ft = await prisma.formulationType.create({ data: { code, name, description, sortOrder } })
    console.log(`剤型 ${code}（${name}）を追加しました。`)
  }
  return ft
}

async function ensureActiveIngredient(data: {
  slug: string
  name: string
  nameEn: string
  fracCode?: string
  iracCode?: string
  ingredientGroup: string
  description: string
  resistanceRisk?: 'low' | 'medium' | 'high'
}) {
  let ing = await prisma.activeIngredient.findUnique({ where: { slug: data.slug } })
  if (!ing) {
    ing = await prisma.activeIngredient.create({
      data: {
        slug: data.slug,
        name: data.name,
        nameEn: data.nameEn,
        fracCode: data.fracCode ?? null,
        iracCode: data.iracCode ?? null,
        ingredientGroup: data.ingredientGroup,
        description: data.description,
        resistanceRisk: data.resistanceRisk ?? null,
      },
    })
    console.log(`有効成分 ${data.name}（${data.slug}）を追加しました。`)
  }
  return ing
}

async function ensurePesticide(data: {
  slug: string
  name: string
  registrationNumber: string | null
  pesticideType: 'fungicide' | 'insecticide' | 'acaricide' | 'compound' | 'other'
  formulationTypeId: string
  description: string
}) {
  const existing = await prisma.pesticide.findUnique({ where: { slug: data.slug } })
  if (existing) {
    console.log(`${data.name}（${data.slug}）は既に登録済みです。スキップします。`)
    return existing
  }
  const pesticide = await prisma.pesticide.create({
    data: {
      slug: data.slug,
      name: data.name,
      registrationNumber: data.registrationNumber,
      pesticideType: data.pesticideType,
      formulationTypeId: data.formulationTypeId,
      description: data.description,
    },
  })
  console.log(`農薬 ${data.name}（${data.slug}）を追加しました。`)
  return pesticide
}

async function linkIngredient(pesticideId: string, ingredientId: string, contentLabel: string) {
  const existing = await prisma.pesticideActiveIngredient.findUnique({
    where: { pesticideId_activeIngredientId: { pesticideId, activeIngredientId: ingredientId } },
  })
  if (!existing) {
    await prisma.pesticideActiveIngredient.create({
      data: { pesticideId, activeIngredientId: ingredientId, contentLabel },
    })
  }
}

async function linkEffect(
  pesticideId: string,
  diseasePestSlug: string,
  effect: {
    preventionLevel?: 'excellent' | 'good' | 'fair' | 'poor' | 'none'
    treatmentLevel?: 'excellent' | 'good' | 'fair' | 'poor' | 'none'
    efficacyLevel?: 'excellent' | 'good' | 'fair' | 'poor' | 'none'
    persistenceLevel?: 'excellent' | 'good' | 'fair' | 'poor' | 'none'
    note?: string
  },
) {
  const dp = await prisma.diseasePest.findUnique({ where: { slug: diseasePestSlug } })
  if (!dp) {
    console.warn(`  ⚠ 病害虫 ${diseasePestSlug} が見つかりません。スキップします。`)
    return
  }
  const existing = await prisma.pesticideEffect.findUnique({
    where: { pesticideId_diseasePestId: { pesticideId, diseasePestId: dp.id } },
  })
  if (!existing) {
    await prisma.pesticideEffect.create({
      data: {
        pesticideId,
        diseasePestId: dp.id,
        preventionLevel: effect.preventionLevel ?? null,
        treatmentLevel: effect.treatmentLevel ?? null,
        efficacyLevel: effect.efficacyLevel ?? null,
        persistenceLevel: effect.persistenceLevel ?? null,
        note: effect.note ?? null,
      },
    })
    console.log(`  効果データ追加: ${dp.name}`)
  }
}

// ── メイン処理 ──────────────────────────────────────────────

async function main() {
  console.log('=== スプレータイプ薬剤の追加を開始します ===\n')

  // ── 剤型 AL（エアゾール・スプレー）を確保 ──
  const ftAL = await ensureFormulationType(
    'AL',
    'エアゾール・スプレー',
    'そのまま使えるスプレー製剤。希釈不要で手軽に使用できる。家庭園芸向けが多い。',
    7,
  )

  // ══════════════════════════════════════════════════════════
  //  有効成分の確認・追加
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 有効成分の確認・追加 ---')

  const ingMepanipyrim = await ensureActiveIngredient({
    slug: 'mepanipyrim',
    name: 'メパニピリム',
    nameEn: 'Mepanipyrim',
    fracCode: '9',
    ingredientGroup: 'アニリノピリミジン系',
    description:
      'FRACコード9（アニリノピリミジン系）。病原菌が植物組織に侵入する際に分泌する細胞壁分解酵素の生合成を阻害する殺菌剤。灰色かび病・うどんこ病・黒星病に予防・治療効果がある。ベニカXファインスプレーの殺菌成分として使用。ボトリチス属やベンチュリア属に高い活性。',
    resistanceRisk: 'medium',
  })

  const ingPyridalyl = await ensureActiveIngredient({
    slug: 'pyridalyl',
    name: 'ピリダリル',
    nameEn: 'Pyridalyl',
    iracCode: 'UN',
    ingredientGroup: 'ピリダリル系（未分類）',
    description:
      'IRAC UN（未分類）。既存の殺虫剤とは全く異なる新規作用機構を持つ殺虫剤。細胞膜を破壊する作用が示唆されているがIRACでは公式分類が未確定。チョウ目（ヨトウムシ・コナガ等）とアザミウマ目害虫に高い効果を示す。既存剤に抵抗性を発達させた害虫にも有効。住友化学開発。',
    resistanceRisk: 'low',
  })

  const ingMandestrobin = await ensureActiveIngredient({
    slug: 'mandestrobin',
    name: 'マンデストロビン',
    nameEn: 'Mandestrobin',
    fracCode: '11',
    ingredientGroup: 'QoI系（メトキシアセタミド系）',
    description:
      'FRACコード11（QoI系）。住友化学が開発したメトキシアセタミド型のQoI殺菌剤。ミトコンドリアの電子伝達系Complex IIIのQoサイトを阻害する。ストロビルリン系と同じ作用点だが化学構造が異なる。うどんこ病・黒星病・灰色かび病など幅広い病害に効果がある。浸透移行性を有し予防・治療効果がある。ベニカXネクストスプレーの殺菌成分として使用。',
    resistanceRisk: 'medium',
  })

  const ingDifenoconazole = await ensureActiveIngredient({
    slug: 'difenoconazole',
    name: 'ジフェノコナゾール',
    nameEn: 'Difenoconazole',
    fracCode: '3',
    ingredientGroup: 'トリアゾール系（DMI殺菌剤）',
    description:
      'FRACコード3（DMI系トリアゾール系）。エルゴステロール生合成を阻害する浸透移行性殺菌剤。幅広い病害（うどんこ病・黒星病・さび病・褐斑病等）に予防・治療効果を持ち、残効性にも優れる。家庭園芸用スプレー製品（カダンプラスDX等）の殺菌成分として使用される。',
    resistanceRisk: 'medium',
  })

  const ingTriforine = await ensureActiveIngredient({
    slug: 'triforine',
    name: 'トリホリン',
    nameEn: 'Triforine',
    fracCode: '3',
    ingredientGroup: 'ピペラジン系（DMI殺菌剤）',
    description:
      'うどんこ病・黒星病・さび病に高い効果を持つ殺菌剤。予防・治療効果がある。バラのうどんこ病・黒星病防除で広く使用される。',
    resistanceRisk: 'medium',
  })

  const ingHSH = await ensureActiveIngredient({
    slug: 'hydrogenated-starch-hydrolysate',
    name: '還元澱粉糖化物',
    nameEn: 'Hydrogenated Starch Hydrolysate',
    ingredientGroup: '物理的防除剤',
    description:
      'でんぷん由来の食品成分。害虫の体表面を覆い気門を塞ぐことによる物理的な殺虫効果と、うどんこ病菌の菌糸を被覆し死滅させる物理的な殺菌効果を持つ。化学的な作用機構ではないため耐性が生じにくい。',
    resistanceRisk: 'low',
  })

  const ingBifenthrin = await ensureActiveIngredient({
    slug: 'bifenthrin',
    name: 'ビフェントリン',
    nameEn: 'Bifenthrin',
    iracCode: '3A',
    ingredientGroup: 'ピレスロイド系',
    description:
      '合成ピレスロイド系殺虫剤。接触毒・食毒の両作用を持ち、速効性に優れる。アブラムシ・ハダニ・ケムシ等幅広い害虫に有効。残効性も比較的長い。',
    resistanceRisk: 'medium',
  })

  const ingPyrethrins = await ensureActiveIngredient({
    slug: 'pyrethrins',
    name: 'ピレトリン',
    nameEn: 'Pyrethrins',
    iracCode: '3A',
    ingredientGroup: '天然ピレスロイド（除虫菊由来）',
    description:
      'IRAC 3A（天然ピレスロイド）。除虫菊（シロバナムシヨケギク Tanacetum cinerariifolium）の花から抽出された天然殺虫成分。ピレトリンI/IIとシネリンI/II等の混合物。神経のナトリウムチャネルに作用し速効的なノックダウン効果を示す。光分解が速く残効性は低いが、そのため環境への蓄積リスクが小さい。有機JAS規格で使用が認められている天然農薬。パイベニカVスプレーの有効成分。',
    resistanceRisk: 'low',
  })

  const ingSorbitan = await ensureActiveIngredient({
    slug: 'sorbitan-fatty-acid-ester',
    name: 'ソルビタン脂肪酸エステル',
    nameEn: 'Sorbitan Fatty Acid Ester',
    ingredientGroup: '物理的防除剤（界面活性剤系）',
    description:
      '食品添加物としても使われる界面活性剤。害虫の体表面のロウ質層を破壊し気門を塞いで窒息させる物理的殺虫作用と、うどんこ病菌の細胞膜を破壊する物理的殺菌作用を持つ。化学的な作用機構ではないため耐性がつかない。',
    resistanceRisk: 'low',
  })

  // 既存の有効成分を取得
  console.log('\n--- 既存有効成分の取得 ---')
  const ingClothianidin = await prisma.activeIngredient.findUnique({ where: { slug: 'clothianidin' } })
  const ingFenpropathrin = await prisma.activeIngredient.findUnique({ where: { slug: 'fenpropathrin' } })
  const ingMyclobutanil = await prisma.activeIngredient.findUnique({ where: { slug: 'myclobutanil' } })
  const ingEmamectin = await prisma.activeIngredient.findUnique({ where: { slug: 'emamectin-benzoate' } })
  const ingThiamethoxam = await prisma.activeIngredient.findUnique({ where: { slug: 'thiamethoxam' } })
  // ピリダベンはベニカXネクストには含まれない（MAFF登録#24117確認済み）。
  // ダニトロン等の別製品で使用されるため成分マスタとしては残す。
  const ingAcephate = await prisma.activeIngredient.findUnique({ where: { slug: 'acephate' } })
  const ingFenitrothion = await prisma.activeIngredient.findUnique({ where: { slug: 'fenitrothion' } })
  const ingPermethrin = await prisma.activeIngredient.findUnique({ where: { slug: 'permethrin' } })

  const requiredIngredients = {
    clothianidin: ingClothianidin,
    fenpropathrin: ingFenpropathrin,
    myclobutanil: ingMyclobutanil,
    'emamectin-benzoate': ingEmamectin,
    thiamethoxam: ingThiamethoxam,
    acephate: ingAcephate,
    fenitrothion: ingFenitrothion,
    permethrin: ingPermethrin,
  }
  for (const [name, ing] of Object.entries(requiredIngredients)) {
    if (!ing) {
      console.error(`❌ 必須有効成分 ${name} が見つかりません。先に seed-pesticide-data.ts を実行してください。`)
      process.exit(1)
    }
  }
  console.log('既存有効成分をすべて確認しました。')

  // ══════════════════════════════════════════════════════════
  //  1. ベニカXファインスプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 1. ベニカXファインスプレー ---')
  const benicaXFine = await ensurePesticide({
    slug: 'benica-x-fine-spray',
    name: 'ベニカXファインスプレー',
    registrationNumber: '22506',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の殺虫殺菌スプレー。クロチアニジン（浸透移行性殺虫）・フェンプロパトリン（接触殺虫）・メパニピリム（殺菌）の3成分を配合。アブラムシ・コナジラミ等の害虫と、うどんこ病・黒星病・灰色かび病等の病害を同時に防除できる。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaXFine.id, ingClothianidin!.id, '0.0080%')
  await linkIngredient(benicaXFine.id, ingFenpropathrin!.id, '0.010%')
  await linkIngredient(benicaXFine.id, ingMepanipyrim.id, '0.020%')
  // 病害への効果
  // メパニピリム（FRAC9）: 灰色かび病が主要対象、うどんこ病にも予防・初期治療効果。黒星病には限定的。
  await linkEffect(benicaXFine.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaXFine.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(benicaXFine.id, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'fair', note: 'メパニピリムの主要ターゲット。予防・治療両効果あり' })
  await linkEffect(benicaXFine.id, 'hanten-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair', note: 'メパニピリムで限定的な効果' })
  // 害虫への効果
  // クロチアニジン（浸透移行性ネオニコチノイド）: 吸汁性害虫に持続的効果
  // フェンプロパトリン（接触性ピレスロイド）: 速効的な接触殺虫
  await linkEffect(benicaXFine.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'クロチアニジンの浸透移行性により、葉裏の害虫にも効果' })
  await linkEffect(benicaXFine.id, 'konajirami', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(benicaXFine.id, 'hadani', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: 'フェンプロパトリンの接触効果のみ。専用殺ダニ剤の併用推奨' })
  await linkEffect(benicaXFine.id, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaXFine.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'フェンプロパトリンの接触・食毒作用' })
  await linkEffect(benicaXFine.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaXFine.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'クロチアニジンの浸透移行性＋フェンプロパトリンの接触効果' })
  await linkEffect(benicaXFine.id, 'yokobai', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'クロチアニジンの浸透移行性で吸汁害虫に効果' })
  await linkEffect(benicaXFine.id, 'chadokuga', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'フェンプロパトリンの接触効果。若齢幼虫に有効' })
  await linkEffect(benicaXFine.id, 'hasumon-yotou', { efficacyLevel: 'good', persistenceLevel: 'fair', note: '若齢幼虫に有効。老齢幼虫には効果が落ちる' })

  // ══════════════════════════════════════════════════════════
  //  2. ベニカXネクストスプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 2. ベニカXネクストスプレー ---')
  const benicaXNext = await ensurePesticide({
    slug: 'benica-x-next-spray',
    name: 'ベニカXネクストスプレー',
    registrationNumber: '24117',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の5成分配合殺虫殺菌スプレー。殺虫成分としてクロチアニジン（浸透移行性ネオニコチノイド）・ピリダリル（新規作用）・ペルメトリン（速効性ピレスロイド）、殺菌成分としてマンデストロビン（QoI系 FRAC11）、物理防除成分として還元澱粉糖化物を配合。幅広い害虫・病害に対応し、抵抗性害虫にも有効。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaXNext.id, ingClothianidin!.id, '0.0080%')
  await linkIngredient(benicaXNext.id, ingPyridalyl.id, '0.010%')
  await linkIngredient(benicaXNext.id, ingPermethrin!.id, '0.010%')
  await linkIngredient(benicaXNext.id, ingMandestrobin.id, '0.020%')
  await linkIngredient(benicaXNext.id, ingHSH.id, '0.60%')
  // 注意: MAFF登録(#24117)の5成分は クロチアニジン・ピリダリル・ペルメトリン・マンデストロビン・還元澱粉糖化物。ピリダベンは含まれない。
  // 病害への効果
  // マンデストロビン（FRAC11 QoI系）: 予防効果が中心。浸透移行性あり、初期治療にも一定の効果。
  await linkEffect(benicaXNext.id, 'udonko-byo', { preventionLevel: 'excellent', treatmentLevel: 'fair', persistenceLevel: 'good', note: 'マンデストロビンのQoI作用（FRAC11）。予防が主体で、進行した病害への治療効果は限定的' })
  await linkEffect(benicaXNext.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  await linkEffect(benicaXNext.id, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(benicaXNext.id, 'tanso-byo', { preventionLevel: 'fair', treatmentLevel: 'poor', persistenceLevel: 'fair', note: 'マンデストロビンで限定的な予防効果' })
  await linkEffect(benicaXNext.id, 'hanten-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  // 害虫への効果
  // クロチアニジン: 浸透移行性、吸汁害虫に持続的効果
  // ピリダリル: 独自の作用機構、チョウ目に特に有効、抵抗性害虫にも効果
  // ペルメトリン: 速効性ピレスロイド、接触・食毒
  // ペルメトリン＋ピリダリル: チョウ目・食害性害虫に接触・食毒
  await linkEffect(benicaXNext.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'excellent', note: 'クロチアニジンの浸透移行性で持続的に防除' })
  await linkEffect(benicaXNext.id, 'hadani', { efficacyLevel: 'fair', persistenceLevel: 'poor', note: '還元澱粉糖化物の物理的効果のみ。専用殺ダニ剤の併用推奨' })
  await linkEffect(benicaXNext.id, 'konajirami', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(benicaXNext.id, 'kemushi-imomushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'ピリダリル＋ペルメトリンの複合作用。抵抗性チョウ目にも有効' })
  await linkEffect(benicaXNext.id, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'ピリダリルがアザミウマ目にも効果を発揮' })
  await linkEffect(benicaXNext.id, 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaXNext.id, 'kabura-habachi', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(benicaXNext.id, 'koganemushi-seichu', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: 'ペルメトリンの接触効果のみ' })
  await linkEffect(benicaXNext.id, 'gunbaimushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'クロチアニジンの浸透移行性＋ペルメトリンの速効性' })
  await linkEffect(benicaXNext.id, 'yokobai', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(benicaXNext.id, 'chadokuga', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'ペルメトリン＋ピリダリルで若齢幼虫に有効' })
  await linkEffect(benicaXNext.id, 'minomushi', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: '巣から出ている幼虫に接触効果。巣内の幼虫には効果が薄い' })
  await linkEffect(benicaXNext.id, 'hasumon-yotou', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'ピリダリルがヨトウムシ類に特に高い効果' })
  await linkEffect(benicaXNext.id, 'nami-hadani', { efficacyLevel: 'fair', persistenceLevel: 'poor', note: '還元澱粉糖化物の物理的効果のみ' })
  await linkEffect(benicaXNext.id, 'kanzawa-hadani', { efficacyLevel: 'fair', persistenceLevel: 'poor', note: '還元澱粉糖化物の物理的効果のみ' })

  // ══════════════════════════════════════════════════════════
  //  3. ベニカグリーンVスプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 3. ベニカグリーンVスプレー ---')
  const benicaGreenV = await ensurePesticide({
    slug: 'benica-green-v-spray',
    name: 'ベニカグリーンVスプレー',
    registrationNumber: '22009',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の殺虫殺菌スプレー。フェンプロパトリン（ピレスロイド系殺虫）とミクロブタニル（EBI系殺菌）を配合。害虫と病気を同時に防除でき、ミクロブタニルの治療効果によりうどんこ病の発生初期にも有効。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaGreenV.id, ingFenpropathrin!.id, '0.010%')
  await linkIngredient(benicaGreenV.id, ingMyclobutanil!.id, '0.0025%')
  // 病害への効果
  // ミクロブタニル（FRAC3 EBI系/DMI系）: エルゴステロール生合成阻害。治療効果が特に高い。
  await linkEffect(benicaGreenV.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'excellent', persistenceLevel: 'good', note: 'ミクロブタニルのEBI作用により治療効果が高い。発症初期の散布で進行を抑制' })
  await linkEffect(benicaGreenV.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(benicaGreenV.id, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(benicaGreenV.id, 'hanten-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair', note: 'ミクロブタニルで限定的な効果' })
  // 害虫への効果
  // フェンプロパトリン: ピレスロイド系、接触・食毒。浸透移行性はない。
  await linkEffect(benicaGreenV.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: '接触効果のみ。葉裏に届きにくい場合がある' })
  await linkEffect(benicaGreenV.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaGreenV.id, 'hadani', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: '接触効果のみ。発生が多い場合は専用殺ダニ剤を推奨' })
  await linkEffect(benicaGreenV.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaGreenV.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaGreenV.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaGreenV.id, 'hasumon-yotou', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: '若齢幼虫に接触効果あり' })

  // ══════════════════════════════════════════════════════════
  //  4. カダンプラスDX
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 4. カダンプラスDX ---')
  const kadanPlusDX = await ensurePesticide({
    slug: 'kadan-plus-dx',
    name: 'カダンプラスDX',
    registrationNumber: '22330',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      'フマキラーの殺虫殺菌スプレー。エマメクチン安息香酸塩（食毒性殺虫）・チアメトキサム（浸透移行性殺虫）・ジフェノコナゾール（トリアゾール系殺菌）の3成分配合。予防効果と治療効果を兼ね備え、病害虫を同時に防除。希釈せずそのまま使用。',
  })
  await linkIngredient(kadanPlusDX.id, ingEmamectin!.id, '0.00050%')
  await linkIngredient(kadanPlusDX.id, ingThiamethoxam!.id, '0.0050%')
  await linkIngredient(kadanPlusDX.id, ingDifenoconazole.id, '0.0050%')
  // 病害への効果
  // ジフェノコナゾール（FRAC3 DMI系）: 予防・治療両効果。浸透移行性あり。
  await linkEffect(kadanPlusDX.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good', note: 'ジフェノコナゾール（DMI系）による予防・治療効果' })
  await linkEffect(kadanPlusDX.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(kadanPlusDX.id, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good', note: 'ジフェノコナゾールはさび病に予防効果が高い' })
  await linkEffect(kadanPlusDX.id, 'haiiro-kabi-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(kadanPlusDX.id, 'tanso-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good', note: 'ジフェノコナゾールで炭疽病にも予防効果' })
  await linkEffect(kadanPlusDX.id, 'hanten-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  // 害虫への効果
  // チアメトキサム: ネオニコチノイド系、浸透移行性
  // エマメクチン安息香酸塩: マクロライド系、食毒（特にチョウ目）
  await linkEffect(kadanPlusDX.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'excellent', note: 'チアメトキサムの浸透移行性で持続的に効果を発揮' })
  await linkEffect(kadanPlusDX.id, 'konajirami', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(kadanPlusDX.id, 'kemushi-imomushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'エマメクチン安息香酸塩の食毒効果がチョウ目に特に有効' })
  await linkEffect(kadanPlusDX.id, 'hadani', { efficacyLevel: 'fair', persistenceLevel: 'poor', note: 'エマメクチンの食毒作用でハダニに若干の効果があるが限定的。専用殺ダニ剤の併用推奨' })
  await linkEffect(kadanPlusDX.id, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(kadanPlusDX.id, 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'エマメクチンの食毒効果' })
  await linkEffect(kadanPlusDX.id, 'yokobai', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'チアメトキサムの浸透移行性で吸汁害虫に効果' })
  await linkEffect(kadanPlusDX.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(kadanPlusDX.id, 'hasumon-yotou', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'エマメクチンの食毒効果。若齢幼虫に有効' })

  // ══════════════════════════════════════════════════════════
  //  5. GFオルトランCスプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 5. GFオルトランCスプレー ---')
  const ortranC = await ensurePesticide({
    slug: 'gf-ortran-c-spray',
    name: 'GFオルトランCスプレー',
    registrationNumber: '21811',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の殺虫殺菌スプレー。アセフェート（浸透移行性有機リン系）・MEP（フェニトロチオン、接触性有機リン系）・トリホリン（ピペラジン系殺菌）の3成分配合。幅広い害虫に速効性と持続性を発揮し、うどんこ病・黒星病等の病気にも効果がある。希釈せずそのまま使用。',
  })
  await linkIngredient(ortranC.id, ingAcephate!.id, '0.19%')
  await linkIngredient(ortranC.id, ingFenitrothion!.id, '0.17%')
  await linkIngredient(ortranC.id, ingTriforine.id, '0.15%')
  // 病害への効果
  // トリホリン（FRAC3 DMI系）: うどんこ病・黒星病・さび病に予防・治療効果。
  await linkEffect(ortranC.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good', note: 'トリホリン（DMI系）による予防・治療効果' })
  await linkEffect(ortranC.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(ortranC.id, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair', note: 'トリホリンはさび病にも予防効果がある' })
  // 害虫への効果
  // アセフェート: 有機リン系、浸透移行性。吸汁害虫に持続的効果。
  // MEP（フェニトロチオン）: 有機リン系、接触毒・食毒。速効性。
  await linkEffect(ortranC.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'excellent', note: 'アセフェートの浸透移行性で長期間防除' })
  await linkEffect(ortranC.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'アセフェート＋MEPの複合作用' })
  await linkEffect(ortranC.id, 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(ortranC.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(ortranC.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(ortranC.id, 'kaigaramushi', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: '若齢幼虫には効果あり。成虫の殻は貫通しにくい' })
  await linkEffect(ortranC.id, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'アセフェートの浸透移行性で効果' })
  await linkEffect(ortranC.id, 'yokobai', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'アセフェートの浸透移行性で吸汁害虫に特に有効' })
  await linkEffect(ortranC.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'good' })

  // ══════════════════════════════════════════════════════════
  //  6. ベニカスプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 6. ベニカスプレー ---')
  const benicaSpray = await ensurePesticide({
    slug: 'benica-spray',
    name: 'ベニカスプレー',
    registrationNumber: null,
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸のピレスロイド系殺虫スプレー。ペルメトリン配合で幅広い害虫に速効性がある。アブラムシ・ケムシ・ハバチ等に有効。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaSpray.id, ingPermethrin!.id, '0.020%')
  // ペルメトリン: ピレスロイド系、接触毒・食毒。速効性あるが持続性は低い。浸透移行性なし。
  await linkEffect(benicaSpray.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: '接触効果のみ。葉裏まで十分に散布が必要' })
  await linkEffect(benicaSpray.id, 'kemushi-imomushi', { efficacyLevel: 'excellent', persistenceLevel: 'fair', note: 'ピレスロイド系の速効性で即効的に駆除' })
  await linkEffect(benicaSpray.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaSpray.id, 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaSpray.id, 'azamiuma', { efficacyLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(benicaSpray.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaSpray.id, 'yokobai', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: '接触効果のみ。浸透移行性がないため持続効果は低い' })

  // ══════════════════════════════════════════════════════════
  //  7. マイローズ殺菌スプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 7. マイローズ殺菌スプレー ---')
  const myRose = await ensurePesticide({
    slug: 'my-rose-fungicide-spray',
    name: 'マイローズ殺菌スプレー',
    registrationNumber: null,
    pesticideType: 'fungicide',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸のバラ向け殺菌スプレー。ミクロブタニル（EBI系）配合で、うどんこ病・黒星病に対して予防・治療効果を発揮する。発症後の散布でも進行を止める治療効果があるのが特長。希釈せずそのまま使用。',
  })
  await linkIngredient(myRose.id, ingMyclobutanil!.id, '0.025%')
  // ミクロブタニル（FRAC3 EBI系）: 治療効果が特に高い。
  await linkEffect(myRose.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'excellent', persistenceLevel: 'good', note: 'ミクロブタニルのEBI作用。発症後でも菌の進展を抑制' })
  await linkEffect(myRose.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(myRose.id, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(myRose.id, 'hanten-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair', note: 'ミクロブタニルで限定的な効果' })

  // ══════════════════════════════════════════════════════════
  //  8. ベニカマイルドスプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 8. ベニカマイルドスプレー ---')
  const benicaMild = await ensurePesticide({
    slug: 'benica-mild-spray',
    name: 'ベニカマイルドスプレー',
    registrationNumber: '22160',
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の物理防除スプレー。有効成分の還元澱粉糖化物（食品由来成分）が害虫の体表を覆い窒息させ、うどんこ病菌の菌糸を被覆して死滅させる。化学殺虫成分を使用しないため、収穫前日まで使用可能。有機JAS規格適合。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaMild.id, ingHSH.id, '0.60%')
  // 物理的防除: 害虫の体表被覆→窒息、菌糸の被覆→死滅。残効性なし。
  await linkEffect(benicaMild.id, 'udonko-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'poor', note: '物理的に菌糸を被覆・死滅させる。持続効果は短く、繰り返し散布が必要' })
  await linkEffect(benicaMild.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '直接かかった害虫に効果。残効性なし、定期散布が必要' })
  await linkEffect(benicaMild.id, 'hadani', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '物理的に気門を塞いで窒息させる' })
  await linkEffect(benicaMild.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(benicaMild.id, 'nami-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '直接かかった個体に物理的効果' })
  await linkEffect(benicaMild.id, 'kanzawa-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })

  // ══════════════════════════════════════════════════════════
  //  9. ベニカベジフルスプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 9. ベニカベジフルスプレー ---')
  const benicaVegiFru = await ensurePesticide({
    slug: 'benica-vegifru-spray',
    name: 'ベニカベジフルスプレー',
    registrationNumber: null,
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の野菜・果樹向け殺虫殺菌スプレー。クロチアニジン（浸透移行性殺虫）とマンデストロビン（QoI系殺菌 FRAC11）の2成分配合。浸透移行性により葉裏の害虫にも効果を発揮し、病気の予防・治療にも対応。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaVegiFru.id, ingClothianidin!.id, '0.0080%')
  await linkIngredient(benicaVegiFru.id, ingMandestrobin.id, '0.020%')
  // 病害への効果（マンデストロビン FRAC11 QoI系）
  await linkEffect(benicaVegiFru.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good', note: 'マンデストロビンのQoI作用（FRAC11）。予防効果が主体' })
  await linkEffect(benicaVegiFru.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  await linkEffect(benicaVegiFru.id, 'haiiro-kabi-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  // 害虫への効果（クロチアニジン 浸透移行性ネオニコチノイド）
  await linkEffect(benicaVegiFru.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'クロチアニジンの浸透移行性で葉裏の害虫にも効果' })
  await linkEffect(benicaVegiFru.id, 'konajirami', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(benicaVegiFru.id, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaVegiFru.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaVegiFru.id, 'yokobai', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'クロチアニジンの浸透移行性で吸汁害虫に効果' })
  await linkEffect(benicaVegiFru.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })

  // ══════════════════════════════════════════════════════════
  //  10. ベニカJスプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 10. ベニカJスプレー ---')
  const benicaJ = await ensurePesticide({
    slug: 'benica-j-spray',
    name: 'ベニカJスプレー',
    registrationNumber: null,
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の浸透移行性殺虫スプレー。クロチアニジン（ネオニコチノイド系）配合で、直接散布が届きにくい葉裏の害虫にも浸透移行により効果を発揮する。アブラムシ・コナジラミ・アザミウマ等の吸汁性害虫に有効。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaJ.id, ingClothianidin!.id, '0.0080%')
  // クロチアニジン単剤: 浸透移行性で吸汁害虫に特に有効
  await linkEffect(benicaJ.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: '浸透移行性で葉裏の害虫にも効果が持続' })
  await linkEffect(benicaJ.id, 'konajirami', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(benicaJ.id, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(benicaJ.id, 'kemushi-imomushi', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: 'チョウ目への効果は限定的' })
  await linkEffect(benicaJ.id, 'kaigaramushi', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: '若齢幼虫には効果あり' })
  await linkEffect(benicaJ.id, 'yokobai', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: '浸透移行性で吸汁害虫に特に有効' })
  await linkEffect(benicaJ.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'good' })

  // ══════════════════════════════════════════════════════════
  //  11. ベニカXスプレー（新規追加）
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 11. ベニカXスプレー ---')
  const benicaX = await ensurePesticide({
    slug: 'benica-x-spray',
    name: 'ベニカXスプレー',
    registrationNumber: null,
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の殺虫殺菌スプレー。ペルメトリン（ピレスロイド系殺虫）とミクロブタニル（EBI系殺菌）を配合。害虫の速効駆除と病気の予防・治療を同時に行える。ベニカXファインスプレーの前身モデルで、シンプルな2成分構成。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaX.id, ingPermethrin!.id, '0.020%')
  await linkIngredient(benicaX.id, ingMyclobutanil!.id, '0.0080%')
  // 病害への効果（ミクロブタニル FRAC3 EBI系）
  await linkEffect(benicaX.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'excellent', persistenceLevel: 'good', note: 'ミクロブタニルのEBI作用で治療効果が高い' })
  await linkEffect(benicaX.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(benicaX.id, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(benicaX.id, 'hanten-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  // 害虫への効果（ペルメトリン ピレスロイド系 接触・食毒）
  await linkEffect(benicaX.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: '接触効果のみ。浸透移行性はない' })
  await linkEffect(benicaX.id, 'kemushi-imomushi', { efficacyLevel: 'excellent', persistenceLevel: 'fair', note: 'ピレスロイド系の速効性' })
  await linkEffect(benicaX.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaX.id, 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaX.id, 'azamiuma', { efficacyLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(benicaX.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })

  // ══════════════════════════════════════════════════════════
  //  12. カダンセーフ（新規追加）
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 12. カダンセーフ ---')
  const kadanSafe = await ensurePesticide({
    slug: 'kadan-safe',
    name: 'カダンセーフ',
    registrationNumber: '20924',
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description:
      'フマキラーの物理防除スプレー。有効成分のソルビタン脂肪酸エステル（食品添加物由来）が害虫の気門を塞ぎ窒息させる殺虫効果と、うどんこ病菌の細胞膜を破壊する殺菌効果を発揮する。化学殺虫成分を使用しないため耐性がつかず、有機JAS規格適合。希釈せずそのまま使用。',
  })
  await linkIngredient(kadanSafe.id, ingSorbitan.id, '0.14%')
  // 物理的防除: 残効性なし。繰り返し散布が基本。
  await linkEffect(kadanSafe.id, 'udonko-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'poor', note: '物理的に菌の細胞膜を破壊。持続効果は短く繰り返し散布が必要' })
  await linkEffect(kadanSafe.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '直接かかった害虫に効果。残効性なし' })
  await linkEffect(kadanSafe.id, 'hadani', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '気門を塞いで窒息させる物理的効果' })
  await linkEffect(kadanSafe.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(kadanSafe.id, 'nami-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(kadanSafe.id, 'kanzawa-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })

  // ══════════════════════════════════════════════════════════
  //  13. アタックワンAL（新規追加）
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 13. アタックワンAL ---')
  const attackOneAL = await ensurePesticide({
    slug: 'attack-one-al',
    name: 'アタックワンAL',
    registrationNumber: null,
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸のバラ向け殺虫殺菌スプレー。ビフェントリン（ピレスロイド系殺虫・殺ダニ）とミクロブタニル（EBI系殺菌）を配合。ビフェントリンはハダニにも効果があるため、バラの3大トラブル（害虫・ハダニ・病気）に1本で対応可能。希釈せずそのまま使用。',
  })
  await linkIngredient(attackOneAL.id, ingBifenthrin.id, '0.0020%')
  await linkIngredient(attackOneAL.id, ingMyclobutanil!.id, '0.0080%')
  // 病害への効果（ミクロブタニル FRAC3 EBI系）
  await linkEffect(attackOneAL.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'excellent', persistenceLevel: 'good', note: 'ミクロブタニルのEBI作用で治療効果が高い' })
  await linkEffect(attackOneAL.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(attackOneAL.id, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(attackOneAL.id, 'hanten-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  // 害虫への効果（ビフェントリン ピレスロイド系 接触・食毒、ハダニにも有効）
  await linkEffect(attackOneAL.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'ビフェントリンの残効性は比較的長い' })
  await linkEffect(attackOneAL.id, 'hadani', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'ビフェントリンはハダニにも効果がある合成ピレスロイド' })
  await linkEffect(attackOneAL.id, 'nami-hadani', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(attackOneAL.id, 'kanzawa-hadani', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(attackOneAL.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(attackOneAL.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(attackOneAL.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(attackOneAL.id, 'chadokuga', { efficacyLevel: 'good', persistenceLevel: 'fair', note: '若齢幼虫に接触効果' })

  // ══════════════════════════════════════════════════════════
  //  14. パイベニカVスプレー（新規追加）
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 14. パイベニカVスプレー ---')
  const pyBenicaV = await ensurePesticide({
    slug: 'py-benica-v-spray',
    name: 'パイベニカVスプレー',
    registrationNumber: '23109',
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の天然成分殺虫スプレー。除虫菊由来の天然ピレトリン配合。速効性に優れ、アブラムシ・ケムシ・ハダニ等に幅広く効果を発揮する。天然成分のため光分解が速く、残留性が低い。有機JAS規格適合。希釈せずそのまま使用。',
  })
  await linkIngredient(pyBenicaV.id, ingPyrethrins.id, '0.0060%')
  // ピレトリン: 天然ピレスロイド、速効性だが光分解が速い。残効性低い。
  await linkEffect(pyBenicaV.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '速効性はあるが光分解で残効性が低い。繰り返し散布が必要' })
  await linkEffect(pyBenicaV.id, 'hadani', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '天然ピレトリンはハダニにも接触効果あり' })
  await linkEffect(pyBenicaV.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(pyBenicaV.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(pyBenicaV.id, 'azamiuma', { efficacyLevel: 'fair', persistenceLevel: 'poor' })
  await linkEffect(pyBenicaV.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(pyBenicaV.id, 'nami-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(pyBenicaV.id, 'kanzawa-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })

  // ══════════════════════════════════════════════════════════
  //  15. ベニカナチュラルスプレー（新規追加）
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 15. ベニカナチュラルスプレー ---')
  const benicaNatural = await ensurePesticide({
    slug: 'benica-natural-spray',
    name: 'ベニカナチュラルスプレー',
    registrationNumber: null,
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の天然由来物理防除スプレー。有効成分の還元澱粉糖化物が害虫・ハダニの気門を塞ぎ窒息させ、うどんこ病菌を被覆して死滅させる。化学農薬成分を使わないため、野菜・果樹にも収穫前日まで使用可能。有機JAS規格適合。ベニカマイルドスプレーの後継品。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaNatural.id, ingHSH.id, '5.0%')
  // 物理的防除: ベニカマイルドスプレーと同様の作用機構
  await linkEffect(benicaNatural.id, 'udonko-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'poor', note: '物理的に菌糸を被覆。繰り返し散布が必要' })
  await linkEffect(benicaNatural.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '直接かかった害虫に効果。残効性なし' })
  await linkEffect(benicaNatural.id, 'hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(benicaNatural.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(benicaNatural.id, 'nami-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(benicaNatural.id, 'kanzawa-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })

  // ══════════════════════════════════════════════════════════
  //  16. サンヨール液剤AL（効果データ補足）
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 16. サンヨール液剤AL 効果データ補足 ---')

  const ingDBEDC = await ensureActiveIngredient({
    slug: 'dbedc',
    name: 'DBEDC（有機銅系）',
    nameEn: 'Dodecylbenzenesulfonic acid bis(ethylenediamine) copper complex (II)',
    fracCode: 'M01',
    ingredientGroup: '有機銅系（多作用点接触活性）',
    description:
      'ドデシルベンゼンスルホン酸ビスエチレンジアミン銅錯塩(II)。銅イオンによる殺菌作用と界面活性剤としての殺虫作用を併せ持つ。多作用点で耐性がつきにくい。うどんこ病・べと病等の殺菌効果と、アブラムシ・ハダニ・コナジラミ等への殺虫効果がある。',
    resistanceRisk: 'low',
  })

  const sanyol = await prisma.pesticide.findUnique({ where: { slug: 'sanyouru-ekizai-al' } })
  if (sanyol) {
    await linkIngredient(sanyol.id, ingDBEDC.id, '0.040%')
    // 病害への効果（銅イオンによる殺菌 — 保護殺菌が主体、浸透移行性なし）
    await linkEffect(sanyol.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'fair', note: '銅系保護殺菌作用。予防散布が基本' })
    await linkEffect(sanyol.id, 'beto-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'fair' })
    await linkEffect(sanyol.id, 'kappan-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'fair' })
    await linkEffect(sanyol.id, 'kuroboshi-byo', { preventionLevel: 'fair', treatmentLevel: 'none', persistenceLevel: 'fair' })
    await linkEffect(sanyol.id, 'haiiro-kabi-byo', { preventionLevel: 'fair', treatmentLevel: 'none', persistenceLevel: 'fair' })
    await linkEffect(sanyol.id, 'tanso-byo', { preventionLevel: 'fair', treatmentLevel: 'none', persistenceLevel: 'fair' })
    // 害虫への効果（界面活性剤作用 — 接触のみ、残効性低い）
    await linkEffect(sanyol.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '界面活性剤の接触効果。残効性なし' })
    await linkEffect(sanyol.id, 'hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })
    await linkEffect(sanyol.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'poor' })
    await linkEffect(sanyol.id, 'onshitsu-konajirami', { efficacyLevel: 'good', persistenceLevel: 'poor' })
    console.log('  サンヨール液剤AL 効果データ追加完了')
  } else {
    console.warn('  ⚠ sanyouru-ekizai-al が見つかりません。seed-pesticide-additions.ts を先に実行してください。')
  }

  // ══════════════════════════════════════════════════════════
  //  完了
  // ══════════════════════════════════════════════════════════
  console.log('\n=== スプレータイプ薬剤の追加が完了しました ===')
  console.log('追加した製品:')
  console.log('  複合剤(compound): ベニカXファインスプレー, ベニカXネクストスプレー, ベニカグリーンVスプレー,')
  console.log('                    カダンプラスDX, GFオルトランCスプレー, ベニカマイルドスプレー,')
  console.log('                    ベニカベジフルスプレー, ベニカXスプレー, カダンセーフ,')
  console.log('                    アタックワンAL, ベニカナチュラルスプレー, サンヨール液剤AL')
  console.log('  殺虫剤(insecticide): ベニカスプレー, ベニカJスプレー, パイベニカVスプレー')
  console.log('  殺菌剤(fungicide): マイローズ殺菌スプレー')
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
