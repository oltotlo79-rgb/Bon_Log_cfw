/* eslint-disable no-console */
/**
 * 病害虫効果データの事実に基づく正確性修正スクリプト。
 *
 * 修正内容:
 * 1. ポリオキシン: treatmentLevel excellent → good（静菌的作用のため治療効果は限定的）
 * 2. フジワン: 白絹病(S.rolfsii)への紐付けを削除（エビデンスなし、白紋羽病と混同）
 *    + 紋枯病のtreatmentLevelを excellent → good に修正（単剤では治療効果が限定的）
 * 3. アクタラ: カイガラムシへのパラメータ修正（成虫の殻に薬剤が届きにくい）
 * 4. モスピラン粒剤: カイガラムシ・コナカイガラムシのパラメータ修正
 * 5. 石灰硫黄合剤: treatmentLevel修正（休眠期保護剤。治療効果は限定的）
 * 6. トリフミンEC: 萎凋病・葉焼病への誤った紐付けを削除
 * 7. アミスター20FL: 萎凋病のtreatmentLevel修正
 * 8. 殺虫剤のpreventionLevel/treatmentLevelをnullに修正（殺菌剤用語の誤適用）
 * 9. ポリオキシン: 紋枯病のtreatmentLevel excellent → good
 * 10. 不足している重要な紐付けの追加
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-fix-accuracy.ts
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
  if (!existing) {
    console.warn(`  ⚠ ${pesticideSlug} → ${dpSlug} の効果データが存在しません（スキップ）`);
    return false;
  }

  await prisma.pesticideEffect.delete({ where: { id: existing.id } });
  console.log(`  ✗ ${pesticideSlug} → ${dpSlug} を削除`);
  return true;
}

async function addEffect(
  pesticideSlug: string,
  dpSlug: string,
  effect: {
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
  if (existing) return false; // 既に存在

  await prisma.pesticideEffect.create({
    data: {
      pesticideId: pId,
      diseasePestId: dpId,
      preventionLevel: effect.preventionLevel ?? null,
      treatmentLevel: effect.treatmentLevel ?? null,
      efficacyLevel: effect.efficacyLevel ?? null,
      persistenceLevel: effect.persistenceLevel ?? null,
      note: effect.note ?? null,
    },
  });
  console.log(`  + ${pesticideSlug} → ${dpSlug} を追加`);
  return true;
}

async function main() {
  console.log("=== 効果データの正確性修正を開始します ===\n");

  // ──────────────────────────────────────────────────────
  //  1. ポリオキシン: treatmentLevel excellent → good
  //  ポリオキシンはキチン生合成阻害剤（FRAC19）で静菌的作用。
  //  予防効果は高いが、既に感染した菌糸への治療効果は限定的。
  // ──────────────────────────────────────────────────────
  console.log("--- 1. ポリオキシン treatmentLevel 修正 ---");
  for (const slug of ["polyoxin-al", "polyoxin-wp"]) {
    const pId = await getPesticideId(slug);
    if (!pId) continue;

    const updated = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: pId,
        treatmentLevel: "excellent",
      },
      data: {
        treatmentLevel: "good",
      },
    });
    if (updated.count > 0) {
      console.log(`  ✓ ${slug}: ${updated.count}件の treatmentLevel を excellent → good に修正`);
    }
  }

  // ──────────────────────────────────────────────────────
  //  2. フジワン: 白絹病への紐付け削除 + 紋枯病パラメータ修正
  //  イソプロチオラン（FRAC6）は稲いもち病が主な適用。
  //  白絹病(Sclerotium rolfsii)への効果エビデンスなし（白紋羽病と混同された可能性）。
  //  紋枯病は単剤では治療効果が限定的（フジワンモンカット粒剤はフルトラニルとの混合剤）。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 2. フジワン 白絹病・紋枯病 修正 ---");
  for (const slug of ["fujione-wp", "fujione-fl"]) {
    // 白絹病との紐付けを削除
    await deleteEffect(slug, "shirakinu-byo");

    // 紋枯病の treatmentLevel を修正
    await updateEffect(slug, "mongare-byo", {
      treatmentLevel: "good",
      note: "イソプロチオランの浸透移行性。予防効果が主体。治療効果は単剤では限定的",
    });
  }

  // ──────────────────────────────────────────────────────
  //  3. アクタラ: カイガラムシのパラメータ修正
  //  チアメトキサム（IRAC4A）は浸透移行性ネオニコチノイド。
  //  カイガラムシの若齢幼虫(クローラー)には有効だが、
  //  成虫はロウ質の殻に覆われて薬剤が到達しにくい。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 3. アクタラ カイガラムシ パラメータ修正 ---");
  for (const slug of ["actara-wdg", "actara-fl"]) {
    await updateEffect(slug, "kaigaramushi", {
      preventionLevel: null,
      treatmentLevel: null,
      efficacyLevel: "good",
      persistenceLevel: "good",
      note: "浸透移行性で若齢幼虫（クローラー）に有効。成虫のロウ質殻には薬剤が到達しにくい",
    });
  }

  // ──────────────────────────────────────────────────────
  //  4. モスピラン粒剤: カイガラムシ・コナカイガラムシの修正
  //  アセタミプリド（IRAC4A）。他の剤型(mospilan-sl/dp)では
  //  efficacyLevel: good, persistenceLevel: good。粒剤のみ全パラメータ
  //  excellent は過大評価。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 4. モスピラン粒剤 カイガラムシ 修正 ---");
  await updateEffect("mospilan-gr", "kaigaramushi", {
    preventionLevel: null,
    treatmentLevel: null,
    efficacyLevel: "good",
    persistenceLevel: "excellent",
    note: "浸透移行性で若齢幼虫に有効。成虫の殻は薬剤が到達しにくい。土壌施用の浸透効果で持続性は高い",
  });
  await updateEffect("mospilan-gr", "konakaigaramushi", {
    preventionLevel: null,
    treatmentLevel: null,
    efficacyLevel: "good",
    persistenceLevel: "excellent",
    note: "コナカイガラムシの綿状分泌物を通じて浸透効果あり",
  });

  // ──────────────────────────────────────────────────────
  //  5. 石灰硫黄合剤: treatmentLevel修正
  //  休眠期に使用する保護剤。接触殺菌作用はあるが、
  //  植物体内に浸透して感染菌を殺す「治療効果」は限定的。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 5. 石灰硫黄合剤 treatmentLevel 修正 ---");
  const limeSulfurId = await getPesticideId("lime-sulfur");
  if (limeSulfurId) {
    // うどんこ病: 接触で菌糸を殺すが浸透治療ではない
    await updateEffect("lime-sulfur", "udonko-byo", {
      treatmentLevel: "fair",
      note: "冬季休眠期の保護散布が主用途。接触により表面の菌糸は殺菌するが、組織内への浸透治療効果は低い",
    });

    // カイガラムシ: 冬季の殻ごと窒息・殺卵効果
    await updateEffect("lime-sulfur", "kaigaramushi", {
      treatmentLevel: "good",
      note: "休眠期に高濃度散布で越冬個体を殺滅。生育期の使用は薬害リスクが高い",
    });

    // ハダニ: 直接接触で殺ダニ効果
    await updateEffect("lime-sulfur", "hadani", {
      treatmentLevel: "good",
      note: "休眠期散布で越冬卵・成虫に直接接触効果。生育期は薬害に注意",
    });

    // その他のeffectで treatmentLevel が excellent のものを fair に修正
    const updated = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: limeSulfurId,
        treatmentLevel: "excellent",
      },
      data: {
        treatmentLevel: "fair",
      },
    });
    if (updated.count > 0) {
      console.log(`  ✓ lime-sulfur: 残り${updated.count}件の treatmentLevel を excellent → fair に修正`);
    }
  }

  // ──────────────────────────────────────────────────────
  //  6. トリフミンEC: 萎凋病・葉焼病への誤った紐付けを削除
  //  トリフルミゾール（FRAC3 DMI系）は葉面の糸状菌に効果があるが、
  //  萎凋病（土壌伝染性の維管束病害）や葉焼病（生理障害が主因）には無効。
  //  MAFF登録にもこれらの適用はない。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 6. トリフミンEC 不正確な紐付け削除 ---");
  await deleteEffect("trifumin-ec", "icho-byo");
  await deleteEffect("trifumin-ec", "hayake-byo");

  // ──────────────────────────────────────────────────────
  //  7. アミスター20FL: 萎凋病のtreatmentLevel修正
  //  アゾキシストロビン（FRAC11 QoI系）は土壌灌注で一部の萎凋病に
  //  効果ありとの報告があるが、葉面散布（盆栽での一般的な使用法）では
  //  維管束内の病原菌に到達しない。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 7. アミスター20FL 萎凋病パラメータ修正 ---");
  await updateEffect("amistar-20-fl", "icho-byo", {
    treatmentLevel: "poor",
    efficacyLevel: "fair",
    note: "土壌灌注で限定的な効果報告あり。葉面散布では維管束内の病原菌に到達せず効果は乏しい",
  });

  // ──────────────────────────────────────────────────────
  //  8. 殺虫剤のpreventionLevel/treatmentLevelをnullに修正
  //  「予防効果」「治療効果」は殺菌剤固有の概念。
  //  殺虫剤にはefficacyLevel（殺虫効果）とpersistenceLevel（残効性）
  //  のみが適用される。
  //  ただし、対象が害虫（pest）カテゴリのeffectのみを修正。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 8. 殺虫剤の preventionLevel/treatmentLevel をnullに修正 ---");

  // pest カテゴリの diseasePest の ID を取得
  const pestDPs = await prisma.diseasePest.findMany({
    where: { category: "pest" },
    select: { id: true },
  });
  const pestDPIds = pestDPs.map(dp => dp.id);

  // 殺虫剤タイプの pesticide の ID を取得
  const insecticidePesticides = await prisma.pesticide.findMany({
    where: {
      pesticideType: { in: ["insecticide", "acaricide"] },
    },
    select: { id: true },
  });
  const insecticideIds = insecticidePesticides.map(p => p.id);

  // 殺虫剤 → 害虫 のエフェクトで preventionLevel/treatmentLevel が設定されているものを修正
  if (insecticideIds.length > 0 && pestDPIds.length > 0) {
    const updatedPrev = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: { in: insecticideIds },
        diseasePestId: { in: pestDPIds },
        preventionLevel: { not: null },
      },
      data: { preventionLevel: null },
    });

    const updatedTreat = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: { in: insecticideIds },
        diseasePestId: { in: pestDPIds },
        treatmentLevel: { not: null },
      },
      data: { treatmentLevel: null },
    });

    console.log(`  ✓ 殺虫剤→害虫: preventionLevel ${updatedPrev.count}件、treatmentLevel ${updatedTreat.count}件をnullに修正`);
  }

  // compound（複合剤）の害虫エフェクトも同様に修正
  // ただし、スプレー製品（seed-pesticide-spray.ts）は正しくefficacyLevel/persistenceLevelのみで
  // 作成されているため影響は少ない
  const compoundPesticides = await prisma.pesticide.findMany({
    where: { pesticideType: "compound" },
    select: { id: true },
  });
  const compoundIds = compoundPesticides.map(p => p.id);

  if (compoundIds.length > 0 && pestDPIds.length > 0) {
    const updatedPrevC = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: { in: compoundIds },
        diseasePestId: { in: pestDPIds },
        preventionLevel: { not: null },
      },
      data: { preventionLevel: null },
    });

    const updatedTreatC = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: { in: compoundIds },
        diseasePestId: { in: pestDPIds },
        treatmentLevel: { not: null },
      },
      data: { treatmentLevel: null },
    });

    if (updatedPrevC.count > 0 || updatedTreatC.count > 0) {
      console.log(`  ✓ 複合剤→害虫: preventionLevel ${updatedPrevC.count}件、treatmentLevel ${updatedTreatC.count}件をnullに修正`);
    }
  }

  // 殺菌剤タイプだが害虫エフェクトを持つ場合も修正（石灰硫黄合剤→ハダニ/カイガラムシ等）
  // 殺菌剤→害虫のエフェクトで preventionLevel/treatmentLevel が設定されている場合
  const fungicidePesticides = await prisma.pesticide.findMany({
    where: { pesticideType: "fungicide" },
    select: { id: true },
  });
  const fungicideIds = fungicidePesticides.map(p => p.id);

  // ただし石灰硫黄合剤は殺菌剤分類だがカイガラムシ/ハダニにも使われる。
  // これらは efficacyLevel/persistenceLevel で表現すべき。
  // 上の修正5で個別に treatmentLevel を調整済みなので、
  // 殺菌剤→害虫の残りの preventionLevel もnullに修正
  if (fungicideIds.length > 0 && pestDPIds.length > 0) {
    const updatedFP = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: { in: fungicideIds },
        diseasePestId: { in: pestDPIds },
        preventionLevel: { not: null },
      },
      data: { preventionLevel: null },
    });

    if (updatedFP.count > 0) {
      console.log(`  ✓ 殺菌剤→害虫: preventionLevel ${updatedFP.count}件をnullに修正`);
    }

    // 殺菌剤→害虫の treatmentLevel もnullに修正
    const updatedFT = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: { in: fungicideIds },
        diseasePestId: { in: pestDPIds },
        treatmentLevel: { not: null },
      },
      data: { treatmentLevel: null },
    });

    if (updatedFT.count > 0) {
      console.log(`  ✓ 殺菌剤→害虫: treatmentLevel ${updatedFT.count}件をnullに修正`);
    }
  }

  // ──────────────────────────────────────────────────────
  //  9. 不足している重要な紐付けの追加
  // ──────────────────────────────────────────────────────
  console.log("\n--- 9. 不足している重要な紐付けの追加 ---");

  // ダコニール（TPN/クロロタロニル FRAC M05）は保護殺菌剤で
  // べと病に特に効果が高いが、紐付けが不足している場合
  for (const slug of ["daconil-1000", "daconil-wp", "daconil-wdg"]) {
    await addEffect(slug, "beto-byo", {
      preventionLevel: "excellent",
      treatmentLevel: "none",
      persistenceLevel: "good",
      note: "保護殺菌剤。べと病に対する予防効果が特に高い",
    });
    await addEffect(slug, "eki-byo", {
      preventionLevel: "good",
      treatmentLevel: "none",
      persistenceLevel: "good",
      note: "保護殺菌剤。疫病(Phytophthora)に予防効果",
    });
  }

  // トップジンM（チオファネートメチル FRAC1）→ 炭疽病（治療効果あり）
  await addEffect("topjin-m-wp", "tanso-byo", {
    preventionLevel: "good",
    treatmentLevel: "good",
    persistenceLevel: "good",
    note: "浸透移行性で予防・治療の両効果。炭疽病に広く使用される",
  });

  // トップジンM → 黒星病
  await addEffect("topjin-m-wp", "kuroboshi-byo", {
    preventionLevel: "good",
    treatmentLevel: "good",
    persistenceLevel: "good",
    note: "ベンゾイミダゾール系の浸透移行性で黒星病に予防・治療効果",
  });

  // ベンレート（ベノミル FRAC1）→ 菌核病（土壌灌注で高い効果）
  for (const slug of ["benlate-wp", "benlate-df"]) {
    await addEffect(slug, "kinkaku-byo", {
      preventionLevel: "good",
      treatmentLevel: "good",
      persistenceLevel: "good",
      note: "ベンゾイミダゾール系。菌核病菌の菌核形成を抑制",
    });
  }

  // ジマンダイセン（マンゼブ FRAC M03）→ べと病（保護殺菌剤の基本）
  await addEffect("dithane-wp", "beto-byo", {
    preventionLevel: "excellent",
    treatmentLevel: "none",
    persistenceLevel: "good",
    note: "保護殺菌剤。べと病の予防散布に最適",
  });

  // スミチオン（フェニトロチオン IRAC1B）→ カミキリムシ
  await addEffect("sumithion-ec", "kamikirimushi", {
    efficacyLevel: "good",
    persistenceLevel: "fair",
    note: "有機リン系。幹への塗布で産卵・幼虫に効果",
  });

  // マシン油 → カイガラムシの種類別紐付け追加
  await addEffect("machine-oil-ec", "konakaigaramushi", {
    efficacyLevel: "excellent",
    persistenceLevel: "fair",
    note: "油膜で気門を塞ぎ窒息させる物理的防除。冬季の高濃度散布で越冬個体に高い効果",
  });

  // ──────────────────────────────────────────────────────
  //  10. ゲッター水和剤: treatmentLevel修正
  //  チオファネートメチル+キャプタンの混合剤。
  //  元データでは全effctが excellent/excellent だが、
  //  キャプタン成分は保護殺菌剤で治療効果なし。
  //  複合的にはgoodが妥当。
  // ──────────────────────────────────────────────────────
  console.log("\n--- 10. ゲッター水和剤 treatmentLevel 修正 ---");
  for (const slug of ["getter-wp", "getter-fl"]) {
    const pId = await getPesticideId(slug);
    if (!pId) continue;

    const updated = await prisma.pesticideEffect.updateMany({
      where: {
        pesticideId: pId,
        treatmentLevel: "excellent",
      },
      data: {
        treatmentLevel: "good",
      },
    });
    if (updated.count > 0) {
      console.log(`  ✓ ${slug}: ${updated.count}件の treatmentLevel を excellent → good に修正（キャプタン成分は保護殺菌剤のため）`);
    }
  }

  console.log("\n=== 効果データの正確性修正が完了しました ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
