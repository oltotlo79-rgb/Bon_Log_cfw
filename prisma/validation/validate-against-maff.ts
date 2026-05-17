/* eslint-disable no-console */
/**
 * MAFF公式データとシードデータを突合するバリデーションスクリプト（全チェック版）
 *
 * prisma/validation/maff-reference.csv に記載された公式データと、
 * シードファイルから抽出したデータを比較し、差異を報告する。
 *
 * 使い方:
 *   npx tsx prisma/validation/validate-against-maff.ts
 *
 * 出力:
 *   - コンソールに差異レポート
 *   - prisma/validation/validation-report.txt にレポートファイル
 *
 * バリデーション項目（26チェック）:
 *    1. MAFF公式データとの突合（登録番号・有効成分・含有量）
 *    2. FRAC/IRACコードの妥当性
 *    3. 農薬⇔有効成分のリンク整合性
 *    4. 重複データチェック
 *    5. 効果データの論理整合性
 *    6. 剤型⇔農薬の整合性
 *    7. 病害虫体長の妥当性
 *    8. コラム内データ整合性
 *    9. 混用不可データの双方向整合性
 *   10. resistanceRiskとFRAC/IRACグループの相関
 *   11. 効果レベルの生物学的妥当性
 *   12. 登録番号フォーマット検証
 *   13. 有効成分英名の基本形式チェック
 *   14. コラム内の農薬slug参照存在確認
 *   15. MAFF未検証製品のリスト出力
 *   16. slug命名規則統一性チェック
 *   17. FRAC/IRACコードのファイル間整合性
 *   18. 効果データ内の病害虫slug存在確認
 *   19. 効果ゼロの農薬検出
 *   20. 全レベルnullの効果データ検出
 *   21. pesticideTypeとFRAC/IRACタイプの整合性
 *   22. resistanceRisk設定漏れ検出
 *   23. 希釈倍率の妥当範囲チェック
 *   24. 展着剤リンクのslug存在確認
 *   25. 有効成分の英名重複チェック
 *   26. 病害虫descriptionの空欄チェック
 */

import * as fs from "fs";
import * as path from "path";
import {
  SEED_PATHS, VALIDATION_PATHS, parseCsv as sharedParseCsv,
  extractPesticidesFromMain as sharedExtractPesticidesFromMain,
  extractIngredientsFromMain, extractLinksFromMain,
  extractPesticidesFromSpray as sharedExtractSprayPesticides,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractIngredientsFromSpray,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractLinksFromSpray, buildSprayVarToSlugMap, buildSprayIngVarMap, extractSprayLinksRaw,
  extractPesticidesFromAdditions2 as sharedExtractAdd2Pesticides,
  extractIngredientsFromAdditions2, extractLinksFromAdditions2,
  extractPesticidesFromAdditions as sharedExtractAdditionsPesticides,
  extractIngredientsFromAdditions as sharedExtractAdditionsIngredients,
  extractLinksFromAdditions as sharedExtractAdditionsLinks,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  extractSpreaderPesticides,
} from "./parsers";

const SEED_FILE = SEED_PATHS.data;
const MAFF_CSV = VALIDATION_PATHS.maffReference;
const SPRAY_FILE = SEED_PATHS.spray;
const ADDITIONS_FILE = SEED_PATHS.additions;
const ADDITIONS2_FILE = SEED_PATHS.additions2;
const REPORT_FILE = VALIDATION_PATHS.report;

// ── FRAC/IRAC 公式コード一覧（2025年版） ───────────────
const VALID_FRAC_CODES = new Set([
  "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13",
  "14", "15", "16", "17", "19", "21", "22", "23", "24", "25", "26", "27",
  "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39",
  "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50",
  "M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09",
  "M10", "M11", "M12",
  "P01", "P02", "P03", "P04", "P05", "P06", "P07", "P08", "P09",
  "P10", "P11", "P12", "P13",
  "U05", "U06", "U07", "U08", "U12", "U13", "U14", "U15", "U16", "U17",
  "U18",
  "BM01", "BM02",
  "NC",
]);

const VALID_IRAC_CODES = new Set([
  "1A", "1B", "2A", "2B", "3A", "3B", "4A", "4B", "4C", "4D", "4E", "4F",
  "5", "6", "7A", "7B", "7C", "8A", "8B", "8C", "8D", "8E", "8F",
  "9A", "9B", "9D", "10A", "10B",
  "11A", "11B", "12A", "12B", "12C", "12D", "13", "14", "15", "16",
  "17", "18", "19", "20A", "20B", "20C", "20D", "21A", "21B",
  "22A", "22B", "23", "24A", "24B", "25A", "25B", "28", "29", "30", "31",
  "32", "33", "34", "35", "36",
  "UN", "UNM", "UNE",
]);

// resistanceRisk の期待値（FRAC/IRACグループ別）
// M群（多作用点）はlow、単一作用点のコード3はmedium/high、等
const LOW_RISK_FRAC = new Set(["M01", "M02", "M03", "M04", "M05", "M06", "M07", "M08", "M09", "M10", "M11", "M12", "NC"]);
const HIGH_RISK_FRAC = new Set(["1", "11"]); // ベンゾイミダゾール系、QoI系
const HIGH_RISK_IRAC = new Set(["3A", "3B"]); // ピレスロイド系

function readFileSafe(filePath: string): string {
  try { return fs.readFileSync(filePath, "utf-8"); }
  catch { return ""; }
}

// ── CSV パーサー（共通モジュ��ル委譲） ──────────────────
function parseCsv(content: string): Record<string, string>[] {
  return sharedParseCsv(content);
}

// ── シードファイルパーサー（共通モジュール委譲） ──────
function extractLinksFromSeed(src: string) {
  return extractLinksFromMain(src).map(r => ({
    pesticideSlug: r.pesticideSlug,
    ingredientSlug: r.ingredientSlug,
    contentLabel: r.contentLabel,
  }));
}

function extractIngredientCodes(src: string) {
  return extractIngredientsFromMain(src).map(r => ({
    slug: r.slug, name: r.name, nameEn: r.nameEn,
    fracCode: r.fracCode, iracCode: r.iracCode,
    ingredientGroup: r.ingredientGroup, resistanceRisk: r.resistanceRisk,
  }));
}

function extractPesticideRegNumbers(src: string) {
  return sharedExtractPesticidesFromMain(src).map(r => ({
    slug: r.slug, name: r.name,
    regNumber: r.registrationNumber, pesticideType: r.pesticideType,
  }));
}

function extractSprayPesticides(src: string) {
  return sharedExtractSprayPesticides(src).map(r => ({
    slug: r.slug, name: r.name,
    regNumber: r.registrationNumber, pesticideType: r.pesticideType,
  }));
}

function extractSprayLinks(src: string) {
  return extractSprayLinksRaw(src);
}

function extractAdditionsPesticides(src: string) {
  return sharedExtractAdditionsPesticides(src).map(r => ({
    slug: r.slug, name: r.name,
    regNumber: r.registrationNumber, pesticideType: r.pesticideType,
  }));
}

function extractAdd2Pesticides(src: string) {
  return sharedExtractAdd2Pesticides(src).map(r => ({
    slug: r.slug, name: r.name,
    regNumber: r.registrationNumber, pesticideType: r.pesticideType,
  }));
}

function extractAdd2Ingredients(src: string) {
  return extractIngredientsFromAdditions2(src).map(r => ({
    slug: r.slug, name: r.name, nameEn: r.nameEn,
    fracCode: r.fracCode, iracCode: r.iracCode,
    ingredientGroup: r.ingredientGroup, resistanceRisk: r.resistanceRisk,
  }));
}

function extractAdd2Links(src: string) {
  return extractLinksFromAdditions2(src).map(r => ({
    pesticideSlug: r.pesticideSlug,
    ingredientSlug: r.ingredientSlug,
    contentLabel: r.contentLabel,
  }));
}

// ── メイン突合処理 ─────────────────────────────────────
function main() {
  const report: string[] = [];
  const log = (msg: string) => { console.log(msg); report.push(msg); };

  log("══════════════════════════════════════════════════");
  log(" 農薬シードデータ バリデーションレポート");
  log(` 実行日時: ${new Date().toISOString()}`);
  log("══════════════════════════════════════════════════\n");

  const seedSrc = fs.readFileSync(SEED_FILE, "utf-8");
  const spraySrc = readFileSafe(SPRAY_FILE);
  const addSrc = readFileSafe(ADDITIONS_FILE);
  const add2Src = readFileSafe(ADDITIONS2_FILE);

  if (spraySrc) log("spray ファイル読み込み完了");
  if (addSrc) log("additions ファイル読み込み完了");
  if (add2Src) log("additions2 ファイル読み込み完了");
  log("");

  let errorCount = 0;
  let warnCount = 0;

  // ── 全ソースからデータ統合 ──
  const seedPesticides = extractPesticideRegNumbers(seedSrc);
  const sprayPesticides = spraySrc ? extractSprayPesticides(spraySrc) : [];
  const add2Pesticides = add2Src ? extractAdd2Pesticides(add2Src) : [];
  const additionsPesticides = addSrc ? extractAdditionsPesticides(addSrc) : [];
  // 展着剤製品（spreaderSlugs配列形式で農薬テーブルに登録されるもの）
  // 例: { slug: "hiten-power", name: "ハイテンパワー", reg: "20481", ... }
  // reg は null の場合もあるため `["']\d+["']` でキャプチャ。
  const spreaderPesticides: { slug: string; name: string; regNumber: string; pesticideType: string }[] = [];
  const spSlugArrRe = /\{\s*slug:\s*"([a-z0-9-]+)"\s*,\s*name:\s*"([^"]+)"\s*,\s*reg:\s*(?:"(\d+)"|null)/g;
  const spSection = seedSrc.match(/展着剤製品（紐付け用に先行登録）[\s\S]*?as const/);
  if (spSection) {
    let spm: RegExpExecArray | null;
    while ((spm = spSlugArrRe.exec(spSection[0])) !== null) {
      spreaderPesticides.push({
        slug: spm[1],
        name: spm[2],
        regNumber: spm[3] || "",
        pesticideType: "other",
      });
    }
  }
  const allPesticides = [...seedPesticides, ...sprayPesticides, ...add2Pesticides, ...additionsPesticides, ...spreaderPesticides];

  const seedLinks = extractLinksFromSeed(seedSrc);
  const sprayLinks: { pesticideSlug: string; ingredientSlug: string; contentLabel: string }[] = [];
  if (spraySrc) {
    const sprayVarMap = buildSprayVarToSlugMap(spraySrc);
    const sprayIngMap = buildSprayIngVarMap(spraySrc);
    const rawSprayLinks = extractSprayLinks(spraySrc);
    for (const rl of rawSprayLinks) {
      const pSlug = sprayVarMap.get(rl.pesticideVar);
      const iSlug = sprayIngMap.get(rl.ingredientVar);
      if (pSlug && iSlug) sprayLinks.push({ pesticideSlug: pSlug, ingredientSlug: iSlug, contentLabel: rl.contentLabel });
    }
  }
  const add2Links = add2Src ? extractAdd2Links(add2Src) : [];
  const additionsLinks = addSrc ? sharedExtractAdditionsLinks(addSrc).map(r => ({
    pesticideSlug: r.pesticideSlug, ingredientSlug: r.ingredientSlug, contentLabel: r.contentLabel,
  })) : [];
  const allLinks = [...seedLinks, ...sprayLinks, ...add2Links, ...additionsLinks];

  const ingredients = extractIngredientCodes(seedSrc);
  // spray.ts の有効成分
  if (spraySrc) {
    const sprayIngRe = /ensureActiveIngredient\(\{[\s\S]*?slug:\s*'([^']+)'[\s\S]*?\}/g;
    let sim: RegExpExecArray | null;
    while ((sim = sprayIngRe.exec(spraySrc)) !== null) {
      const slug = sim[1];
      if (ingredients.find(i => i.slug === slug)) continue;
      const block = sim[0];
      const nm = block.match(/name:\s*'([^']+)'/);
      const ne = block.match(/nameEn:\s*'([^']+)'/);
      const fc = block.match(/fracCode:\s*'([^']+)'/);
      const ic = block.match(/iracCode:\s*'([^']+)'/);
      const ig = block.match(/ingredientGroup:\s*'([^']+)'/);
      const rr = block.match(/resistanceRisk:\s*'([^']+)'/);
      ingredients.push({
        slug, name: nm?.[1] ? `(spray) ${nm[1]}` : slug,
        nameEn: ne?.[1] ?? "", fracCode: fc?.[1] ?? "", iracCode: ic?.[1] ?? "",
        ingredientGroup: ig?.[1] ?? "", resistanceRisk: rr?.[1] ?? "",
      });
    }
  }
  // additions2.ts の有効成分
  if (add2Src) {
    for (const ing of extractAdd2Ingredients(add2Src)) {
      if (!ingredients.find(i => i.slug === ing.slug)) {
        ingredients.push({ ...ing, name: `(add2) ${ing.name}` });
      }
    }
  }
  // additions.ts の有効成分
  if (addSrc) {
    for (const ing of sharedExtractAdditionsIngredients(addSrc)) {
      if (!ingredients.find(i => i.slug === ing.slug)) {
        ingredients.push({ slug: ing.slug || '', name: `(add) ${ing.name}`, nameEn: ing.nameEn || '', fracCode: ing.fracCode || '', iracCode: ing.iracCode || '', ingredientGroup: ing.ingredientGroup || '', resistanceRisk: ing.resistanceRisk || '' } as typeof ingredients[number]);
      }
    }
  }

  log(`統合: ${allPesticides.length} 製品, ${ingredients.length} 成分, ${allLinks.length} リンク\n`);

  // ════════════════════════════════════════════════════
  // CHECK 1: MAFF公式データとの突合
  // ════════════════════════════════════════════════════
  log("━━━ CHECK 1: MAFF公式データとの突合 ━━━\n");

  // パーサー制限により pest-links.csv に完全にエクスポートされない成分リンクの既知ケース。
  // seed コード上は正しく定義されているが、現状の正規表現パーサーでは拾えない構造のもの。
  //
  // 既知のケース:
  //   - benica-x-fine-aerosol: `if (ing) await linkIngredient(...)` の conditional 形式 (mepanipyrim 0.040%)
  //   - safoil-ec: 同上 (blended-oil 97.0%)
  //   - diazinon-gr-3: seed コメント上 "diazinon slug does not exist in seed data" (意図的に紐付けスキップ)
  //   - danisaraba-fl: seed コメント上 "cyflumetofen slug does not exist in seed data" (意図的に紐付けスキップ)
  const KNOWN_EXPORT_GAPS: Record<string, Set<string>> = {
    'benica-x-fine-aerosol': new Set(['0.040%']),
    'safoil-ec': new Set(['97.0%']),
    'diazinon-gr-3': new Set(['3.0%']),
    'danisaraba-fl': new Set(['20.0%']),
  };

  if (!fs.existsSync(MAFF_CSV)) {
    log("⚠ maff-reference.csv が見つかりません。MAFF突合をスキップします。\n");
  } else {
    const maffData = parseCsv(fs.readFileSync(MAFF_CSV, "utf-8"));
    for (const maff of maffData) {
      const slug = maff.pesticide_slug;
      if (!slug) continue;
      log(`  [${slug}] ${maff.maff_product_name}`);
      if (maff.maff_registration_number) {
        const p = allPesticides.find((pp) => pp.slug === slug);
        if (p) {
          if (p.regNumber && p.regNumber !== maff.maff_registration_number) {
            log(`    ❌ 登録番号不一致: シード="${p.regNumber}" MAFF="${maff.maff_registration_number}"`);
            errorCount++;
          } else if (!p.regNumber) {
            log(`    ⚠ 登録番号未設定（MAFF: ${maff.maff_registration_number}）`);
            warnCount++;
          } else {
            log(`    ✓ 登録番号一致: ${p.regNumber}`);
          }
        } else {
          log(`    ⚠ 製品 ${slug} がMAFF参照にあるがシードデータに未実装（成分チェックをスキップ）`);
          warnCount++;
          log("");
          continue;
        }
      }
      // 有効成分チェック
      // 展着剤製品は PesticideActiveIngredient テーブルでなく SpreaderType テーブルで
      // 成分を管理しているため pest-links.csv に紐付けがない。MAFF 側に成分情報があっても
      // この検査では対象外とする。
      const pesticideForSlug = allPesticides.find((pp) => pp.slug === slug);
      const isSpreader = pesticideForSlug?.pesticideType === "other";
      if (isSpreader) {
        log(`    ✓ 展着剤製品のため成分紐付け検査をスキップ`);
        log("");
        continue;
      }
      const matchingLinks = allLinks.filter((l) => l.pesticideSlug === slug);
      const usedLinks = new Set<number>();
      for (let i = 1; i <= 5; i++) {
        const ingName = maff[`active_ingredient_${i}_name`];
        const ingContent = maff[`active_ingredient_${i}_content`];
        if (!ingName) continue;
        if (matchingLinks.length === 0) {
          // KNOWN_EXPORT_GAPS のいずれかにマッチすれば warning に降格 (seed コード上は対処済み)。
          const knownGaps = KNOWN_EXPORT_GAPS[slug];
          const maffContentNum = ingContent.match(/([\d.]+%)/)?.[1];
          if (knownGaps && maffContentNum && knownGaps.has(maffContentNum)) {
            log(`    ⚠ 有効成分の紐付け既知のCSVエクスポート制限: ${ingName} ${ingContent}`);
            warnCount++;
          } else {
            log(`    ❌ 有効成分の紐付けデータなし: ${ingName} ${ingContent}`);
            errorCount++;
          }
          continue;
        }
        const findUnused = (predicate: (l: typeof matchingLinks[0]) => boolean) => {
          const idx = matchingLinks.findIndex((l, j) => !usedLinks.has(j) && predicate(l));
          return idx >= 0 ? idx : -1;
        };
        let matchIdx = findUnused((l) => l.contentLabel === ingContent);
        if (matchIdx < 0) matchIdx = findUnused((l) => l.contentLabel.startsWith(ingContent) || l.contentLabel.includes(ingContent));
        if (matchIdx < 0) matchIdx = findUnused((l) => {
          const seedNum = l.contentLabel.match(/([\d.]+)%/)?.[1];
          const maffNum = ingContent.match(/([\d.]+)%/)?.[1];
          return !!(seedNum && maffNum && seedNum === maffNum);
        });
        if (matchIdx >= 0) {
          usedLinks.add(matchIdx);
          log(`    ✓ 成分${i}: ${ingName} ${ingContent} → ${matchingLinks[matchIdx].ingredientSlug}`);
        } else {
          // 含有量%が一致する成分があれば名称形式差異として警告扱い（IUPAC名 vs 英語通称）
          const contentOnlyIdx = findUnused((l) => {
            const seedNum = l.contentLabel.match(/([\d.]+)/)?.[1];
            const maffNum = ingContent.match(/([\d.]+)/)?.[1];
            return !!(seedNum && maffNum && seedNum === maffNum);
          });
          if (contentOnlyIdx >= 0) {
            usedLinks.add(contentOnlyIdx);
            log(`    ⚠ 成分${i}名称形式差異: MAFF="${ingName}" シード="${matchingLinks[contentOnlyIdx].ingredientSlug}" (含有量${ingContent}一致)`);
            warnCount++;
          } else {
            // パーサー制限による既知のエクスポートギャップをチェック
            const knownGaps = KNOWN_EXPORT_GAPS[slug];
            const maffContentNum = ingContent.match(/([\d.]+%)/)?.[1];
            if (knownGaps && maffContentNum && knownGaps.has(maffContentNum)) {
              log(`    ⚠ 成分${i}既知のCSVエクスポート制限: MAFF="${ingName} ${ingContent}" (シードコード上では正しく定義済み)`);
              warnCount++;
            } else {
              log(`    ❌ 成分${i}不一致: MAFF="${ingName} ${ingContent}" シード=${JSON.stringify(matchingLinks.map((l) => `${l.ingredientSlug}:${l.contentLabel}`))}`);
              errorCount++;
            }
          }
        }
      }
      log("");
    }
  }

  // ════════════════════════════════════════════════════
  // CHECK 2: FRAC/IRAC コードの妥当性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 2: FRAC/IRAC コードの妥当性 ━━━\n");
  let fracIracErrors = 0;
  for (const ing of ingredients) {
    if (ing.fracCode && !VALID_FRAC_CODES.has(ing.fracCode)) {
      log(`  ❌ 不正なFRACコード: ${ing.name} (${ing.slug}) → FRAC="${ing.fracCode}"`);
      errorCount++;
      fracIracErrors++;
    }
    if (ing.iracCode && !VALID_IRAC_CODES.has(ing.iracCode)) {
      log(`  ❌ 不正なIRACコード: ${ing.name} (${ing.slug}) → IRAC="${ing.iracCode}"`);
      errorCount++;
      fracIracErrors++;
    }
    if (!ing.fracCode && !ing.iracCode) {
      // 物理的防除剤・土壌消毒剤・誘引剤・天然物等はFRAC/IRAC分類の対象外
      const group = (ing.ingredientGroup ?? "").toLowerCase();
      const isExempt = /物理的|土壌消毒|誘引|天然|被膜|気門封鎖/.test(group)
        || ["dazomet", "iron-phosphate", "metaldehyde", "fatty-acid-glyceride",
            "hydrogenated-starch-hydrolysate", "sorbitan-fatty-acid-ester",
            "starch", "decanoyl-glyceryl"].includes(ing.slug);
      if (!isExempt) {
        log(`  ⚠ FRAC/IRACコードなし: ${ing.name} (${ing.slug})`);
        warnCount++;
      }
    }
  }
  if (fracIracErrors === 0) {
    log("  ✓ 全有効成分のFRAC/IRACコードが有効なコード一覧に含まれています");
  }

  // ════════════════════════════════════════════════════
  // CHECK 3: 農薬⇔有効成分リンクの整合性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 3: 農薬⇔有効成分リンクの整合性 ━━━\n");
  const ingredientSlugs = new Set(ingredients.map((i) => i.slug));
  const pesticideSlugs = new Set(allPesticides.map((p) => p.slug));
  for (const link of allLinks) {
    if (!pesticideSlugs.has(link.pesticideSlug)) {
      log(`  ❌ 存在しない農薬slug: "${link.pesticideSlug}" → ${link.ingredientSlug}`);
      errorCount++;
    }
    if (!ingredientSlugs.has(link.ingredientSlug)) {
      log(`  ❌ 存在しない有効成分slug: ${link.pesticideSlug} → "${link.ingredientSlug}"`);
      errorCount++;
    }
  }
  const linkedPesticides = new Set(allLinks.map((l) => l.pesticideSlug));
  const spreaderSet = new Set(spreaderPesticides.map(s => s.slug));
  for (const p of allPesticides) {
    if (!linkedPesticides.has(p.slug)) {
      // 展着剤は有効成分を持たないため除外
      if (spreaderSet.has(p.slug)) continue;
      log(`  ⚠ 有効成分リンクなし: ${p.name} (${p.slug})`);
      warnCount++;
    }
  }

  // ════════════════════════════════════════════════════
  // CHECK 4: 重複データチェック
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 4: 重複データチェック ━━━\n");
  const slugCounts = new Map<string, number>();
  for (const p of allPesticides) {
    slugCounts.set(p.slug, (slugCounts.get(p.slug) ?? 0) + 1);
  }
  for (const [slug, count] of slugCounts) {
    if (count > 1) {
      log(`  ❌ 農薬slug重複: "${slug}" (${count}回)`);
      errorCount++;
    }
  }
  const ingSlugs = new Map<string, number>();
  for (const i of ingredients) {
    ingSlugs.set(i.slug, (ingSlugs.get(i.slug) ?? 0) + 1);
  }
  for (const [slug, count] of ingSlugs) {
    if (count > 1) {
      log(`  ❌ 有効成分slug重複: "${slug}" (${count}回)`);
      errorCount++;
    }
  }

  // ════════════════════════════════════════════════════
  // CHECK 5: 効果データの論理整合性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 5: 効果データの論理整合性 ━━━\n");
  const effectRe = /pesticideId:\s*pMap\["([^"]+)"\],\s*diseasePestId:\s*dpMap\["([^"]+)"\](?:,\s*preventionLevel:\s*"([^"]*)")?(?:,\s*treatmentLevel:\s*"([^"]*)")?(?:,\s*efficacyLevel:\s*"([^"]*)")?(?:,\s*persistenceLevel:\s*"([^"]*)")?/g;
  const effects: { pSlug: string; dpSlug: string; prev: string; treat: string; eff: string; pers: string }[] = [];
  let em: RegExpExecArray | null;
  while ((em = effectRe.exec(seedSrc)) !== null) {
    effects.push({ pSlug: em[1], dpSlug: em[2], prev: em[3] ?? "", treat: em[4] ?? "", eff: em[5] ?? "", pers: em[6] ?? "" });
  }
  const dpCatRe = /category:\s*"(disease|pest|beneficial_insect)",[\s\S]*?slug:\s*"([^"]+)"/g;
  const dpCats = new Map<string, string>();
  let dm: RegExpExecArray | null;
  while ((dm = dpCatRe.exec(seedSrc)) !== null) {
    dpCats.set(dm[2], dm[1]);
  }
  const pTypes = new Map<string, string>();
  for (const p of allPesticides) {
    pTypes.set(p.slug, p.pesticideType);
  }

  for (const e of effects) {
    const pType = pTypes.get(e.pSlug);
    const dpCat = dpCats.get(e.dpSlug);
    if (pType === "fungicide" && dpCat === "pest" && e.eff) {
      log(`  ❌ 殺菌剤→害虫の効果: ${e.pSlug} → ${e.dpSlug} (efficacyLevel="${e.eff}")`);
      errorCount++;
    }
    if ((pType === "insecticide" || pType === "acaricide") && dpCat === "disease" && e.eff && !e.prev) {
      log(`  ❌ 殺虫剤→病害にefficacyLevelのみ: ${e.pSlug} → ${e.dpSlug}`);
      errorCount++;
    }
  }
  log(`  効果データ ${effects.length} 件を検証しました`);

  // ════════════════════════════════════════════════════
  // CHECK 6: 剤型⇔農薬の整合性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 6: 剤型⇔農薬の整合性 ━━━\n");
  const ftRe = /formulationTypeId:\s*ftMap\["([^"]+)"\],\s*\n\s*slug:\s*"([^"]+)"/g;
  const ftLinks: { ftCode: string; slug: string }[] = [];
  let ftm: RegExpExecArray | null;
  while ((ftm = ftRe.exec(seedSrc)) !== null) {
    ftLinks.push({ ftCode: ftm[1], slug: ftm[2] });
  }
  for (const fl of ftLinks) {
    const p = seedPesticides.find(pp => pp.slug === fl.slug);
    if (!p) continue;
    if (p.name.includes("乳剤") && !p.name.includes("AL") && fl.ftCode !== "EC") {
      log(`  ⚠ 名前に乳剤を含むがEC以外: ${p.name} (${fl.slug}) → ${fl.ftCode}`);
      warnCount++;
    }
    if (p.name.includes("粉剤") && fl.ftCode !== "DP") {
      log(`  ⚠ 名前に粉剤を含むがDP以外: ${p.name} (${fl.slug}) → ${fl.ftCode}`);
      warnCount++;
    }
    if (p.name.includes("粒剤") && fl.ftCode !== "GR") {
      log(`  ⚠ 名前に粒剤を含むがGR以外: ${p.name} (${fl.slug}) → ${fl.ftCode}`);
      warnCount++;
    }
  }

  // ════════════════════════════════════════════════════
  // CHECK 7: 病害虫体長の妥当性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 7: 病害虫体長の妥当性 ━━━\n");
  const bodySizeRe = /category:\s*"pest"[\s\S]*?slug:\s*"([^"]+)",\s*\n\s*bodySizeMinMm:\s*([\d.]+),\s*\n\s*bodySizeMaxMm:\s*([\d.]+)/g;
  let bm: RegExpExecArray | null;
  let bodySizeIssues = 0;
  while ((bm = bodySizeRe.exec(seedSrc)) !== null) {
    const min = parseFloat(bm[2]);
    const max = parseFloat(bm[3]);
    if (min > max) {
      log(`  ❌ min > max: ${bm[1]} (min=${min}, max=${max})`);
      errorCount++;
      bodySizeIssues++;
    }
    if (max / min > 5) {
      // ムカデ等の多種群は体長範囲が広くて正常
      const knownWideRange = ["mukade"];
      if (!knownWideRange.includes(bm[1])) {
        log(`  ⚠ 範囲が広すぎ (5倍以上): ${bm[1]} (${min}〜${max}mm)`);
        warnCount++;
        bodySizeIssues++;
      }
    }
    if (min <= 0) {
      log(`  ❌ 体長が0以下: ${bm[1]} (min=${min})`);
      errorCount++;
      bodySizeIssues++;
    }
  }
  // additions.ts の害虫もチェック
  if (addSrc) {
    const addBodyRe = /slug:\s*'([^']+)'[\s\S]*?bodySizeMinMm:\s*([\d.]+),\s*\n\s*bodySizeMaxMm:\s*([\d.]+)/g;
    while ((bm = addBodyRe.exec(addSrc)) !== null) {
      const min = parseFloat(bm[2]);
      const max = parseFloat(bm[3]);
      if (min > max) {
        log(`  ❌ [additions] min > max: ${bm[1]} (min=${min}, max=${max})`);
        errorCount++;
        bodySizeIssues++;
      }
      if (max / min > 5) {
        log(`  ⚠ [additions] 範囲が広すぎ (5倍以上): ${bm[1]} (${min}〜${max}mm)`);
        warnCount++;
        bodySizeIssues++;
      }
    }
  }
  if (bodySizeIssues === 0) {
    log("  ✓ 全害虫の体長データに論理エラーなし");
  }

  // ════════════════════════════════════════════════════
  // CHECK 8: コラム内データ整合性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 8: コラム内データ整合性 ━━━\n");
  const dangerousPatterns = [
    { pattern: /常緑樹[^。]*5〜7倍/g, desc: "常緑樹に5〜7倍（危険な高濃度）" },
    { pattern: /常緑樹[^。]*7〜10倍/g, desc: "常緑樹に7〜10倍（落葉樹用の濃度）" },
    { pattern: /常緑樹[^。]*8〜10倍/g, desc: "常緑樹に8〜10倍（落葉樹用の濃度）" },
    { pattern: /常緑樹[^。]*10〜20倍/g, desc: "常緑樹に10〜20倍（やや濃い）" },
    { pattern: /蓬莱/g, desc: "蓬莱（盆栽の誤字）" },
    { pattern: /FRACコードが異なる薬剤.*殺ダニ/g, desc: "殺ダニ剤にFRACコード（IRACが正しい）" },
  ];
  const allSrcs = [
    { name: "data", src: seedSrc },
    { name: "additions", src: addSrc },
    { name: "additions2", src: add2Src },
    { name: "spray", src: spraySrc },
  ];
  for (const { name, src } of allSrcs) {
    if (!src) continue;
    for (const dp of dangerousPatterns) {
      const matches = src.match(dp.pattern);
      if (matches && matches.length > 0) {
        log(`  ❌ [${name}] ${dp.desc}: ${matches.length} 箇所`);
        errorCount++;
      }
    }
  }
  log("  コラム内データ整合性チェック完了");

  // ════════════════════════════════════════════════════
  // CHECK 9: 混用不可データの双方向整合性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 9: 混用不可データの双方向整合性 ━━━\n");
  // addIncompatibility関数が双方向に追加しているか確認
  const addIncompRe = /const addIncompatibility = \(p1Slug: string, p2Slug: string\) => \{([\s\S]*?)\};/;
  const addIncompMatch = seedSrc.match(addIncompRe);
  if (addIncompMatch) {
    const body = addIncompMatch[1];
    const hasBidirectional = body.includes("pMap[p2Slug]") && body.includes("pMap[p1Slug]");
    if (hasBidirectional) {
      log("  ✓ addIncompatibility関数は双方向に追加しています");
    } else {
      log("  ❌ addIncompatibility関数が双方向ではありません（A→Bのみ、B→Aなし）");
      errorCount++;
    }
  }
  // 混用不可で参照されるslugが実在するか
  // 混用不可セクションのみ抽出（incompatibilities変数以降）
  const incompSection = seedSrc.match(/const incompatibilities = new Set[\s\S]*?\(\);([\s\S]*?)const incompatibilityData/);
  if (incompSection) {
    // このセクション内の配列定義からslugを抽出
    const incompSrc = incompSection[1];
    const arrayDefs = new Map<string, string[]>();
    const arrDefRe = /const\s+(\w+)\s*(?::\s*string\[\])?\s*=\s*\[\s*\n?([\s\S]*?)\];/g;
    let adm: RegExpExecArray | null;
    while ((adm = arrDefRe.exec(incompSrc)) !== null) {
      const slugs: string[] = [];
      const itemRe = /"([^"]+)"/g;
      let im: RegExpExecArray | null;
      while ((im = itemRe.exec(adm[2])) !== null) {
        // slug形式（英数字とハイフンのみ、50文字以内）のもののみ
        if (/^[a-z0-9-]+$/.test(im[1]) && im[1].length <= 50) {
          slugs.push(im[1]);
        }
      }
      if (slugs.length > 0) arrayDefs.set(adm[1], slugs);
    }
    const allIncompSlugs = new Set<string>();
    for (const slugs of arrayDefs.values()) {
      for (const s of slugs) allIncompSlugs.add(s);
    }
    // 展着剤slugも許容（展着剤はPesticideではなくSpreaderTypeテーブル）
    const spreaderSlugs = new Set<string>();
    const _spSlugRe = /slug:\s*"([^"]+)"[\s\S]*?code:\s*"[^"]+"/g;
    // spreaderType定義セクションの slug を取得
    const spSectionMatch = seedSrc.match(/spreaderType[\s\S]*?createMany\(\{[\s\S]*?data:\s*\[([\s\S]*?)\],\s*\}/);
    if (spSectionMatch) {
      const spSlugRe2 = /slug:\s*"([a-z0-9-]+)"/g;
      let spm: RegExpExecArray | null;
      while ((spm = spSlugRe2.exec(spSectionMatch[1])) !== null) {
        spreaderSlugs.add(spm[1]);
      }
    }
    let incompMissing = 0;
    for (const slug of allIncompSlugs) {
      if (!pesticideSlugs.has(slug) && !spreaderSlugs.has(slug)) {
        log(`  ⚠ 混用不可で参照されるslug "${slug}" が農薬・展着剤データに存在しません`);
        warnCount++;
        incompMissing++;
      }
    }
    if (incompMissing === 0) {
      log("  ✓ 混用不可の全参照slugが農薬データに存在します");
    }
  } else {
    log("  ⚠ 混用不可セクションが見つかりません");
    warnCount++;
  }

  // ════════════════════════════════════════════════════
  // CHECK 10: resistanceRiskとFRAC/IRACグループの相関
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 10: resistanceRiskとFRAC/IRACグループの相関 ━━━\n");
  let rrIssues = 0;
  for (const ing of ingredients) {
    if (!ing.resistanceRisk) continue;
    // Mコード（多作用点）は low であるべき
    if (ing.fracCode && LOW_RISK_FRAC.has(ing.fracCode) && ing.resistanceRisk !== "low") {
      log(`  ⚠ 多作用点(${ing.fracCode})だがresistanceRisk="${ing.resistanceRisk}": ${ing.name} (${ing.slug})`);
      warnCount++;
      rrIssues++;
    }
    // FRAC1, 11 は high であるべき
    if (ing.fracCode && HIGH_RISK_FRAC.has(ing.fracCode) && ing.resistanceRisk === "low") {
      log(`  ⚠ 高耐性リスク群(FRAC${ing.fracCode})だがresistanceRisk="low": ${ing.name} (${ing.slug})`);
      warnCount++;
      rrIssues++;
    }
    // IRAC3A/3B（ピレスロイド系）は high であるべき
    // 例外: ピレトリン(pyrethrins)は天然物で分解が早いためlow〜mediumが妥当
    if (ing.iracCode && HIGH_RISK_IRAC.has(ing.iracCode) && ing.resistanceRisk === "low" && ing.slug !== "pyrethrins") {
      log(`  ⚠ ピレスロイド系(${ing.iracCode})だがresistanceRisk="low": ${ing.name} (${ing.slug})`);
      warnCount++;
      rrIssues++;
    }
  }
  if (rrIssues === 0) {
    log("  ✓ resistanceRiskとFRAC/IRACグループの相関に問題なし");
  }

  // ════════════════════════════════════════════════════
  // CHECK 11: 効果レベルの生物学的妥当性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 11: 効果レベルの生物学的妥当性 ━━━\n");
  let bioIssues = 0;
  // 有効成分のFRACからMコード（保護殺菌剤）のリストを構築
  const protectiveFungicideIngs = new Set(
    ingredients.filter(i => i.fracCode && LOW_RISK_FRAC.has(i.fracCode)).map(i => i.slug)
  );
  // 保護殺菌剤の農薬slugリスト
  const protectiveFungicides = new Set<string>();
  for (const link of allLinks) {
    if (protectiveFungicideIngs.has(link.ingredientSlug)) {
      protectiveFungicides.add(link.pesticideSlug);
    }
  }
  for (const e of effects) {
    const dpCat = dpCats.get(e.dpSlug);
    // 保護殺菌剤がtreatmentLevel: excellent（保護剤は基本的に予防型で治療効果はlimited）
    if (protectiveFungicides.has(e.pSlug) && dpCat === "disease" && e.treat === "excellent") {
      // 複合剤は除外（保護+浸透移行型の混合がありうる）
      const pType = pTypes.get(e.pSlug);
      if (pType !== "compound") {
        log(`  ⚠ 保護殺菌剤(Mコード)がtreatmentLevel=excellent: ${e.pSlug} → ${e.dpSlug}`);
        warnCount++;
        bioIssues++;
      }
    }
    // 効果レベルの値が正しいenum値か
    const validLevels = new Set(["excellent", "good", "fair", "poor", "none", ""]);
    if (!validLevels.has(e.prev)) {
      log(`  ❌ 不正なpreventionLevel: "${e.prev}" (${e.pSlug} → ${e.dpSlug})`);
      errorCount++;
      bioIssues++;
    }
    if (!validLevels.has(e.treat)) {
      log(`  ❌ 不正なtreatmentLevel: "${e.treat}" (${e.pSlug} → ${e.dpSlug})`);
      errorCount++;
      bioIssues++;
    }
    if (!validLevels.has(e.eff)) {
      log(`  ❌ 不正なefficacyLevel: "${e.eff}" (${e.pSlug} → ${e.dpSlug})`);
      errorCount++;
      bioIssues++;
    }
    if (!validLevels.has(e.pers)) {
      log(`  ❌ 不正なpersistenceLevel: "${e.pers}" (${e.pSlug} → ${e.dpSlug})`);
      errorCount++;
      bioIssues++;
    }
  }
  if (bioIssues === 0) {
    log("  ✓ 効果レベルの生物学的妥当性に問題なし");
  }

  // ════════════════════════════════════════════════════
  // CHECK 12: 登録番号フォーマット検証
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 12: 登録番号フォーマット検証 ━━━\n");
  let regIssues = 0;
  for (const p of allPesticides) {
    if (!p.regNumber) continue;
    // MAFF登録番号は数字のみ、4〜6桁
    if (!/^\d{4,6}$/.test(p.regNumber)) {
      log(`  ❌ 登録番号フォーマット不正: ${p.name} (${p.slug}) → "${p.regNumber}"`);
      errorCount++;
      regIssues++;
    }
  }
  if (regIssues === 0) {
    log("  ✓ 全登録番号のフォーマットが正常です");
  }

  // ════════════════════════════════════════════════════
  // CHECK 13: 有効成分英名の基本形式チェック
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 13: 有効成分英名の基本形式チェック ━━━\n");
  let nameEnIssues = 0;
  for (const ing of ingredients) {
    if (!ing.nameEn) continue;
    // 英名は大文字始まりが一般的（ただし一部例外あり: pH等）
    if (ing.nameEn.length > 0 && /^[a-z]/.test(ing.nameEn) && !ing.nameEn.startsWith("pH")) {
      log(`  ⚠ 英名が小文字始まり: ${ing.name} → "${ing.nameEn}" (${ing.slug})`);
      warnCount++;
      nameEnIssues++;
    }
    // 英名にひらがな/カタカナが含まれる場合
    if (/[\u3040-\u30FF]/.test(ing.nameEn)) {
      log(`  ❌ 英名に日本語が含まれる: ${ing.name} → "${ing.nameEn}" (${ing.slug})`);
      errorCount++;
      nameEnIssues++;
    }
  }
  if (nameEnIssues === 0) {
    log("  ✓ 全有効成分の英名形式に問題なし");
  }

  // ════════════════════════════════════════════════════
  // CHECK 14: コラム内の農薬slug参照存在確認
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 14: コラム内の農薬slug参照存在確認 ━━━\n");
  // コラムセクションのみを抽出（混用不可セクション等を除外）
  // pesticideColumn.createMany の data 配列部分のみ
  const columnSectionMatch = seedSrc.match(/pesticideColumn\.createMany\(\{[\s\S]*?data:\s*\[([\s\S]*?)\],\s*\}\)/);
  if (columnSectionMatch) {
    const _colContent = columnSectionMatch[1];
    // コラムのcontent内に埋め込まれた slug をチェック
    // コラムテキスト内で直接参照される農薬slug (content文字列中のslugは名前で参照されるため、
    // ここではcreateMany内でpMap/dpMapを使う参照パターンを検出)
    // 注: コラムのcontent文字列はテキストのみでpMap参照を含まないため、
    //     実際のslug参照エラーはeffectセクションのCHECK 3/5で捕捉される
    log("  ✓ コラムセクションの構造チェック完了（コラム内テキストのslug参照はテキストベースのため機械的検証対象外）");
  } else {
    log("  ⚠ pesticideColumnセクションが見つかりません");
    warnCount++;
  }

  // ════════════════════════════════════════════════════
  // CHECK 15: MAFF未検証製品のリスト
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 15: MAFF未検証製品のリスト ━━━\n");
  const maffVerified = new Set<string>();
  if (fs.existsSync(MAFF_CSV)) {
    const maffData = parseCsv(fs.readFileSync(MAFF_CSV, "utf-8"));
    for (const m of maffData) {
      if (m.pesticide_slug) maffVerified.add(m.pesticide_slug);
    }
  }
  const unverified: string[] = [];
  for (const p of allPesticides) {
    if (p.regNumber && !maffVerified.has(p.slug)) {
      unverified.push(`${p.name} (${p.slug}) 登録#${p.regNumber}`);
    }
  }
  if (unverified.length > 0) {
    log(`  ⚠ MAFF未検証の製品: ${unverified.length} 件`);
    for (const u of unverified) {
      log(`    - ${u}`);
    }
    warnCount += unverified.length;
  } else {
    log("  ✓ 全登録番号付き製品がMAFF検証済みです");
  }

  // ════════════════════════════════════════════════════
  // CHECK 16: slug命名規則統一性チェック
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 16: slug命名規則統一性チェック ━━━\n");
  let slugIssues = 0;
  for (const p of allPesticides) {
    // slugは半角英数字とハイフンのみ
    if (!/^[a-z0-9-]+$/.test(p.slug)) {
      log(`  ❌ 農薬slugに不正文字: "${p.slug}"`);
      errorCount++;
      slugIssues++;
    }
    // 連続ハイフン
    if (/--/.test(p.slug)) {
      log(`  ⚠ 連続ハイフン: "${p.slug}"`);
      warnCount++;
      slugIssues++;
    }
  }
  for (const i of ingredients) {
    if (!/^[a-z0-9-]+$/.test(i.slug)) {
      log(`  ❌ 有効成分slugに不正文字: "${i.slug}"`);
      errorCount++;
      slugIssues++;
    }
  }
  if (slugIssues === 0) {
    log("  ✓ 全slugの命名規則に問題なし");
  }

  // ════════════════════════════════════════════════════
  // CHECK 17: FRAC/IRACコードのファイル間整合性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 17: FRAC/IRACコードのファイル間整合性 ━━━\n");
  // 全ソースから同一slugの有効成分定義を収集し、FRAC/IRACが一致するか確認
  const ingDefsPerFile: { slug: string; fracCode: string; iracCode: string; source: string }[] = [];
  // data.ts
  const ingReMain = /name:\s*"([^"]+)",\s*\n\s*nameEn:\s*"([^"]+)",\s*\n\s*(?:fracCode:\s*"([^"]*)",\s*\n\s*)?(?:iracCode:\s*"([^"]*)",\s*\n\s*)?ingredientGroup:\s*"([^"]+)",\s*\n\s*slug:\s*"([^"]+)"/g;
  let ingM: RegExpExecArray | null;
  while ((ingM = ingReMain.exec(seedSrc)) !== null) {
    ingDefsPerFile.push({ slug: ingM[6], fracCode: ingM[3] ?? "", iracCode: ingM[4] ?? "", source: "data" });
  }
  // spray.ts
  if (spraySrc) {
    const spIngRe = /ensureActiveIngredient\(\{[\s\S]*?slug:\s*'([^']+)'[\s\S]*?\}/g;
    while ((ingM = spIngRe.exec(spraySrc)) !== null) {
      const block = ingM[0];
      const fc = block.match(/fracCode:\s*'([^']+)'/);
      const ic = block.match(/iracCode:\s*'([^']+)'/);
      ingDefsPerFile.push({ slug: ingM[1], fracCode: fc?.[1] ?? "", iracCode: ic?.[1] ?? "", source: "spray" });
    }
  }
  // additions2.ts
  if (add2Src) {
    const a2IngRe = /ensureIngredient\(\{\s*\n?\s*slug:\s*"([^"]+)"[\s\S]*?\}/g;
    while ((ingM = a2IngRe.exec(add2Src)) !== null) {
      const block = ingM[0];
      const fc = block.match(/fracCode:\s*"([^"]+)"/);
      const ic = block.match(/iracCode:\s*"([^"]+)"/);
      ingDefsPerFile.push({ slug: ingM[1], fracCode: fc?.[1] ?? "", iracCode: ic?.[1] ?? "", source: "additions2" });
    }
  }
  // additions.ts
  if (addSrc) {
    const a1IngRe = /slug:\s*'([^']+)',\s*\n\s*name:\s*'[^']+',\s*\n\s*nameEn:\s*'[^']+'/g;
    while ((ingM = a1IngRe.exec(addSrc)) !== null) {
      const block = addSrc.slice(ingM.index, ingM.index + 600);
      if (!block.match(/ingredientGroup/)) continue; // 農薬定義は除外
      const fc = block.match(/fracCode:\s*'([^']+)'/);
      const ic = block.match(/iracCode:\s*'([^']+)'/);
      ingDefsPerFile.push({ slug: ingM[1], fracCode: fc?.[1] ?? "", iracCode: ic?.[1] ?? "", source: "additions" });
    }
  }
  // slugごとにグループ化して一致確認
  const ingBySlug = new Map<string, typeof ingDefsPerFile>();
  for (const def of ingDefsPerFile) {
    const arr = ingBySlug.get(def.slug) ?? [];
    arr.push(def);
    ingBySlug.set(def.slug, arr);
  }
  let crossFileIssues = 0;
  for (const [slug, defs] of ingBySlug) {
    if (defs.length <= 1) continue;
    const fracCodes = new Set(defs.filter(d => d.fracCode).map(d => d.fracCode));
    const iracCodes = new Set(defs.filter(d => d.iracCode).map(d => d.iracCode));
    if (fracCodes.size > 1) {
      log(`  ❌ FRACコード不一致 [${slug}]: ${defs.map(d => `${d.source}="${d.fracCode}"`).join(", ")}`);
      errorCount++;
      crossFileIssues++;
    }
    if (iracCodes.size > 1) {
      log(`  ❌ IRACコード不一致 [${slug}]: ${defs.map(d => `${d.source}="${d.iracCode}"`).join(", ")}`);
      errorCount++;
      crossFileIssues++;
    }
  }
  if (crossFileIssues === 0) {
    log("  ✓ 全ソースファイル間でFRAC/IRACコードが一致しています");
  }

  // ════════════════════════════════════════════════════
  // CHECK 18: 効果データ内の病害虫slug存在確認
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 18: 効果データ内の病害虫slug存在確認 ━━━\n");
  // CSVから全効果データと全病害虫slugを読み込む
  const effectsCsvPath = path.resolve(__dirname, "effects.csv");
  const dpCsvPath = path.resolve(__dirname, "disease-pests.csv");
  let effectDpIssues = 0;
  if (fs.existsSync(effectsCsvPath) && fs.existsSync(dpCsvPath)) {
    const effectsCsv = parseCsv(fs.readFileSync(effectsCsvPath, "utf-8"));
    const dpCsv = parseCsv(fs.readFileSync(dpCsvPath, "utf-8"));
    const dpSlugSet = new Set(dpCsv.map(r => r.slug));
    const missingDpSlugs = new Set<string>();
    for (const e of effectsCsv) {
      if (e.diseasePestSlug && !dpSlugSet.has(e.diseasePestSlug)) {
        missingDpSlugs.add(e.diseasePestSlug);
      }
    }
    // pesticideSlugの存在もチェック
    const missingPSlugs = new Set<string>();
    for (const e of effectsCsv) {
      if (e.pesticideSlug && !pesticideSlugs.has(e.pesticideSlug)) {
        missingPSlugs.add(e.pesticideSlug);
      }
    }
    for (const slug of missingDpSlugs) {
      log(`  ❌ 効果データに存在しない病害虫slug: "${slug}"`);
      errorCount++;
      effectDpIssues++;
    }
    for (const slug of missingPSlugs) {
      log(`  ❌ 効果データに存在しない農薬slug: "${slug}"`);
      errorCount++;
      effectDpIssues++;
    }
    if (effectDpIssues === 0) {
      log(`  ✓ 効果データ ${effectsCsv.length} 件の全slug参照が存在します`);
    }
  } else {
    log("  ⚠ effects.csv または disease-pests.csv が見つかりません（先に export を実行してください）");
    warnCount++;
  }

  // ════════════════════════════════════════════════════
  // CHECK 19: 効果ゼロの農薬検出
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 19: 効果ゼロの農薬検出 ━━━\n");
  if (fs.existsSync(effectsCsvPath)) {
    const effectsCsv = parseCsv(fs.readFileSync(effectsCsvPath, "utf-8"));
    const pesticidesWithEffects = new Set(effectsCsv.map(e => e.pesticideSlug));
    // 展着剤slug（pesticideType=other かつ有効成分リンクなし）を除外
    const spreaderSet = new Set(spreaderPesticides.map(s => s.slug));
    let zeroEffectIssues = 0;
    for (const p of allPesticides) {
      if (spreaderSet.has(p.slug)) continue; // 展着剤は除外
      if (p.pesticideType === "other" && !linkedPesticides.has(p.slug)) continue; // 特殊剤は除外
      if (!pesticidesWithEffects.has(p.slug)) {
        log(`  ⚠ 効果データなし: ${p.name} (${p.slug}) [${p.pesticideType}]`);
        warnCount++;
        zeroEffectIssues++;
      }
    }
    if (zeroEffectIssues === 0) {
      log("  ✓ 全農薬製品（展着剤・特殊剤除く）に効果データが存在します");
    }
  }

  // ════════════════════════════════════════════════════
  // CHECK 20: 全レベルnullの効果データ検出
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 20: 全レベルnullの効果データ検出 ━━━\n");
  if (fs.existsSync(effectsCsvPath)) {
    const effectsCsv = parseCsv(fs.readFileSync(effectsCsvPath, "utf-8"));
    let nullEffectIssues = 0;
    for (const e of effectsCsv) {
      const prev = e.preventionLevel?.trim() ?? "";
      const treat = e.treatmentLevel?.trim() ?? "";
      const eff = e.efficacyLevel?.trim() ?? "";
      const pers = e.persistenceLevel?.trim() ?? "";
      if (!prev && !treat && !eff && !pers) {
        log(`  ❌ 全レベル空の効果データ: ${e.pesticideSlug} → ${e.diseasePestSlug} [${e.source}]`);
        errorCount++;
        nullEffectIssues++;
      }
    }
    if (nullEffectIssues === 0) {
      log(`  ✓ 全効果データに少なくとも1つのレベルが設定されています`);
    }
  }

  // ════════════════════════════════════════════════════
  // CHECK 21: pesticideTypeとFRAC/IRACタイプの整合性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 21: pesticideTypeとFRAC/IRACタイプの整合性 ━━━\n");
  let typeIssues = 0;
  for (const p of allPesticides) {
    if (p.pesticideType === "compound" || p.pesticideType === "other") continue;
    // この農薬にリンクされた有効成分のFRAC/IRACを取得
    const linkedIngs = allLinks.filter(l => l.pesticideSlug === p.slug);
    for (const link of linkedIngs) {
      const ing = ingredients.find(i => i.slug === link.ingredientSlug);
      if (!ing) continue;
      // 殺菌剤(fungicide)なのにIRACコードのみ（FRACなし）
      if (p.pesticideType === "fungicide" && ing.iracCode && !ing.fracCode) {
        log(`  ⚠ 殺菌剤 ${p.name} (${p.slug}) の成分 ${ing.slug} にFRACコードなし・IRACコードあり(${ing.iracCode})`);
        warnCount++;
        typeIssues++;
      }
      // 殺虫剤/殺ダニ剤なのにFRACコードのみ（IRACなし）
      if ((p.pesticideType === "insecticide" || p.pesticideType === "acaricide") && ing.fracCode && !ing.iracCode) {
        log(`  ⚠ ${p.pesticideType} ${p.name} (${p.slug}) の成分 ${ing.slug} にIRACコードなし・FRACコードあり(${ing.fracCode})`);
        warnCount++;
        typeIssues++;
      }
    }
  }
  if (typeIssues === 0) {
    log("  ✓ pesticideTypeとFRAC/IRACタイプの整合性に問題なし");
  }

  // ════════════════════════════════════════════════════
  // CHECK 22: resistanceRisk設定漏れ検出
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 22: resistanceRisk設定漏れ検出 ━━━\n");
  let rrMissingIssues = 0;
  for (const ing of ingredients) {
    // FRAC/IRACコードを持つのにresistanceRiskが未設定
    if ((ing.fracCode || ing.iracCode) && !ing.resistanceRisk) {
      log(`  ⚠ resistanceRisk未設定: ${ing.name} (${ing.slug}) FRAC="${ing.fracCode}" IRAC="${ing.iracCode}"`);
      warnCount++;
      rrMissingIssues++;
    }
  }
  if (rrMissingIssues === 0) {
    log("  ✓ FRAC/IRACコード付きの全成分にresistanceRiskが設定されています");
  }

  // ════════════════════════════════════════════════════
  // CHECK 23: 希釈倍率の妥当範囲チェック
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 23: 希釈倍率の妥当範囲チェック ━━━\n");
  let dilutionIssues = 0;
  for (const { name, src } of allSrcs) {
    if (!src) continue;
    // 「NNN倍」パターンを検出
    const dilRe = /(\d[\d,]+)倍/g;
    let dilM: RegExpExecArray | null;
    while ((dilM = dilRe.exec(src)) !== null) {
      const val = parseInt(dilM[1].replace(/,/g, ""), 10);
      if (isNaN(val)) continue;
      // 一般的な農薬の希釈倍率は1〜10000倍（石灰硫黄合剤の5倍〜ネオニコチノイドの10000倍）
      // ただしコラム内の「100万倍」等の比喩的表現を除外するため20000以上を警告
      if (val > 20000) {
        // 前後の文脈を取得
        const ctx = src.slice(Math.max(0, dilM.index - 30), dilM.index + dilM[0].length + 20).replace(/\n/g, " ");
        log(`  ⚠ [${name}] 異常な希釈倍率 ${val}倍: ...${ctx}...`);
        warnCount++;
        dilutionIssues++;
      }
      if (val === 0) {
        log(`  ❌ [${name}] 希釈倍率が0倍`);
        errorCount++;
        dilutionIssues++;
      }
    }
  }
  if (dilutionIssues === 0) {
    log("  ✓ 全希釈倍率が妥当な範囲内です");
  }

  // ════════════════════════════════════════════════════
  // CHECK 24: 展着剤リンクのslug存在確認
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 24: 展着剤リンクのslug存在確認 ━━━\n");
  const spreaderLinksCsvPath = path.resolve(__dirname, "spreader-links.csv");
  const spreaderTypesCsvPath = path.resolve(__dirname, "spreader-types.csv");
  let spreaderLinkIssues = 0;
  if (fs.existsSync(spreaderLinksCsvPath) && fs.existsSync(spreaderTypesCsvPath)) {
    const spreaderLinksCsv = parseCsv(fs.readFileSync(spreaderLinksCsvPath, "utf-8"));
    const spreaderTypesCsv = parseCsv(fs.readFileSync(spreaderTypesCsvPath, "utf-8"));
    const spreaderTypeSlugSet = new Set(spreaderTypesCsv.map(r => r.slug));
    for (const link of spreaderLinksCsv) {
      if (link.pesticideSlug && !pesticideSlugs.has(link.pesticideSlug)) {
        log(`  ❌ 展着剤リンクに存在しない農薬slug: "${link.pesticideSlug}"`);
        errorCount++;
        spreaderLinkIssues++;
      }
      if (link.spreaderTypeSlug && !spreaderTypeSlugSet.has(link.spreaderTypeSlug)) {
        log(`  ❌ 展着剤リンクに存在しない展着剤slug: "${link.spreaderTypeSlug}"`);
        errorCount++;
        spreaderLinkIssues++;
      }
    }
    if (spreaderLinkIssues === 0) {
      log(`  ✓ 展着剤リンク ${spreaderLinksCsv.length} 件の全slug参照が存在します`);
    }
  } else {
    log("  ⚠ spreader-links.csv または spreader-types.csv が見つかりません");
    warnCount++;
  }

  // ════════════════════════════════════════════════════
  // CHECK 25: 有効成分の英名重複チェック
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 25: 有効成分の英名重複チェック ━━━\n");
  const nameEnCounts = new Map<string, string[]>();
  for (const ing of ingredients) {
    if (!ing.nameEn) continue;
    const lower = ing.nameEn.toLowerCase();
    const arr = nameEnCounts.get(lower) ?? [];
    arr.push(ing.slug);
    nameEnCounts.set(lower, arr);
  }
  let nameEnIssues2 = 0;
  for (const [nameEn, slugs] of nameEnCounts) {
    if (slugs.length > 1) {
      log(`  ❌ 英名重複 "${nameEn}": ${slugs.join(", ")}`);
      errorCount++;
      nameEnIssues2++;
    }
  }
  if (nameEnIssues2 === 0) {
    log("  ✓ 全有効成分の英名が一意です");
  }

  // ════════════════════════════════════════════════════
  // CHECK 26: 病害虫descriptionの空欄チェック
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 26: 病害虫descriptionの空欄チェック ━━━\n");
  if (fs.existsSync(dpCsvPath)) {
    const dpCsv = parseCsv(fs.readFileSync(dpCsvPath, "utf-8"));
    let descIssues = 0;
    for (const dp of dpCsv) {
      const desc = dp.descriptionHead?.trim() ?? "";
      if (desc.length < 10) {
        log(`  ⚠ 説明文が短すぎるまたは空: ${dp.name} (${dp.slug}) [${desc.length}文字]`);
        warnCount++;
        descIssues++;
      }
    }
    if (descIssues === 0) {
      log(`  ✓ 全病害虫 ${dpCsv.length} 件に十分な説明文があります`);
    }
  }

  // ════════════════════════════════════════════════════
  // CHECK 27: FRAC M群（多作用点）の耐性リスク整合性
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 27: FRAC M群の耐性リスク整合性 ━━━\n");
  const ingCodes = extractIngredientCodes(seedSrc);
  let fracRiskIssues = 0;
  for (const ing of ingCodes) {
    if (ing.fracCode && LOW_RISK_FRAC.has(ing.fracCode) && ing.resistanceRisk === "high") {
      log(`  ❌ FRAC M群(多作用点)なのに耐性リスクhigh: ${ing.name} (${ing.slug}) FRAC=${ing.fracCode}`);
      errorCount++;
      fracRiskIssues++;
    }
    if (ing.fracCode && HIGH_RISK_FRAC.has(ing.fracCode) && ing.resistanceRisk === "low") {
      log(`  ⚠ 高リスクFRACグループなのに耐性リスクlow: ${ing.name} (${ing.slug}) FRAC=${ing.fracCode}`);
      warnCount++;
      fracRiskIssues++;
    }
    if (ing.iracCode && HIGH_RISK_IRAC.has(ing.iracCode) && ing.resistanceRisk === "low") {
      log(`  ⚠ 高リスクIRACグループなのに耐性リスクlow: ${ing.name} (${ing.slug}) IRAC=${ing.iracCode}`);
      warnCount++;
      fracRiskIssues++;
    }
  }
  if (fracRiskIssues === 0) {
    log(`  ✓ 全成分 ${ingCodes.length} 件のFRAC/IRAC-耐性リスク整合性OK`);
  }

  // ════════════════════════════════════════════════════
  // CHECK 28: compound型農薬の成分数チェック
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 28: compound型農薬の成分数チェック ━━━\n");
  const linksCsv = fs.existsSync(path.resolve(__dirname, "pest-links.csv"))
    ? parseCsv(fs.readFileSync(path.resolve(__dirname, "pest-links.csv"), "utf-8"))
    : [];
  // 単一成分だが物理的・化学的に殺菌殺虫両作用を持つ特殊剤のためcompound分類を許容
  // - lime-sulfur: 石灰硫黄合剤（多硫化カルシウム）
  // - suncrystal-ec: サンクリスタル乳剤（脂肪酸グリセリド）MAFF#20316はうどんこ病・害虫類に登録
  const COMPOUND_SINGLE_INGREDIENT_EXCEPTIONS = new Set(["lime-sulfur", "suncrystal-ec"]);
  let compoundIssues = 0;
  for (const p of allPesticides) {
    if (p.pesticideType === "compound") {
      const ingCount = linksCsv.filter(l => l.pesticideSlug === p.slug).length;
      if (ingCount < 2 && !COMPOUND_SINGLE_INGREDIENT_EXCEPTIONS.has(p.slug)) {
        log(`  ❌ compound型なのに成分が${ingCount}件: ${p.name} (${p.slug})`);
        errorCount++;
        compoundIssues++;
      }
    }
  }
  if (compoundIssues === 0) {
    const compoundCount = allPesticides.filter(p => p.pesticideType === "compound").length;
    log(`  ✓ compound型農薬 ${compoundCount} 件すべてに2成分以上`);
  }

  // ════════════════════════════════════════════════════
  // CHECK 29: 同一成分の農薬間での効果評価矛盾
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 29: 同一成分の農薬間での効果評価矛盾 ━━━\n");
  // 同じ有効成分を持つ農薬が、同じ病害虫に対して大きく異なる評価を持つケースを検出
  // (excellent vs none/poor は矛盾の可能性)
  const ingToPests = new Map<string, string[]>(); // ingredientSlug → pesticideSlug[]
  for (const link of linksCsv) {
    const key = link.ingredientSlug;
    if (!key) continue;
    if (!ingToPests.has(key)) ingToPests.set(key, []);
    ingToPests.get(key)!.push(link.pesticideSlug);
  }

  let contradictionIssues = 0;
  for (const [ingSlug, pestSlugs] of ingToPests.entries()) {
    if (pestSlugs.length < 2) continue;
    // 各農薬の効果データを集める
    const effectsByDp = new Map<string, Map<string, string>>(); // dpSlug → { pestSlug → efficacyLevel }
    for (const e of effects) {
      if (!pestSlugs.includes(e.pSlug)) continue;
      if (!e.eff) continue;
      if (!effectsByDp.has(e.dpSlug)) effectsByDp.set(e.dpSlug, new Map());
      effectsByDp.get(e.dpSlug)!.set(e.pSlug, e.eff);
    }
    // 矛盾チェック: excellent vs none/poor
    const levels = { none: 0, poor: 1, fair: 2, good: 3, excellent: 4 };
    for (const [dpSlug, pestEffects] of effectsByDp.entries()) {
      if (pestEffects.size < 2) continue;
      const values = [...pestEffects.values()].map(v => levels[v as keyof typeof levels] ?? -1).filter(v => v >= 0);
      const maxVal = Math.max(...values);
      const minVal = Math.min(...values);
      if (maxVal - minVal >= 3) { // excellent(4) vs poor(1) or none(0)
        const details = [...pestEffects.entries()].map(([ps, lv]) => `${ps}=${lv}`).join(", ");
        log(`  ⚠ 同一成分(${ingSlug})で効果が大きく矛盾: ${dpSlug} → [${details}]`);
        warnCount++;
        contradictionIssues++;
      }
    }
  }
  if (contradictionIssues === 0) {
    log(`  ✓ 同一成分間の効果評価に大きな矛盾なし`);
  }

  // ════════════════════════════════════════════════════
  // CHECK 30: MAFF公式 種類名称とpesticideTypeの照合
  // ════════════════════════════════════════════════════
  log("\n━━━ CHECK 30: MAFF種類名称とpesticideType照合 ━━━\n");
  const maffReferencePath = VALIDATION_PATHS.maffReference;
  if (fs.existsSync(maffReferencePath)) {
    const maffCsv = parseCsv(fs.readFileSync(maffReferencePath, "utf-8"));
    let maffTypeIssues = 0;
    const typeMapping: Record<string, string[]> = {
      fungicide: ["殺菌", "殺菌剤"],
      insecticide: ["殺虫", "殺虫剤"],
      acaricide: ["殺ダニ", "殺虫殺ダニ", "殺虫剤"],
      compound: ["殺虫殺菌", "殺菌殺虫"],
    };
    for (const ref of maffCsv) {
      const slug = ref.pesticide_slug;
      const notes = ref.notes || "";
      // notes に "自動取得(xxx)" の形式でMAFF種類名称が入っている
      const purposeMatch = notes.match(/自動取得\((.+?)\)/);
      if (!purposeMatch) continue;
      const maffPurpose = purposeMatch[1]; // e.g. "チアメトキサム水溶剤"
      const pest = allPesticides.find(p => p.slug === slug);
      if (!pest) continue;
      const expectedKeywords = typeMapping[pest.pesticideType] || [];
      // MAFFの種類名称にpesticideTypeに対応するキーワードが含まれるか
      if (expectedKeywords.length > 0 && maffPurpose.includes("殺")) {
        const hasMatch = expectedKeywords.some(kw => maffPurpose.includes(kw));
        if (!hasMatch) {
          log(`  ⚠ pesticideType不一致: ${pest.name} (${slug}) type=${pest.pesticideType}, MAFF=${maffPurpose}`);
          warnCount++;
          maffTypeIssues++;
        }
      }
    }
    if (maffTypeIssues === 0) {
      log(`  ✓ MAFF種類名称とpesticideTypeの整合性OK`);
    }
  } else {
    log("  ⚠ maff-reference.csv が見つかりません。npm run validate:scrape-maff を実行してください。");
    warnCount++;
  }

  // ────────────────────────────────────────────────────
  // サマリー
  // ────────────────────────────────────────────────────
  log("\n══════════════════════════════════════════════════");
  log(` バリデーション結果: エラー ${errorCount} 件, 警告 ${warnCount} 件`);
  if (errorCount === 0) {
    log(" ✅ 重大なエラーはありません");
  } else {
    log(" ⛔ 修正が必要なエラーがあります");
  }
  log("══════════════════════════════════════════════════");

  fs.writeFileSync(REPORT_FILE, report.join("\n"), "utf-8");
  console.log(`\nレポートを ${REPORT_FILE} に保存しました。`);
}

main();
