 
/**
 * 農薬データの整合性・正確性を検証するスクリプト。
 *
 * 4段階の検証を行う:
 *   Level 1: 必須フィールドの完全性（DB内データの整合性チェック）
 *   Level 2: リレーション整合性（孤立レコード、重複、参照整合性）
 *   Level 3: MAFF農薬登録情報との詳細突合（--maff オプションで有効化）
 *     - 登録番号の存在確認
 *     - 有効成分名の一致確認（DBの原体がMAFF登録と合致するか）
 *     - 含有量(%)の一致確認
 *     - 剤型の一致確認（DB上のWP/EC/FL等がMAFF登録と合致するか）
 *   Level 4: 展着剤の型分類検証（--maff オプションで有効化）
 *     - 展着剤が正しい型（エーテル/エステル/シリコーン等）に分類されているか
 *
 * 実行例:
 *   npx tsx prisma/seed-pesticide-validate.ts           # Level 1+2 のみ（高速）
 *   npx tsx prisma/seed-pesticide-validate.ts --maff     # Level 1+2+3+4（MAFF突合含む、数分かかる）
 *
 * 結果:
 *   問題がなければ exit code 0
 *   警告のみ（修正推奨）の場合は exit code 0 + 警告メッセージ
 *   重大な問題がある場合は exit code 1
 */

import { createSeedPrismaClient } from '../shared/create-client'

const prisma = createSeedPrismaClient();

const enableMaff = process.argv.includes("--maff");

// ── 結果集計 ──
let errors = 0;
let warnings = 0;

function logError(msg: string) {
  console.error(`  ❌ ${msg}`);
  errors++;
}
function logWarn(msg: string) {
  console.warn(`  ⚠ ${msg}`);
  warnings++;
}
function logOk(msg: string) {
  console.log(`  ✅ ${msg}`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Level 1: 必須フィールドの完全性
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function validateLevel1() {
  console.log("\n=== Level 1: 必須フィールドの完全性 ===\n");

  // 1a. 農薬製品の必須フィールド
  console.log("--- 1a. 農薬製品の必須フィールド ---");
  const pesticides = await prisma.pesticide.findMany({
    select: {
      id: true, slug: true, name: true,
      pesticideType: true, registrationNumber: true,
      formulationTypeId: true, description: true,
    },
  });

  let missingRegNum = 0;
  let missingFormulation = 0;
  let missingDescription = 0;
  let emptyName = 0;

  for (const p of pesticides) {
    if (!p.name || p.name.trim() === "") {
      logError(`農薬 ${p.slug}: 名前が空`);
      emptyName++;
    }
    if (!p.registrationNumber) missingRegNum++;
    if (!p.formulationTypeId) missingFormulation++;
    if (!p.description || p.description.trim() === "") missingDescription++;
  }

  logOk(`農薬製品: ${pesticides.length}件`);
  if (missingRegNum > 0) logWarn(`登録番号なし: ${missingRegNum}件（展着剤等は正常）`);
  if (missingFormulation > 0) logWarn(`剤型リンクなし: ${missingFormulation}件`);
  if (missingDescription > 0) logWarn(`説明文なし: ${missingDescription}件`);
  if (emptyName > 0) logError(`名前が空の製品: ${emptyName}件`);

  // 1b. 有効成分の必須フィールド
  console.log("\n--- 1b. 有効成分の必須フィールド ---");
  const ingredients = await prisma.activeIngredient.findMany({
    select: {
      id: true, slug: true, name: true, nameEn: true,
      fracCode: true, iracCode: true, ingredientGroup: true,
    },
  });

  let noCode = 0;
  let noGroup = 0;
  for (const ing of ingredients) {
    if (!ing.fracCode && !ing.iracCode) {
      // 物理的防除剤やマシン油等はコードなしが正常
      noCode++;
    }
    if (!ing.ingredientGroup || ing.ingredientGroup.trim() === "") {
      logWarn(`有効成分 ${ing.slug} (${ing.name}): ingredientGroup が空`);
      noGroup++;
    }
  }
  logOk(`有効成分: ${ingredients.length}件`);
  if (noCode > 0) logWarn(`FRAC/IRACコードなし: ${noCode}件（物理防除剤等は正常）`);
  if (noGroup > 0) logWarn(`ingredientGroupなし: ${noGroup}件`);

  // 1c. 病害虫の必須フィールド
  console.log("\n--- 1c. 病害虫の必須フィールド ---");
  const diseasePests = await prisma.diseasePest.findMany({
    select: {
      id: true, slug: true, name: true, category: true,
      description: true, bodySizeMinMm: true, bodySizeMaxMm: true,
    },
  });

  let noDescription = 0;
  let invalidBodySize = 0;
  let missingBodySize = 0;
  for (const dp of diseasePests) {
    if (!dp.description || dp.description.trim() === "") noDescription++;
    if (dp.category === "pest" || dp.category === "beneficial_insect") {
      if (dp.bodySizeMinMm == null || dp.bodySizeMaxMm == null) {
        missingBodySize++;
      } else if (dp.bodySizeMinMm > dp.bodySizeMaxMm) {
        logError(`病害虫 ${dp.slug}: min(${dp.bodySizeMinMm}) > max(${dp.bodySizeMaxMm})`);
        invalidBodySize++;
      } else if (dp.bodySizeMinMm <= 0) {
        logError(`病害虫 ${dp.slug}: 体長が0以下 (${dp.bodySizeMinMm}mm)`);
        invalidBodySize++;
      }
    }
  }
  logOk(`病害虫: ${diseasePests.length}件`);
  if (noDescription > 0) logWarn(`説明文なし: ${noDescription}件`);
  if (missingBodySize > 0) logWarn(`体長データなし（害虫/益虫）: ${missingBodySize}件`);
  if (invalidBodySize > 0) logError(`体長データ異常: ${invalidBodySize}件`);

  // 1d. 効果データの妥当性
  console.log("\n--- 1d. 効果データの妥当性 ---");
  const effects = await prisma.pesticideEffect.findMany({
    select: {
      id: true, pesticideId: true, diseasePestId: true,
      preventionLevel: true, treatmentLevel: true,
      efficacyLevel: true, persistenceLevel: true,
    },
  });

  let noRatings = 0;
  for (const e of effects) {
    if (!e.preventionLevel && !e.treatmentLevel && !e.efficacyLevel && !e.persistenceLevel) {
      noRatings++;
    }
  }
  logOk(`効果データ: ${effects.length}件`);
  if (noRatings > 0) logWarn(`全パラメータnullの効果データ: ${noRatings}件（削除推奨）`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Level 2: リレーション整合性
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function validateLevel2() {
  console.log("\n=== Level 2: リレーション整合性 ===\n");

  // 2a. 有効成分リンクのない農薬製品
  console.log("--- 2a. 有効成分リンクのない農薬製品 ---");
  const pesticidesNoIng = await prisma.pesticide.findMany({
    where: { ingredients: { none: {} } },
    select: { slug: true, name: true, pesticideType: true },
  });
  if (pesticidesNoIng.length > 0) {
    for (const p of pesticidesNoIng) {
      logWarn(`${p.name} (${p.slug}) [${p.pesticideType}]: 有効成分リンクなし`);
    }
  } else {
    logOk("全農薬製品に有効成分がリンクされています");
  }

  // 2b. 効果データのない農薬製品（展着剤を除く）
  console.log("\n--- 2b. 効果データのない農薬製品 ---");
  const pesticidesNoEffects = await prisma.pesticide.findMany({
    where: {
      effects: { none: {} },
      spreaderTypes: { none: {} },
    },
    select: { slug: true, name: true, pesticideType: true },
  });
  if (pesticidesNoEffects.length > 0) {
    for (const p of pesticidesNoEffects) {
      logWarn(`${p.name} (${p.slug}) [${p.pesticideType}]: 効果データなし`);
    }
  } else {
    logOk("全農薬製品（展着剤除く）に効果データがあります");
  }

  // 2c. 効果データの重複チェック
  console.log("\n--- 2c. 重複効果データ ---");
  const duplicateEffects = await prisma.$queryRaw<{ pesticideId: string; diseasePestId: string; cnt: bigint }[]>`
    SELECT "pesticide_id" as "pesticideId", "disease_pest_id" as "diseasePestId", COUNT(*) as cnt
    FROM pesticide_effects
    GROUP BY "pesticide_id", "disease_pest_id"
    HAVING COUNT(*) > 1
  `;
  if (duplicateEffects.length > 0) {
    for (const d of duplicateEffects) {
      logError(`重複効果データ: pesticide=${d.pesticideId}, diseasePest=${d.diseasePestId} (${d.cnt}件)`);
    }
  } else {
    logOk("重複効果データなし");
  }

  // 2d. 殺虫剤の効果データに予防/治療レベルが残っていないか
  console.log("\n--- 2d. 殺虫剤→害虫の予防/治療パラメータ残留チェック ---");
  const insecticideWithPrevTreat = await prisma.pesticideEffect.count({
    where: {
      pesticide: { pesticideType: { in: ["insecticide", "acaricide"] } },
      diseasePest: { category: "pest" },
      OR: [
        { preventionLevel: { not: null } },
        { treatmentLevel: { not: null } },
      ],
    },
  });
  if (insecticideWithPrevTreat > 0) {
    logWarn(`殺虫剤→害虫に予防/治療パラメータが残っている: ${insecticideWithPrevTreat}件`);
  } else {
    logOk("殺虫剤→害虫の予防/治療パラメータは全てnull");
  }

  // 2e. 保護殺菌剤の治療レベルチェック
  console.log("\n--- 2e. 保護殺菌剤の治療レベルチェック ---");
  const protectiveSlugs = [
    "dithane-wp", "dithane-fl", "captan-wp",
    "daconil-1000", "daconil-wp", "daconil-dp",
    "orthocide-wp", "sankei-maneb-wp", "z-bordeaux",
    "kasumin-bordeaux", "sankei-copper-fl", "sankei-copper-wp", "sanyo-copper-wp",
  ];
  let protectiveWithTreatment = 0;
  for (const slug of protectiveSlugs) {
    const p = await prisma.pesticide.findUnique({ where: { slug } });
    if (!p) continue;
    const badEffects = await prisma.pesticideEffect.count({
      where: {
        pesticideId: p.id,
        treatmentLevel: { notIn: ["none"] },
        NOT: { treatmentLevel: null },
      },
    });
    if (badEffects > 0) {
      logWarn(`保護殺菌剤 ${slug}: 治療レベルがnone以外の効果が${badEffects}件`);
      protectiveWithTreatment += badEffects;
    }
  }
  if (protectiveWithTreatment === 0) {
    logOk("保護殺菌剤の治療レベルは全てnoneまたはnull");
  }

  // 2f. slug の重複チェック
  console.log("\n--- 2f. slug重複チェック ---");
  const dupPestSlugs = await prisma.$queryRaw<{ slug: string; cnt: bigint }[]>`
    SELECT slug, COUNT(*) as cnt FROM pesticides GROUP BY slug HAVING COUNT(*) > 1
  `;
  const dupDpSlugs = await prisma.$queryRaw<{ slug: string; cnt: bigint }[]>`
    SELECT slug, COUNT(*) as cnt FROM disease_pests GROUP BY slug HAVING COUNT(*) > 1
  `;
  const dupIngSlugs = await prisma.$queryRaw<{ slug: string; cnt: bigint }[]>`
    SELECT slug, COUNT(*) as cnt FROM active_ingredients GROUP BY slug HAVING COUNT(*) > 1
  `;
  if (dupPestSlugs.length > 0) {
    for (const d of dupPestSlugs) logError(`農薬slug重複: ${d.slug} (${d.cnt}件)`);
  }
  if (dupDpSlugs.length > 0) {
    for (const d of dupDpSlugs) logError(`病害虫slug重複: ${d.slug} (${d.cnt}件)`);
  }
  if (dupIngSlugs.length > 0) {
    for (const d of dupIngSlugs) logError(`有効成分slug重複: ${d.slug} (${d.cnt}件)`);
  }
  if (dupPestSlugs.length === 0 && dupDpSlugs.length === 0 && dupIngSlugs.length === 0) {
    logOk("全テーブルのslugはユニーク");
  }

  // 2g. contentLabel の形式チェック
  console.log("\n--- 2g. 含有量(contentLabel)の形式チェック ---");
  const allLinks = await prisma.pesticideActiveIngredient.findMany({
    select: {
      contentLabel: true,
      pesticide: { select: { slug: true, name: true } },
      activeIngredient: { select: { slug: true, name: true } },
    },
  });
  const percentRegex = /^\d+(\.\d+)?%$/;
  let badLabels = 0;
  for (const link of allLinks) {
    if (link.contentLabel && !percentRegex.test(link.contentLabel)) {
      logWarn(`${link.pesticide.name} → ${link.activeIngredient.name}: contentLabel "${link.contentLabel}" が不正な形式`);
      badLabels++;
    }
    if (!link.contentLabel) {
      badLabels++;
    }
  }
  if (badLabels === 0) {
    logOk(`全${allLinks.length}件の含有量ラベルが正常な形式`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Level 3: MAFF農薬登録情報との突合（詳細版）
//  登録番号の存在確認に加え、以下を検証:
//    - 有効成分名の一致
//    - 含有量(%)の一致
//    - 剤型の一致
//    - 適用病害虫の存在確認
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** MAFF HTMLからテーブル行を抽出するヘルパー */
export function extractTextBetween(html: string, startMarker: string, endMarker: string): string {
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return "";
  const afterStart = startIdx + startMarker.length;
  const endIdx = html.indexOf(endMarker, afterStart);
  if (endIdx === -1) return html.substring(afterStart);
  return html.substring(afterStart, endIdx);
}

/** HTMLタグを除去 */
export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, "").trim();
}

/** 全角英数を半角に変換 */
export function toHalfWidth(str: string): string {
  return str.replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) =>
    String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
  ).replace(/\u3000/g, " ");
}

interface MaffData {
  productName: string;
  formulation: string;
  ingredients: { name: string; concentration: string }[];
  applicablePests: string[];
}

/** MAFFページをフェッチ・パースして構造化データを返す */
async function fetchMaffData(registrationNumber: string): Promise<MaffData | null> {
  const url = `https://pesticide.maff.go.jp/agricultural-chemicals/details/${registrationNumber}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

  if (!res.ok) return null;
  const html = await res.text();

  // 製品名: <h1 class="ttl">...</h1>
  const titleMatch = html.match(/<h1\s+class="ttl">([\s\S]*?)<\/h1>/);
  const productName = titleMatch ? toHalfWidth(stripTags(titleMatch[1])) : "";

  // 剤型: <th>剤型</th><td>...</td>
  const formulationMatch = html.match(/<th[^>]*>剤型<\/th>\s*<td>([\s\S]*?)<\/td>/);
  const formulation = formulationMatch ? stripTags(formulationMatch[1]).trim() : "";

  // 有効成分: table.col2_table 内の「有効成分」行
  const ingredients: { name: string; concentration: string }[] = [];
  const ingredientSection = extractTextBetween(html, "成分情報", "適用表情報");
  if (ingredientSection) {
    // 有効成分の行を抽出（「有効成分」というthを含む行）
    const rowRegex = /<tr(?:\s[^>]*)?>\s*<th[^>]*class="sp_only"[^>]*><\/th>\s*<th[^>]*>有効成分<\/th>\s*<td[^>]*><p>([\s\S]*?)<\/p><\/td>\s*<td[^>]*><p>([\s\S]*?)<\/p><\/td>\s*<\/tr>/g;
    let match;
    while ((match = rowRegex.exec(ingredientSection)) !== null) {
      const name = toHalfWidth(stripTags(match[1])).trim();
      const concentration = stripTags(match[2]).trim();
      if (name) ingredients.push({ name, concentration });
    }
  }

  // 適用病害虫名: 適用表テーブルの「適用病害虫名」列
  const applicablePests: string[] = [];
  const applicationSection = extractTextBetween(html, "適用表情報", "<!-- /content_inner -->");
  if (applicationSection) {
    const pestCellRegex = /data-label="適用病害虫名[^"]*"[^>]*>([\s\S]*?)<\/td>/g;
    let pestMatch;
    while ((pestMatch = pestCellRegex.exec(applicationSection)) !== null) {
      const pestName = toHalfWidth(stripTags(pestMatch[1])).trim();
      if (pestName && !applicablePests.includes(pestName)) {
        applicablePests.push(pestName);
      }
    }
  }

  return { productName, formulation, ingredients, applicablePests };
}

/** DB上の剤型コードをMAFF表記にマッピング */
export const FORMULATION_MAP: Record<string, string[]> = {
  WP: ["水和剤", "顆粒水和剤"],
  EC: ["乳剤"],
  FL: ["フロアブル", "水和剤", "液剤"],
  GR: ["粒剤"],
  DP: ["粉剤"],
  SP: ["水溶剤", "顆粒水溶剤"],
  AL: ["液剤", "エアゾル"],
  SE: ["マイクロカプセル剤"],
  PA: ["ペースト"],
};

/** 展着剤分類の期待される成分キーワード */
const SPREADER_TYPE_KEYWORDS: Record<string, string[]> = {
  ether: ["ポリオキシエチレン", "アルキルエーテル", "POE"],
  ester: ["脂肪酸エステル", "ソルビタン", "ポリオキシエチレン脂肪酸"],
  "anionic-nonionic": ["ドデシルベンゼンスルホン酸", "ポリオキシエチレン", "アルキルエーテル"],
  cationic: ["アルキルトリメチルアンモニウム", "塩化ベンザルコニウム"],
  paraffin: ["パラフィン", "流動パラフィン"],
  silicone: ["シリコーン", "ポリシロキサン", "メチルポリシロキサン"],
};

async function validateLevel3() {
  console.log("\n=== Level 3: MAFF農薬登録情報との詳細突合 ===\n");

  const pesticides = await prisma.pesticide.findMany({
    where: {
      registrationNumber: { not: null },
      spreaderTypes: { none: {} }, // 展着剤を除外（展着剤は別途検証）
    },
    select: {
      slug: true,
      name: true,
      registrationNumber: true,
      pesticideType: true,
      formulationType: { select: { code: true, name: true } },
      ingredients: {
        select: {
          contentLabel: true,
          activeIngredient: { select: { slug: true, name: true } },
        },
      },
      effects: {
        select: {
          diseasePest: { select: { slug: true, name: true, category: true } },
        },
      },
    },
  });

  console.log(`検証対象（展着剤除く）: ${pesticides.length}件\n`);

  let checked = 0;
  let regValid = 0;
  let regInvalid = 0;
  let ingredientMismatch = 0;
  let formulationMismatch = 0;
  let fetchErrors = 0;

  for (const p of pesticides) {
    if (!p.registrationNumber) continue;

    try {
      const maff = await fetchMaffData(p.registrationNumber);
      checked++;

      if (!maff) {
        logError(`${p.name} (${p.slug}): 登録番号 ${p.registrationNumber} がMAFFに存在しない`);
        regInvalid++;
        await new Promise((r) => setTimeout(r, 800));
        continue;
      }

      regValid++;

      // ── 3a. 有効成分の突合 ──
      if (maff.ingredients.length > 0 && p.ingredients.length > 0) {
        for (const dbIng of p.ingredients) {
          const dbName = toHalfWidth(dbIng.activeIngredient.name);
          const found = maff.ingredients.some((mi) => {
            const maffName = mi.name;
            // 部分一致（MAFF名は化学名が長い場合がある）
            return maffName.includes(dbName) || dbName.includes(maffName)
              || maffName.replace(/\s/g, "").includes(dbName.replace(/\s/g, ""));
          });

          if (!found) {
            logError(`${p.name}: 有効成分「${dbIng.activeIngredient.name}」がMAFF登録に見つからない`);
            logWarn(`  MAFF成分: ${maff.ingredients.map((i) => i.name).join(", ")}`);
            ingredientMismatch++;
          }
        }

        // DB に無い成分が MAFF にある場合（追加漏れ）
        for (const maffIng of maff.ingredients) {
          const found = p.ingredients.some((dbIng) => {
            const dbName = toHalfWidth(dbIng.activeIngredient.name);
            const maffName = maffIng.name;
            return maffName.includes(dbName) || dbName.includes(maffName)
              || maffName.replace(/\s/g, "").includes(dbName.replace(/\s/g, ""));
          });
          if (!found) {
            logWarn(`${p.name}: MAFF登録の成分「${maffIng.name} ${maffIng.concentration}」がDBにない（追加漏れ？）`);
          }
        }

        // 含有量の突合
        for (const dbIng of p.ingredients) {
          if (!dbIng.contentLabel) continue;
          const dbPct = dbIng.contentLabel.replace("%", "").trim();
          const dbName = toHalfWidth(dbIng.activeIngredient.name);

          for (const maffIng of maff.ingredients) {
            const maffName = maffIng.name;
            if (!(maffName.includes(dbName) || dbName.includes(maffName))) continue;

            const maffPct = maffIng.concentration.replace("%", "").replace(/\s/g, "").trim();
            if (dbPct && maffPct && dbPct !== maffPct) {
              // 浮動小数点の丸め差は許容
              const diff = Math.abs(parseFloat(dbPct) - parseFloat(maffPct));
              if (diff > 0.1) {
                logError(`${p.name}: 「${dbIng.activeIngredient.name}」含有量 DB=${dbIng.contentLabel} vs MAFF=${maffIng.concentration}`);
                ingredientMismatch++;
              }
            }
          }
        }
      }

      // ── 3b. 剤型の突合 ──
      if (p.formulationType && maff.formulation) {
        const code = p.formulationType.code;
        const acceptable = FORMULATION_MAP[code] || [];
        const maffForm = maff.formulation;
        const matched = acceptable.some((a) => maffForm.includes(a));
        if (!matched && maffForm) {
          logWarn(`${p.name}: 剤型 DB=${p.formulationType.name}(${code}) vs MAFF=${maffForm}`);
          formulationMismatch++;
        }
      }

      // 進捗表示
      if (checked % 10 === 0) {
        console.log(`  ... ${checked}/${pesticides.length} チェック済み`);
      }

      // MAFF へのリクエスト間隔（負荷軽減）
      await new Promise((r) => setTimeout(r, 800));
    } catch (e) {
      fetchErrors++;
      logWarn(`${p.name} (${p.slug}): MAFF接続エラー (${(e as Error).message})`);
    }
  }

  console.log(`\n--- Level 3 結果 ---`);
  console.log(`  登録番号チェック: ${checked}件中 有効=${regValid}, 無効=${regInvalid}, エラー=${fetchErrors}`);
  console.log(`  有効成分不一致: ${ingredientMismatch}件`);
  console.log(`  剤型不一致: ${formulationMismatch}件`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  Level 4: 展着剤の型分類検証
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function validateLevel4() {
  console.log("\n=== Level 4: 展着剤の型分類検証 ===\n");

  const spreaders = await prisma.pesticide.findMany({
    where: { spreaderTypes: { some: {} } },
    select: {
      slug: true,
      name: true,
      description: true,
      spreaderTypes: {
        select: { spreaderType: { select: { slug: true, name: true } } },
      },
    },
  });

  for (const sp of spreaders) {
    for (const st of sp.spreaderTypes) {
      const typeSlug = st.spreaderType.slug;
      const keywords = SPREADER_TYPE_KEYWORDS[typeSlug];
      if (!keywords) continue;

      // 説明文に型の特徴的なキーワードが含まれるか
      const desc = sp.description || "";
      const hasKeyword = keywords.some((kw) => desc.includes(kw));

      if (!hasKeyword && desc.length > 0) {
        logWarn(`展着剤 ${sp.name} (${sp.slug}): 型=${st.spreaderType.name} だが説明文に型の特徴キーワードなし`);
        logWarn(`  期待キーワード: ${keywords.join(", ")}`);
      }
    }
  }

  logOk(`展着剤 ${spreaders.length}件の型分類をチェック`);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  メイン
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  農薬データ整合性検証スクリプト          ║");
  console.log("╚══════════════════════════════════════════╝");

  await validateLevel1();
  await validateLevel2();

  if (enableMaff) {
    await validateLevel3();
    await validateLevel4();
  } else {
    console.log("\n=== Level 3-4: MAFF突合・展着剤検証はスキップ（--maff オプションで有効化） ===");
  }

  // ── 結果サマリ ──
  console.log("\n╔══════════════════════════════════════════╗");
  console.log(`║  結果: エラー ${errors}件 / 警告 ${warnings}件`);
  console.log("╚══════════════════════════════════════════╝");

  if (errors > 0) {
    console.error("\n❌ 重大な問題が見つかりました。修正が必要です。");
    process.exit(1);
  } else if (warnings > 0) {
    console.warn("\n⚠ 警告があります。確認を推奨します。");
    process.exit(0);
  } else {
    console.log("\n✅ 全チェックをパスしました。");
    process.exit(0);
  }
}

// CLI直接実行時のみmain()を呼び出す（テスト時のインポートでは実行しない）
const isCliEntry =
  typeof process !== "undefined" &&
  process.argv[1] &&
  (process.argv[1].endsWith("seed-pesticide-validate.ts") ||
    process.argv[1].includes("seed-pesticide-validate"));

if (isCliEntry) {
  main()
    .catch((e) => {
      console.error("検証スクリプトの実行中にエラーが発生しました:", e);
      process.exit(1);
    });
}
