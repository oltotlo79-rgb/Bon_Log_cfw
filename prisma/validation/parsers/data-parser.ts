/**
 * seed-pesticide-data.ts 用パーサー（pMap/ingMap/dpMap形式, ダブルクォート）
 */

import { dedup } from "./csv-utils";

export function extractPesticidesFromMain(src: string) {
  const rows: Record<string, string>[] = [];
  // formulationTypeId は `ftMap["X"]`, `R(ftMap, "X")`, または別途解決された変数を許容する。
  const blockRe =
    /name:\s*"([^"]+)",\s*\n\s*registrationNumber:\s*("([^"]*?)"|null),\s*\n(?:\s*\/\/[^\n]*\n)*\s*pesticideType:\s*"([^"]+)",(?:\s*\/\/[^\n]*)?\s*\n\s*formulationTypeId:\s*(?:ftMap\["([^"]+)"\]|R\(ftMap,\s*"([^"]+)"\)|[^,]+),\s*\n\s*slug:\s*"([^"]+)",\s*\n\s*description:\s*\n?\s*"([^"]*?)"/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(src)) !== null) {
    rows.push({
      name: m[1] ?? "",
      registrationNumber: m[3] ?? "",
      pesticideType: m[4] ?? "",
      formulationType: m[5] ?? m[6] ?? "",
      slug: m[7] ?? "",
      description: m[8]?.slice(0, 120).replace(/\n/g, " ") ?? "",
      source: "data",
    });
  }
  return rows;
}

export function extractIngredientsFromMain(src: string) {
  const rows: Record<string, string>[] = [];
  const blockRe =
    /name:\s*"([^"]+)",\s*\n\s*nameEn:\s*"([^"]+)",\s*\n\s*(?:fracCode:\s*"([^"]*)",\s*\n\s*)?(?:iracCode:\s*"([^"]*)",\s*\n\s*)?ingredientGroup:\s*"([^"]+)",\s*\n\s*slug:\s*"([^"]+)",/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(src)) !== null) {
    const after = src.slice(m.index, m.index + 800);
    const rr = after.match(/resistanceRisk:\s*"([^"]+)"/);
    rows.push({
      name: m[1]!,
      nameEn: m[2]!,
      fracCode: m[3] ?? "",
      iracCode: m[4] ?? "",
      ingredientGroup: m[5]!,
      slug: m[6]!,
      resistanceRisk: rr ? rr[1]! : "",
      source: "data",
    });
  }
  return rows;
}

export function extractLinksFromMain(src: string) {
  const rows: Record<string, string>[] = [];
  // 旧 `pMap["X"]` と新 `R(pMap, "X")` の両形式をマッチさせる
  // (noUncheckedIndexedAccess 対応で map lookup を helper 経由に変更したため)。
  const re =
    /pesticideId:\s*(?:pMap\["([^"]+)"\]|R\(pMap,\s*"([^"]+)"\)),\s*(?:\n\s*)?activeIngredientId:\s*(?:ingMap\["([^"]+)"\]|R\(ingMap,\s*"([^"]+)"\)),\s*(?:\n\s*)?contentLabel:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    rows.push({
      pesticideSlug: m[1] ?? m[2] ?? "",
      ingredientSlug: m[3] ?? m[4] ?? "",
      contentLabel: m[5] ?? "",
      source: "data",
    });
  }
  return rows;
}

export function extractDiseasePests(src: string, sourceLabel: string) {
  const rows: Record<string, string>[] = [];
  const seen = new Set<string>();

  const blockRe =
    /name:\s*"([^"]+)",\s*\n\s*nameKana:\s*"([^"]*)",\s*\n\s*category:\s*"([^"]+)",\s*\n\s*description:\s*\n?\s*"([\s\S]*?)",\s*\n\s*slug:\s*"([^"]+)",/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(src)) !== null) {
    const slug = m[5]!;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const category = m[3]!;
    let bminVal = "";
    let bmaxVal = "";
    if (category === "pest" || category === "beneficial_insect") {
      const slugPos = src.indexOf(`slug: "${slug}"`, m.index);
      const searchEnd = src.indexOf("prisma.diseasePest", slugPos + 1);
      const narrow = src.slice(slugPos, searchEnd > 0 ? searchEnd : slugPos + 300);
      const bmin = narrow.match(/bodySizeMinMm:\s*([\d.]+)/);
      const bmax = narrow.match(/bodySizeMaxMm:\s*([\d.]+)/);
      bminVal = bmin ? bmin[1]! : "";
      bmaxVal = bmax ? bmax[1]! : "";
    }
    rows.push({
      name: m[1]!,
      nameKana: m[2]!,
      category,
      slug,
      bodySizeMinMm: bminVal,
      bodySizeMaxMm: bmaxVal,
      descriptionHead: m[4]!.slice(0, 150).replace(/\n/g, " "),
      source: sourceLabel,
    });
  }

  // additions.ts の配列形式（slug, name, ... bodySizeMinMm:）
  const arrRe =
    /slug:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)',\s*\n\s*nameKana:\s*'([^']*)',\s*\n\s*category:\s*'([^']+)'/g;
  let am: RegExpExecArray | null;
  while ((am = arrRe.exec(src)) !== null) {
    const slug = am[1]!;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const after = src.slice(am.index, am.index + 1500);
    const desc = after.match(/description:\s*\n?\s*'([\s\S]*?)'/);
    const bmin = after.match(/bodySizeMinMm:\s*([\d.]+)/);
    const bmax = after.match(/bodySizeMaxMm:\s*([\d.]+)/);
    rows.push({
      name: am[2]!,
      nameKana: am[3]!,
      category: am[4]!,
      slug,
      bodySizeMinMm: bmin ? bmin[1]! : "",
      bodySizeMaxMm: bmax ? bmax[1]! : "",
      descriptionHead: desc ? desc[1]!.slice(0, 150).replace(/\n/g, " ") : "",
      source: sourceLabel,
    });
  }

  return rows;
}

export function extractEffectsFromMain(src: string) {
  const rows: Record<string, string>[] = [];
  // 旧 `pMap["X"]`/`dpMap["X"]` と新 `R(pMap, "X")`/`R(dpMap, "X")` の両形式に対応
  const re =
    /pesticideId:\s*(?:pMap\["([^"]+)"\]|R\(pMap,\s*"([^"]+)"\)),\s*diseasePestId:\s*(?:dpMap\["([^"]+)"\]|R\(dpMap,\s*"([^"]+)"\))(?:,\s*preventionLevel:\s*"([^"]*)")?(?:,\s*treatmentLevel:\s*"([^"]*)")?(?:,\s*efficacyLevel:\s*"([^"]*)")?(?:,\s*persistenceLevel:\s*"([^"]*)")?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    // コメントアウト行を除外
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    const linePrefix = src.slice(lineStart, m.index).trim();
    if (linePrefix.startsWith("//")) continue;
    rows.push({
      pesticideSlug: m[1] ?? m[2] ?? "",
      diseasePestSlug: m[3] ?? m[4] ?? "",
      preventionLevel: m[5] ?? "",
      treatmentLevel: m[6] ?? "",
      efficacyLevel: m[7] ?? "",
      persistenceLevel: m[8] ?? "",
      source: "data",
    });
  }
  return rows;
}

export function extractFormulationTypes(src: string) {
  const rows: Record<string, string>[] = [];
  const re =
    /code:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*description:\s*"([^"]*?)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    rows.push({
      code: m[1]!,
      name: m[2]!,
      description: m[3]!.slice(0, 100),
    });
  }
  return rows;
}

export function extractColumns(src: string) {
  const rows: Record<string, string>[] = [];
  const re =
    /slug:\s*"([^"]+)",\s*\n\s*title:\s*"([^"]+)",\s*\n\s*content:\s*\n?\s*"([\s\S]*?)",\s*\n\s*category:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (!["management", "resistance", "organic", "basics", "calendar", "technique"].includes(m[4]!)) continue;
    rows.push({
      slug: m[1]!,
      title: m[2]!,
      category: m[4]!,
      contentHead: m[3]!.slice(0, 200).replace(/\n/g, "\\n"),
    });
  }
  return rows;
}

export function extractIncompatibilities(src: string) {
  const rows: Record<string, string>[] = [];
  const arrayDefs = new Map<string, string[]>();

  // 混用不可セクションのみを対象にする
  const sectionStart = src.indexOf("混用不可農薬データを生成中");
  const sectionSrc = sectionStart >= 0 ? src.slice(sectionStart) : src;

  // 配列定義を抽出: const varName = ["slug1", "slug2", ...];
  const arrRe = /const\s+(\w+)\s*(?::\s*string\[\])?\s*=\s*\[\s*\n?([\s\S]*?)\];/g;
  let am: RegExpExecArray | null;
  while ((am = arrRe.exec(sectionSrc)) !== null) {
    const slugs: string[] = [];
    const itemRe = /"([a-z][a-z0-9-]*)"/g;
    let im: RegExpExecArray | null;
    while ((im = itemRe.exec(am[2]!)) !== null) {
      slugs.push(im[1]!);
    }
    if (slugs.length > 0) {
      arrayDefs.set(am[1]!, slugs);
    }
  }

  // イテレータ変数→解決値を管理するスタック
  // 外側forEach変数を追跡
  const varBindings = new Map<string, string[]>();

  const lines = sectionSrc.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) continue;

    // outerArr.forEach((varName) => { — ブロック開始
    const outerStart = trimmed.match(/^(\w+)\.forEach\(\((\w+)\)\s*=>\s*\{$/);
    if (outerStart) {
      const arrSlugs = arrayDefs.get(outerStart[1]!) ?? [];
      varBindings.set(outerStart[2]!, arrSlugs);
      continue;
    }

    // innerArr.forEach((varName) => addIncompatibility(arg1, arg2))
    const innerMatch = trimmed.match(
      /(\w+)\.forEach\(\((\w+)\)\s*=>\s*addIncompatibility\(\s*([^,)]+?)\s*,\s*([^)]+?)\s*\)\)/
    );
    if (innerMatch) {
      const iterArrSlugs = arrayDefs.get(innerMatch[1]!) ?? [];
      const iterVar = innerMatch[2]!;
      const arg1Raw = innerMatch[3]!.replace(/["']/g, "").trim();
      const arg2Raw = innerMatch[4]!.replace(/["']/g, "").trim();

      const resolve = (raw: string, currentIterVar: string, currentItem: string): string[] => {
        if (raw === currentIterVar) return [currentItem];
        // 外側forEach変数の参照
        if (varBindings.has(raw)) return varBindings.get(raw)!;
        // 文字列リテラル（ハイフン含むslug）
        if (/^[a-z][a-z0-9-]*$/.test(raw)) return [raw];
        // 配列変数名
        if (arrayDefs.has(raw)) return arrayDefs.get(raw)!;
        return [];
      };

      for (const item of iterArrSlugs) {
        const a1s = resolve(arg1Raw, iterVar, item);
        const a2s = resolve(arg2Raw, iterVar, item);
        for (const a1 of a1s) {
          for (const a2 of a2s) {
            if (a1 && a2 && a1 !== a2) {
              rows.push({ slug1: a1, slug2: a2 });
              rows.push({ slug1: a2, slug2: a1 });
            }
          }
        }
      }
      continue;
    }
  }

  return dedup(rows, "slug1,slug2");
}

/** 展着剤タイプを抽出 */
export function extractSpreaderTypes(src: string) {
  const rows: Record<string, string>[] = [];
  const spreaderSection = src.match(/const spreaderTypes = \[([\s\S]*?)\];/);
  if (spreaderSection) {
    const spEntryRe = /code:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?slug:\s*"([^"]+)"[\s\S]*?sortOrder:\s*(\d+)/g;
    let sm: RegExpExecArray | null;
    // spreaderSection[1] は if(spreaderSection) で保証済み
    while ((sm = spEntryRe.exec(spreaderSection[1]!)) !== null) {
      rows.push({ code: sm[1]!, name: sm[2]!, slug: sm[3]!, descriptionHead: "" });
    }
  }
  return rows;
}

/** 展着剤⇔農薬紐付けを抽出 */
export function extractSpreaderLinks(src: string) {
  const rows: Record<string, string>[] = [];
  // seed-pesticide-data.ts は `pesticideId: R(pMap, "slug")` または `pesticideId: pMap["slug"]` の
  // どちらの形式も使い得るため、両方を受け付ける (R() は pMap から id を取り出す helper)。
  const re = /pesticideId:\s*(?:R\(pMap,\s*"([^"]+)"\)|pMap\["([^"]+)"\]),\s*spreaderTypeId:[\s\S]*?slug:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const pesticideSlug = m[1] ?? m[2];
    if (pesticideSlug) {
      rows.push({ pesticideSlug, spreaderTypeSlug: m[3]! });
    }
  }
  return rows;
}

/** 展着剤製品を抽出（validate用） */
export function extractSpreaderPesticides(src: string) {
  const rows: { slug: string; name: string; regNumber: string; pesticideType: string }[] = [];
  const spSection = src.match(/展着剤製品（紐付け用に先行登録）[\s\S]*?as const/);
  if (spSection) {
    const re = /slug:\s*"([a-z0-9-]+)",\s*name:\s*"([^"]+)",\s*reg:\s*(?:"([^"]+)"|null)/g;
    let m: RegExpExecArray | null;
    // spSection[0] は if(spSection) で保証済み
    while ((m = re.exec(spSection[0]!)) !== null) {
      rows.push({ slug: m[1]!, name: m[2]!, regNumber: m[3] ?? "", pesticideType: "other" });
    }
  }
  return rows;
}
