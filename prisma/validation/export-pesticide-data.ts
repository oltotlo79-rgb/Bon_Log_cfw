/* eslint-disable no-console */
/**
 * 農薬シードデータからCSVを出力するスクリプト
 *
 * シードファイル群をパースし、バリデーション用の CSV ファイルを prisma/validation/ に出力する。
 *
 * 対象ソースファイル:
 *   - seed-pesticide-data.ts        (メインデータ + 効果補完・説明文強化を含む)
 *   - seed-pesticide-additions.ts   (追加データ第1弾)
 *   - seed-pesticide-additions2.ts  (追加農薬製品・スプレー型農薬 統合版)
 *
 * 出力ファイル:
 *   1. pesticides.csv           — 農薬製品一覧
 *   2. ingredients.csv          — 有効成分一覧
 *   3. pest-links.csv           — 農薬⇔有効成分の紐付け
 *   4. disease-pests.csv        — 病害虫一覧
 *   5. effects.csv              — 農薬⇔病害虫の効果データ
 *   6. formulation-types.csv    — 剤型一覧
 *   7. columns.csv              — コラム一覧
 *   8. spreader-types.csv       — 展着剤タイプ一覧
 *   9. spreader-links.csv       — 展着剤⇔農薬紐付け
 *  10. incompatibilities.csv    — 混用不可データ
 *
 * 使い方:
 *   npx tsx prisma/validation/export-pesticide-data.ts
 *
 * ※ DB接続は不要。シードファイルのソースコードを正規表現でパースする。
 */

import * as fs from "fs";
import * as path from "path";
import {
  SEED_PATHS, VALIDATION_PATHS, toCsv, dedup,
  extractPesticidesFromMain, extractIngredientsFromMain, extractLinksFromMain,
  extractDiseasePests, extractEffectsFromMain, extractFormulationTypes,
  extractColumns, extractIncompatibilities, extractSpreaderTypes, extractSpreaderLinks, extractSpreaderPesticides,
  extractPesticidesFromSpray, extractIngredientsFromSpray, extractLinksFromSpray, extractEffectsFromSpray,
  extractPesticidesFromAdditions, extractIngredientsFromAdditions, extractLinksFromAdditions, extractEffectsFromAdditions,
  extractPesticidesFromAdditions2, extractIngredientsFromAdditions2, extractLinksFromAdditions2, extractEffectsFromAdditions2,
} from "./parsers";

function readFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    console.warn(`  ⚠ ファイルが見つかりません: ${path.basename(filePath)}`);
    return "";
  }
}

// ── メイン処理 ─────────────────────────────────────────
function main() {
  console.log("シードファイルを読み込み中...");
  const mainSrc = readFile(SEED_PATHS.data);
  const addSrc = readFile(SEED_PATHS.additions);
  const add2Src = readFile(SEED_PATHS.additions2);
  const spraySrc = readFile(SEED_PATHS.spray);
  console.log(`  data.ts: ${(mainSrc.length / 1024).toFixed(0)} KB`);
  console.log(`  additions.ts: ${(addSrc.length / 1024).toFixed(0)} KB`);
  console.log(`  additions2.ts: ${(add2Src.length / 1024).toFixed(0)} KB`);
  console.log(`  spray.ts: ${(spraySrc.length / 1024).toFixed(0)} KB\n`);

  const OUT_DIR = VALIDATION_PATHS.outDir;
  const write = (name: string, headers: string[], rows: Record<string, string>[]) => {
    fs.writeFileSync(path.join(OUT_DIR, name), toCsv(headers, rows), "utf-8");
    console.log(`  ${name}: ${rows.length} 件`);
  };

  // 1. 農薬（全ソース統合・重複除去 + 展着剤を含む）
  const spreaderPests = extractSpreaderPesticides(mainSrc).map(sp => ({
    name: sp.name,
    slug: sp.slug,
    registrationNumber: sp.regNumber,
    pesticideType: sp.pesticideType,
    formulationType: "EC",
    description: "",
    source: "data",
  }));
  const pesticides = dedup([
    ...extractPesticidesFromMain(mainSrc),
    ...extractPesticidesFromSpray(spraySrc),
    ...extractPesticidesFromAdditions(addSrc),
    ...extractPesticidesFromAdditions2(add2Src),
    ...spreaderPests,
  ], "slug");
  write("pesticides.csv",
    ["name", "slug", "registrationNumber", "pesticideType", "formulationType", "description", "source"],
    pesticides);

  // 2. 有効成分（全ソース統合・重複除去）
  const ingredients = dedup([
    ...extractIngredientsFromMain(mainSrc),
    ...extractIngredientsFromSpray(spraySrc),
    ...extractIngredientsFromAdditions(addSrc),
    ...extractIngredientsFromAdditions2(add2Src),
  ], "slug");
  write("ingredients.csv",
    ["name", "nameEn", "fracCode", "iracCode", "ingredientGroup", "slug", "resistanceRisk", "source"],
    ingredients);

  // 3. 農薬⇔有効成分紐付け（全ソース統合・複合キーで重複除去）
  // additions2 と spray は同一ファイル(seed-pesticide-additions2.ts)を異なる正規表現でパースするため
  // 同じ linkIngredient 呼び出しが両方にマッチして重複が生じる。dedup で先勝ちで残す。
  const links = dedup([
    ...extractLinksFromMain(mainSrc),
    ...extractLinksFromAdditions(addSrc),
    ...extractLinksFromAdditions2(add2Src),
    ...extractLinksFromSpray(spraySrc),
  ], "pesticideSlug,ingredientSlug");
  write("pest-links.csv",
    ["pesticideSlug", "ingredientSlug", "contentLabel", "source"],
    links);

  // 4. 病害虫（全ソース統合・重複除去）
  const diseasePests = dedup([
    ...extractDiseasePests(mainSrc, "data"),
    ...extractDiseasePests(addSrc, "additions"),
  ], "slug");
  write("disease-pests.csv",
    ["name", "nameKana", "category", "slug", "bodySizeMinMm", "bodySizeMaxMm", "descriptionHead", "source"],
    diseasePests);

  // 5. 効果データ（全ソース統合・複合キーで重複除去。effect-supplement は data.ts に吸収済み）
  // pest-links と同じ理由で additions2 / spray が同一 linkEffect を二重抽出するため dedup する。
  const effects = dedup([
    ...extractEffectsFromMain(mainSrc),
    ...extractEffectsFromAdditions(addSrc),
    ...extractEffectsFromAdditions2(add2Src),
    ...extractEffectsFromSpray(spraySrc),
  ], "pesticideSlug,diseasePestSlug");
  write("effects.csv",
    ["pesticideSlug", "diseasePestSlug", "preventionLevel", "treatmentLevel", "efficacyLevel", "persistenceLevel", "source"],
    effects);

  // 6. 剤型
  write("formulation-types.csv",
    ["code", "name", "description"],
    extractFormulationTypes(mainSrc));

  // 7. コラム
  write("columns.csv",
    ["slug", "title", "category", "contentHead"],
    extractColumns(mainSrc));

  // 8. 展着剤タイプ
  write("spreader-types.csv", ["code", "name", "slug", "descriptionHead"], extractSpreaderTypes(mainSrc));

  // 9. 展着剤⇔農薬紐付け
  write("spreader-links.csv", ["pesticideSlug", "spreaderTypeSlug"], extractSpreaderLinks(mainSrc));

  // 10. 混用不可データ
  const incomp = extractIncompatibilities(mainSrc);
  write("incompatibilities.csv", ["slug1", "slug2"], incomp);

  console.log("\n完了。prisma/validation/ に CSV を出力しました。");
  console.log("次のステップ:");
  console.log("  1. pesticides.csv の各製品をMAFF (https://pesticide.maff.go.jp/) で検索");
  console.log("  2. 公式データを maff-reference.csv に記入");
  console.log("  3. npx tsx prisma/validation/validate-against-maff.ts で自動突合");
}

main();
