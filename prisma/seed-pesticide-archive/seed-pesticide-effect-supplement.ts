/* eslint-disable no-console */
/**
 * 効果データが不足している農薬製品に、追加の病害虫効果紐付けを行うスクリプト。
 * 既存データは削除せず、未登録の効果のみ追加する（冪等）。
 *
 * 対象: 効果紐付けが5件以下の農薬製品（展着剤・ナメクジ専用剤を除く）
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-effect-supplement.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

type ER = 'excellent' | 'good' | 'fair' | 'poor' | 'none'

async function link(
  pesticideSlug: string,
  dpSlug: string,
  effect: { preventionLevel?: ER; treatmentLevel?: ER; efficacyLevel?: ER; persistenceLevel?: ER; note?: string },
) {
  const p = await prisma.pesticide.findUnique({ where: { slug: pesticideSlug } })
  if (!p) { console.warn(`  ⚠ 農薬 ${pesticideSlug} が見つかりません`); return }
  const dp = await prisma.diseasePest.findUnique({ where: { slug: dpSlug } })
  if (!dp) { console.warn(`  ⚠ 病害虫 ${dpSlug} が見つかりません`); return }
  const existing = await prisma.pesticideEffect.findUnique({
    where: { pesticideId_diseasePestId: { pesticideId: p.id, diseasePestId: dp.id } },
  })
  if (!existing) {
    await prisma.pesticideEffect.create({
      data: {
        pesticideId: p.id,
        diseasePestId: dp.id,
        preventionLevel: effect.preventionLevel ?? null,
        treatmentLevel: effect.treatmentLevel ?? null,
        efficacyLevel: effect.efficacyLevel ?? null,
        persistenceLevel: effect.persistenceLevel ?? null,
        note: effect.note ?? null,
      },
    })
    console.log(`  + ${pesticideSlug} → ${dp.name}`)
  }
}

async function main() {
  console.log('=== 効果データ補足を開始します ===\n')

  // ──────────────────────────────────────────────────────
  //  殺菌剤の効果補足
  // ──────────────────────────────────────────────────────

  // サンヨーエムペンス水和剤 (rally-wp) : ミクロブタニル（FRAC3 EBI系）
  // 現状4件 → うどんこ病、さび病、赤星病、輪紋病
  // ミクロブタニルはEBI系で黒星病・斑点病にも効果あり
  console.log('--- rally-wp (ミクロブタニル) ---')
  await link('rally-wp', 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good', note: 'EBI系殺菌剤。予防・治療効果あり' })
  await link('rally-wp', 'hanten-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await link('rally-wp', 'tanso-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })

  // サプロール乳剤 (saprol-ec) : トリホリン（FRAC3 DMI系ピペラジン系）
  // 現状3件 → うどんこ病、さび病、赤星病
  // DMI系なので黒星病・炭疽病にも効果
  console.log('--- saprol-ec (トリホリン) ---')
  await link('saprol-ec', 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good', note: 'EBI系殺菌剤。予防・治療効果あり' })
  await link('saprol-ec', 'tanso-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await link('saprol-ec', 'hanten-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })

  // トリフミン水和剤 (trifumin-wp) : トリフルミゾール（FRAC3 EBI系）
  // 現状4件 → 同じくEBI系の追加
  console.log('--- trifumin-wp (トリフルミゾール) ---')
  await link('trifumin-wp', 'hanten-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  await link('trifumin-wp', 'akaboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await link('trifumin-wp', 'rinmon-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })

  // トリフミンフロアブル (trifumin-fl) : トリフルミゾール（FRAC3 EBI系）
  console.log('--- trifumin-fl (トリフルミゾール) ---')
  await link('trifumin-fl', 'hanten-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  await link('trifumin-fl', 'akaboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await link('trifumin-fl', 'rinmon-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })

  // シフルフェナミド水和剤 (cyflufenamid-wp) : シフルフェナミド（FRAC U06）
  // 現状2件 → うどんこ病、もち病。うどんこ病の専門薬。
  console.log('--- cyflufenamid-wp (シフルフェナミド) ---')
  // シフルフェナミドはうどんこ病に特化した薬剤。追加できる対象は限定的。
  // 一部のさび病にも補助的効果がある場合があるが、主要ターゲットはうどんこ病のみ。
  // 追加は不要（うどんこ病専門薬のため）。

  // フジワン水和剤 (fujione-wp) : イソプロチオラン（FRAC6）
  // 現状2件 → 紋枯病、白絹病。主に稲の病害向け。
  console.log('--- fujione-wp (イソプロチオラン) ---')
  await link('fujione-wp', 'tachigare-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good', note: 'イソプロチオランの浸透移行性' })

  // フジワンフロアブル (fujione-fl) : イソプロチオラン
  console.log('--- fujione-fl (イソプロチオラン) ---')
  await link('fujione-fl', 'tachigare-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })

  // ストロビーフロアブル/粉剤/顆粒 (strobi-fl/dp/wdg) : クレソキシムメチル（FRAC11 QoI系）
  // 現状2件ずつ → うどんこ病、黒星病。QoI系はさび病・炭疽病にも効果。
  console.log('--- strobi (クレソキシムメチル) ---')
  // REMOVED(fictional): strobi-fl/dp/wdg は架空製品のためスキップ
  // for (const slug of ['strobi-fl', 'strobi-dp', 'strobi-wdg']) {
  //   await link(slug, 'sabi-byo', { ... })
  //   await link(slug, 'tanso-byo', { ... })
  //   await link(slug, 'haiiro-kabi-byo', { ... })
  //   await link(slug, 'hanten-byo', { ... })
  // }

  // ボスカイドフロアブル (bosca-fl) : ボスカリド（FRAC7 SDHI系）
  // 現状2件 → 灰色かび病、うどんこ病
  console.log('--- bosca-fl (ボスカリド) ---')
  // REMOVED(fictional):   await link('bosca-fl', 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good', note: 'SDHI系殺菌剤。予防効果が主体' })
  // REMOVED(fictional):   await link('bosca-fl', 'tanso-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })

  // テブフロアブル (tebu-fl/tebu-fl2) : テブコナゾール（FRAC3 DMI系）
  // 現状3-4件 → DMI系で幅広い糸状菌病害に効果
  // tebu-fl/fl2 は架空製品のためスキップ
  // console.log('--- tebu-fl/fl2 (テブコナゾール) ---')
  // for (const slug of ['tebu-fl', 'tebu-fl2']) {
  //   await link(slug, 'tanso-byo', { ... })
  //   ...
  // }

  // ラリーフロアブル/乳剤/顆粒 (rally-fl/ec/wdg) : ミクロブタニル（FRAC3 EBI系）
  // 現状3件ずつ → うどんこ病、さび病、赤星病。黒星病・輪紋病追加。
  // rally-fl/ec/wdg は架空製品のためスキップ
  // console.log('--- rally (ミクロブタニル) ---')
  // for (const slug of ['rally-fl', 'rally-ec', 'rally-wdg']) { ... }

  // ベルクート水和剤/フロアブル (belkut-wp/fl) : イミノクタジンアルベシル酸塩（FRAC M7 多作用点）
  // 現状4件ずつ → 炭疽病、斑点病、胴枯病、灰色かび病。多作用点なので幅広い。
  console.log('--- belkut (イミノクタジンアルベシル酸塩) ---')
  for (const slug of ['belkut-wp', 'belkut-fl']) {
    await link(slug, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good', note: '多作用点殺菌剤。耐性がつきにくい' })
    await link(slug, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
    await link(slug, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
    await link(slug, 'rinmon-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  }

  // ゲッター水和剤/フロアブル (getter-wp/fl) : チオファネートメチル+キャプタン
  // 現状4件 → 炭疽病、斑点病、胴枯病、灰色かび病
  // getter-wp/fl は架空製品のためスキップ
  // console.log('--- getter (チオファネートメチル+キャプタン) ---')
  // for (const slug of ['getter-wp', 'getter-fl']) { ... }

  // ポリオキシン (polyoxin-al/wp) : ポリオキシン（FRAC19）
  // 現状4件 → うどんこ病、灰色かび病、黒星病、紋枯病
  console.log('--- polyoxin (ポリオキシン) ---')
  for (const slug of ['polyoxin-al', 'polyoxin-wp']) {
    await link(slug, 'tanso-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair', note: 'キチン生合成阻害による殺菌作用' })
    await link(slug, 'sabi-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })
    await link(slug, 'hanten-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  }

  // ベンレート水和剤/DF (benlate-wp/df) : ベノミル（FRAC1 ベンゾイミダゾール系）
  // 現状5件 → 幅広い糸状菌に効果
  console.log('--- benlate (ベノミル) ---')
  for (const slug of ['benlate-wp', 'benlate-df']) {
    await link(slug, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good', note: 'ベンゾイミダゾール系。浸透移行性あり' })
    await link(slug, 'hanten-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
    await link(slug, 'rinmon-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  }

  // オーソサイド水和剤 / キャプタン顆粒 (orthocide-wp/captan-wdg) : キャプタン（FRAC M4 多作用点）
  // 現状5件 → 保護殺菌剤、幅広い
  console.log('--- orthocide/captan (キャプタン) ---')
  for (const slug of ['orthocide-wp', 'captan-wdg']) {
    await link(slug, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'good', note: '保護殺菌剤。予防散布が基本' })
    await link(slug, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'good' })
    await link(slug, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'good' })
  }

  // カスミンボルドー / サンケイ銅 / サンヨール銅 (kasumin-bordeaux/sankei-copper-fl/sanyo-copper-wp/sankei-maneb-wp)
  // 銅系殺菌剤 → 細菌性病害にも対応
  console.log('--- kasumin-bordeaux / copper系 補足 ---')
  for (const slug of ['kasumin-bordeaux', 'sankei-copper-fl', 'sanyo-copper-wp', 'sankei-maneb-wp']) {
    await link(slug, 'udonko-byo', { preventionLevel: 'fair', treatmentLevel: 'none', persistenceLevel: 'good', note: '銅系保護殺菌剤。予防散布が基本' })
    await link(slug, 'haiiro-kabi-byo', { preventionLevel: 'fair', treatmentLevel: 'none', persistenceLevel: 'good' })
    await link(slug, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'good' })
    await link(slug, 'kuroboshi-byo', { preventionLevel: 'fair', treatmentLevel: 'none', persistenceLevel: 'good' })
  }

  // フロンサイド (fronside-sc/dp/wp) : フルアジナム（FRAC29）
  // 現状3件 → 疫病、べと病、菌核病。もっと幅広い。
  console.log('--- fronside (フルアジナム) ---')
  for (const slug of ['fronside-sc', 'fronside-dp', 'fronside-wp']) {
    await link(slug, 'shirakinu-byo', { preventionLevel: 'excellent', treatmentLevel: 'none', persistenceLevel: 'excellent', note: 'フルアジナムは白絹病に特に高い効果' })
    await link(slug, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'good' })
    await link(slug, 'tanso-byo', { preventionLevel: 'good', treatmentLevel: 'none', persistenceLevel: 'good' })
  }

  // アミスター (amistar-20-fl/10-fl/wdg) : アゾキシストロビン（FRAC11 QoI系）
  // 幅広い。少ないものに追加。
  console.log('--- amistar 10/wdg 補足 (アゾキシストロビン) ---')
  for (const slug of ['amistar-10-fl', 'amistar-wdg']) {
    await link(slug, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good', note: 'QoI系殺菌剤' })
    await link(slug, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
    await link(slug, 'hanten-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
    await link(slug, 'rinmon-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  }

  // ファンタジスタ水和剤 (fantasia-wp) : ピリベンカルブ（FRAC11 QoI系）
  console.log('--- fantasia-wp (ピリベンカルブ) ---')
  await link('fantasia-wp', 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  await link('fantasia-wp', 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  await link('fantasia-wp', 'hanten-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })

  // ──────────────────────────────────────────────────────
  //  殺虫剤の効果補足
  // ──────────────────────────────────────────────────────

  // マッチ乳剤 (match-ec) : ルフェヌロン（IRAC15 ベンゾイルウレア系IGR）
  // 現状1件 → ケムシのみ。IGR系はチョウ目全般に脱皮阻害効果。
  console.log('--- match-ec (ルフェヌロン) ---')
  await link('match-ec', 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'excellent', note: 'IGR系脱皮阻害剤。幼虫の脱皮を阻害して死亡させる。持続性高い' })
  await link('match-ec', 'hasumon-yotou', { efficacyLevel: 'good', persistenceLevel: 'excellent' })
  await link('match-ec', 'shinkuimushi', { efficacyLevel: 'good', persistenceLevel: 'excellent' })
  await link('match-ec', 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await link('match-ec', 'monshirochou-youchu', { efficacyLevel: 'good', persistenceLevel: 'excellent' })

  // カスケード乳剤 (cascade-ec) : フルフェノクスロン（IRAC15 ベンゾイルウレア系IGR）
  // 現状1件 → ハマキムシのみ。同じくIGR系。
  console.log('--- cascade-ec (フルフェノクスロン) ---')
  await link('cascade-ec', 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'excellent', note: 'IGR系脱皮阻害剤。若齢幼虫に特に有効' })
  await link('cascade-ec', 'hasumon-yotou', { efficacyLevel: 'good', persistenceLevel: 'excellent' })
  await link('cascade-ec', 'shinkuimushi', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await link('cascade-ec', 'hadani', { efficacyLevel: 'fair', persistenceLevel: 'good', note: 'ハダニの卵・幼虫に効果。成虫には効きにくい' })

  // アポロ水和剤 (apollo-wp) : クロフェンテジン（IRAC10A 殺ダニ剤）
  // 現状1件 → ハダニのみ。殺ダニ専門だが種別追加。
  console.log('--- apollo-wp (クロフェンテジン) ---')
  // REMOVED(fictional):   await link('apollo-wp', 'nami-hadani', { efficacyLevel: 'good', persistenceLevel: 'excellent', note: '卵・若齢幼虫に特に効果が高い殺ダニ剤' })
  // REMOVED(fictional):   await link('apollo-wp', 'kanzawa-hadani', { efficacyLevel: 'good', persistenceLevel: 'excellent' })

  // コルト顆粒剤/水和剤 (colt-gr/wp) : ピリフルキナゾン（IRAC9B キナゾリン系）
  // 現状1-3件 → 吸汁害虫に広く効果
  console.log('--- colt (ピリフルキナゾン) ---')
  for (const slug of ['colt-gr', 'colt-wp']) {
    await link(slug, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: '吸汁阻害作用。吸汁害虫専門' })
    await link(slug, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'good' })
    await link(slug, 'yokobai', { efficacyLevel: 'good', persistenceLevel: 'good' })
    await link(slug, 'azamiuma', { efficacyLevel: 'fair', persistenceLevel: 'fair' })
  }

  // ピシロック乳剤 (ranou-ec) : ピリプロキシフェン（IRAC7C IGR系）
  // 現状2件 → コナジラミ、カイガラムシ。IGR系で幼虫に効果。
  console.log('--- ranou-ec (ピリプロキシフェン) ---')
  await link('ranou-ec', 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'IGR系。幼虫の変態を阻害' })
  await link('ranou-ec', 'konakaigaramushi', { efficacyLevel: 'good', persistenceLevel: 'good' })

  // ダニゲッターフロアブル (danigetter-fl) : スピロメシフェン（IRAC23）30.0%
  // 現状2件 → ハダニ、コナジラミ。殺ダニ剤。バイエルクロップサイエンス製 MAFF#22094
  console.log('--- danigetter-fl (シフルメトフェン+フロニカミド) ---')
  await link('danigetter-fl', 'nami-hadani', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await link('danigetter-fl', 'kanzawa-hadani', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await link('danigetter-fl', 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'フロニカミド成分の吸汁阻害効果' })
  await link('danigetter-fl', 'azamiuma', { efficacyLevel: 'fair', persistenceLevel: 'fair' })

  // ウララDF/顆粒/フロアブル (urara-df/gr/fl/wdg) : フロニカミド（IRAC29）
  // 現状3-5件 → 吸汁害虫全般に追加
  // urara-df/gr/fl/wdg は架空製品を含むためスキップ
  // console.log('--- urara (フロニカミド) ---')
  // for (const slug of ['urara-df', 'urara-gr', 'urara-fl', 'urara-wdg']) { ... }

  // アクタラ顆粒/フロアブル (actara-wdg/fl) : チアメトキサム（IRAC4A ネオニコチノイド系）
  // 現状4件 → 浸透移行性で幅広い
  // actara-wdg/fl は架空製品を含むためスキップ
  // console.log('--- actara (チアメトキサム) ---')
  // for (const slug of ['actara-wdg', 'actara-fl']) { ... }

  // モベントフロアブル (movento-fl) : スピロテトラマト（IRAC23 脂質合成阻害）
  // 現状4件 → 浸透移行性で吸汁害虫に効果
  console.log('--- movento-fl (スピロテトラマト) ---')
  await link('movento-fl', 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'excellent', note: '双方向浸透移行性で葉裏・根部の害虫にも効果' })
  await link('movento-fl', 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await link('movento-fl', 'yokobai', { efficacyLevel: 'good', persistenceLevel: 'good' })

  // ミルベノック (milbenock-ec/fl/wp) : ミルベメクチン（IRAC6 マクロライド系）
  // 現状4件 → ハダニ3種＋コナジラミ。アザミウマにも効果。
  console.log('--- milbenock (ミルベメクチン) ---')
  for (const slug of ['milbenock-ec', 'milbenock-fl', 'milbenock-wp']) {
    await link(slug, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'マクロライド系。ハダニ・アザミウマに効果' })
    await link(slug, 'tsuya-hadani', { efficacyLevel: 'good', persistenceLevel: 'good' })
  }

  // ダニトロン (danitron-fl/ec) : ピリダベン（IRAC21A METI系殺ダニ）
  // 現状3件 → ハダニ3種。アザミウマにも効果。
  console.log('--- danitron (ピリダベン) ---')
  for (const slug of ['danitron-fl', 'danitron-ec']) {
    await link(slug, 'azamiuma', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: 'METI系殺ダニ剤。ハダニが主対象' })
    await link(slug, 'tsuya-hadani', { efficacyLevel: 'good', persistenceLevel: 'good' })
  }

  // ニッソラン水和剤 (nissoran-wp) : ヘキシチアゾクス（IRAC10A 殺ダニ）
  // 現状3件 → ハダニ3種。殺ダニ専門。ツヤハダニ追加。
  console.log('--- nissoran-wp (ヘキシチアゾクス) ---')
  await link('nissoran-wp', 'tsuya-hadani', { efficacyLevel: 'good', persistenceLevel: 'excellent', note: '卵・幼虫に特に効果が高い殺ダニ剤' })

  // カネマイトフロアブル (kanemite-fl) : アセキノシル（IRAC20B 殺ダニ）
  // 現状5件 → ハダニ3種＋アザミウマ2種。ツヤハダニ追加。
  console.log('--- kanemite-fl (アセキノシル) ---')
  await link('kanemite-fl', 'tsuya-hadani', { efficacyLevel: 'good', persistenceLevel: 'good' })

  // コロマイト乳剤/フロアブル (colomite-ec/fl) : ミルベメクチン
  // 現状3-5件。
  // colomite-ec/fl は架空製品を含むためスキップ
  // console.log('--- colomite (ミルベメクチン) ---')
  // for (const slug of ['colomite-ec', 'colomite-fl']) { ... }

  // コテツフロアブル/乳剤 (kotetsu-fl/ec) : クロルフェナピル（IRAC13 酸化的リン酸化阻害）
  // 現状4件 → ハダニ、アザミウマ、ケムシ、コナジラミ。ヨトウムシ類にも。
  console.log('--- kotetsu (クロルフェナピル) ---')
  for (const slug of ['kotetsu-fl', 'kotetsu-ec']) {
    await link(slug, 'hasumon-yotou', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: '酸化的リン酸化阻害。抵抗性害虫にも有効' })
    await link(slug, 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'good' })
    await link(slug, 'nami-hadani', { efficacyLevel: 'good', persistenceLevel: 'good' })
  }

  // アーデントフロアブル/顆粒 (ardent-fl/wdg) : アクリナトリン（IRAC3A ピレスロイド系）
  // 現状3-5件。速効性で幅広い害虫に有効。
  console.log('--- ardent (アクリナトリン) ---')
  for (const slug of ['ardent-fl', 'ardent-wdg']) {
    await link(slug, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'ピレスロイド系殺虫殺ダニ剤' })
    await link(slug, 'yokobai', { efficacyLevel: 'good', persistenceLevel: 'good' })
    await link(slug, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'good' })
    await link(slug, 'kaigaramushi', { efficacyLevel: 'fair', persistenceLevel: 'fair', note: '若齢幼虫に効果あり' })
  }

  // アディオンフロアブル (adion-fl) : ペルメトリン（IRAC3A ピレスロイド系）
  // 現状5件。接触・食毒で幅広い。
  console.log('--- adion-fl (ペルメトリン) ---')
  await link('adion-fl', 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await link('adion-fl', 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await link('adion-fl', 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await link('adion-fl', 'yokobai', { efficacyLevel: 'fair', persistenceLevel: 'fair' })

  // ダイン乳剤/サンクリスタル (chlorfenapyr-ec) : トルフェンピラド（IRAC21A）
  // 現状4件。殺ダニ＋殺虫。
  console.log('--- chlorfenapyr-ec (トルフェンピラド) ---')
  await link('chlorfenapyr-ec', 'nami-hadani', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await link('chlorfenapyr-ec', 'kanzawa-hadani', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await link('chlorfenapyr-ec', 'hasumon-yotou', { efficacyLevel: 'good', persistenceLevel: 'fair' })

  // サンマイトフロアブル (sanmite-fl) : ピリダベン（METI系 IRAC21A）20.0%
  // 殺ダニ剤。日産化学製 MAFF#17814
  // 現状4件 → ハダニ、コナジラミ、アザミウマ、ミカンキイロアザミウマ。追加対象限定。
  console.log('--- sanmite-fl 補足 ---')
  await link('sanmite-fl', 'nami-hadani', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await link('sanmite-fl', 'kanzawa-hadani', { efficacyLevel: 'good', persistenceLevel: 'good' })

  // ──────────────────────────────────────────────────────
  //  剤型違い（同一成分）の効果数均一化
  //  ※ applaud-dp (ブプロフェジン粉剤) は applaud-wp と同成分
  // ──────────────────────────────────────────────────────
  console.log('--- applaud-dp (ブプロフェジン) 追加 ---')
  await link('applaud-dp', 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'good', note: 'IGR系脱皮阻害。若齢幼虫に効果' })
  await link('applaud-dp', 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await link('applaud-dp', 'yokobai', { efficacyLevel: 'fair', persistenceLevel: 'fair' })

  console.log('\n=== 効果データ補足が完了しました ===')
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
