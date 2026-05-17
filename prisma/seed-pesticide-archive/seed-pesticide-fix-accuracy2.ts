/* eslint-disable no-console */
/**
 * 病害虫効果データの事実に基づく正確性修正スクリプト（第2弾）。
 *
 * 修正内容:
 * 1. マンデストロビン: FRACコードを7→11に修正、ingredientGroupをQoI系に修正
 * 2. ベニカXネクスト: ピリダベンの成分リンクを削除、還元澱粉糖化物を追加、ハダニ効果データ修正
 * 3. カダンプラスDX: 登録番号を22743→22330に修正、ハダニの効果を"good"→"fair"に修正
 * 4. トレボンEC/エアロゾル/粉剤: ハダニ・カイガラムシ等の不正確な紐付けを削除・修正
 * 5. ダントツSP/粒剤: ハダニの紐付け削除、大型チョウ目の効果を修正
 * 6. ジマンダイセン水和剤: 萎凋病等の土壌病害の紐付け削除、うどんこ病を"excellent"→"fair"に修正
 * 7. バルク生成された一律評価データの個別修正
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-fix-accuracy2.ts
 */

// Load env before Pool
/* eslint-disable @typescript-eslint/no-require-imports */
const dotenv = require("dotenv");
dotenv.config({ path: ".env.local", override: true });
dotenv.config({ path: ".env", override: false });
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("localhost")) {
  const fs = require("fs");
  if (fs.existsSync(".env.local")) {
    const envConfig = dotenv.parse(fs.readFileSync(".env.local"));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  }
}
/* eslint-enable @typescript-eslint/no-require-imports */
const finalConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!finalConnectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is not set");
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: { url: finalConnectionString }
  }
});

type ER = "excellent" | "good" | "fair" | "poor" | "none";

// ── ヘルパー ──
async function getPesticideId(slug: string): Promise<string | null> {
  const p = await prisma.pesticide.findUnique({ where: { slug } });
  if (!p) { console.warn(`  ⚠ 農薬 ${slug} が見つかりません`); return null; }
  return p.id;
}

async function getDPId(slug: string): Promise<string | null> {
  const dp = await prisma.diseasePest.findUnique({ where: { slug } });
  if (!dp) { console.warn(`  ⚠ 病害虫 ${slug} が見つかりません`); return null; }
  return dp.id;
}

async function updateEffect(
  pesticideSlug: string,
  dpSlug: string,
  updates: {
    preventionLevel?: ER | null;
    treatmentLevel?: ER | null;
    efficacyLevel?: ER | null;
    persistenceLevel?: ER | null;
    note?: string | null;
  },
) {
  const pId = await getPesticideId(pesticideSlug);
  const dpId = await getDPId(dpSlug);
  if (!pId || !dpId) return false;

  const existing = await prisma.pesticideEffect.findUnique({
    where: { pesticideId_diseasePestId: { pesticideId: pId, diseasePestId: dpId } },
  });
  if (!existing) {
    console.warn(`  ⚠ ${pesticideSlug} → ${dpSlug} の効果データが見つかりません`);
    return false;
  }

  await prisma.pesticideEffect.update({
    where: { id: existing.id },
    data: updates,
  });
  console.log(`  ✓ ${pesticideSlug} → ${dpSlug} を修正`);
  return true;
}

async function deleteEffect(pesticideSlug: string, dpSlug: string) {
  const pId = await getPesticideId(pesticideSlug);
  const dpId = await getDPId(dpSlug);
  if (!pId || !dpId) return false;

  const existing = await prisma.pesticideEffect.findUnique({
    where: { pesticideId_diseasePestId: { pesticideId: pId, diseasePestId: dpId } },
  });
  if (!existing) return false;

  await prisma.pesticideEffect.delete({ where: { id: existing.id } });
  console.log(`  ✗ ${pesticideSlug} → ${dpSlug} を削除`);
  return true;
}

async function main() {
  console.log("=== 効果データの正確性修正（第2弾）を開始します ===\n");

  // ──────────────────────────────────────────────────────
  //  1. マンデストロビンのFRACコード・分類修正
  //  正しくはFRAC11（QoI系メトキシアセタミド）。FRAC7はSDHI系で完全に別。
  //  出典: CropLife Japan FRAC 2025分類表、住友化学研究報告
  // ──────────────────────────────────────────────────────
  console.log("--- 1. マンデストロビン FRACコード修正 ---");
  const mandestrobin = await prisma.activeIngredient.findUnique({ where: { slug: "mandestrobin" } });
  if (mandestrobin) {
    await prisma.activeIngredient.update({
      where: { id: mandestrobin.id },
      data: {
        fracCode: "11",
        ingredientGroup: "QoI系（メトキシアセタミド系）",
        description: "住友化学が開発したQoI系殺菌剤（FRAC11）。ミトコンドリアの電子伝達系を阻害する。うどんこ病・黒星病・灰色かび病など幅広い病害に効果がある。浸透移行性を有する。",
      },
    });
    console.log("  ✓ mandestrobin: FRAC 7→11, ingredientGroup→QoI系に修正");
  }

  // ──────────────────────────────────────────────────────
  //  2. ベニカXネクスト: ピリダベン成分リンク削除＋還元澱粉糖化物追加
  //  MAFF登録#24117の5成分: クロチアニジン・ピリダリル・ペルメトリン・
  //  マンデストロビン・還元澱粉糖化物。ピリダベンは含まれない。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 2. ベニカXネクスト 成分リンク修正 ---");
  const benicaXNext = await prisma.pesticide.findUnique({ where: { slug: "benica-x-next-spray" } });
  if (benicaXNext) {
    // ピリダベンの成分リンクを削除
    const pyridaben = await prisma.activeIngredient.findUnique({ where: { slug: "pyridaben" } });
    if (pyridaben) {
      const link = await prisma.pesticideActiveIngredient.findUnique({
        where: { pesticideId_activeIngredientId: { pesticideId: benicaXNext.id, activeIngredientId: pyridaben.id } },
      });
      if (link) {
        await prisma.pesticideActiveIngredient.delete({
          where: { pesticideId_activeIngredientId: { pesticideId: benicaXNext.id, activeIngredientId: pyridaben.id } },
        });
        console.log("  ✗ benica-x-next-spray → pyridaben のリンクを削除");
      }
    }

    // 還元澱粉糖化物の成分リンクを追加
    const hsh = await prisma.activeIngredient.findUnique({ where: { slug: "hydrogenated-starch-hydrolysate" } });
    if (hsh) {
      const existing = await prisma.pesticideActiveIngredient.findUnique({
        where: { pesticideId_activeIngredientId: { pesticideId: benicaXNext.id, activeIngredientId: hsh.id } },
      });
      if (!existing) {
        await prisma.pesticideActiveIngredient.create({
          data: { pesticideId: benicaXNext.id, activeIngredientId: hsh.id, contentLabel: "0.60%" },
        });
        console.log("  + benica-x-next-spray → hydrogenated-starch-hydrolysate を追加");
      }
    }

    // description を修正
    await prisma.pesticide.update({
      where: { id: benicaXNext.id },
      data: {
        description: "住友化学園芸の5成分配合殺虫殺菌スプレー。殺虫成分としてクロチアニジン（浸透移行性ネオニコチノイド）・ピリダリル（新規作用）・ペルメトリン（速効性ピレスロイド）、殺菌成分としてマンデストロビン（QoI系 FRAC11）、物理防除成分として還元澱粉糖化物を配合。幅広い害虫・病害に対応し、抵抗性害虫にも有効。希釈せずそのまま使用。",
      },
    });
    console.log("  ✓ benica-x-next-spray description を修正");

    // ハダニ効果データの修正（ピリダベン由来のexcellent→物理防除のfair）
    await updateEffect("benica-x-next-spray", "hadani", {
      efficacyLevel: "fair", persistenceLevel: "poor",
      note: "還元澱粉糖化物の物理的効果のみ。専用殺ダニ剤の併用推奨",
    });
    await updateEffect("benica-x-next-spray", "nami-hadani", {
      efficacyLevel: "fair", persistenceLevel: "poor",
      note: "還元澱粉糖化物の物理的効果のみ",
    });
    await updateEffect("benica-x-next-spray", "kanzawa-hadani", {
      efficacyLevel: "fair", persistenceLevel: "poor",
      note: "還元澱粉糖化物の物理的効果のみ",
    });

    // マンデストロビン関連のnoteも修正
    await updateEffect("benica-x-next-spray", "udonko-byo", {
      note: "マンデストロビンのQoI作用（FRAC11）。予防が主体で、進行した病害への治療効果は限定的",
    });
  }

  // ──────────────────────────────────────────────────────
  //  3. カダンプラスDX: 登録番号修正 + ハダニ効果修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 3. カダンプラスDX 修正 ---");
  const kadanPlusDX = await prisma.pesticide.findUnique({ where: { slug: "kadan-plus-dx" } });
  if (kadanPlusDX) {
    await prisma.pesticide.update({
      where: { id: kadanPlusDX.id },
      data: { registrationNumber: "22330" },
    });
    console.log("  ✓ kadan-plus-dx 登録番号: 22743→22330");

    await updateEffect("kadan-plus-dx", "hadani", {
      efficacyLevel: "fair", persistenceLevel: "poor",
      note: "エマメクチンの食毒作用でハダニに若干の効果があるが限定的。専用殺ダニ剤の併用推奨",
    });
  }

  // ──────────────────────────────────────────────────────
  //  4. トレボンEC/エアロゾル/粉剤: 不正確な害虫紐付け修正
  //  エトフェンプロクスはピレスロイド様化合物で、ハダニには無効
  //  （天敵を殺してハダニを増殖させるリスクあり）。
  //  カイガラムシもMAFF登録の適用害虫に含まれない。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 4. トレボン系 不正確な紐付け修正 ---");

  // ハダニに無効な害虫slug一覧
  const trebonMiteTargets = ["hadani", "nami-hadani", "kanzawa-hadani", "tsuya-hadani"];
  // カイガラムシ系も適用外
  const trebonScaleTargets = ["kaigaramushi", "konakaigaramushi", "nashi-maru-kaigaramushi",
    "iseria-kaigaramushi", "ruby-roumushi", "bara-shiro-kaigaramushi", "kuwa-shiro-kaigaramushi"];
  // ナメクジ・ダンゴムシ等の陸生軟体動物にも無効
  const trebonOtherInvalid = ["namekuji", "dangomushi", "mukade"];

  for (const slug of ["trebon-ec", "trebon-aerosol", "trebon-dp"]) {
    for (const dpSlug of [...trebonMiteTargets, ...trebonScaleTargets, ...trebonOtherInvalid]) {
      await deleteEffect(slug, dpSlug);
    }
  }

  // トレボンの大型チョウ目（ケムシ・イモムシ）への効果をexcellent→goodに修正
  // ピレスロイドは接触毒だが、大型幼虫には効果が落ちる
  for (const slug of ["trebon-ec", "trebon-aerosol", "trebon-dp"]) {
    await updateEffect(slug, "kemushi-imomushi", {
      efficacyLevel: "good", persistenceLevel: "fair",
      note: "接触・食毒。若齢幼虫に有効だが老齢幼虫には効果が落ちる",
    });
    // コガネムシ幼虫（土中）にもエトフェンプロクスは到達しにくい
    await updateEffect(slug, "koganemushi-youchu", {
      efficacyLevel: "fair", persistenceLevel: "poor",
      note: "土中の幼虫には薬剤が到達しにくい",
    });
    // カミキリムシ（幹内部）にも限定的
    await updateEffect(slug, "kamikirimushi", {
      efficacyLevel: "fair", persistenceLevel: "poor",
      note: "幹内部の幼虫には到達しない。成虫への接触効果のみ",
    });
    // ミノムシ（巣の中）にも限定的
    await updateEffect(slug, "minomushi", {
      efficacyLevel: "fair", persistenceLevel: "poor",
      note: "巣の中にいる幼虫には薬剤が届きにくい",
    });
  }

  // ──────────────────────────────────────────────────────
  //  5. ダントツSP/粒剤: 不正確な害虫紐付け修正
  //  クロチアニジンはネオニコチノイド系で吸汁害虫に特化。
  //  ハダニには無効（ダニは昆虫ではなく節足動物の別綱）。
  //  大型チョウ目外部食害虫にも限定的。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 5. ダントツ系 不正確な紐付け修正 ---");

  for (const slug of ["dantotsu-sp", "dantotsu-gr"]) {
    // ハダニ系を全削除（ネオニコチノイドはダニに無効）
    for (const dpSlug of ["hadani", "nami-hadani", "kanzawa-hadani", "tsuya-hadani"]) {
      await deleteEffect(slug, dpSlug);
    }
    // ナメクジ・ダンゴムシ等にも無効
    for (const dpSlug of ["namekuji", "dangomushi", "mukade"]) {
      await deleteEffect(slug, dpSlug);
    }

    // 大型チョウ目外部食害虫の効果を修正
    // ネオニコチノイドは小型のハモグリガ・ホソガには効くが、大型ケムシには限定的
    await updateEffect(slug, "kemushi-imomushi", {
      efficacyLevel: "fair", persistenceLevel: "fair",
      note: "ネオニコチノイド系は大型チョウ目外部食害虫への効果は限定的。小型のハモグリガ等には有効",
    });
    // マツケムシも大型チョウ目
    await updateEffect(slug, "matsukemushi", {
      efficacyLevel: "fair", persistenceLevel: "fair",
      note: "大型の外部食害性チョウ目には効果が限定的",
    });

    // カミキリムシ（幹内部の幼虫には薬剤到達困難）
    await updateEffect(slug, "kamikirimushi", {
      efficacyLevel: "fair", persistenceLevel: "fair",
      note: "成虫への接触効果はあるが、幹内部の幼虫には薬剤が到達しにくい",
    });
    // コガネムシ幼虫（土中で浸透効果はあるが限定的）
    await updateEffect(slug, "koganemushi-youchu", {
      efficacyLevel: "fair", persistenceLevel: "good",
      note: "粒剤の土壌処理で一部効果あるが、コガネムシ幼虫への適用は限定的",
    });
    // ミノムシ
    await updateEffect(slug, "minomushi", {
      efficacyLevel: "fair", persistenceLevel: "fair",
      note: "浸透移行性で巣内の幼虫にも一部効果があるが限定的",
    });

    // 全体的にpersistenceLevel "excellent" が多すぎるので主要害虫以外をgoodに修正
    // 吸汁害虫（本来の適用対象）はexcellentのまま
    // チョウ目全般のpersistenceLevelをgoodに下げる
    const pId = await getPesticideId(slug);
    if (pId) {
      // チョウ目・甲虫目の害虫（非吸汁系）のpersistenceLevelを修正
      const nonSuckingPests = await prisma.diseasePest.findMany({
        where: {
          category: "pest",
          slug: {
            in: [
              "hasumon-yotou", "amerika-shirohitori", "maimaiga", "iragarui",
              "monshirochou-youchu", "chadokuga", "akaeguriba", "hamakimushi",
              "ringo-kokaku-hamaki", "cha-hamaki", "ringo-hamaki",
              "kabura-habachi", "kinuwaba", "tamana-yaga", "kabura-yaga",
              "sesuji-suzume-youchu", "nashi-kemushi", "kiashi-dokuga",
              "maeaka-sukashiba", "oosukashiba", "koumoriga",
              "koganemushi-seichu", "douganebuibui", "himekogane",
              "semadara-kogane", "aodougane", "midori-hanamuguri",
              "koao-hanamuguri", "hamushi-rui", "kuro-urihamushi",
              "kiashi-kurohamushi", "kuwahamushi", "oosanshou-zoumusi",
              "oo-zoumusi", "hime-hana-zoumusi",
            ],
          },
        },
        select: { id: true },
      });
      const nonSuckingIds = nonSuckingPests.map(dp => dp.id);
      if (nonSuckingIds.length > 0) {
        const updated = await prisma.pesticideEffect.updateMany({
          where: {
            pesticideId: pId,
            diseasePestId: { in: nonSuckingIds },
            persistenceLevel: "excellent",
          },
          data: { persistenceLevel: "good" },
        });
        if (updated.count > 0) {
          console.log(`  ✓ ${slug}: チョウ目・甲虫目 ${updated.count}件の persistenceLevel を excellent → good に修正`);
        }
      }
    }
  }

  // ──────────────────────────────────────────────────────
  //  6. ジマンダイセン水和剤: 土壌病害・不適切な紐付け修正
  //  マンゼブは葉面保護殺菌剤（FRAC M03）。
  //  土壌伝染性の維管束病害には到達できず無効。
  //  うどんこ病への効果も限定的（"excellent"→"fair"）。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 6. ジマンダイセン水和剤 修正 ---");

  // 葉面保護殺菌剤が効果を発揮できない病害の紐付けを削除
  const dithaneInvalidDiseases = [
    // 土壌伝染性維管束病害（葉面散布では到達不可能）
    "icho-byo",           // 萎凋病
    "dojo-densen-icho-byo", // 土壌伝染性萎凋病
    "shinsou-icho-byo",   // 新梢萎凋病
    "youmyaku-icho-byo",  // 葉脈萎凋病
    // 生理障害が主因の病害（殺菌剤では対応できない）
    "hayake-byo",         // 葉焼病
    "hasen-gare-byo",     // 葉先枯病（生理障害の複合）
    "hasen-kappen-byo",   // 葉先褐変病（生理障害の複合）
    "kanretsu-byo",       // 幹裂病（物理的原因が主）
    // ウイルス・ファイトプラズマ病害（殺菌剤では無効）
    "youmyaku-ouka-byo",  // 葉脈黄化病（ウイルス/生理障害）
    "youmyaku-eshi-byo",  // 葉脈壊死病（ウイルス/細菌）
    "mosaic-byo",         // モザイク病（ウイルス）
    // 木材腐朽菌（マンゼブの接触保護では対応困難）
    "miki-shinkusare-byo", // 幹心腐病
  ];

  for (const dpSlug of dithaneInvalidDiseases) {
    // dithane-wp と関連製品
    for (const slug of ["dithane-wp", "dithane-fl"]) {
      await deleteEffect(slug, dpSlug);
    }
  }

  // うどんこ病: "excellent"→"fair"（マンゼブは登録があるが保護殺菌剤として限定的）
  for (const slug of ["dithane-wp", "dithane-fl"]) {
    await updateEffect(slug, "udonko-byo", {
      preventionLevel: "fair",
      note: "保護殺菌剤。うどんこ病に対する予防効果は限定的。EBI系やQoI系との併用が望ましい",
    });
  }

  // すす病: efficacyLevel "poor"のまま（害虫分泌物が原因のため殺菌剤の直接効果は低い）
  // ← これは既にpoorに設定されているのでOK

  // 細菌性病害: マンゼブは糸状菌用で細菌には効果なし → 紐付け削除
  const dithaneInvalidBacterial = [
    "megare-saikin-byo",   // 芽枯細菌病
    "edagare-saikin-byo",  // 枝枯細菌病
    "edagare-saikin2-byo", // 枝枯細菌病（Pseudomonas）
    "kougare-saikin-byo",  // 梢枯細菌病
    "hagusare-saikin-byo", // 葉腐細菌病
    "hagare-saikin-byo",   // 葉枯細菌病
    "shougare-saikin-byo", // 梢枯細菌病
    "kappan-saikin-byo",   // 褐斑細菌病
    "kaiyou-saikin-byo",   // 潰瘍細菌病
  ];
  for (const dpSlug of dithaneInvalidBacterial) {
    for (const slug of ["dithane-wp", "dithane-fl"]) {
      await deleteEffect(slug, dpSlug);
    }
  }

  // 残りの病害のpreventionLevelを個別に調整
  // べと病・疫病: excellent のまま（マンゼブの主要ターゲット）
  // さび病・炭疽病・褐斑病: excellent → good（効果はあるが専門薬ほどではない）
  const dithaneGoodDiseases = [
    "sabi-byo", "tanso-byo", "hanten-byo", "haiiro-kabi-byo",
    "kuroboshi-byo", "rinmon-byo", "akaboshi-byo",
  ];
  for (const dpSlug of dithaneGoodDiseases) {
    for (const slug of ["dithane-wp", "dithane-fl"]) {
      await updateEffect(slug, dpSlug, {
        preventionLevel: "good",
        note: "保護殺菌剤。予防散布が基本。治療効果なし",
      });
    }
  }

  // ──────────────────────────────────────────────────────
  //  7. ベニカベジフルスプレーの SDHI→QoI 表記修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 7. ベニカベジフルスプレー 表記修正 ---");
  const benicaVegiFru = await prisma.pesticide.findUnique({ where: { slug: "benica-vegifru-spray" } });
  if (benicaVegiFru) {
    await prisma.pesticide.update({
      where: { id: benicaVegiFru.id },
      data: {
        description: "住友化学園芸の野菜・果樹向け殺虫殺菌スプレー。クロチアニジン（浸透移行性殺虫）とマンデストロビン（QoI系殺菌 FRAC11）の2成分配合。浸透移行性により葉裏の害虫にも効果を発揮し、病気の予防・治療にも対応。希釈せずそのまま使用。",
      },
    });
    console.log("  ✓ benica-vegifru-spray description を修正");

    // 効果データのnote修正
    await updateEffect("benica-vegifru-spray", "udonko-byo", {
      note: "マンデストロビンのQoI作用（FRAC11）。予防効果が主体",
    });
  }

  // ──────────────────────────────────────────────────────
  //  8. 同一系統（銅系）の保護殺菌剤で細菌病と誤紐付けされていないか確認
  //  （銅系殺菌剤は細菌病にも有効なので紐付けは正しい）
  //  ※ マンゼブ系は糸状菌専用なので上で削除済み
  // ──────────────────────────────────────────────────────

  // ──────────────────────────────────────────────────────
  //  9. トレボンEC の一律 "excellent" を害虫特性に応じて分化
  // ──────────────────────────────────────────────────────
  console.log("\n--- 9. トレボンEC 一律評価の分化 ---");

  for (const slug of ["trebon-ec", "trebon-aerosol", "trebon-dp"]) {
    const pId = await getPesticideId(slug);
    if (!pId) continue;

    // 吸汁害虫（アブラムシ、コナジラミ、ヨコバイ等）: excellent→good
    // エトフェンプロクスは接触性のためネオニコチノイドほど吸汁害虫に持続効果がない
    const suckingPests = await prisma.diseasePest.findMany({
      where: {
        category: "pest",
        slug: {
          in: ["aburamushi", "konajirami", "yokobai", "gunbaimushi",
               "kamemushi", "momoaka-aburamushi", "wata-aburamushi",
               "higenaga-aburamushi", "himekuro-ooaburamushi"],
        },
      },
      select: { id: true },
    });
    const suckingIds = suckingPests.map(dp => dp.id);
    if (suckingIds.length > 0) {
      await prisma.pesticideEffect.updateMany({
        where: {
          pesticideId: pId,
          diseasePestId: { in: suckingIds },
          efficacyLevel: "excellent",
        },
        data: { efficacyLevel: "good", persistenceLevel: "fair" },
      });
    }

    // チョウ目幼虫: good, persistenceLevel fair（接触毒なので残効性は低い）
    const lepidopteraPests = await prisma.diseasePest.findMany({
      where: {
        category: "pest",
        slug: {
          in: ["hasumon-yotou", "hamakimushi", "chadokuga",
               "maimaiga", "iragarui", "amerika-shirohitori",
               "monshirochou-youchu", "ringo-kokaku-hamaki",
               "cha-hamaki", "ringo-hamaki", "kinuwaba",
               "kabura-yaga", "tamana-yaga"],
        },
      },
      select: { id: true },
    });
    const lepIds = lepidopteraPests.map(dp => dp.id);
    if (lepIds.length > 0) {
      await prisma.pesticideEffect.updateMany({
        where: {
          pesticideId: pId,
          diseasePestId: { in: lepIds },
          persistenceLevel: "excellent",
        },
        data: { persistenceLevel: "fair" },
      });
    }

    console.log(`  ✓ ${slug}: 害虫特性に応じて効果を分化`);
  }

  // ──────────────────────────────────────────────────────
  //  10. ジマンダイセンの他剤型（dithane-fl等）にも同様の修正を適用
  //  + 銅系保護殺菌剤のうどんこ病評価の見直し
  // ──────────────────────────────────────────────────────
  console.log("\n--- 10. その他保護殺菌剤のうどんこ病評価修正 ---");

  // 銅系保護殺菌剤 → うどんこ病は "fair" が適切
  // （銅系は細菌・べと病系には効くがうどんこ病への効果は限定的）
  const copperSlugs = [
    "sankei-copper-fl", "sankei-copper-wp", "sanyo-copper-wp",
    "z-bordeaux", "kasumin-bordeaux", "sankei-maneb-wp",
  ];
  for (const slug of copperSlugs) {
    await updateEffect(slug, "udonko-byo", {
      preventionLevel: "fair",
      note: "銅系保護殺菌剤。うどんこ病への効果は限定的。べと病・細菌病が主な適用",
    });
  }

  // ──────────────────────────────────────────────────────
  //  11. 有効成分マスタデータの修正
  // ──────────────────────────────────────────────────────
  console.log("\n--- 11. 有効成分マスタデータ修正 ---");

  // フルアジナム: ingredientGroup修正
  const fluazinam = await prisma.activeIngredient.findUnique({ where: { slug: "fluazinam" } });
  if (fluazinam) {
    await prisma.activeIngredient.update({
      where: { id: fluazinam.id },
      data: { ingredientGroup: "2,6-ジニトロアニリン系" },
    });
    console.log("  ✓ fluazinam ingredientGroup → 2,6-ジニトロアニリン系");
  }

  // ボスカリド: resistanceRisk修正 (high → medium)
  const boscalid = await prisma.activeIngredient.findUnique({ where: { slug: "boscalid" } });
  if (boscalid) {
    await prisma.activeIngredient.update({
      where: { id: boscalid.id },
      data: { resistanceRisk: "medium" },
    });
    console.log("  ✓ boscalid resistanceRisk → medium（FRAC公式: medium to high）");
  }

  // オキシテトラサイクリン: fracCode追加
  const oxytet = await prisma.activeIngredient.findUnique({ where: { slug: "okishi-tetora-saikurin" } });
  if (oxytet && !oxytet.fracCode) {
    await prisma.activeIngredient.update({
      where: { id: oxytet.id },
      data: { fracCode: "41" },
    });
    console.log("  ✓ okishi-tetora-saikurin fracCode → 41");
  }

  // ダゾメット: fracCode null化（FRAC公式分類外の土壌燻蒸剤）
  const dazomet = await prisma.activeIngredient.findUnique({ where: { slug: "dazomet" } });
  if (dazomet && dazomet.fracCode) {
    await prisma.activeIngredient.update({
      where: { id: dazomet.id },
      data: {
        fracCode: null,
        ingredientGroup: "チアジアジン系（土壌燻蒸剤）",
      },
    });
    console.log("  ✓ dazomet fracCode → null（土壌燻蒸剤はFRAC分類外）");
  }

  // DBEDC: fracCode M1 → M01
  const dbedc = await prisma.activeIngredient.findUnique({ where: { slug: "dbedc" } });
  if (dbedc && dbedc.fracCode === "M1") {
    await prisma.activeIngredient.update({
      where: { id: dbedc.id },
      data: { fracCode: "M01" },
    });
    console.log("  ✓ dbedc fracCode → M01");
  }

  // ペルメトリン重複解消: perumeto-rin → permethrin に統合
  // DB上に perumeto-rin のエントリがある場合、
  // それを参照する PesticideActiveIngredient を permethrin に差し替え
  const permethrinOld = await prisma.activeIngredient.findUnique({ where: { slug: "perumeto-rin" } });
  const permethrinNew = await prisma.activeIngredient.findUnique({ where: { slug: "permethrin" } });
  if (permethrinOld && permethrinNew) {
    // permethrinNew の resistanceRisk を high に統一
    await prisma.activeIngredient.update({
      where: { id: permethrinNew.id },
      data: { resistanceRisk: "high" },
    });

    // perumeto-rin を参照しているリンクを permethrin に差し替え
    const links = await prisma.pesticideActiveIngredient.findMany({
      where: { activeIngredientId: permethrinOld.id },
    });
    for (const link of links) {
      // 既に permethrin でリンクがあるか確認
      const existing = await prisma.pesticideActiveIngredient.findUnique({
        where: { pesticideId_activeIngredientId: { pesticideId: link.pesticideId, activeIngredientId: permethrinNew.id } },
      });
      if (!existing) {
        // permethrin で新規リンク作成
        await prisma.pesticideActiveIngredient.create({
          data: { pesticideId: link.pesticideId, activeIngredientId: permethrinNew.id, contentLabel: link.contentLabel },
        });
      }
      // 旧リンク削除
      await prisma.pesticideActiveIngredient.delete({
        where: { pesticideId_activeIngredientId: { pesticideId: link.pesticideId, activeIngredientId: permethrinOld.id } },
      });
    }
    // 旧エントリ削除
    await prisma.activeIngredient.delete({ where: { id: permethrinOld.id } });
    console.log("  ✓ perumeto-rin → permethrin に統合（重複解消）");
  }

  // ──────────────────────────────────────────────────────
  //  12. 剤型マスタの修正: SE → CS
  // ──────────────────────────────────────────────────────
  console.log("\n--- 12. 剤型マスタ修正 ---");
  const seFT = await prisma.formulationType.findUnique({ where: { code: "SE" } });
  if (seFT) {
    await prisma.formulationType.update({
      where: { id: seFT.id },
      data: { code: "CS" },
    });
    console.log("  ✓ SE → CS（マイクロカプセル剤の正しい国際コード）");
  }

  console.log("\n=== 効果データの正確性修正（第2弾）が完了しました ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
