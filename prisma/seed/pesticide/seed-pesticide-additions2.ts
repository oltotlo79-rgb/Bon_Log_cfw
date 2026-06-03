 
/**
 * 追加農薬製品・スプレー型農薬のシードスクリプト（統合版）。
 * 旧 seed-pesticide-additions2.ts と seed-pesticide-spray.ts を統合。
 * 既存データは削除せず、存在しない場合のみ追加する（冪等）。
 *
 * 全製品MAFF公式データで検証済み (2026-03-28)
 * 実行: npx tsx prisma/seed/pesticide/seed-pesticide-additions2.ts
 */

import { createSeedPrismaClient } from '../shared/create-client'
import { createSeedHelpers } from '../shared/helpers'

const prisma = createSeedPrismaClient()
const {
  ensureFormulationType,
  ensureIngredient,
  ensureActiveIngredient,
  ensurePesticide,
  ensureSprayProduct,
  linkIngredient,
  linkEffect,
} = createSeedHelpers(prisma)

async function main() {
  // ══════════════════════════════════════════════════════════════
  //  Part 1: 追加農薬製品（旧 seed-pesticide-additions2.ts）
  // ══════════════════════════════════════════════════════════════
  console.log("=== 追加農薬製品の投入を開始します（第2弾） ===\n");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  新規有効成分の追加
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("--- 新規有効成分 ---");

  const ingEtoxazole = await ensureIngredient({
    slug: "etoxazole", name: "エトキサゾール", nameEn: "Etoxazole",
    iracCode: "10B",
    ingredientGroup: "ジフェニルオキサゾリン系（殺ダニ剤）",
    description: "IRACコード10B。ハダニの卵・幼虫の発育を阻害する殺ダニ剤。キチン合成阻害により脱皮不全を引き起こす。成虫への直接的な殺ダニ効果は限定的だが、処理面での殺卵効果と残効性が非常に長い。既存の殺ダニ剤に抵抗性を発達させたハダニにも有効。バロックフロアブルの有効成分。",
    resistanceRisk: "medium",
  });

  const ingStreptomycin = await ensureIngredient({
    slug: "streptomycin", name: "ストレプトマイシン", nameEn: "Streptomycin",
    fracCode: "25",
    ingredientGroup: "グルコピラノシル系抗生物質",
    description: "FRACコード25（グルコピラノシル系抗生物質）。放線菌Streptomyces griseus由来の抗生物質系殺菌剤。細菌のリボソーム30Sサブユニットに作用しタンパク質合成を阻害する。根頭癌腫病（Agrobacterium）・軟腐病（Pectobacterium）・かいよう病等の細菌性病害に有効。浸透移行性がある。ストマイ液剤の有効成分。",
    resistanceRisk: "high",
  });

  const ingOxineCopper = await ensureIngredient({
    slug: "oxine-copper", name: "オキシン銅（8-ヒドロキシキノリン銅）", nameEn: "Oxine-copper",
    fracCode: "M01",
    ingredientGroup: "有機銅系殺菌剤",
    description: "FRACコードM01（銅系殺菌剤）。8-ヒドロキシキノリンの銅錯体で、無機銅剤より安定性が高く薬害が出にくい有機銅系殺菌剤。銅イオンの殺菌作用により炭疽病・斑点病・べと病・黒とう病等に予防効果。細菌性病害にも有効。耐性菌が発生しにくい多作用点型。キノンドー水和剤の有効成分。",
    resistanceRisk: "low",
  });

  const ingSulfur = await ensureIngredient({
    slug: "sulfur", name: "硫黄", nameEn: "Sulfur",
    fracCode: "M02",
    ingredientGroup: "無機硫黄系殺菌殺ダニ剤",
    description: "FRACコードM02（無機硫黄系）。多作用点で菌のSH基含有酵素を広範に阻害する保護殺菌剤。うどんこ病・黒星病・さび病等に予防効果。殺ダニ作用もありハダニの密度抑制にも寄与する。耐性菌が発生しにくい。石灰硫黄合剤と同じ硫黄系だが液剤として単独使用可能。有機JAS規格適合。イオウフロアブルの有効成分。",
    resistanceRisk: "low",
  });

  const ingCyenopyrafen = await ensureIngredient({
    slug: "cyenopyrafen", name: "シエノピラフェン", nameEn: "Cyenopyrafen",
    iracCode: "25A",
    ingredientGroup: "β-ケトニトリル誘導体（METI-II系殺ダニ剤）",
    description: "IRACコード25A。ミトコンドリア電子伝達系Complex IIを阻害する新規殺ダニ剤。ハダニ類の卵・幼虫・若虫・成虫の全ステージに優れた速効性を示す。既存の殺ダニ剤（METI系・IGR系等）に抵抗性を発達させたハダニにも有効。日産化学開発。スターマイトフロアブルの有効成分。",
    resistanceRisk: "medium",
  });

  const ingStarch = await ensureIngredient({
    slug: "starch", name: "デンプン（ヒドロキシプロピルデンプン）", nameEn: "Hydroxypropyl starch",
    ingredientGroup: "物理的防除剤（被膜形成型）",
    description: "物理的作用により害虫を防除する天然由来成分。散布後にデンプンの粘着性皮膜が害虫の体表を覆い、気門を封鎖して窒息させる。ハダニ・アブラムシ・コナジラミに有効。化学的作用機構ではないため耐性が発生しない。有機栽培でも使用可能。粘着くん水和剤の有効成分。",
    resistanceRisk: "low",
  });

  const ingDecanoylGlyceryl = await ensureIngredient({
    slug: "decanoyl-glyceryl", name: "デカン酸グリセリル", nameEn: "Capric acid glyceryl",
    ingredientGroup: "物理的防除剤（気門封鎖型）",
    description: "天然由来の脂肪酸エステル。害虫の体表面を覆い気門を封鎖して窒息させる物理的殺虫効果と、うどんこ病菌の菌糸を被覆して死滅させる物理的殺菌効果を持つ。化学的作用ではないため耐性が発生しない。食品由来成分で安全性が高い。ロハピの有効成分。",
    resistanceRisk: "low",
  });

  const ingPenthiopyrad = await ensureIngredient({
    slug: "penthiopyrad", name: "ペンチオピラド", nameEn: "Penthiopyrad",
    fracCode: "7",
    ingredientGroup: "SDHI系（コハク酸脱水素酵素阻害剤）",
    description: "FRACコード7（SDHI系）。ミトコンドリアのコハク酸脱水素酵素（Complex II）を阻害する殺菌剤。うどんこ病・灰色かび病・黒星病・さび病等に予防・治療効果。浸透移行性がある。三井化学開発。花いとし（アースガーデン4）の殺菌成分として使用。",
    resistanceRisk: "medium",
  });

  // 既存成分のID取得
  const existingIngs = await prisma.activeIngredient.findMany({
    where: { slug: { in: ["permethrin", "bifenazate", "clothianidin", "fatty-acid-glyceride", "bt-bacillus", "hydrogenated-starch-hydrolysate", "dinotefuran", "etofenprox", "milbemectin", "myclobutanil"] } },
  });
  const ingMap: Record<string, string> = {};
  existingIngs.forEach(i => { ingMap[i.slug] = i.id; });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  農薬製品の追加
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 農薬製品 ---");

  // 1. ベニカS乳剤
  const benicaS = await ensurePesticide({
    slug: "benica-s-ec", name: "ベニカS乳剤", registrationNumber: "23112",
    pesticideType: "insecticide", formulationTypeCode: "EC",
    description: "ペルメトリン（ピレスロイド系 IRAC3A）2.0%配合の乳剤殺虫剤。ケムシ・アブラムシ・ハバチ・カメムシ等の幅広い害虫に接触毒・食毒で速効的に効果を発揮する。盆栽のケムシ防除の定番薬剤。希釈倍率200〜1,000倍。KINCHO園芸製。MAFF登録#23112。",
  });

  // 2. 園芸用キンチョールE
  const kincholE = await ensurePesticide({
    slug: "kinchol-e", name: "園芸用キンチョールE", registrationNumber: "15975",
    pesticideType: "insecticide", formulationTypeCode: "AL",
    description: "ペルメトリン（ピレスロイド系 IRAC3A）0.20%配合のエアゾル殺虫剤。針ノズル付きで、カミキリムシ幼虫（テッポウムシ）の穿入孔に直接噴射して駆除できる専用スプレー。盆栽の幹に穿孔するゴマダラカミキリ・クビアカツヤカミキリ等の幼虫防除に不可欠。大日本除虫菊（KINCHO）製。MAFF登録#15975。",
  });

  // 3. バロックフロアブル
  const baroque = await ensurePesticide({
    slug: "baroque-fl", name: "バロックフロアブル", registrationNumber: "19962",
    pesticideType: "acaricide", formulationTypeCode: "FL",
    description: "エトキサゾール（IRAC 10B）10.0%配合のフロアブル殺ダニ剤。ハダニの卵・幼虫のキチン合成を阻害し脱皮不全を引き起こすIGR型殺ダニ剤。成虫への直接効果は限定的だが、殺卵効果と残効性が非常に長い。既存薬に耐性のハダニにも有効。殺ダニ剤ローテーションの重要パートナー。希釈倍率2,000倍。協友アグリ製。MAFF登録#19962。",
  });

  // 4. ダニ太郎
  const danitaro = await ensurePesticide({
    slug: "danitaro", name: "ダニ太郎", registrationNumber: "21968",
    pesticideType: "acaricide", formulationTypeCode: "FL",
    description: "ビフェナゼート（IRAC 20D カルバジン酸エステル系）20.0%配合のフロアブル殺ダニ剤。ハダニ類に対して高い速効性を持つ接触型殺ダニ剤。卵・幼虫・成虫の全ステージに有効。既存殺ダニ剤との交差耐性が低くローテーション散布に適する。希釈倍率1,000倍。KINCHO園芸製。MAFF登録#21968。",
  });

  // 5. ストマイ液剤20
  const stomai = await ensurePesticide({
    slug: "stomai-sl", name: "ストマイ液剤20", registrationNumber: "24455",
    pesticideType: "fungicide", formulationTypeCode: "SL",
    description: "ストレプトマイシン硫酸塩25.0%（ストレプトマイシンとして20.0%）配合の液剤殺菌剤（FRAC 25 アミノグリコシド系抗生物質）。細菌性病害に特化した抗生物質系殺菌剤。根頭癌腫病（Agrobacterium）・軟腐病（Pectobacterium）・かいよう病等に有効。ウメ・サクラ・バラ等バラ科盆栽の癌腫病予防に重要。希釈倍率1,000〜2,000倍。協友アグリ製。MAFF登録#24455。",
  });

  // 6. キノンドー水和剤40
  const quinondo = await ensurePesticide({
    slug: "quinondo-wp", name: "キノンドー水和剤40", registrationNumber: "8086",
    pesticideType: "fungicide", formulationTypeCode: "WP",
    description: "オキシン銅（8-ヒドロキシキノリン銅）40.0%配合の水和剤殺菌剤（FRAC M01 有機銅系）。無機銅剤より薬害が出にくい有機銅系の保護殺菌剤。炭疽病・斑点病・べと病・黒とう病・褐斑病・そうか病等に予防効果。細菌性病害にも有効。耐性菌が発生しにくい多作用点型。希釈倍率600〜800倍。アグロカネショウ製。MAFF登録#8086。",
  });

  // 7. イオウフロアブル
  const sulfurFL = await ensurePesticide({
    slug: "sulfur-fl", name: "イオウフロアブル", registrationNumber: "17827",
    pesticideType: "fungicide", formulationTypeCode: "FL", // MAFF公式: 殺菌剤（硫黄水和剤）
    description: "硫黄52.0%配合のフロアブル殺菌殺ダニ剤（FRAC M02）。多作用点型の保護殺菌剤で、うどんこ病・黒星病・さび病等に予防効果。殺ダニ作用もありハダニの密度抑制に寄与。石灰硫黄合剤の代替として休眠期以外にも使用でき入手が容易。有機JAS規格適合。希釈倍率200〜600倍。日本農薬製。MAFF登録#17827。",
  });

  // 8. スターマイトフロアブル
  const starmite = await ensurePesticide({
    slug: "starmite-fl", name: "スターマイトフロアブル", registrationNumber: "22305",
    pesticideType: "acaricide", formulationTypeCode: "FL",
    description: "シエノピラフェン（IRAC 25A β-ケトニトリル誘導体）30.0%配合のフロアブル殺ダニ剤。ミトコンドリアComplex II阻害の新世代殺ダニ剤。ハダニの全ステージ（卵・幼虫・若虫・成虫）に優れた速効性。既存殺ダニ剤に抵抗性を発達させたハダニにも有効。殺ダニ剤ローテーションの新たな選択肢。希釈倍率2,000倍。日産化学製。MAFF登録#22305。",
  });

  // 9. アーリーセーフ
  const earlySafe = await ensurePesticide({
    slug: "early-safe", name: "アーリーセーフ", registrationNumber: "21767",
    pesticideType: "insecticide", formulationTypeCode: "EC", // MAFF公式: 殺虫剤（脂肪酸グリセリド乳剤）
    description: "脂肪酸グリセリド（デカノイルオクタノイルグリセロール）90.0%配合の乳剤殺虫殺菌剤。害虫の気門を油膜で封鎖して窒息させる物理的防除剤。アブラムシ・ハダニ・コナジラミに有効。うどんこ病菌にも効果。天然由来成分で有機JAS規格適合。サンクリスタル乳剤と同一有効成分だが家庭園芸向け製品。希釈倍率300〜600倍。富士グリーン製。MAFF登録#21767。",
  });

  // 10. 粘着くん水和剤
  const nenchaku = await ensurePesticide({
    slug: "nenchakukun-wp", name: "粘着くん水和剤", registrationNumber: "21513",
    pesticideType: "insecticide", formulationTypeCode: "WP",
    description: "デンプン（ヒドロキシプロピルデンプン）40.0%配合の水和剤殺虫剤。散布後にデンプンの粘着性皮膜が害虫の体表を覆い気門を封鎖して窒息させる物理的防除剤。ハダニ・アブラムシ・コナジラミに有効。化学的作用ではないため耐性が発生せず、殺ダニ剤ローテーションのリセット剤としても活用できる。有機栽培可能。希釈倍率100倍。住友化学製。MAFF登録#21513。",
  });

  // 11. ベニカマツケア
  const matsukea = await ensurePesticide({
    slug: "benica-matsukea", name: "ベニカマツケア", registrationNumber: "22876",
    pesticideType: "insecticide", formulationTypeCode: "SL",
    description: "クロチアニジン（ネオニコチノイド系 IRAC4A）2.0%配合の液剤殺虫剤。マツ専用の樹幹注入剤で、マツノマダラカミキリ（松くい虫の媒介者）を防除しマツノザイセンチュウの感染を予防する。1回の注入で約2ヶ月間の予防効果。松盆栽（黒松・赤松・五葉松等）の松枯れ防止に。KINCHO園芸製。MAFF登録#22876。",
  });

  // 12. ロハピ
  const rohapi = await ensurePesticide({
    slug: "rohapi", name: "ロハピ", registrationNumber: "24181",
    pesticideType: "insecticide", formulationTypeCode: "AL", // MAFF公式: 殺虫剤（カプリン酸グリセリル乳剤）
    description: "デカン酸グリセリル0.050%配合のスプレー殺虫殺菌剤。食品由来成分で害虫の体表を覆い気門を封鎖して窒息させる物理的防除剤。アブラムシ・ハダニ・コナジラミに殺虫効果、うどんこ病に殺菌効果。収穫前日まで使用可能で安全性が高い。希釈不要のスプレータイプ。アース製薬製。MAFF登録#24181。",
  });

  // 13. ベニカXガード粒剤
  const benicaXGuard = await ensurePesticide({
    slug: "benica-x-guard-gr", name: "ベニカXガード粒剤", registrationNumber: "24274",
    pesticideType: "compound", formulationTypeCode: "GR",
    description: "クロチアニジン0.10%＋BT菌（バチルス・チューリンゲンシス菌）10.0%配合の粒剤殺虫殺菌剤。株元にまくだけでネオニコチノイドの浸透移行性による吸汁害虫防除と、BT菌の土壌中での増殖による病害（黒星病・灰色かび病等）の予防効果を同時に発揮。KINCHO園芸製。MAFF登録#24274。",
  });

  // 14. 花いとし（アースガーデン4）
  const hanaitoshi = await ensurePesticide({
    slug: "hanaitoshi-spray", name: "花いとし（アースガーデン4）", registrationNumber: "24316",
    pesticideType: "compound", formulationTypeCode: "AL",
    description: "エトフェンプロックス0.020%＋ジノテフラン0.010%＋ミルベメクチン0.00050%＋ペンチオピラド0.010%の4成分配合スプレー殺虫殺菌剤。殺虫3成分（ピレスロイド系+ネオニコチノイド系+アベルメクチン系）と殺菌1成分（SDHI系）で幅広い害虫と病害を1本で防除。アース製薬製。MAFF登録#24316。",
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  有効成分リンク
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 有効成分リンク ---");

  await linkIngredient(benicaS, ingMap["permethrin"], "2.0%");
  await linkIngredient(kincholE, ingMap["permethrin"], "0.20%");
  await linkIngredient(baroque, ingEtoxazole, "10.0%");
  await linkIngredient(danitaro, ingMap["bifenazate"], "20.0%");
  await linkIngredient(stomai, ingStreptomycin, "25.0%（ストレプトマイシンとして20.0%）");
  await linkIngredient(quinondo, ingOxineCopper, "40.0%");
  await linkIngredient(sulfurFL, ingSulfur, "52.0%");
  await linkIngredient(starmite, ingCyenopyrafen, "30.0%");
  await linkIngredient(earlySafe, (await prisma.activeIngredient.findUnique({ where: { slug: "fatty-acid-glyceride" } }))!.id, "90.0%");
  await linkIngredient(nenchaku, ingStarch, "40.0%");
  await linkIngredient(matsukea, ingMap["clothianidin"], "2.0%");
  await linkIngredient(rohapi, ingDecanoylGlyceryl, "0.050%");
  await linkIngredient(benicaXGuard, ingMap["clothianidin"], "0.10%");
  await linkIngredient(benicaXGuard, (await prisma.activeIngredient.findUnique({ where: { slug: "bt-bacillus" } }))!.id, "10.0%");
  await linkIngredient(hanaitoshi, ingMap["etofenprox"], "0.020%");
  await linkIngredient(hanaitoshi, ingMap["dinotefuran"], "0.010%");
  await linkIngredient(hanaitoshi, ingMap["milbemectin"], "0.00050%");
  await linkIngredient(hanaitoshi, ingPenthiopyrad, "0.010%");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  効果リンク
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 効果リンク ---");

  // ベニカS乳剤: ピレスロイド系接触毒
  await linkEffect(benicaS, "kemushi-imomushi", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "fair" });
  await linkEffect(benicaS, "aburamushi", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "good", persistenceLevel: "fair" });
  await linkEffect(benicaS, "hamakimushi", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "fair" });
  await linkEffect(benicaS, "kamemushi", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "good", persistenceLevel: "fair" });
  await linkEffect(benicaS, "kabura-habachi", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "fair" });

  // 園芸用キンチョールE: テッポウムシ専用
  await linkEffect(kincholE, "gomadara-kamikiri", { efficacyLevel: "excellent", persistenceLevel: "good", note: "穿入孔に針ノズルで直接噴射" });
  await linkEffect(kincholE, "kubiaka-tsuyakamikiri", { efficacyLevel: "excellent", persistenceLevel: "good", note: "穿入孔に直接噴射" });

  // バロックフロアブル: IGR型殺ダニ剤
  await linkEffect(baroque, "hadani", { preventionLevel: "excellent", treatmentLevel: "poor", efficacyLevel: "good", persistenceLevel: "excellent", note: "卵・幼虫に特化。成虫への即効性は低いが残効性が非常に長い" });
  await linkEffect(baroque, "nami-hadani", { preventionLevel: "excellent", treatmentLevel: "poor", efficacyLevel: "good", persistenceLevel: "excellent" });
  await linkEffect(baroque, "kanzawa-hadani", { preventionLevel: "excellent", treatmentLevel: "poor", efficacyLevel: "good", persistenceLevel: "excellent" });
  await linkEffect(baroque, "tsuya-hadani", { preventionLevel: "excellent", treatmentLevel: "poor", efficacyLevel: "good", persistenceLevel: "excellent" });

  // ダニ太郎: 接触型殺ダニ剤
  await linkEffect(danitaro, "hadani", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "good" });
  await linkEffect(danitaro, "nami-hadani", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "good" });
  await linkEffect(danitaro, "kanzawa-hadani", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "good" });

  // ストマイ液剤: 細菌性病害
  // kontou-ganshu-byo（根頭癌腫病）削除: 癌腫はAgrobacteriumのT-DNA組込みで形質転換した植物細胞の増殖であり抗生物質では治療不能。防除はバイオ防除(K84株)。ストマイ液剤(MAFF#24455)も癌腫病は適用外
  await linkEffect(stomai, "nanpu-byo", { preventionLevel: "good", treatmentLevel: "fair", efficacyLevel: "good", persistenceLevel: "fair" });
  await linkEffect(stomai, "kaiyou-saikin-byo", { preventionLevel: "good", treatmentLevel: "good", efficacyLevel: "good", persistenceLevel: "fair" });

  // キノンドー水和剤: 有機銅系保護殺菌剤
  await linkEffect(quinondo, "tanso-byo", { preventionLevel: "excellent", treatmentLevel: "none", efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(quinondo, "hanten-byo", { preventionLevel: "excellent", treatmentLevel: "none", efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(quinondo, "beto-byo", { preventionLevel: "excellent", treatmentLevel: "none", efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(quinondo, "kappan-byo", { preventionLevel: "excellent", treatmentLevel: "none", efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(quinondo, "kaiyou-byo", { preventionLevel: "good", treatmentLevel: "none", efficacyLevel: "good", persistenceLevel: "fair" });

  // イオウフロアブル: 硫黄系殺菌殺ダニ
  await linkEffect(sulfurFL, "udonko-byo", { preventionLevel: "excellent", treatmentLevel: "fair", efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(sulfurFL, "kuroboshi-byo", { preventionLevel: "good", treatmentLevel: "none", efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(sulfurFL, "sabi-byo", { preventionLevel: "good", treatmentLevel: "none", efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(sulfurFL, "hadani", { preventionLevel: "fair", treatmentLevel: "fair", efficacyLevel: "fair", persistenceLevel: "fair", note: "殺ダニ補助効果。専用殺ダニ剤の代替にはならない" });
  await linkEffect(sulfurFL, "nami-hadani", { preventionLevel: "fair", treatmentLevel: "fair", efficacyLevel: "fair", persistenceLevel: "fair" });
  await linkEffect(sulfurFL, "kanzawa-hadani", { preventionLevel: "fair", treatmentLevel: "fair", efficacyLevel: "fair", persistenceLevel: "fair" });

  // スターマイトフロアブル: 新世代殺ダニ剤
  await linkEffect(starmite, "hadani", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "good" });
  await linkEffect(starmite, "nami-hadani", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "good" });
  await linkEffect(starmite, "kanzawa-hadani", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "good" });
  await linkEffect(starmite, "tsuya-hadani", { preventionLevel: "fair", treatmentLevel: "excellent", efficacyLevel: "excellent", persistenceLevel: "good" });

  // アーリーセーフ: 物理的防除
  await linkEffect(earlySafe, "hadani", { efficacyLevel: "good", persistenceLevel: "poor", note: "物理的気門封鎖。残効性なし、繰り返し散布が必要" });
  await linkEffect(earlySafe, "aburamushi", { efficacyLevel: "good", persistenceLevel: "poor" });
  await linkEffect(earlySafe, "konajirami", { efficacyLevel: "good", persistenceLevel: "poor" });
  await linkEffect(earlySafe, "udonko-byo", { preventionLevel: "fair", treatmentLevel: "fair", efficacyLevel: "fair", persistenceLevel: "poor" });

  // 粘着くん水和剤: デンプン被膜型
  await linkEffect(nenchaku, "hadani", { efficacyLevel: "good", persistenceLevel: "poor", note: "デンプン皮膜で窒息防除。耐性なし" });
  await linkEffect(nenchaku, "nami-hadani", { efficacyLevel: "good", persistenceLevel: "poor" });
  await linkEffect(nenchaku, "kanzawa-hadani", { efficacyLevel: "good", persistenceLevel: "poor" });
  await linkEffect(nenchaku, "aburamushi", { efficacyLevel: "good", persistenceLevel: "poor" });
  await linkEffect(nenchaku, "konajirami", { efficacyLevel: "good", persistenceLevel: "poor" });

  // ベニカマツケア: 松専用
  await linkEffect(matsukea, "matsunomadara-kamikiri", { preventionLevel: "excellent", treatmentLevel: "none", efficacyLevel: "excellent", persistenceLevel: "excellent", note: "樹幹注入で約2ヶ月間予防。マツノザイセンチュウ感染予防が目的" });

  // ロハピ: 物理的防除スプレー
  await linkEffect(rohapi, "aburamushi", { efficacyLevel: "good", persistenceLevel: "poor" });
  await linkEffect(rohapi, "hadani", { efficacyLevel: "fair", persistenceLevel: "poor" });
  await linkEffect(rohapi, "konajirami", { efficacyLevel: "good", persistenceLevel: "poor" });
  await linkEffect(rohapi, "udonko-byo", { preventionLevel: "fair", treatmentLevel: "fair", efficacyLevel: "fair", persistenceLevel: "poor" });

  // ベニカXガード粒剤
  await linkEffect(benicaXGuard, "aburamushi", { preventionLevel: "good", treatmentLevel: "good", efficacyLevel: "good", persistenceLevel: "excellent", note: "クロチアニジンの浸透移行性" });
  await linkEffect(benicaXGuard, "konajirami", { preventionLevel: "good", treatmentLevel: "good", efficacyLevel: "good", persistenceLevel: "excellent" });
  await linkEffect(benicaXGuard, "azamiuma", { preventionLevel: "good", treatmentLevel: "good", efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(benicaXGuard, "kuroboshi-byo", { preventionLevel: "good", treatmentLevel: "none", efficacyLevel: "good", persistenceLevel: "good", note: "BT菌の土壌中での生物的防除効果" });
  await linkEffect(benicaXGuard, "haiiro-kabi-byo", { preventionLevel: "good", treatmentLevel: "none", efficacyLevel: "good", persistenceLevel: "good" });

  // 花いとし: 4成分複合スプレー
  await linkEffect(hanaitoshi, "aburamushi", { efficacyLevel: "excellent", persistenceLevel: "good", note: "ジノテフラン（浸透移行性）+エトフェンプロックス（接触毒）の相乗効果" });
  await linkEffect(hanaitoshi, "hadani", { efficacyLevel: "good", persistenceLevel: "fair", note: "ミルベメクチン成分のハダニ効果" });
  await linkEffect(hanaitoshi, "konajirami", { efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(hanaitoshi, "kemushi-imomushi", { efficacyLevel: "good", persistenceLevel: "fair" });
  await linkEffect(hanaitoshi, "udonko-byo", { preventionLevel: "good", treatmentLevel: "good", efficacyLevel: "good", persistenceLevel: "good", note: "ペンチオピラド（SDHI系）の殺菌効果" });
  await linkEffect(hanaitoshi, "kuroboshi-byo", { preventionLevel: "good", treatmentLevel: "good", efficacyLevel: "good", persistenceLevel: "good" });
  await linkEffect(hanaitoshi, "sabi-byo", { preventionLevel: "good", treatmentLevel: "fair", efficacyLevel: "good", persistenceLevel: "good" });

  console.log("\n=== 追加農薬製品の投入が完了しました ===");

  // ══════════════════════════════════════════════════════════════
  //  Part 2: スプレー型農薬（旧 seed-pesticide-spray.ts）
  // ══════════════════════════════════════════════════════════════
  console.log('\n=== スプレータイプ薬剤の追加を開始します ===\n')

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
    resistanceRisk: 'high',
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
    resistanceRisk: 'high',
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
  const benicaXFine = await ensureSprayProduct({
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
  const benicaXNext = await ensureSprayProduct({
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
  const benicaGreenV = await ensureSprayProduct({
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
  const kadanPlusDX = await ensureSprayProduct({
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
  const ortranC = await ensureSprayProduct({
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

  // ベニカスプレー（plain）は架空製品のため削除。実在するのはベニカXスプレー、ベニカXファインスプレー等。

  // ══════════════════════════════════════════════════════════
  //  7. マイローズ殺菌スプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 7. マイローズ殺菌スプレー ---')
  const myRose = await ensureSprayProduct({
    slug: 'my-rose-fungicide-spray',
    name: 'マイローズ殺菌スプレー',
    registrationNumber: '23374',
    pesticideType: 'fungicide',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸のバラ向け殺菌スプレー。ミクロブタニル（EBI系）配合で、うどんこ病・黒星病に対して予防・治療効果を発揮する。発症後の散布でも進行を止める治療効果があるのが特長。希釈せずそのまま使用。',
  })
  await linkIngredient(myRose.id, ingMyclobutanil!.id, '0.0080%')
  // ミクロブタニル（FRAC3 EBI系）: 治療効果が特に高い。
  await linkEffect(myRose.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'excellent', persistenceLevel: 'good', note: 'ミクロブタニルのEBI作用。発症後でも菌の進展を抑制' })
  await linkEffect(myRose.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(myRose.id, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(myRose.id, 'hanten-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'fair', note: 'ミクロブタニルで限定的な効果' })

  // ══════════════════════════════════════════════════════════
  //  8. ベニカマイルドスプレー
  // ══════════════════════════════════════════════════════════
  console.log('\n--- 8. ベニカマイルドスプレー ---')
  const benicaMild = await ensureSprayProduct({
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
  const benicaVegiFru = await ensureSprayProduct({
    slug: 'benica-vegifru-spray',
    name: 'ベニカベジフルスプレー',
    registrationNumber: '23121',
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の野菜・果樹向け殺虫スプレー。クロチアニジン（浸透移行性ネオニコチノイド系 IRAC4A）単剤。浸透移行性により葉裏の害虫にも効果を発揮する。殺菌成分は含まない（殺菌成分を含むのはベニカベジフルVスプレー#23491）。MAFF登録#23121。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaVegiFru.id, ingClothianidin!.id, '0.0080%')
  // ※マンデストロビンは含まない（MAFF#23121確認済み。ベジフルVスプレーとの混同注意）
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
  const benicaJ = await ensureSprayProduct({
    slug: 'benica-j-spray',
    name: 'ベニカJスプレー',
    registrationNumber: '23130',
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の殺虫スプレー。クロチアニジン（ネオニコチノイド系IRAC4A）+フェンプロパトリン（ピレスロイド系IRAC3A）の2成分配合。クロチアニジンの浸透移行性で葉裏の害虫に持続効果、フェンプロパトリンの速効性でケムシ・ハダニにも対応。MAFF登録#23130。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaJ.id, ingClothianidin!.id, '0.0080%')
  await linkIngredient(benicaJ.id, ingFenpropathrin!.id, '0.010%')
  // クロチアニジン+フェンプロパトリン: 浸透移行性+速効性の組み合わせ
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
  const benicaX = await ensureSprayProduct({
    slug: 'benica-x-spray',
    name: 'ベニカXスプレー',
    registrationNumber: '20643',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の殺虫殺菌スプレー。ペルメトリン（ピレスロイド系殺虫）とミクロブタニル（EBI系殺菌）を配合。害虫の速効駆除と病気の予防・治療を同時に行える。ベニカXファインスプレーの前身モデルで、シンプルな2成分構成。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaX.id, ingPermethrin!.id, '0.010%') // MAFF公式: 0.010%
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
  const kadanSafe = await ensureSprayProduct({
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
  const attackOneAL = await ensureSprayProduct({
    slug: 'attack-one-al',
    name: 'アタックワンAL',
    registrationNumber: '20854',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸のバラ向け殺虫殺菌スプレー。ビフェントリン（ピレスロイド系殺虫・殺ダニ）とミクロブタニル（EBI系殺菌）を配合。ビフェントリンはハダニにも効果があるため、バラの3大トラブル（害虫・ハダニ・病気）に1本で対応可能。希釈せずそのまま使用。',
  })
  await linkIngredient(attackOneAL.id, ingBifenthrin.id, '0.0030%')
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
  const pyBenicaV = await ensureSprayProduct({
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
  const benicaNatural = await ensureSprayProduct({
    slug: 'benica-natural-spray',
    name: 'ベニカナチュラルスプレー',
    registrationNumber: '24643',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description:
      '住友化学園芸の天然由来物理防除スプレー。有効成分の還元澱粉糖化物が害虫・ハダニの気門を塞ぎ窒息させ、うどんこ病菌を被覆して死滅させる。化学農薬成分を使わないため、野菜・果樹にも収穫前日まで使用可能。有機JAS規格適合。ベニカマイルドスプレーの後継品。希釈せずそのまま使用。',
  })
  await linkIngredient(benicaNatural.id, ingHSH.id, '0.60%')
  // 調合油（サフラワー油＋綿実油）0.32% — MAFF#24643
  // ensureActiveIngredient: パーサー互換のため .id パターンで統一（ensureIngredient は id を直接返すがパーサーが拾えない）
  const ingBlendedOil = await ensureActiveIngredient({
    slug: "blended-oil", name: "調合油（サフラワー油及び綿実油）", nameEn: "Blended oil (safflower and cottonseed oil)",
    ingredientGroup: "物理的防除剤（植物油系）",
    description: "サフラワー油と綿実油を調合した植物油。害虫の気門を封鎖して窒息させる物理的防除成分。化学的作用機構ではないため耐性が発生しない。ベニカナチュラルスプレーの有効成分の一つ。",
    resistanceRisk: "low",
  })
  await linkIngredient(benicaNatural.id, ingBlendedOil.id, '0.32%')
  // BT菌 10.0% — MAFF#24643
  const ingBtForNatural = await prisma.activeIngredient.findUnique({ where: { slug: 'bt-bacillus' } })
  if (ingBtForNatural) {
    await linkIngredient(benicaNatural.id, ingBtForNatural.id, '10.0%')
  }
  // 還元澱粉糖化物+調合油: 物理的防除（気門封鎖・被覆）
  await linkEffect(benicaNatural.id, 'udonko-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', persistenceLevel: 'poor', note: '物理的に菌糸を被覆。繰り返し散布が必要' })
  await linkEffect(benicaNatural.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'poor', note: '直接かかった害虫に効果。残効性なし' })
  await linkEffect(benicaNatural.id, 'hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(benicaNatural.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(benicaNatural.id, 'nami-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  await linkEffect(benicaNatural.id, 'kanzawa-hadani', { efficacyLevel: 'good', persistenceLevel: 'poor' })
  // BT菌: 鱗翅目害虫への特異的殺虫効果（MAFF#24643 BT菌10.0%）
  await linkEffect(benicaNatural.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'BT菌の鱗翅目特異的殺虫効果' })
  await linkEffect(benicaNatural.id, 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaNatural.id, 'chadokuga', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaNatural.id, 'hasumon-yotou', { efficacyLevel: 'good', persistenceLevel: 'fair' })

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
    await linkEffect(sanyol.id, 'hadani', { efficacyLevel: 'fair', persistenceLevel: 'poor' })
    await linkEffect(sanyol.id, 'konajirami', { efficacyLevel: 'fair', persistenceLevel: 'poor' })
    await linkEffect(sanyol.id, 'onshitsu-konajirami', { efficacyLevel: 'fair', persistenceLevel: 'poor' })
    await linkEffect(sanyol.id, 'namekuji', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'MAFF適用表登録。界面活性剤の接触効果' })
    console.log('  サンヨール液剤AL 効果データ追加完了')
  } else {
    console.warn('  ⚠ sanyouru-ekizai-al が見つかりません。seed-pesticide-additions.ts を先に実行してください。')
  }

  // ══════════════════════════════════════════════════════════
  //  Part 3: maff-reference-pending.csv 由来の追加製品 (8件)
  // ══════════════════════════════════════════════════════════
  console.log('\n=== pending製品の追加を開始します ===\n')

  // ── 新規有効成分（ensureActiveIngredientで統一: .idパターンでパーサー互換） ──
  const ingFlubendiamide = await ensureActiveIngredient({
    slug: 'flubendiamide',
    name: 'フルベンジアミド',
    nameEn: 'Flubendiamide',
    iracCode: '28',
    ingredientGroup: 'ジアミド系（リアノジン受容体作用）',
    description: 'IRACコード28（ジアミド系）。昆虫の筋肉細胞のリアノジン受容体に作用し、筋収縮を制御不能にして殺虫効果を発揮する。チョウ目（ヨトウムシ・コナガ等）に特に高い活性。日本農薬開発。カダンMAXの殺虫成分として使用。',
    resistanceRisk: 'medium',
  })

  const ingPyraziflumid = await ensureActiveIngredient({
    slug: 'pyraziflumid',
    name: 'ピラジフルミド',
    nameEn: 'Pyraziflumid',
    fracCode: '7',
    ingredientGroup: 'SDHI系（コハク酸脱水素酵素阻害剤）',
    description: 'FRACコード7（SDHI系）。ミトコンドリアのコハク酸脱水素酵素（Complex II）を阻害する新世代殺菌剤。うどんこ病・灰色かび病・黒星病等に予防・治療効果。日本曹達開発。カダンMAXの殺菌成分として使用。',
    resistanceRisk: 'medium',
  })

  // 既存成分の追加取得
  const ingThiophanate = await prisma.activeIngredient.findUnique({ where: { slug: 'thiophanate-methyl' } })
  const ingFlonicamid = await prisma.activeIngredient.findUnique({ where: { slug: 'flonicamid' } })
  const ingAcetamiprid = await prisma.activeIngredient.findUnique({ where: { slug: 'acetamiprid' } })
  const ingEtofenprox = await prisma.activeIngredient.findUnique({ where: { slug: 'etofenprox' } })
  const ingDinotefuran = await prisma.activeIngredient.findUnique({ where: { slug: 'dinotefuran' } })

  // ── 15. GFモストップジンRスプレー ──
  console.log('\n--- 15. GFモストップジンRスプレー ---')
  const mostopjinR = await ensureSprayProduct({
    slug: 'mostopjin-r-spray',
    name: 'GFモストップジンRスプレー',
    registrationNumber: '22952',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description: 'アセタミプリド0.0050%＋フェンプロパトリン0.010%＋チオファネートメチル0.040%の3成分配合殺虫殺菌スプレー。ネオニコチノイド系（浸透移行性）＋ピレスロイド系（接触殺虫）＋ベンズイミダゾール系（殺菌）で害虫と病害を同時防除。KINCHO園芸製。MAFF登録#22952。',
  })
  if (ingAcetamiprid) await linkIngredient(mostopjinR.id, ingAcetamiprid.id, '0.0050%')
  if (ingFenpropathrin) await linkIngredient(mostopjinR.id, ingFenpropathrin!.id, '0.010%')
  if (ingThiophanate) await linkIngredient(mostopjinR.id, ingThiophanate.id, '0.040%')
  await linkEffect(mostopjinR.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'アセタミプリドの浸透移行性＋フェンプロパトリンの接触効果' })
  await linkEffect(mostopjinR.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(mostopjinR.id, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(mostopjinR.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'フェンプロパトリンの接触・食毒' })
  await linkEffect(mostopjinR.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good', note: 'チオファネートメチル（FRAC1）の浸透移行性殺菌' })
  await linkEffect(mostopjinR.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(mostopjinR.id, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })

  // ── 16. ベニカAスプレー ──
  console.log('\n--- 16. ベニカAスプレー ---')
  const benicaA = await ensureSprayProduct({
    slug: 'benica-a-spray',
    name: 'ベニカAスプレー',
    registrationNumber: '24360',
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description: 'ペルメトリン0.010%配合の殺虫スプレー。ピレスロイド系の速効性接触殺虫剤。ケムシ・アブラムシ・ハバチ等の幅広い害虫に効果。希釈不要のスプレータイプ。KINCHO園芸製。MAFF登録#24360。',
  })
  if (ingPermethrin) await linkIngredient(benicaA.id, ingPermethrin!.id, '0.010%')
  await linkEffect(benicaA.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'ペルメトリンの接触・食毒' })
  await linkEffect(benicaA.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaA.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaA.id, 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaA.id, 'chadokuga', { efficacyLevel: 'good', persistenceLevel: 'fair' })

  // ── 17. ベニカVフレッシュスプレー ──
  console.log('\n--- 17. ベニカVフレッシュスプレー ---')
  const benicaVFresh = await ensureSprayProduct({
    slug: 'benica-v-fresh-spray',
    name: 'ベニカVフレッシュスプレー',
    registrationNumber: '24118',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description: '還元澱粉糖化物0.60%＋クロチアニジン0.0080%＋マンデストロビン0.020%の3成分配合殺虫殺菌スプレー。物理的防除（気門封鎖）＋浸透移行性殺虫（ネオニコチノイド）＋QoI系殺菌の複合効果。KINCHO園芸製。MAFF登録#24118。',
  })
  await linkIngredient(benicaVFresh.id, ingHSH.id, '0.60%')
  if (ingClothianidin) await linkIngredient(benicaVFresh.id, ingClothianidin!.id, '0.0080%')
  await linkIngredient(benicaVFresh.id, ingMandestrobin.id, '0.020%')
  await linkEffect(benicaVFresh.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'クロチアニジンの浸透移行性＋還元澱粉糖化物の物理的効果' })
  await linkEffect(benicaVFresh.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(benicaVFresh.id, 'hadani', { efficacyLevel: 'fair', persistenceLevel: 'poor', note: '還元澱粉糖化物の物理的効果のみ' })
  await linkEffect(benicaVFresh.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good', note: 'マンデストロビン（QoI系 FRAC11）の殺菌効果' })
  await linkEffect(benicaVFresh.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })
  await linkEffect(benicaVFresh.id, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })

  // ── 18. ベニカRスプレー ──
  console.log('\n--- 18. ベニカRスプレー ---')
  const benicaR = await ensureSprayProduct({
    slug: 'benica-r-spray',
    name: 'ベニカRスプレー',
    registrationNumber: '23798',
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description: 'フェンプロパトリン0.010%配合の殺虫スプレー。ピレスロイド系の接触殺虫剤。バラのアブラムシ・チュウレンジハバチ等の害虫に効果。バラ用として開発されたが盆栽のバラ科樹種にも使用可能。KINCHO園芸製。MAFF登録#23798。',
  })
  if (ingFenpropathrin) await linkIngredient(benicaR.id, ingFenpropathrin!.id, '0.010%')
  await linkEffect(benicaR.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'フェンプロパトリンの接触効果' })
  await linkEffect(benicaR.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaR.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(benicaR.id, 'gunbaimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })

  // ── 19. ベニカベジフルVスプレー ──
  console.log('\n--- 19. ベニカベジフルVスプレー ---')
  const benicaVegifru = await ensureSprayProduct({
    slug: 'benica-vegifru-v-spray',
    name: 'ベニカベジフルVスプレー',
    registrationNumber: '23491',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description: 'クロチアニジン0.0080%＋ミクロブタニル0.0025%配合の殺虫殺菌スプレー。ネオニコチノイド系の浸透移行性殺虫＋EBI系殺菌で害虫・病害を同時防除。野菜・果樹向けだが盆栽の実もの樹種にも活用可能。KINCHO園芸製。MAFF登録#23491。',
  })
  if (ingClothianidin) await linkIngredient(benicaVegifru.id, ingClothianidin!.id, '0.0080%')
  if (ingMyclobutanil) await linkIngredient(benicaVegifru.id, ingMyclobutanil!.id, '0.0025%')
  await linkEffect(benicaVegifru.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'クロチアニジンの浸透移行性' })
  await linkEffect(benicaVegifru.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(benicaVegifru.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'excellent', persistenceLevel: 'good', note: 'ミクロブタニル（EBI系）の治療効果が高い' })
  await linkEffect(benicaVegifru.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(benicaVegifru.id, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })

  // ── 20. アースガーデンT ──
  console.log('\n--- 20. アースガーデンT ---')
  const earthGardenT = await ensureSprayProduct({
    slug: 'earth-garden-t',
    name: 'アースガーデンT',
    registrationNumber: '23198',
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description: 'エトフェンプロックス0.020%配合の殺虫スプレー。ピレスロイド系（IRAC3A）の接触・食毒性殺虫剤。ケムシ・アブラムシ等の幅広い害虫に速効性。家庭園芸向けスプレータイプ。アース製薬製。MAFF登録#23198。',
  })
  if (ingEtofenprox) await linkIngredient(earthGardenT.id, ingEtofenprox.id, '0.020%')
  await linkEffect(earthGardenT.id, 'kemushi-imomushi', { efficacyLevel: 'good', persistenceLevel: 'fair', note: 'エトフェンプロックスの接触・食毒' })
  await linkEffect(earthGardenT.id, 'aburamushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(earthGardenT.id, 'kabura-habachi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(earthGardenT.id, 'hamakimushi', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(earthGardenT.id, 'chadokuga', { efficacyLevel: 'good', persistenceLevel: 'fair' })

  // ── 21. オールスタースプレー ──
  console.log('\n--- 21. オールスタースプレー ---')
  const allstar = await ensureSprayProduct({
    slug: 'allstar-spray',
    name: 'オールスタースプレー',
    registrationNumber: '23506',
    pesticideType: 'insecticide',
    formulationTypeId: ftAL.id,
    description: 'ジノテフラン0.010%配合の殺虫スプレー。ネオニコチノイド系（IRAC4A）の浸透移行性殺虫剤。葉面散布で有効成分が植物体内に浸透し、吸汁害虫を持続的に防除。アース製薬/三井化学CLS製。MAFF登録#23506。',
  })
  if (ingDinotefuran) await linkIngredient(allstar.id, ingDinotefuran.id, '0.010%')
  await linkEffect(allstar.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'excellent', note: 'ジノテフランの浸透移行性で持続的効果' })
  await linkEffect(allstar.id, 'konajirami', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(allstar.id, 'kaigaramushi', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(allstar.id, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(allstar.id, 'yokobai', { efficacyLevel: 'excellent', persistenceLevel: 'good' })

  // ── 22. カダンMAX ──
  console.log('\n--- 22. カダンMAX ---')
  const kadanMax = await ensureSprayProduct({
    slug: 'kadan-max',
    name: 'カダンMAX',
    registrationNumber: '24834',
    pesticideType: 'compound',
    formulationTypeId: ftAL.id,
    description: 'フルベンジアミド0.0050%＋フロニカミド0.0050%＋ピラジフルミド0.0050%の3成分配合殺虫殺菌スプレー。ジアミド系殺虫（チョウ目特効）＋フロニカミド（吸汁害虫）＋SDHI系殺菌の複合効果。2024年2月登録の新しい製品。フマキラー製。MAFF登録#24834。',
  })
  await linkIngredient(kadanMax.id, ingFlubendiamide.id, '0.0050%')
  if (ingFlonicamid) await linkIngredient(kadanMax.id, ingFlonicamid.id, '0.0050%')
  await linkIngredient(kadanMax.id, ingPyraziflumid.id, '0.0050%')
  await linkEffect(kadanMax.id, 'kemushi-imomushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'フルベンジアミド（ジアミド系）がチョウ目に特効' })
  await linkEffect(kadanMax.id, 'hasumon-yotou', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'ジアミド系はヨトウムシ類に特に高い効果' })
  await linkEffect(kadanMax.id, 'hamakimushi', { efficacyLevel: 'excellent', persistenceLevel: 'good' })
  await linkEffect(kadanMax.id, 'aburamushi', { efficacyLevel: 'excellent', persistenceLevel: 'good', note: 'フロニカミドの吸汁害虫抑制効果' })
  await linkEffect(kadanMax.id, 'konajirami', { efficacyLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(kadanMax.id, 'azamiuma', { efficacyLevel: 'good', persistenceLevel: 'fair' })
  await linkEffect(kadanMax.id, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good', note: 'ピラジフルミド（SDHI系 FRAC7）の殺菌効果' })
  await linkEffect(kadanMax.id, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', persistenceLevel: 'good' })
  await linkEffect(kadanMax.id, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'fair' })
  await linkEffect(kadanMax.id, 'sabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', persistenceLevel: 'good' })

  console.log('\n=== pending製品の追加が完了しました ===')

  // ══════════════════════════════════════════════════════════════
  //  Part 4: MAFF検証済み追加農薬 17件 (2026-04-05)
  // ══════════════════════════════════════════════════════════════
  console.log('\n=== MAFF検証済み追加農薬 17件の投入を開始します ===\n')

  // ── 剤型 AE（エアゾール缶）を確保 ──
  const ftAE = await ensureFormulationType(
    'AE',
    'エアゾール缶',
    '有効成分をLPGガス等で加圧充填したエアゾール缶。噴霧ボタンを押すだけで使用でき、希釈不要。カミキリムシ用など穿孔害虫への直接噴射にも適する。',
    10,
  )
  // ftAE is used by ensurePesticide via formulationTypeCode lookup
  void ftAE

  // ── 既存有効成分IDの取得 ──
  const part4Ings = await prisma.activeIngredient.findMany({
    where: {
      slug: {
        in: [
          'malathion', 'fenitrothion', 'acephate', 'bt-bacillus',
          'acetamiprid', 'thiophanate-methyl', 'permethrin', 'myclobutanil',
          'fenpropathrin', 'clothianidin', 'benomyl',
        ],
      },
    },
  })
  const p4ing: Record<string, string> = {}
  part4Ings.forEach(i => { p4ing[i.slug] = i.id })

  // ── 1. スミソン乳剤 ──
  console.log('\n--- P4-1. スミソン乳剤 ---')
  const sumison = await ensurePesticide({
    slug: 'sumison-ec', name: 'スミソン乳剤', registrationNumber: '6829',
    pesticideType: 'compound', formulationTypeCode: 'EC',
    description: 'マラソン（マラチオン）15.0%＋MEP（フェニトロチオン）35.0%配合の有機リン系複合乳剤殺虫剤。2種の有機リン系成分の混合により幅広い害虫に効果を発揮する。住友化学園芸製。MAFF登録#6829。',
  })
  await linkIngredient(sumison, p4ing['malathion'], '15.0%')
  await linkIngredient(sumison, p4ing['fenitrothion'], '35.0%')
  await linkEffect(sumison, 'aburamushi', { efficacyLevel: 'excellent' })
  await linkEffect(sumison, 'chadokuga', { efficacyLevel: 'good' })
  await linkEffect(sumison, 'gunbaimushi', { efficacyLevel: 'good' })
  await linkEffect(sumison, 'amerika-shirohitori', { efficacyLevel: 'good' })

  // ── 2. オルチオン乳剤 ──
  console.log('\n--- P4-2. オルチオン乳剤 ---')
  const olthion = await ensurePesticide({
    slug: 'olthion-ec', name: 'オルチオン乳剤', registrationNumber: '18747',
    pesticideType: 'compound', formulationTypeCode: 'EC',
    description: 'アセフェート5.0%＋MEP（フェニトロチオン）5.0%配合の有機リン系複合乳剤殺虫剤。浸透移行性のアセフェートと速効性のMEPの組み合わせで、吸汁害虫から食害害虫まで幅広く防除する。住友化学園芸製。MAFF登録#18747。',
  })
  await linkIngredient(olthion, p4ing['acephate'], '5.0%')
  await linkIngredient(olthion, p4ing['fenitrothion'], '5.0%')
  await linkEffect(olthion, 'aburamushi', { efficacyLevel: 'excellent' })
  await linkEffect(olthion, 'kemushi-imomushi', { efficacyLevel: 'good' })
  await linkEffect(olthion, 'kaigaramushi', { efficacyLevel: 'good' })
  await linkEffect(olthion, 'gunbaimushi', { efficacyLevel: 'good' })

  // ── 3. 家庭園芸用ダイアジノン粒剤3 ──
  console.log('\n--- P4-3. 家庭園芸用ダイアジノン粒剤3 ---')
  const diazinon3 = await ensurePesticide({
    slug: 'diazinon-gr-3', name: '家庭園芸用ダイアジノン粒剤3', registrationNumber: '19526',
    pesticideType: 'insecticide', formulationTypeCode: 'GR',
    description: 'ダイアジノン3.0%配合の粒剤殺虫剤。土壌害虫（コガネムシ類幼虫・ネキリムシ・ケラ等）の防除に特化した土壌混和型殺虫剤。住友化学園芸製。MAFF登録#19526。',
  })
  // ダイアジノン (有機リン系 IRAC 1B): MAFF#19526 公式の有効成分含有量 3.0% を反映。
  // 有効成分マスタにまだ存在しない場合は新規作成し、いずれの場合も pesticide に linkIngredient する。
  const ingDiazinonP4 = await ensureActiveIngredient({
    slug: 'diazinon',
    name: 'ダイアジノン',
    nameEn: 'Diazinon',
    iracCode: '1B',
    ingredientGroup: '有機リン系（アセチルコリンエステラーゼ阻害剤）',
    resistanceRisk: 'medium',
    description: '有機リン系殺虫剤。アセチルコリンエステラーゼを阻害することで、害虫の神経伝達を麻痺させる（IRAC 1B）。家庭園芸用ダイアジノン粒剤3 (MAFF#19526) では土壌混和型として、コガネムシ類幼虫やネキリムシ類の防除に使用される。',
  })
  await linkIngredient(diazinon3, ingDiazinonP4.id, '3.0%')
  await linkEffect(diazinon3, 'koganemushi-youchu', { efficacyLevel: 'excellent' })
  await linkEffect(diazinon3, 'nekirimushi', { efficacyLevel: 'good' })
  // ケラ (kera) slug does not exist in seed data — effect link skipped

  // ── 4. トアロー水和剤CT ──
  console.log('\n--- P4-4. トアロー水和剤CT ---')
  const toarowWP = await ensurePesticide({
    slug: 'toarow-wp-ct', name: 'トアロー水和剤CT', registrationNumber: '14459',
    pesticideType: 'insecticide', formulationTypeCode: 'WP',
    description: 'BT菌（バチルス・チューリンゲンシス菌 kurstaki系統）7.0%配合の水和剤微生物殺虫剤。チョウ目幼虫に特異的に効果を発揮する天然由来の生物農薬。OATアグリオ製。MAFF登録#14459。',
  })
  await linkIngredient(toarowWP, p4ing['bt-bacillus'], '7.0%')
  await linkEffect(toarowWP, 'monshirochou-youchu', { efficacyLevel: 'excellent', note: 'BT菌の主要ターゲット（チョウ目幼虫）' })
  await linkEffect(toarowWP, 'kemushi-imomushi', { efficacyLevel: 'good' })
  await linkEffect(toarowWP, 'hamakimushi', { efficacyLevel: 'good' })
  await linkEffect(toarowWP, 'amerika-shirohitori', { efficacyLevel: 'good' })
  await linkEffect(toarowWP, 'chadokuga', { efficacyLevel: 'good' })
  await linkEffect(toarowWP, 'hasumon-yotou', { efficacyLevel: 'good' })

  // ── 5. トアローフロアブルCT ──
  console.log('\n--- P4-5. トアローフロアブルCT ---')
  const toarowFL = await ensurePesticide({
    slug: 'toarow-fl-ct', name: 'トアローフロアブルCT', registrationNumber: '20056',
    pesticideType: 'insecticide', formulationTypeCode: 'FL',
    description: 'BT菌（バチルス・チューリンゲンシス菌 kurstaki系統）7.0%配合のフロアブル微生物殺虫剤。水和剤CTのフロアブル製剤版で、粉立ちがなく計量しやすい。OATアグリオ製。MAFF登録#20056。',
  })
  await linkIngredient(toarowFL, p4ing['bt-bacillus'], '7.0%')
  await linkEffect(toarowFL, 'monshirochou-youchu', { efficacyLevel: 'excellent', note: 'BT菌の主要ターゲット（チョウ目幼虫）' })
  await linkEffect(toarowFL, 'amerika-shirohitori', { efficacyLevel: 'good' })
  await linkEffect(toarowFL, 'chadokuga', { efficacyLevel: 'good' })
  await linkEffect(toarowFL, 'hasumon-yotou', { efficacyLevel: 'good' })

  // ── 6. モスピラン・トップジンMスプレー ──
  console.log('\n--- P4-6. モスピラン・トップジンMスプレー ---')
  const mospilanTopjin = await ensurePesticide({
    slug: 'mospilan-topjin-m-spray', name: 'モスピラン・トップジンMスプレー', registrationNumber: '21309',
    pesticideType: 'compound', formulationTypeCode: 'AL',
    description: 'アセタミプリド0.0050%＋チオファネートメチル0.040%配合の殺虫殺菌スプレー。ネオニコチノイド系の浸透移行性殺虫とベンズイミダゾール系殺菌で害虫と病害を同時防除。住友化学園芸製。MAFF登録#21309。',
  })
  await linkIngredient(mospilanTopjin, p4ing['acetamiprid'], '0.0050%')
  await linkIngredient(mospilanTopjin, p4ing['thiophanate-methyl'], '0.040%')
  await linkEffect(mospilanTopjin, 'aburamushi', { efficacyLevel: 'excellent', note: 'アセタミプリドの浸透移行性' })
  await linkEffect(mospilanTopjin, 'konajirami', { efficacyLevel: 'good' })
  await linkEffect(mospilanTopjin, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good', note: 'チオファネートメチル（FRAC1）' })
  await linkEffect(mospilanTopjin, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })
  await linkEffect(mospilanTopjin, 'tanso-byo', { preventionLevel: 'good', treatmentLevel: 'fair', efficacyLevel: 'good' })
  await linkEffect(mospilanTopjin, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', efficacyLevel: 'good' })

  // ── 7. トップジンMゾル ──
  console.log('\n--- P4-7. トップジンMゾル ---')
  const topjinMSol = await ensurePesticide({
    slug: 'topjin-m-sol', name: 'トップジンMゾル', registrationNumber: '14228',
    pesticideType: 'fungicide', formulationTypeCode: 'FL',
    description: 'チオファネートメチル40.0%配合のフロアブル殺菌剤（FRAC1 ベンズイミダゾール系）。浸透移行性があり予防・治療効果を持つ。幅広い病害に有効。日本曹達製。MAFF登録#14228。',
  })
  await linkIngredient(topjinMSol, p4ing['thiophanate-methyl'], '40.0%')
  await linkEffect(topjinMSol, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })
  await linkEffect(topjinMSol, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })
  await linkEffect(topjinMSol, 'tanso-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })
  await linkEffect(topjinMSol, 'kappan-byo', { preventionLevel: 'good', treatmentLevel: 'fair', efficacyLevel: 'good' })

  // ── 8. ベニカX乳剤 ──
  console.log('\n--- P4-8. ベニカX乳剤 ---')
  const benicaXEC = await ensurePesticide({
    slug: 'benica-x-ec', name: 'ベニカX乳剤', registrationNumber: '20610',
    pesticideType: 'compound', formulationTypeCode: 'EC',
    description: 'ペルメトリン5.0%＋ミクロブタニル4.0%配合の殺虫殺菌乳剤。ピレスロイド系殺虫とEBI系殺菌で害虫と病害を同時防除。希釈して使用。住友化学園芸製。MAFF登録#20610。',
  })
  await linkIngredient(benicaXEC, p4ing['permethrin'], '5.0%')
  await linkIngredient(benicaXEC, p4ing['myclobutanil'], '4.0%')
  await linkEffect(benicaXEC, 'aburamushi', { efficacyLevel: 'good' })
  await linkEffect(benicaXEC, 'chadokuga', { efficacyLevel: 'good' })
  await linkEffect(benicaXEC, 'amerika-shirohitori', { efficacyLevel: 'good' })
  await linkEffect(benicaXEC, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'excellent', efficacyLevel: 'good', note: 'ミクロブタニル（EBI系）の治療効果が高い' })
  await linkEffect(benicaXEC, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })
  // 白さび病 (shiro-sabi-byo) slug does not exist in seed data — effect link skipped

  // ── 9. ベニカR乳剤 ──
  console.log('\n--- P4-9. ベニカR乳剤 ---')
  const benicaREC = await ensurePesticide({
    slug: 'benica-r-ec', name: 'ベニカR乳剤', registrationNumber: '23709',
    pesticideType: 'insecticide', formulationTypeCode: 'EC',
    description: 'フェンプロパトリン（ピレスロイド系 IRAC3A）1.0%配合の乳剤殺虫剤。アブラムシ・ハダニ・コナジラミ・アザミウマ等に接触効果。住友化学園芸製。MAFF登録#23709。',
  })
  await linkIngredient(benicaREC, p4ing['fenpropathrin'], '1.0%')
  await linkEffect(benicaREC, 'aburamushi', { efficacyLevel: 'good' })
  await linkEffect(benicaREC, 'hadani', { efficacyLevel: 'good' })
  await linkEffect(benicaREC, 'konajirami', { efficacyLevel: 'good' })
  await linkEffect(benicaREC, 'azamiuma', { efficacyLevel: 'good' })

  // ── 10. ベニカ液剤 ──
  console.log('\n--- P4-10. ベニカ液剤 ---')
  const benicaSL = await ensurePesticide({
    slug: 'benica-sl', name: 'ベニカ液剤', registrationNumber: '22593',
    pesticideType: 'insecticide', formulationTypeCode: 'SL',
    description: 'クロチアニジン（ネオニコチノイド系 IRAC4A）2.0%配合の液剤殺虫剤。浸透移行性で葉裏の害虫にも効果が持続する。住友化学園芸製。MAFF登録#22593。',
  })
  await linkIngredient(benicaSL, p4ing['clothianidin'], '2.0%')
  await linkEffect(benicaSL, 'aburamushi', { efficacyLevel: 'excellent', note: 'クロチアニジンの浸透移行性' })
  await linkEffect(benicaSL, 'konajirami', { efficacyLevel: 'good' })
  await linkEffect(benicaSL, 'kamikirimushi', { efficacyLevel: 'good' })
  await linkEffect(benicaSL, 'kemushi-imomushi', { efficacyLevel: 'good' })

  // ── 11. ベニカXファインエアゾール ──
  console.log('\n--- P4-11. ベニカXファインエアゾール ---')
  const benicaXFineAerosol = await ensurePesticide({
    slug: 'benica-x-fine-aerosol', name: 'ベニカXファインエアゾール', registrationNumber: '22576',
    pesticideType: 'compound', formulationTypeCode: 'AE',
    description: 'クロチアニジン0.032%＋フェンプロパトリン0.020%＋メパニピリム0.040%配合のエアゾール殺虫殺菌剤。ネオニコチノイド系（浸透移行性）＋ピレスロイド系（接触殺虫）＋アニリノピリミジン系（殺菌）の3成分で害虫と病害を同時防除。住友化学園芸製。MAFF登録#22576。',
  })
  await linkIngredient(benicaXFineAerosol, p4ing['clothianidin'], '0.032%')
  await linkIngredient(benicaXFineAerosol, p4ing['fenpropathrin'], '0.020%')
  // mepanipyrim was added in Part 2 — link it
  const ingMepanipyrimP4 = await prisma.activeIngredient.findUnique({ where: { slug: 'mepanipyrim' } })
  if (ingMepanipyrimP4) await linkIngredient(benicaXFineAerosol, ingMepanipyrimP4.id, '0.040%')
  await linkEffect(benicaXFineAerosol, 'aburamushi', { efficacyLevel: 'excellent', note: 'クロチアニジンの浸透移行性' })
  await linkEffect(benicaXFineAerosol, 'kemushi-imomushi', { efficacyLevel: 'good' })
  await linkEffect(benicaXFineAerosol, 'gunbaimushi', { efficacyLevel: 'good' })
  await linkEffect(benicaXFineAerosol, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })
  await linkEffect(benicaXFineAerosol, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'fair', efficacyLevel: 'good' })

  // ── 12. ベニカカミキリムシエアゾール ──
  console.log('\n--- P4-12. ベニカカミキリムシエアゾール ---')
  const benicaKamikiri = await ensurePesticide({
    slug: 'benica-kamikiri-aerosol', name: 'ベニカカミキリムシエアゾール', registrationNumber: '23779',
    pesticideType: 'insecticide', formulationTypeCode: 'AE',
    description: 'フェンプロパトリン（ピレスロイド系 IRAC3A）0.020%配合のエアゾール殺虫剤。カミキリムシ（テッポウムシ）の穿入孔に直接噴射して防除する専用エアゾール。住友化学園芸製。MAFF登録#23779。',
  })
  await linkIngredient(benicaKamikiri, p4ing['fenpropathrin'], '0.020%')
  await linkEffect(benicaKamikiri, 'kamikirimushi', { efficacyLevel: 'excellent', note: 'カミキリムシが主要ターゲット。穿入孔に直接噴射' })

  // ── 13. ベニカベジフル乳剤 ──
  console.log('\n--- P4-13. ベニカベジフル乳剤 ---')
  const benicaVegiEC = await ensurePesticide({
    slug: 'benica-vegifru-ec', name: 'ベニカベジフル乳剤', registrationNumber: '23948',
    pesticideType: 'insecticide', formulationTypeCode: 'EC',
    description: 'ペルメトリン（ピレスロイド系 IRAC3A）3.0%配合の乳剤殺虫剤。幅広い害虫に接触毒・食毒で速効的に効果を発揮する。希釈して使用。住友化学園芸製。MAFF登録#23948。',
  })
  await linkIngredient(benicaVegiEC, p4ing['permethrin'], '3.0%')
  await linkEffect(benicaVegiEC, 'aburamushi', { efficacyLevel: 'good' })
  await linkEffect(benicaVegiEC, 'kemushi-imomushi', { efficacyLevel: 'good' })
  await linkEffect(benicaVegiEC, 'hasumon-yotou', { efficacyLevel: 'good' })
  await linkEffect(benicaVegiEC, 'monshirochou-youchu', { efficacyLevel: 'good' })

  // ── 14. GFベンレート水和剤 ──
  console.log('\n--- P4-14. GFベンレート水和剤 ---')
  const gfBenlate = await ensurePesticide({
    slug: 'gf-benlate-wp', name: 'GFベンレート水和剤', registrationNumber: '23180',
    pesticideType: 'fungicide', formulationTypeCode: 'WP',
    description: 'ベノミル50.0%配合の水和剤殺菌剤（FRAC1 ベンズイミダゾール系）。浸透移行性があり予防・治療効果を持つ。幅広い病害に有効な家庭園芸向け製品。住友化学園芸製。MAFF登録#23180。',
  })
  await linkIngredient(gfBenlate, p4ing['benomyl'], '50.0%')
  await linkEffect(gfBenlate, 'udonko-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })
  await linkEffect(gfBenlate, 'haiiro-kabi-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })
  await linkEffect(gfBenlate, 'kuroboshi-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })
  await linkEffect(gfBenlate, 'tanso-byo', { preventionLevel: 'good', treatmentLevel: 'good', efficacyLevel: 'good' })

  // ── 15. 家庭園芸用GFオルトラン水和剤 ──
  console.log('\n--- P4-15. 家庭園芸用GFオルトラン水和剤 ---')
  const gfOrtranWP = await ensurePesticide({
    slug: 'gf-ortran-wp', name: '家庭園芸用GFオルトラン水和剤', registrationNumber: '21819',
    pesticideType: 'insecticide', formulationTypeCode: 'WP',
    description: 'アセフェート（有機リン系 IRAC1B）50.0%配合の水和剤殺虫剤。浸透移行性があり、吸汁害虫に持続的な防除効果を発揮する。住友化学園芸製。MAFF登録#21819。',
  })
  await linkIngredient(gfOrtranWP, p4ing['acephate'], '50.0%')
  await linkEffect(gfOrtranWP, 'aburamushi', { efficacyLevel: 'excellent', note: 'アセフェートの浸透移行性で持続効果' })
  await linkEffect(gfOrtranWP, 'kemushi-imomushi', { efficacyLevel: 'good' })
  await linkEffect(gfOrtranWP, 'kaigaramushi', { efficacyLevel: 'good', note: '若齢幼虫に有効' })
  await linkEffect(gfOrtranWP, 'hamakimushi', { efficacyLevel: 'good' })
  await linkEffect(gfOrtranWP, 'azamiuma', { efficacyLevel: 'good' })

  // ── 16. サフオイル乳剤 ──
  console.log('\n--- P4-16. サフオイル乳剤 ---')
  const safoil = await ensurePesticide({
    slug: 'safoil-ec', name: 'サフオイル乳剤', registrationNumber: '22801',
    pesticideType: 'insecticide', formulationTypeCode: 'EC',
    description: '調合油（サフラワー油・綿実油）97.0%配合の乳剤殺虫殺菌剤。植物油由来の物理的防除剤で、害虫の気門を封鎖し窒息させる。ハダニ・アブラムシ・コナジラミに有効。うどんこ病にも効果。OATアグリオ製。MAFF登録#22801。',
  })
  // blended-oil slug was added in Part 2 (ベニカナチュラルスプレー) — try to link
  const ingBlendedOilP4 = await prisma.activeIngredient.findUnique({ where: { slug: 'blended-oil' } })
  if (ingBlendedOilP4) await linkIngredient(safoil, ingBlendedOilP4.id, '97.0%')
  await linkEffect(safoil, 'hadani', { efficacyLevel: 'good', note: '物理的気門封鎖' })
  await linkEffect(safoil, 'aburamushi', { efficacyLevel: 'good' })
  await linkEffect(safoil, 'konajirami', { efficacyLevel: 'good' })
  await linkEffect(safoil, 'udonko-byo', { preventionLevel: 'fair', treatmentLevel: 'fair', efficacyLevel: 'fair', note: '物理的防除効果' })

  // ── 17. ダニサラバフロアブル ──
  console.log('\n--- P4-17. ダニサラバフロアブル ---')
  const danisaraba = await ensurePesticide({
    slug: 'danisaraba-fl', name: 'ダニサラバフロアブル', registrationNumber: '22034',
    pesticideType: 'acaricide', formulationTypeCode: 'FL',
    description: 'シフルメトフェン（IRAC 25A β-ケトニトリル誘導体）20.0%配合のフロアブル殺ダニ剤。ミトコンドリアComplex II阻害により、ハダニ類の卵・幼虫・若虫・成虫の全ステージに効果。大塚アグリテクノ製。MAFF登録#22034。',
  })
  // cyflumetofen は seed-pesticide-additions.ts で定義済み。MAFF#22034 公式の有効成分含有量 20.0% を反映。
  const ingCyflumetofenP4 = await prisma.activeIngredient.findUnique({ where: { slug: 'cyflumetofen' } })
  if (ingCyflumetofenP4) await linkIngredient(danisaraba, ingCyflumetofenP4.id, '20.0%')
  await linkEffect(danisaraba, 'hadani', { efficacyLevel: 'excellent', note: 'ハダニが主要ターゲット。全ステージに有効' })
  await linkEffect(danisaraba, 'nami-hadani', { efficacyLevel: 'excellent' })
  await linkEffect(danisaraba, 'kanzawa-hadani', { efficacyLevel: 'excellent' })

  console.log('\n=== MAFF検証済み追加農薬 17件の投入が完了しました ===')

  // ══════════════════════════════════════════════════════════
  //  完了
  // ══════════════════════════════════════════════════════════
  console.log('\n=== 全製品の追加が完了しました ===')
  console.log('追加した製品:')
  console.log('  Part 1-3: ベニカS乳剤, キンチョールE, バロックFL, ダニ太郎, ストマイ液剤,')
  console.log('            キノンドー水和剤, イオウFL, スターマイトFL, アーリーセーフ, 粘着くん,')
  console.log('            ベニカマツケア, ロハピ, ベニカXガード粒剤, 花いとし, スプレー型各種')
  console.log('  Part 4 (17件):')
  console.log('    複合剤: スミソン乳剤, オルチオン乳剤, モスピラン・トップジンMスプレー, ベニカX乳剤, ベニカXファインエアゾール')
  console.log('    殺虫剤: ダイアジノン粒剤3, トアロー水和剤CT, トアローフロアブルCT, ベニカR乳剤, ベニカ液剤,')
  console.log('            ベニカカミキリムシエアゾール, ベニカベジフル乳剤, GFオルトラン水和剤, サフオイル乳剤')
  console.log('    殺菌剤: トップジンMゾル, GFベンレート水和剤')
  console.log('    殺ダニ剤: ダニサラバフロアブル')
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
