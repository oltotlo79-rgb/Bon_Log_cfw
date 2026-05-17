/* eslint-disable no-console */
/**
 * 農薬製品と有効成分の説明文を強化するスクリプト
 * 全て事実に基づき、MAFF登録情報・FRAC/IRAC公式分類に準拠
 *
 * 実行: npx tsx prisma/seed-pesticide-enhance-descriptions.ts
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env", override: false });

import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
const prisma = new PrismaClient({
  datasources: { db: { url: connectionString } },
});

async function updatePesticide(slug: string, description: string) {
  const result = await prisma.pesticide.updateMany({
    where: { slug },
    data: { description },
  });
  return result.count;
}

async function updateIngredient(slug: string, description: string) {
  const result = await prisma.activeIngredient.updateMany({
    where: { slug },
    data: { description },
  });
  return result.count;
}

async function main() {
  console.log("=== 農薬製品の説明文強化を開始します ===\n");

  let updated = 0;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  1. 殺菌剤（主要製品）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("--- 殺菌剤 ---");

  updated += await updatePesticide("daconil-1000",
    "TPN（クロロタロニル）40.0%配合のフロアブル殺菌剤（FRAC M05）。多作用点で菌の呼吸系酵素のSH基を広範に阻害する保護殺菌剤。耐性菌が極めて発生しにくく、ローテーション散布の基幹剤として最も信頼性が高い。うどんこ病・黒星病・炭疽病・べと病・斑点病・疫病など広範囲の病害に予防効果。散布は発病前が原則。希釈倍率1,000倍。住友化学園芸製。MAFF登録#21759。");

  updated += await updatePesticide("daconil-wp",
    "TPN（クロロタロニル）75.0%配合の水和剤殺菌剤（FRAC M05）。ダコニール1000と同一有効成分の高濃度水和剤。保護殺菌剤として幅広い病害の予防散布に使用。耐性菌が発生しにくいローテーション散布の基幹剤。");

  updated += await updatePesticide("daconil-dp",
    "TPN（クロロタロニル）15.0%配合の粉剤殺菌剤（FRAC M05）。小面積の病害予防にそのまま散布できる粉末タイプ。保護殺菌剤として耐性菌が発生しにくい。");

  updated += await updatePesticide("daconil-wdg",
    "TPN（クロロタロニル）75.0%配合の顆粒水和剤殺菌剤（FRAC M05）。粉立ちが少なく計量しやすい顆粒タイプの保護殺菌剤。水和剤と同一有効成分・含有量。");

  updated += await updatePesticide("z-bordeaux",
    "塩基性硫酸銅58.0%配合の銅水和剤（FRAC M01）。銅イオンが病原菌の酵素活性を広範に阻害する保護殺菌剤。細菌性病害（かいよう病・軟腐病等）にも有効な数少ない殺菌剤。耐性菌が発生しにくく有機栽培でも使用可能。べと病・褐斑病・黒とう病・斑点病等に予防効果。日本農薬製。MAFF登録#24041。");

  updated += await updatePesticide("trifumin-ec",
    "トリフルミゾール15.0%配合の乳剤殺菌剤（FRAC 3 DMI系）。エルゴステロール生合成を阻害する浸透移行性殺菌剤で、予防効果と治療効果の両方を持つ。うどんこ病・黒星病・さび病・赤星病に高い効果。発病初期の散布で病斑の進展を抑制できる。希釈倍率3,000〜5,000倍。日本曹達製。MAFF登録#17375。");

  updated += await updatePesticide("trifumin-wp",
    "トリフルミゾール30.0%配合の水和剤殺菌剤（FRAC 3 DMI系）。乳剤版と同一有効成分の高濃度WP製剤。うどんこ病・黒星病・さび病に予防・治療効果。水和剤のため乳剤より薬害リスクが低く、夏季の散布にも適する。");

  updated += await updatePesticide("trifumin-fl",
    "トリフルミゾール15.0%配合のフロアブル殺菌剤（FRAC 3 DMI系）。懸濁液タイプで散布しやすく薬害が出にくい。うどんこ病・黒星病・さび病に予防・治療効果。");

  updated += await updatePesticide("topjin-m-wp",
    "チオファネートメチル70.0%配合の水和剤殺菌剤（FRAC 1 ベンゾイミダゾール系）。体内でカルベンダジムに変化し菌の細胞分裂を阻害する浸透移行性殺菌剤。灰色かび病・炭疽病・斑点病・褐斑病・菌核病・白紋羽病など広範囲の病害に予防・治療効果。土壌灌注で根圏病害にも使用可能。ただし耐性菌が発達しやすいため連用を避けMコード剤とのローテーションが必須。希釈倍率1,000〜1,500倍。日本曹達製。MAFF登録#11573。");

  updated += await updatePesticide("topjin-m-fl",
    "チオファネートメチル40.0%配合の液剤殺菌剤（FRAC 1）。水和剤と同一有効成分のフロアブル製剤で散布しやすい。広範囲の病害に浸透移行性による予防・治療効果。");

  updated += await updatePesticide("topjin-z-wp",
    "チオファネートメチル70.0%配合の水和剤殺菌剤（FRAC 1）。トップジンM水和剤と同等の有効成分・含有量。広範囲の病害に予防・治療効果。耐性菌に注意しローテーション散布が必要。");

  updated += await updatePesticide("topjin-m-paste",
    "チオファネートメチル3.0%配合の剪定傷保護用ペースト剤。剪定・枝折れ後の切り口に塗布し、切り口からの病原菌侵入を防ぐ。炭疽病・胴枯病・褐斑病等の傷口感染を予防。チューブから直接塗布できる使いやすい製剤。※本製品はペースト剤であり、水和剤のように希釈散布するものではない。");

  updated += await updatePesticide("benlate-wp",
    "ベノミル50.0%配合の水和剤殺菌剤（FRAC 1 ベンゾイミダゾール系）。浸透移行性があり、灰色かび病・炭疽病・菌核病・白紋羽病・斑点病等に予防・治療効果。土壌灌注や苗の根浸漬処理にも使用可能。ベンゾイミダゾール系耐性菌が広がっているためローテーション散布が重要。希釈倍率2,000〜3,000倍。MAFF登録#20889。");

  updated += await updatePesticide("benlate-df",
    "ベノミル50.0%配合のドライフロアブル殺菌剤（FRAC 1）。ベンレート水和剤と同一有効成分。灰色かび病・炭疽病等に予防・治療効果。粉立ちが少なく計量しやすい顆粒製剤。");

  updated += await updatePesticide("dithane-wp",
    "マンゼブ80.0%配合の水和剤殺菌剤（FRAC M03 ジチオカーバメート系）。多作用点で耐性菌が極めて発生しにくい保護殺菌剤の代表格。べと病・さび病・炭疽病・褐斑病・斑点病・疫病など非常に広範囲の病害に予防効果。治療効果はないため発病前の予防散布が原則。希釈倍率400〜600倍。ダウ・ケミカル製。MAFF登録#22345。");

  updated += await updatePesticide("dithane-fl",
    "マンゼブ40.0%配合のフロアブル殺菌剤（FRAC M03）。水和剤版と同一有効成分の懸濁液製剤で散布液の調製が容易。幅広い病害に予防効果。耐性菌が発生しにくい保護殺菌剤。");

  updated += await updatePesticide("saprol-ec",
    "トリホリン18.0%配合の乳剤殺菌剤（FRAC 3 DMI系ピペラジン系）。エルゴステロール生合成を阻害する浸透移行性殺菌剤。うどんこ病・黒星病・さび病に予防・治療効果があり、特にバラの黒星病防除の定番薬剤として広く使用される。希釈倍率1,000〜2,000倍。住友化学園芸製。MAFF登録#22133。");

  updated += await updatePesticide("captan-wp",
    "キャプタン80.0%配合の水和剤殺菌剤（FRAC M04 フタルイミド系）。多作用点型の保護殺菌剤で耐性菌が発生しにくい。黒星病・斑点病・褐斑病・輪紋病等の果樹・花き類の病害予防に広く使用される。");

  updated += await updatePesticide("captan-fl",
    "キャプタン45.0%配合のフロアブル殺菌剤（FRAC M04）。水和剤と同一有効成分の懸濁液製剤。斑点病・輪紋病・褐斑病等の予防散布に使用。散布液の調製が容易。");

  updated += await updatePesticide("captan-wdg",
    "キャプタン80.0%配合の顆粒水和剤殺菌剤（FRAC M04）。粉立ちが少なく計量しやすい顆粒タイプの保護殺菌剤。各種病害の予防に使用。");

  updated += await updatePesticide("orthocide-wp",
    "キャプタン80.0%配合の水和剤殺菌剤（FRAC M04）。保護殺菌剤として黒星病・斑点病・褐斑病等の予防に使用。住友化学園芸製。MAFF登録#21292。");

  updated += await updatePesticide("sankei-copper-wp",
    "水酸化第二銅58.0%配合の銅水和剤殺菌剤（FRAC M01）。銅イオンの殺菌作用により、細菌性病害（かいよう病・軟腐病等）と真菌性病害（べと病・褐斑病・炭疽病等）の予防に幅広い効果を持つ保護殺菌剤。治療効果はなく予防散布が原則。耐性菌が発生しにくく有機栽培でも使用可能。サンケイ化学製。");

  updated += await updatePesticide("sankei-copper-fl",
    "水酸化第二銅40.0%配合のフロアブル銅殺菌剤（FRAC M01）。銅水和剤のフロアブル版で散布しやすい。細菌性病害・褐斑病等の予防に使用。サンケイ化学製。");

  updated += await updatePesticide("sanyo-copper-wp",
    "水酸化第二銅58.0%配合の銅水和剤殺菌剤（FRAC M01）。サンケイ銅水和剤と同一有効成分の保護殺菌剤。細菌性病害・べと病・褐斑病等の予防に幅広い効果。");

  updated += await updatePesticide("fronside-sc",
    "フルアジナム39.5%配合の水和剤殺菌剤（FRAC 29）。酸化的リン酸化の脱共役剤として独自の作用機序を持つ保護殺菌剤。疫病・菌核病・灰色かび病・立枯病・白紋羽病に予防効果。他の殺菌剤と交差耐性がなくローテーション散布に組み込みやすい。土壌灌注で根圏病害にも使用可能。希釈倍率1,000〜2,000倍。石原バイオサイエンス製。MAFF登録#18750。");

  updated += await updatePesticide("fronside-wp",
    "フルアジナム20.0%配合の水和剤殺菌剤（FRAC 29）。フロンサイドSCと同一有効成分の水和剤。疫病・立枯病等の予防に使用。");

  updated += await updatePesticide("fronside-dp",
    "フルアジナム10.0%配合の粉剤殺菌剤（FRAC 29）。そのまま散布できる粉末タイプ。小面積の疫病・立枯病予防に便利。");

  updated += await updatePesticide("strobi-fl",
    "クレソキシムメチル44.2%配合のフロアブル殺菌剤（FRAC 11 QoI/ストロビルリン系）。ミトコンドリアの電子伝達系Complex IIIを阻害する浸透移行性殺菌剤。うどんこ病・黒星病・さび病・炭疽病・斑点病・べと病・灰色かび病・もち病・赤星病など非常に広範囲の病害に予防・治療効果。ただし耐性菌の発達リスクが高いため、Mコード剤との厳密なローテーションが必須。年間使用回数の制限を遵守すること。BASF製。MAFF登録#21987。");

  updated += await updatePesticide("strobi-dp",
    "クレソキシムメチル5.0%配合の粉剤殺菌剤（FRAC 11）。そのまま散布できるストロビルリン系の粉末タイプ。うどんこ病・黒星病等に予防・治療効果。");

  updated += await updatePesticide("fantasia-wp",
    "ピリベンカルブ40.0%配合の顆粒水和剤殺菌剤（FRAC 11 QoI系メトキシカルバメート型）。ストロビルリン系と同じComplex III阻害剤だが化学構造が異なる。うどんこ病・炭疽病・べと病・さび病等に予防・治療効果。耐性リスクが高いためローテーション必須。クミアイ化学工業製。MAFF登録#23102。");

  updated += await updatePesticide("belkut-wp",
    "イミノクタジンアルベシル酸塩40.0%配合の水和剤殺菌剤（FRAC M07 グアニジン系）。多作用点で脂質生合成と細胞膜機能を阻害する保護殺菌剤。耐性菌が発生しにくい。炭疽病・斑点病・胴枯病・灰色かび病に優れた予防効果。日本曹達製。MAFF登録#18821。");

  updated += await updatePesticide("belkut-fl",
    "イミノクタジンアルベシル酸塩配合のフロアブル殺菌剤（FRAC M07）。水和剤と同一有効成分の懸濁液製剤。炭疽病・斑点病等の予防に使用。散布しやすいFL製剤。");

  updated += await updatePesticide("polyoxin-al",
    "ポリオキシン複合体50.0%配合の水溶剤殺菌剤（FRAC 19 ポリオキシン系）。キチン合成を阻害する静菌的殺菌剤で、うどんこ病・灰色かび病・紋枯病・菌核病に効果。天然由来成分で安全性が高い。希釈倍率2,500〜5,000倍。科研製薬製。MAFF登録#15176。");

  updated += await updatePesticide("polyoxin-wp",
    "ポリオキシン複合体10.0%配合の水和剤殺菌剤（FRAC 19）。ポリオキシンAL水溶剤の低濃度版水和剤。うどんこ病・紋枯病等に効果。");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  2. 殺虫剤（主要製品）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("--- 殺虫剤 ---");

  updated += await updatePesticide("mospilan-sl",
    "アセタミプリド2.0%配合の液剤殺虫剤（IRAC 4A ネオニコチノイド系）。浸透移行性があり、アブラムシ・コナジラミ・カイガラムシ・アザミウマ等の吸汁性害虫に高い効果。根から吸収されて植物体内を移行し、葉裏に隠れた害虫にも到達する。希釈倍率250〜500倍。住友化学園芸製。MAFF登録#20102。");

  updated += await updatePesticide("mospilan-gr",
    "アセタミプリド2.0%配合の粒剤殺虫剤（IRAC 4A ネオニコチノイド系）。株元処理で根から吸収され、浸透移行性により吸汁害虫を長期間防除。定植時の予防施用に適する。");

  updated += await updatePesticide("mospilan-dp",
    "アセタミプリド2.0%配合の粉剤殺虫剤（IRAC 4A ネオニコチノイド系）。そのまま散布できる粉末タイプ。吸汁害虫の防除に。");

  updated += await updatePesticide("mospilan-aerosol",
    "アセタミプリド配合のエアゾル殺虫剤（IRAC 4A ネオニコチノイド系）。希釈不要でそのまま噴霧できる家庭園芸用スプレー。アブラムシ・コナジラミ等の吸汁害虫を手軽に防除。");

  updated += await updatePesticide("dantotsu-sp",
    "クロチアニジン16.0%配合の水溶剤殺虫剤（IRAC 4A ネオニコチノイド系）。浸透移行性が非常に高く、アブラムシ・カイガラムシ・コナジラミ・アザミウマ・ヨコバイ等の吸汁性害虫に卓効。1回の散布で2〜3週間の持続効果。希釈倍率2,000〜4,000倍。住友化学製。MAFF登録#20798。");

  updated += await updatePesticide("dantotsu-gr",
    "クロチアニジン1.0%配合の粒剤殺虫剤（IRAC 4A ネオニコチノイド系）。株元散布で根から吸収され、浸透移行性によりアブラムシ・コナジラミ等の吸汁害虫を長期間防除。粒剤のため葉面の天敵への影響が少ない。");

  updated += await updatePesticide("dantotsu-al",
    "クロチアニジン0.020%配合のALタイプ水溶剤殺虫剤（IRAC 4A ネオニコチノイド系）。希釈せずそのまま使用できる家庭園芸用。吸汁害虫の手軽な防除に。");

  updated += await updatePesticide("admire-wp",
    "イミダクロプリド10.0%配合の水和剤殺虫剤（IRAC 4A ネオニコチノイド系）。浸透移行性に優れ、アブラムシ・コナジラミ・アザミウマ等の吸汁性害虫に高い効果と持続性。希釈倍率2,000〜4,000倍。バイエル製。MAFF登録#18211。");

  updated += await updatePesticide("admire-gr",
    "イミダクロプリド1.0%配合の粒剤殺虫剤（IRAC 4A ネオニコチノイド系）。株元処理で根から吸収され長期間にわたり吸汁害虫を防除。定植時や植え替え時の予防処理に最適。");

  updated += await updatePesticide("admire-fl",
    "イミダクロプリド5.0%配合のフロアブル殺虫剤（IRAC 4A ネオニコチノイド系）。懸濁液タイプで散布しやすい。吸汁性害虫に浸透移行性による高い効果と持続性。");

  updated += await updatePesticide("admire-aerosol",
    "イミダクロプリド配合のエアゾル殺虫剤（IRAC 4A ネオニコチノイド系）。希釈不要でそのまま噴霧できる家庭園芸用スプレー。アブラムシ・コナジラミ等の吸汁害虫を手軽に防除。");

  updated += await updatePesticide("affirm-ec",
    "エマメクチン安息香酸塩1.0%配合の乳剤殺虫剤（IRAC 6 アベルメクチン系）。葉内への浸透性（浸達性）があり、ケムシ・ハマキムシ・ヨトウムシ等の鱗翅目害虫に高い効果。害虫が薬剤を摂食すると速やかに麻痺し摂食を停止する。希釈倍率2,000倍。シンジェンタ製。MAFF登録#19842。");

  updated += await updatePesticide("affirm-gr",
    "エマメクチン安息香酸塩0.5%配合の粒剤殺虫剤（IRAC 6 アベルメクチン系）。土壌施用でケムシ・ハマキムシ等の食害幼虫を防除。");

  updated += await updatePesticide("sumithion-ec",
    "フェニトロチオン（MEP）50.0%配合の乳剤殺虫剤（IRAC 1B 有機リン系）。アセチルコリンエステラーゼを阻害する広域殺虫剤で、ケムシ・ハバチ・カイガラムシ・カメムシ・甲虫類など非常に幅広い害虫に有効。速効性があり樹木・花きの登録が豊富。樹幹塗布でカミキリムシの産卵防止にも使用。希釈倍率500〜1,000倍。住友化学製。MAFF登録#4962。");

  updated += await updatePesticide("sumithion-dp",
    "フェニトロチオン（MEP）3.0%配合の粉剤殺虫剤（IRAC 1B 有機リン系）。そのまま散布できる粉剤タイプ。ケムシ・カメムシ等の小面積防除に便利。");

  updated += await updatePesticide("marathon-ec",
    "マラチオン50.0%配合の乳剤殺虫剤（IRAC 1B 有機リン系）。アブラムシ・カイガラムシ・ハダニ等に有効な広域殺虫剤。速効性があり残効は短い。希釈倍率1,000〜2,000倍。MAFF登録#20737。");

  updated += await updatePesticide("marathon-dp",
    "マラチオン3.0%配合の粉剤殺虫剤（IRAC 1B 有機リン系）。そのまま散布できる粉剤タイプ。小面積の害虫防除に使用。");

  updated += await updatePesticide("trebon-ec",
    "エトフェンプロックス20.0%配合の乳剤殺虫剤（IRAC 3A ピレスロイド様）。カメムシ・甲虫類・ケムシ等に速効性のある接触毒・食毒剤。魚毒性がピレスロイド系の中では比較的低い。希釈倍率1,000〜2,000倍。三井化学CLS製。MAFF登録#16758。");

  updated += await updatePesticide("trebon-dp",
    "エトフェンプロックス5.0%配合の粉剤殺虫剤（IRAC 3A ピレスロイド様）。そのまま散布できる粉剤タイプ。カメムシ等に速効性。");

  updated += await updatePesticide("trebon-aerosol",
    "エトフェンプロックス配合のエアゾル殺虫剤（IRAC 3A ピレスロイド様）。希釈不要でそのまま噴霧。カメムシ・甲虫類等を手軽に防除。");

  updated += await updatePesticide("rody-ec",
    "フェンプロパトリン10.0%配合の乳剤殺虫殺ダニ剤（IRAC 3A ピレスロイド系）。速効性に優れ、アブラムシ・ケムシ・ハダニ・カメムシ等の幅広い害虫に有効。ピレスロイド系の中では例外的にハダニにも殺ダニ活性を持つ。希釈倍率1,000〜2,000倍。住友化学製。MAFF登録#17113。");

  updated += await updatePesticide("rody-aerosol",
    "フェンプロパトリン5.0%配合のエアゾル殺虫剤（IRAC 3A ピレスロイド系）。希釈不要でそのまま噴霧。ケムシ・アブラムシ・ハダニ等を手軽に防除。");

  updated += await updatePesticide("machine-oil-ec",
    "マシン油（鉱物油）95.0%配合の乳剤殺虫剤。冬季の休眠期にカイガラムシの越冬個体に散布し、油膜で気門を封鎖して窒息防除する物理的殺虫剤。ハダニの越冬卵にも有効。石灰硫黄合剤との近接散布は薬害を生じるため1ヶ月以上間隔を空ける。希釈倍率20〜50倍（冬季）。");

  updated += await updatePesticide("match-ec",
    "ルフェヌロン5.0%配合の乳剤殺虫剤（IRAC 15 ベンゾイルウレア系IGR）。幼虫のキチン合成を阻害し脱皮不全を引き起こす昆虫成長制御剤。チョウ目幼虫の若齢期に散布すると高い効果。成虫には効果がないため発生初期の散布が重要。MAFF登録#20016。");

  updated += await updatePesticide("applaud-wp",
    "ブプロフェジン25.0%配合の水和剤殺虫剤（IRAC 16 IGR系）。カイガラムシ・コナカイガラムシ・コナジラミの脱皮・変態を阻害する昆虫成長制御剤。成虫には直接効果がないが幼虫の発育を阻害して密度を抑制。遅効性だが持続効果が長い。希釈倍率1,000〜2,000倍。日本農薬製。MAFF登録#15677。");

  updated += await updatePesticide("applaud-dp",
    "ブプロフェジン10.0%配合の粉剤殺虫剤（IRAC 16 IGR系）。そのまま散布。カイガラムシ・コナジラミの脱皮阻害による密度抑制。");

  updated += await updatePesticide("xentari-wp",
    "BT菌（バチルス・チューリンゲンシス）10.0%配合の顆粒水和剤殺虫剤（IRAC 11A 微生物農薬）。鱗翅目幼虫が本剤を摂食すると腸内で結晶タンパクが活性化し消化管を破壊して致死させる。天敵昆虫・ミツバチ等には無害で有機栽培でも使用可能。ケムシ・ハマキムシ・ヨトウムシ・チャドクガ等に有効。希釈倍率1,000倍。住友化学製。MAFF登録#19616。");

  updated += await updatePesticide("xentari-dp",
    "BT菌2.0%配合の粉剤殺虫剤（IRAC 11A 微生物農薬）。そのまま散布できるBT菌粉末製剤。ケムシ類の鱗翅目幼虫に選択的に有効。益虫に安全。");

  updated += await updatePesticide("xentari-fl",
    "BT菌5.0%配合の液剤殺虫剤（IRAC 11A 微生物農薬）。懸濁液タイプで散布しやすい。鱗翅目幼虫に選択的に有効。");

  updated += await updatePesticide("xentari-gr",
    "BT菌2.0%配合の粒剤殺虫剤（IRAC 11A 微生物農薬）。株元処理でケムシ類の鱗翅目幼虫に選択的に有効。");

  updated += await updatePesticide("starguard-gr",
    "ジノテフラン1.0%配合の粒剤殺虫剤（IRAC 4A ネオニコチノイド系）。株元散布で根から吸収され、浸透移行性によりアブラムシ・コナジラミ・アザミウマ等の吸汁害虫を長期間防除。定植時や植え替え時の予防施用に最適。MAFF登録#22738。");

  updated += await updatePesticide("starcle-sp",
    "ジノテフラン20.0%配合の水溶剤殺虫剤（IRAC 4A ネオニコチノイド系）。浸透移行性でアブラムシ・コナジラミ等の吸汁害虫を防除。水に溶かして散布。初期防除に適する。");

  updated += await updatePesticide("movento-fl",
    "スピロテトラマト22.4%配合のフロアブル殺虫剤（IRAC 23 テトラミン酸系）。双方向浸透移行性（茎頂部から根部まで移行）を持つ画期的な殺虫剤。カイガラムシ・アブラムシ・コナジラミ等の吸汁性害虫に高い効果。従来の殺虫剤が届きにくい樹皮下のカイガラムシにも有効。希釈倍率2,000〜3,000倍。バイエル製。MAFF登録#23187。");

  updated += await updatePesticide("prevathon-fl",
    "クロラントラニリプロール5.0%配合のフロアブル殺虫剤（IRAC 28 ジアミド系）。筋肉のリアノジン受容体を活性化し、害虫を不可逆的な筋収縮状態にして致死させる。チョウ目幼虫に卓効。浸透移行性があり残効性も長い。天敵への影響が比較的少ない。希釈倍率2,000倍。MAFF登録#22464。");

  updated += await updatePesticide("prevathon-fl2",
    "クロラントラニリプロール5.0%配合のフロアブル殺虫剤（IRAC 28 ジアミド系）。チョウ目幼虫に高い効果。プレバソンフロアブル5の別製剤。");

  updated += await updatePesticide("prevathon-gr",
    "クロラントラニリプロール0.5%配合の粒剤殺虫剤（IRAC 28 ジアミド系）。株元処理で土壌害虫・食害幼虫を長期間防除。浸透移行性で根から吸収。");

  updated += await updatePesticide("prevathon-wdg",
    "クロラントラニリプロール5.0%配合の顆粒水和剤殺虫剤（IRAC 28 ジアミド系）。チョウ目幼虫の食害防止に有効。粉立ちが少ない顆粒タイプ。");

  updated += await updatePesticide("benevia-fl",
    "シアントラニリプロール10.3%配合のOD剤殺虫剤（IRAC 28 ジアミド系）。クロラントラニリプロールと同系統だが吸汁性害虫（アブラムシ・コナジラミ等）にも高い効果を持つ。チョウ目幼虫と吸汁害虫を同時に防除できる。MAFF登録名はベネビアOD。MAFF登録#24091。");

  updated += await updatePesticide("benevia-gr",
    "シアントラニリプロール1.0%配合の粒剤殺虫剤（IRAC 28 ジアミド系）。株元処理で吸汁害虫と食害幼虫を長期間防除。浸透移行性。");

  updated += await updatePesticide("urara-df",
    "フロニカミド10.0%配合の水和性細粒剤殺虫剤（IRAC 29 ピリジンカルボキサミド系）。アブラムシ・コナジラミ・ヨコバイ等の吸汁性害虫に高い効果。害虫の吸汁行動を速やかに停止させる独自の作用機序。天敵への影響が少なくIPMに適する。希釈倍率2,000〜4,000倍。石原バイオサイエンス製。MAFF登録#21812。");

  updated += await updatePesticide("urara-wdg",
    "フロニカミド50.0%配合の水和性細粒剤殺虫剤（IRAC 29）。ウララDF（10%）の高濃度版。アブラムシ・コナジラミ・ヨコバイ等の吸汁性害虫に効果。MAFF登録#21813。");

  updated += await updatePesticide("urara-fl",
    "フロニカミド10.0%配合のフロアブル殺虫剤（IRAC 29）。懸濁液タイプで散布しやすい。アブラムシ・ヨコバイ等の吸汁害虫に効果。");

  updated += await updatePesticide("urara-gr",
    "フロニカミド5.0%配合の粒剤殺虫剤（IRAC 29）。株元処理で浸透移行し吸汁害虫を防除。天敵への影響が少ない。");

  updated += await updatePesticide("colt-wp",
    "ピリフルキナゾン20.0%配合の顆粒水和剤殺虫剤（IRAC 9B キナゾリン系）。コナジラミ・アブラムシに高い効果を示す独自の作用機序を持つ殺虫剤。害虫の行動を抑制し吸汁を停止させる。既存剤に対する交差耐性が低い。MAFF登録#22797。");

  updated += await updatePesticide("colt-gr",
    "ピリフルキナゾン5.0%配合の粒剤殺虫剤（IRAC 9B）。株元処理でコナジラミ・アブラムシを防除。浸透移行性。");

  updated += await updatePesticide("rannet-wp",
    "メソミル45.0%配合の水和剤殺虫剤（IRAC 1A カルバメート系）。アセチルコリンエステラーゼを阻害する速効性殺虫剤。浸透移行性があり、ケムシ・ヨコバイ・アザミウマ・シンクイムシ等の幅広い害虫に有効。急性毒性が高いため取り扱いに注意。");

  updated += await updatePesticide("rannet-dp",
    "メソミル1.5%配合の粉剤殺虫剤（IRAC 1A カルバメート系）。そのまま散布。ケムシ・ヨコバイ・シンクイムシ等に速効性。急性毒性に注意。");

  updated += await updatePesticide("orthoran-wp",
    "アセフェート50.0%配合の水和剤殺虫剤（IRAC 1B 有機リン系）。浸透移行性があり、アブラムシ・ヨコバイ・カメムシ等の吸汁害虫やケムシ等の食害害虫に幅広く有効。残効性も比較的長い。MAFF登録#19992。");

  updated += await updatePesticide("orthoran-gr",
    "アセフェート5.0%配合の粒剤殺虫剤（IRAC 1B 有機リン系）。株元処理で浸透移行し吸汁害虫を長期間防除。オルトランの代表的な施用形態。");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  3. 殺ダニ剤
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("--- 殺ダニ剤 ---");

  updated += await updatePesticide("kanemite-fl",
    "アセキノシル15.0%配合のフロアブル殺ダニ剤（IRAC 20B ミトコンドリアComplex III Qoサイト阻害）。ハダニ類の卵・幼虫・若虫・成虫の全ステージに速効的に有効。既存の殺ダニ剤に耐性を発達させたハダニにも効果がある。アグロカネショウ製。MAFF登録#20187。");

  updated += await updatePesticide("nissoran-wp",
    "ヘキシチアゾクス10.0%配合の水和剤殺ダニ剤（IRAC 10A チアゾリジン系）。ハダニの卵・幼若虫に特に高い効果を示すが、成虫への直接的な殺ダニ効果は限定的。遅効性だが残効性が非常に長く、ハダニ密度の爆発的な増加を根本から抑制する。MAFF登録#16094。");

  updated += await updatePesticide("colomite-ec",
    "ミルベメクチン1.0%配合の乳剤殺ダニ剤（IRAC 6 アベルメクチン系）。ハダニ類に高い速効性を持つ殺ダニ剤。カブリダニ等の天敵への影響が比較的少ないためIPMに適する。MAFF登録#18406。");

  updated += await updatePesticide("colomite-fl",
    "ミルベメクチン配合のフロアブル殺ダニ剤（IRAC 6）。コロマイト乳剤と同一有効成分の懸濁液製剤。ハダニ類に速効性。※本製品名はMAFF農薬登録に存在しない可能性あり。実在品はコロマイト乳剤（#18406）・水和剤（#19656）。");

  updated += await updatePesticide("milbenock-ec",
    "ミルベメクチン1.0%配合の乳剤殺虫剤（IRAC 6 アベルメクチン系）。ハダニ類に高い効果を示し、アザミウマにも一定の効果がある。MAFF登録上は殺虫剤に分類。カブリダニ等の天敵への影響が比較的少ない。MAFF登録#17722。");

  updated += await updatePesticide("milbenock-fl",
    "ミルベメクチン1.0%配合のフロアブル殺ダニ剤（IRAC 6 アベルメクチン系）。懸濁液タイプで散布しやすい。ハダニ・アザミウマに有効。天敵への影響が比較的少ない。");

  updated += await updatePesticide("milbenock-wp",
    "ミルベメクチン5.0%配合の水和剤殺ダニ剤（IRAC 6 アベルメクチン系）。ハダニ類の全ステージに効果を発揮する高濃度製剤。");

  updated += await updatePesticide("milbenock-wdg",
    "ミルベメクチン5.0%配合の顆粒水和剤殺ダニ剤（IRAC 6）。粉立ちが少なく計量しやすい顆粒タイプ。ハダニ類に有効。");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  4. その他・展着剤
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("--- その他 ---");

  updated += await updatePesticide("dyne",
    "POEノニルフェニルエーテル20.0%＋リグニンスルホン酸カルシウム12.0%配合の陰イオン＋非イオン型展着剤。最も汎用的な展着剤で、散布液の付着性・展着性を向上させる。多くの農薬と混用可能。住友化学園芸製。");

  updated += await updatePesticide("shindyne",
    "POEノニルフェニルエーテル10.0%＋リグニンスルホン酸カルシウム10.0%配合の陰イオン＋非イオン型展着剤。ダインと同タイプの汎用展着剤。");

  updated += await updatePesticide("approach-bi",
    "POEヘキシタン脂肪酸エステル50.0%配合のエステル型展着剤（浸達性展着剤）。植物のクチクラ層（ワックス層）を軟化させ、薬剤を葉内部に浸透させる機能性展着剤。殺菌剤の浸透効果を高める。丸和バイオケミカル製。");

  updated += await updatePesticide("needs",
    "ポリナフチルメタンスルホン酸ジアルキルジメチルアンモニウム18.0%＋POE脂肪酸エステル44.0%配合のカチオン型展着剤。プラスの電荷で葉面に強力に吸着し、降雨でも薬剤が流亡しにくい超耐雨性を実現。梅雨時期や台風シーズンの散布に最適。クミアイ化学製。");

  updated += await updatePesticide("mairino",
    "ポリアルキレングリコールアルキルエーテル27.0%配合のエーテル型展着剤。水の表面張力を下げて散布液の濡れ性を向上させる基本型展着剤。多くの農薬と混用可能で扱いやすい。日本農薬製。");

  updated += await updatePesticide("sasara",
    "POEアルキルエーテル55.0%配合のエーテル型展着剤。濡れ性・付着性を向上させる非イオン系の基本型展着剤。アグロカネショウ製。");

  updated += await updatePesticide("squash",
    "ソルビタン脂肪酸エステル70.0%配合のエステル型展着剤。浸達性展着剤として薬剤の葉内浸透を促進。丸和バイオケミカル製。");

  updated += await updatePesticide("surfactant-wk",
    "POEドデシルエーテル78.0%配合のエーテル型展着剤。高濃度の非イオン系展着剤で、濡れ性と展着性に優れる。丸和バイオケミカル製。");

  updated += await updatePesticide("driver",
    "POE脂肪酸エステル24.0%配合のエステル型展着剤。薬剤の浸透性と展着性を高める機能性展着剤。花王開発・丸和バイオケミカル販売。");

  updated += await updatePesticide("petan-v",
    "パラフィン42.0%配合のパラフィン型展着剤（固着剤）。散布後に薬剤を植物表面に物理的に固着させ、降雨による流亡を防ぐ耐雨性付与剤。アグロカネショウ製。");

  updated += await updatePesticide("hiten-power",
    "ポリオキシアルキレン脂肪酸エステル30.0%配合のエステル型展着剤。薬剤の展着性と浸透性を向上させる非イオン系機能性展着剤。北興化学工業・ライオン共同開発。MAFF登録#20481。");

  updated += await updatePesticide("gramin-s",
    "POEノニルフェニルエーテル15.0%＋POE脂肪酸エステル5.0%＋ポリナフチルメタンスルホン酸ナトリウム4.0%配合の陰イオン＋非イオン型展着剤。陰イオン成分と非イオン成分の複合で付着性・展着性・湿展性をバランスよく発揮。三井化学CLS製。MAFF登録#10972。");

  updated += await updatePesticide("avion-e",
    "パラフィン24.0%配合のパラフィン型展着剤（固着剤）。薬液を植物表面に物理的に固着させて耐雨性を付与する。特に銅剤や保護殺菌剤との混用で効果を発揮し、降雨による薬剤流亡を大幅に低減する。アビオン製。");

  updated += await updatePesticide("makupika",
    "POEメチルポリシロキサン93.0%配合のシリコーン系展着剤。水の表面張力を約20mN/mまで低下させ、通常の展着剤を大きく凌駕する超拡展性を実現。薬液が葉の気孔にまで入り込み、葉裏への回り込みも優れる。使用量はごく微量（10Lに1〜2滴程度）で十分な効果。");

  updated += await updatePesticide("break-thru",
    "POAオキシプロピルヘプタメチルトリシロキサン80.0%配合のシリコーン系展着剤。超低表面張力により散布液を極薄く均一に広げる超拡展性展着剤。薬液の葉裏への回り込み・気孔への浸透に優れる。Evonik社開発・三共ケミカル販売。");

  updated += await updatePesticide("mix-power",
    "POEアルキルエーテル40.0%＋POEアルキルフェニルエーテル40.0%配合のエーテル型展着剤。2種のエーテル系界面活性剤配合で高い湿展性を持つ。シンジェンタ製。");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  5. 有効成分の説明文強化（短いもの）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("--- 有効成分 ---");

  let ingUpdated = 0;

  ingUpdated += await updateIngredient("diethofencarb",
    "FRACコード10（N-フェニルカーバメート系）。ベンゾイミダゾール系殺菌剤（FRAC1）に耐性を発達させた菌にも効果がある殺菌剤。チオファネートメチルとの混合剤（ゲッター水和剤）として使用される。ベンゾイミダゾール系耐性菌に対する特異的な活性を持つが、ジエトフェンカルブ自身への耐性も報告されており（Botrytis cinerea E198K変異等）、耐性リスクは高い。");

  ingUpdated += await updateIngredient("difenoconazole",
    "FRACコード3（DMI系トリアゾール系）。エルゴステロール生合成を阻害する浸透移行性殺菌剤。幅広い病害（うどんこ病・黒星病・さび病・褐斑病等）に予防・治療効果を持ち、残効性にも優れる。家庭園芸用スプレー製品（カダンプラスDX等）の殺菌成分として使用される。");

  ingUpdated += await updateIngredient("mepanipyrim",
    "FRACコード9（アニリノピリミジン系）。病原菌が植物組織に侵入する際に分泌する細胞壁分解酵素の生合成を阻害する殺菌剤。灰色かび病・うどんこ病・黒星病に予防・治療効果がある。ベニカXファインスプレーの殺菌成分として使用。ボトリチス属やベンチュリア属に高い活性。");

  ingUpdated += await updateIngredient("pyridalyl",
    "IRAC UN（未分類）。既存の殺虫剤とは全く異なる新規作用機構を持つ殺虫剤。細胞膜を破壊する作用が示唆されているがIRACでは公式分類が未確定。チョウ目（ヨトウムシ・コナガ等）とアザミウマ目害虫に高い効果を示す。既存剤に抵抗性を発達させた害虫にも有効。住友化学開発。");

  ingUpdated += await updateIngredient("mandestrobin",
    "FRACコード11（QoI系）。住友化学が開発したメトキシアセタミド型のQoI殺菌剤。ミトコンドリアの電子伝達系Complex IIIのQoサイトを阻害する。ストロビルリン系と同じ作用点だが化学構造が異なる。うどんこ病・黒星病・灰色かび病など幅広い病害に効果がある。浸透移行性を有し予防・治療効果がある。ベニカXネクストスプレーの殺菌成分として使用。");

  ingUpdated += await updateIngredient("nitenpyram",
    "IRACコード4A（ネオニコチノイド系）。ニコチン性アセチルコリン受容体に作用する殺虫剤。浸透移行性が高く、アブラムシ・コナジラミ・ヨコバイ等の吸汁害虫に速効的に効果を発揮する。ネオニコチノイド系の中では特に速効性（ノックダウン効果）に優れるが、残効性はやや短い。ベストガード水溶剤・粒剤の有効成分。");

  ingUpdated += await updateIngredient("pyrethrins",
    "IRAC 3A（天然ピレスロイド）。除虫菊（シロバナムシヨケギク Tanacetum cinerariifolium）の花から抽出された天然殺虫成分。ピレトリンI/IIとシネリンI/II等の混合物。神経のナトリウムチャネルに作用し速効的なノックダウン効果を示す。光分解が速く残効性は低いが、そのため環境への蓄積リスクが小さい。有機JAS規格で使用が認められている天然農薬。パイベニカVスプレーの有効成分。");

  ingUpdated += await updateIngredient("acrinathrin",
    "IRACコード3A（ピレスロイド系）。合成ピレスロイド系の殺虫殺ダニ剤。神経細胞のナトリウムチャネルに作用し、ハダニ・アブラムシ・コナジラミ・アザミウマ等に速効的に効果を発揮する。ピレスロイド系としては例外的にハダニに対しても高い殺ダニ活性を持つ点が特徴。アーデントフロアブル・顆粒水和剤の有効成分。耐性リスクは高い（ピレスロイド系共通のkdr変異による交差耐性）。");

  ingUpdated += await updateIngredient("flufenoxuron",
    "IRACコード15（ベンゾイルウレア系IGR）。幼虫のキチン合成を阻害し脱皮不全を引き起こす昆虫成長制御剤。チョウ目幼虫（ケムシ・ハマキムシ・ヨトウムシ等）に高い効果があり、ハダニの卵・幼虫にも有効。コナジラミ・アザミウマにもMAFF登録適用がある。成虫には効果がないため若齢幼虫期の散布が重要。カスケード乳剤の有効成分。BASF製。");

  ingUpdated += await updateIngredient("fatty-acid-glyceride",
    "物理的防除剤（気門封鎖型）。デカノイルオクタノイルグリセロールを主成分とする天然由来の脂肪酸グリセリド。害虫の気門（呼吸孔）を油膜で封鎖して窒息させる物理的な殺虫効果と、うどんこ病菌等の胞子表面を覆い発芽・侵入を阻害する物理的な殺菌効果を持つ。化学的な作用機構ではなく物理的作用のため、耐性菌・耐性害虫が発生しない。天然由来成分で安全性が高い。サンクリスタル乳剤の有効成分。");

  console.log(`\n農薬製品: ${updated}件、有効成分: ${ingUpdated}件 の説明文を更新しました`);
  console.log("=== 説明文強化が完了しました ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
