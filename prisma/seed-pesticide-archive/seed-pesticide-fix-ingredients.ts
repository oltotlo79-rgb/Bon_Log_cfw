/* eslint-disable no-console */
/**
 * 薬剤-原体-剤型-展着剤の紐付けデータの事実誤りを修正するスクリプト。
 *
 * 修正内容:
 * 1. 有効成分が完全に間違っている紐付けの修正（14件）
 * 2. 含有量（contentLabel）の修正（3件）
 * 3. 架空の製品の削除または正しい製品への置換（3件）
 * 4. 展着剤の型の修正（1件）
 * 5. 紐付け漏れの追加（1件）
 * 6. ゲッター水和剤を2成分の複合剤として正しく登録
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-fix-ingredients.ts
 */

// Load env
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
  datasources: { db: { url: finalConnectionString } },
});

// ── ヘルパー ──
async function getIngredientId(slug: string): Promise<string | null> {
  const ing = await prisma.activeIngredient.findUnique({ where: { slug } });
  if (!ing) { console.warn(`  ⚠ 有効成分 ${slug} が見つかりません`); return null; }
  return ing.id;
}

async function getPesticideId(slug: string): Promise<string | null> {
  const p = await prisma.pesticide.findUnique({ where: { slug } });
  if (!p) { console.warn(`  ⚠ 農薬 ${slug} が見つかりません`); return null; }
  return p.id;
}

async function ensureIngredient(data: {
  slug: string; name: string; nameEn: string;
  fracCode?: string; iracCode?: string;
  ingredientGroup: string; description: string;
  resistanceRisk?: "low" | "medium" | "high";
}): Promise<string> {
  let ing = await prisma.activeIngredient.findUnique({ where: { slug: data.slug } });
  if (!ing) {
    ing = await prisma.activeIngredient.create({
      data: {
        slug: data.slug, name: data.name, nameEn: data.nameEn,
        fracCode: data.fracCode ?? null, iracCode: data.iracCode ?? null,
        ingredientGroup: data.ingredientGroup, description: data.description,
        resistanceRisk: data.resistanceRisk ?? null,
      },
    });
    console.log(`  + 有効成分 ${data.name}（${data.slug}）を追加`);
  }
  return ing.id;
}

async function relinkIngredient(
  pesticideSlug: string, oldIngSlug: string | null, newIngSlug: string, newContentLabel: string,
) {
  const pId = await getPesticideId(pesticideSlug);
  if (!pId) return;

  // 既存リンクを削除
  if (oldIngSlug) {
    const oldIngId = await getIngredientId(oldIngSlug);
    if (oldIngId) {
      try {
        await prisma.pesticideActiveIngredient.delete({
          where: { pesticideId_activeIngredientId: { pesticideId: pId, activeIngredientId: oldIngId } },
        });
      } catch { /* not found */ }
    }
  }

  // 新しいリンクを作成
  const newIngId = await getIngredientId(newIngSlug);
  if (!newIngId) return;

  const existing = await prisma.pesticideActiveIngredient.findUnique({
    where: { pesticideId_activeIngredientId: { pesticideId: pId, activeIngredientId: newIngId } },
  });
  if (existing) {
    await prisma.pesticideActiveIngredient.update({
      where: { pesticideId_activeIngredientId: { pesticideId: pId, activeIngredientId: newIngId } },
      data: { contentLabel: newContentLabel },
    });
  } else {
    await prisma.pesticideActiveIngredient.create({
      data: { pesticideId: pId, activeIngredientId: newIngId, contentLabel: newContentLabel },
    });
  }
  console.log(`  ✓ ${pesticideSlug}: ${oldIngSlug ?? "(なし)"} → ${newIngSlug} ${newContentLabel}`);
}

async function updateContentLabel(pesticideSlug: string, ingSlug: string, newLabel: string) {
  const pId = await getPesticideId(pesticideSlug);
  const ingId = await getIngredientId(ingSlug);
  if (!pId || !ingId) return;

  await prisma.pesticideActiveIngredient.update({
    where: { pesticideId_activeIngredientId: { pesticideId: pId, activeIngredientId: ingId } },
    data: { contentLabel: newLabel },
  });
  console.log(`  ✓ ${pesticideSlug} → ${ingSlug}: 含有量を ${newLabel} に修正`);
}

async function main() {
  console.log("=== 薬剤-原体紐付けデータの修正を開始します ===\n");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  新規有効成分の追加（必要なもの）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("--- 新規有効成分の追加 ---");

  await ensureIngredient({
    slug: "isoprothiolane",
    name: "イソプロチオラン",
    nameEn: "Isoprothiolane",
    fracCode: "6",
    ingredientGroup: "リン系殺菌剤",
    description: "稲いもち病に高い効果を持つ浸透移行性殺菌剤。メラニン生合成阻害により菌の侵入を阻止する。",
    resistanceRisk: "low",
  });

  await ensureIngredient({
    slug: "diethofencarb",
    name: "ジエトフェンカルブ",
    nameEn: "Diethofencarb",
    fracCode: "10",
    ingredientGroup: "N-フェニルカーバメート系",
    description: "ベンゾイミダゾール系殺菌剤に耐性を持つ菌にも効果がある殺菌剤。チオファネートメチルとの混合剤（ゲッター）として使用される。",
    resistanceRisk: "medium",
  });

  await ensureIngredient({
    slug: "fenpyroximate",
    name: "フェンピロキシメート",
    nameEn: "Fenpyroximate",
    iracCode: "21A",
    ingredientGroup: "METI系殺ダニ剤",
    description: "ミトコンドリア電子伝達系Complex I阻害（METI）殺ダニ剤。ハダニの全ステージに速効的に効果を発揮する。",
    resistanceRisk: "medium",
  });

  await ensureIngredient({
    slug: "pyribencarb",
    name: "ピリベンカルブ",
    nameEn: "Pyribencarb",
    fracCode: "11",
    ingredientGroup: "QoI系（メトキシカルバメート系）",
    description: "ストロビルリン系と同じQoI（Complex III阻害）に分類される殺菌剤。うどんこ病・灰色かび病・黒星病に効果。",
    resistanceRisk: "high",
  });

  await ensureIngredient({
    slug: "acrinathrin",
    name: "アクリナトリン",
    nameEn: "Acrinathrin",
    iracCode: "3A",
    ingredientGroup: "ピレスロイド系",
    description: "合成ピレスロイド系殺虫殺ダニ剤。ハダニ・アブラムシ・コナジラミ等に速効的に効果。",
    resistanceRisk: "medium",
  });

  await ensureIngredient({
    slug: "kasugamycin",
    name: "カスガマイシン",
    nameEn: "Kasugamycin",
    fracCode: "24",
    ingredientGroup: "アミノグリコシド系抗生物質",
    description: "放線菌由来の抗生物質系殺菌剤。いもち病・細菌性病害に効果がある。",
    resistanceRisk: "low",
  });

  await ensureIngredient({
    slug: "maneb",
    name: "マネブ",
    nameEn: "Maneb",
    fracCode: "M03",
    ingredientGroup: "ジチオカーバメート系（保護殺菌剤）",
    description: "マンガンエチレンビスジチオカーバメート系の保護殺菌剤。マンゼブとは異なり亜鉛を含まない。耐性菌が発生しにくい。",
    resistanceRisk: "low",
  });

  await ensureIngredient({
    slug: "acequinocyl",
    name: "アセキノシル",
    nameEn: "Acequinocyl",
    iracCode: "20B",
    ingredientGroup: "ミトコンドリア電子伝達系Complex III阻害（Qo site）",
    description: "ハダニの全ステージに効果がある殺ダニ剤。速効性と残効性を兼ね備える。",
    resistanceRisk: "medium",
  });

  await ensureIngredient({
    slug: "basic-copper-chloride",
    name: "塩基性塩化銅",
    nameEn: "Basic Copper Chloride",
    fracCode: "M01",
    ingredientGroup: "銅系殺菌剤",
    description: "銅イオンの殺菌作用により広範な病害に予防効果。細菌性病害にも有効。",
    resistanceRisk: "low",
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  1. コロマイト乳剤: ピリダベン → ミルベメクチン
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 1. コロマイト乳剤/FL: 有効成分修正 ---");
  await relinkIngredient("colomite-ec", "pyridaben", "milbemectin", "1.0%");

  // コロマイトFL（架空製品）— 削除済み
  // const colomiteFl = await prisma.pesticide.findUnique({ where: { slug: "colomite-fl" } });
  // if (colomiteFl) { ... }

  // コロマイト乳剤の説明修正
  await prisma.pesticide.update({
    where: { slug: "colomite-ec" },
    data: { description: "ミルベメクチン（マクロライド系）配合の殺ダニ剤。ハダニ類に高い効果を示す。" },
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  2. フジワン: バリダマイシン → イソプロチオラン
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 2. フジワン水和剤/FL: 有効成分修正 ---");
  await relinkIngredient("fujione-wp", "validamycin", "isoprothiolane", "12.0%");

  const fujioneFl = await prisma.pesticide.findUnique({ where: { slug: "fujione-fl" } });
  if (fujioneFl) {
    await relinkIngredient("fujione-fl", "validamycin", "isoprothiolane", "40.0%");
    await prisma.pesticide.update({
      where: { slug: "fujione-fl" },
      data: { description: "イソプロチオラン配合のフロアブル殺菌剤。いもち病に高い効果。浸透移行性を有する。" },
    });
  }

  await prisma.pesticide.update({
    where: { slug: "fujione-wp" },
    data: { description: "イソプロチオラン配合の水和剤殺菌剤。いもち病に高い効果。浸透移行性を有する。" },
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  3. ゲッター水和剤: イミノクタジン → ジエトフェンカルブ+チオファネートメチル
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 3. ゲッター水和剤: 有効成分修正（2成分複合剤） ---");
  // getter-fl（架空製品）は削除済み。getter-wpのみ処理
  for (const slug of ["getter-wp"]) {
    const pId = await getPesticideId(slug);
    if (!pId) continue;

    // 既存のイミノクタジンリンクを削除
    const iminoctadineId = await getIngredientId("iminoctadine");
    if (iminoctadineId) {
      try {
        await prisma.pesticideActiveIngredient.delete({
          where: { pesticideId_activeIngredientId: { pesticideId: pId, activeIngredientId: iminoctadineId } },
        });
      } catch { /* not found */ }
    }

    // ジエトフェンカルブをリンク
    const diethofencarbId = await getIngredientId("diethofencarb");
    if (diethofencarbId) {
      const existing = await prisma.pesticideActiveIngredient.findUnique({
        where: { pesticideId_activeIngredientId: { pesticideId: pId, activeIngredientId: diethofencarbId } },
      });
      if (!existing) {
        await prisma.pesticideActiveIngredient.create({
          data: { pesticideId: pId, activeIngredientId: diethofencarbId, contentLabel: "12.5%" },
        });
      }
    }

    // チオファネートメチルをリンク
    const thiophanateId = await getIngredientId("thiophanate-methyl");
    if (thiophanateId) {
      const existing = await prisma.pesticideActiveIngredient.findUnique({
        where: { pesticideId_activeIngredientId: { pesticideId: pId, activeIngredientId: thiophanateId } },
      });
      if (!existing) {
        await prisma.pesticideActiveIngredient.create({
          data: { pesticideId: pId, activeIngredientId: thiophanateId, contentLabel: "52.5%" },
        });
      }
    }

    await prisma.pesticide.update({
      where: { slug },
      data: {
        description: "ジエトフェンカルブ＋チオファネートメチルの複合殺菌剤。ベンゾイミダゾール系耐性菌にも効果がある。炭疽病・灰色かび病・斑点病に有効。",
      },
    });
    console.log(`  ✓ ${slug}: 2成分複合剤として正しくリンク`);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  4. ダニトロンFL: ビフェナゼート → フェンピロキシメート
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 4. ダニトロンFL/EC: 有効成分修正 ---");
  await relinkIngredient("danitron-fl", "bifenazate", "fenpyroximate", "5.0%");
  await prisma.pesticide.update({
    where: { slug: "danitron-fl" },
    data: { description: "フェンピロキシメート（METI系）配合殺ダニ剤。ハダニの全ステージに速効性。" },
  });

  // danitron-ec が存在する場合
  const danitronEc = await prisma.pesticide.findUnique({ where: { slug: "danitron-ec" } });
  if (danitronEc) {
    await relinkIngredient("danitron-ec", "bifenazate", "fenpyroximate", "5.0%");
    await prisma.pesticide.update({
      where: { slug: "danitron-ec" },
      data: { description: "フェンピロキシメート（METI系）配合殺ダニ剤。ダニトロンFLの乳剤タイプ。" },
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  5. ファンタジスタ水和剤: アゾキシストロビン → ピリベンカルブ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 5. ファンタジスタ水和剤: 有効成分修正 ---");
  await relinkIngredient("fantasia-wp", "azoxystrobin", "pyribencarb", "40.0%");
  await prisma.pesticide.update({
    where: { slug: "fantasia-wp" },
    data: { description: "ピリベンカルブ（QoI系）配合殺菌剤。うどんこ病・灰色かび病・黒星病に予防・治療効果。" },
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  6. アーデントフロアブル: トルフェンピラド → アクリナトリン
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 6. アーデントFL: 有効成分修正 ---");
  await relinkIngredient("ardent-fl", "tolfenpyrad", "acrinathrin", "6.0%");
  await prisma.pesticide.update({
    where: { slug: "ardent-fl" },
    data: { description: "アクリナトリン（ピレスロイド系）配合殺虫殺ダニ剤。ハダニ・アブラムシ・コナジラミ等に速効性。" },
  });

  // ardent-wdg も同様に修正
  const ardentWdg = await prisma.pesticide.findUnique({ where: { slug: "ardent-wdg" } });
  if (ardentWdg) {
    await relinkIngredient("ardent-wdg", "tolfenpyrad", "acrinathrin", "6.0%");
    await prisma.pesticide.update({
      where: { slug: "ardent-wdg" },
      data: { description: "アクリナトリン（ピレスロイド系）配合殺虫殺ダニ剤。顆粒水和剤タイプ。" },
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  7. サンケイマネブ水和剤: マンゼブ → マネブ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 7. サンケイマネブ水和剤: 有効成分修正 ---");
  await relinkIngredient("sankei-maneb-wp", "mancozeb", "maneb", "75.0%");
  await prisma.pesticide.update({
    where: { slug: "sankei-maneb-wp" },
    data: { description: "マネブ（ジチオカーバメート系）配合の保護殺菌剤。べと病・さび病・炭疽病の予防に有効。マンゼブとは別の有効成分。" },
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  8. カスミンボルドー: カスガマイシン成分を追加
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 8. カスミンボルドー: カスガマイシン追加 + 銅の種類修正 ---");
  const kasuminId = await getPesticideId("kasumin-bordeaux");
  if (kasuminId) {
    // 既存の copper-hydroxide リンクを削除
    const copperHydId = await getIngredientId("copper-hydroxide");
    if (copperHydId) {
      try {
        await prisma.pesticideActiveIngredient.delete({
          where: { pesticideId_activeIngredientId: { pesticideId: kasuminId, activeIngredientId: copperHydId } },
        });
      } catch { /* not found */ }
    }

    // 塩基性塩化銅をリンク
    const bccId = await getIngredientId("basic-copper-chloride");
    if (bccId) {
      const existing = await prisma.pesticideActiveIngredient.findUnique({
        where: { pesticideId_activeIngredientId: { pesticideId: kasuminId, activeIngredientId: bccId } },
      });
      if (!existing) {
        await prisma.pesticideActiveIngredient.create({
          data: { pesticideId: kasuminId, activeIngredientId: bccId, contentLabel: "75.6%" },
        });
      }
    }

    // カスガマイシンをリンク
    const kasugaId = await getIngredientId("kasugamycin");
    if (kasugaId) {
      const existing = await prisma.pesticideActiveIngredient.findUnique({
        where: { pesticideId_activeIngredientId: { pesticideId: kasuminId, activeIngredientId: kasugaId } },
      });
      if (!existing) {
        await prisma.pesticideActiveIngredient.create({
          data: { pesticideId: kasuminId, activeIngredientId: kasugaId, contentLabel: "5.7%" },
        });
      }
    }

    await prisma.pesticide.update({
      where: { slug: "kasumin-bordeaux" },
      data: { description: "カスガマイシン＋塩基性塩化銅の複合殺菌剤。細菌性病害を含む幅広い病害に予防効果。" },
    });
    console.log("  ✓ kasumin-bordeaux: 2成分複合剤として正しくリンク");
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  9. 含有量の修正
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 9. 含有量の修正 ---");

  // ストロビーFL: 20% → 44.2%
  await updateContentLabel("strobi-fl", "kresoxim-methyl", "44.2%");

  // 石灰硫黄合剤: 45% → 27.5%
  await updateContentLabel("lime-sulfur", "lime-sulfur", "27.5%");

  // アクタラ顆粒: 25% → 10%
  await updateContentLabel("actara-wdg", "thiamethoxam", "10.0%");

  // actara-fl（架空製品）— 削除済み

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  10. カネマイトFL: 有効成分リンク追加
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 10. カネマイトFL: 有効成分リンク追加 ---");
  const kanemiteSlug = "kanemite-fl";
  const kanemiteId = await getPesticideId(kanemiteSlug);
  if (kanemiteId) {
    const acequinocylId = await getIngredientId("acequinocyl");
    if (acequinocylId) {
      const existing = await prisma.pesticideActiveIngredient.findUnique({
        where: { pesticideId_activeIngredientId: { pesticideId: kanemiteId, activeIngredientId: acequinocylId } },
      });
      if (!existing) {
        await prisma.pesticideActiveIngredient.create({
          data: { pesticideId: kanemiteId, activeIngredientId: acequinocylId, contentLabel: "15.0%" },
        });
        console.log("  + kanemite-fl → acequinocyl 15.0% リンク追加");
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  11. 展着剤の型修正: ドライバー
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 11. ドライバー: 展着剤の型修正 ---");
  const driverPesticide = await prisma.pesticide.findUnique({ where: { slug: "driver" } });
  if (driverPesticide) {
    const esterType = await prisma.spreaderType.findUnique({ where: { slug: "ester" } });
    const etherType = await prisma.spreaderType.findUnique({ where: { slug: "ether" } });

    if (esterType && etherType) {
      // 既存のether型リンクを削除
      try {
        await prisma.pesticideSpreaderType.delete({
          where: { pesticideId_spreaderTypeId: { pesticideId: driverPesticide.id, spreaderTypeId: etherType.id } },
        });
      } catch { /* not found */ }

      // ester型リンクを作成
      const existing = await prisma.pesticideSpreaderType.findUnique({
        where: { pesticideId_spreaderTypeId: { pesticideId: driverPesticide.id, spreaderTypeId: esterType.id } },
      });
      if (!existing) {
        await prisma.pesticideSpreaderType.create({
          data: { pesticideId: driverPesticide.id, spreaderTypeId: esterType.id },
        });
      }
      console.log("  ✓ driver: ether型 → ester型に修正");
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  12. 架空製品の説明に警告注記を追加
  //  （データ整合性のため削除はせず、説明を修正）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log("\n--- 12. 架空・疑わしい製品の説明修正 ---");

  // ダイン乳剤 → 実在しない。ダインは展着剤。
  const dineEc = await prisma.pesticide.findUnique({ where: { slug: "chlorfenapyr-ec" } });
  if (dineEc) {
    await prisma.pesticide.update({
      where: { slug: "chlorfenapyr-ec" },
      data: {
        description: "※注意: 「ダイン」は住友化学園芸の展着剤の商品名です。クロルフェナピル配合の殺虫殺ダニ剤としてはコテツフロアブルが該当します。",
      },
    });
    console.log("  ✓ chlorfenapyr-ec: 説明を修正（架空製品の注意書き追加）");
  }

  // オルティウスFL → サンマイトフロアブル(#17814)に差替済み。注意書き上書き不要
  // const ortiusFl = ...

  // バイスピラエースFL → ダニゲッターフロアブル(#22094)に差替済み。注意書き上書き不要
  // const bicepsFl = ...

  console.log("\n=== 薬剤-原体紐付けデータの修正が完了しました ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
