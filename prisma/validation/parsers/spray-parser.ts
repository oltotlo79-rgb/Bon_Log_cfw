/**
 * スプレー部分用パーサー（ensureSprayProduct/ensureActiveIngredient形式, シングルクォート）
 */

export function extractPesticidesFromSpray(src: string) {
  const rows: Record<string, string>[] = [];
  const re = /slug:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)',\s*\n\s*registrationNumber:\s*('([^']*)'|null)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const after = src.slice(m.index, m.index + 800);
    const pt = after.match(/pesticideType:\s*'([^']+)'/);
    rows.push({
      name: m[2]!,
      slug: m[1]!,
      registrationNumber: m[4] ?? "",
      pesticideType: pt ? pt[1]! : "",
      formulationType: "",
      description: "",
      source: "spray",
    });
  }
  return rows;
}

export function extractIngredientsFromSpray(src: string) {
  const rows: Record<string, string>[] = [];
  // slug が { の直後にある単一引用符パターンのみ対象（ダブルクォート版は additions2-parser が処理）
  const re = /ensureActiveIngredient\(\{\s*\n?\s*slug:\s*'([^']+)'[\s\S]*?\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const block = m[0];
    const name = block.match(/name:\s*'([^']+)'/);
    const nameEn = block.match(/nameEn:\s*'([^']+)'/);
    const fc = block.match(/fracCode:\s*'([^']+)'/);
    const ic = block.match(/iracCode:\s*'([^']+)'/);
    const ig = block.match(/ingredientGroup:\s*'([^']+)'/);
    const rr = block.match(/resistanceRisk:\s*'([^']+)'/);
    rows.push({
      name: name ? name[1]! : "",
      nameEn: nameEn ? nameEn[1]! : "",
      fracCode: fc ? fc[1]! : "",
      iracCode: ic ? ic[1]! : "",
      ingredientGroup: ig ? ig[1]! : "",
      slug: m[1]!,
      resistanceRisk: rr ? rr[1]! : "",
      source: "spray",
    });
  }
  return rows;
}

export function extractLinksFromSpray(src: string) {
  const rows: Record<string, string>[] = [];
  const pestVarMap = new Map<string, string>();
  // slug が { の直後（改行・空白のみ）にある場合のみ捕捉 — 他の定義ブロックを越境しない
  const re1 = /const\s+(\w+)\s*=\s*await\s+ensureSprayProduct\(\{\s*\n?\s*slug:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(src)) !== null) {
    pestVarMap.set(m[1]!, m[2]!);
  }
  const ingVarMap = new Map<string, string>();
  const re2 = /const\s+(\w+)\s*=\s*await\s+ensureActiveIngredient\(\{\s*\n?\s*slug:\s*'([^']+)'/g;
  while ((m = re2.exec(src)) !== null) {
    ingVarMap.set(m[1]!, m[2]!);
  }
  const re3 = /const\s+(\w+)\s*=\s*await\s+prisma\.activeIngredient\.findUnique\(\{\s*where:\s*\{\s*slug:\s*'([^']+)'/g;
  while ((m = re3.exec(src)) !== null) {
    ingVarMap.set(m[1]!, m[2]!);
  }
  const re4 = /linkIngredient\(\s*(\w+)\.id,\s*(\w+)!?\.id,\s*'([^']+)'\s*\)/g;
  while ((m = re4.exec(src)) !== null) {
    const pSlug = pestVarMap.get(m[1]!);
    const iSlug = ingVarMap.get(m[2]!);
    if (pSlug && iSlug) {
      rows.push({ pesticideSlug: pSlug, ingredientSlug: iSlug, contentLabel: m[3]!, source: "spray" });
    }
  }
  return rows;
}

export function extractEffectsFromSpray(src: string) {
  const rows: Record<string, string>[] = [];
  const pestVarMap = new Map<string, string>();
  // slug が { の直後にある場合のみ（単一引用符専用、越境防止）
  const re0 = /const\s+(\w+)\s*=\s*await\s+ensureSprayProduct\(\{\s*\n?\s*slug:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re0.exec(src)) !== null) {
    pestVarMap.set(m[1]!, m[2]!);
  }
  const re = /linkEffect\(\s*(\w+)\.id,\s*'([^']+)',\s*\{([^}]*)\}/g;
  while ((m = re.exec(src)) !== null) {
    const pSlug = pestVarMap.get(m[1]!);
    if (!pSlug) continue;
    const props = m[3]!;
    const prev = props.match(/preventionLevel:\s*'([^']+)'/);
    const treat = props.match(/treatmentLevel:\s*'([^']+)'/);
    const eff = props.match(/efficacyLevel:\s*'([^']+)'/);
    const pers = props.match(/persistenceLevel:\s*'([^']+)'/);
    rows.push({
      pesticideSlug: pSlug,
      diseasePestSlug: m[2]!,
      preventionLevel: prev ? prev[1]! : "",
      treatmentLevel: treat ? treat[1]! : "",
      efficacyLevel: eff ? eff[1]! : "",
      persistenceLevel: pers ? pers[1]! : "",
      source: "spray",
    });
  }
  return rows;
}

/** validate用: 変数名→slugマッピング構築 */
export function buildSprayVarToSlugMap(src: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /const\s+(\w+)\s*=\s*await\s+ensureSprayProduct\(\{\s*\n?\s*slug:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) map.set(m[1]!, m[2]!);
  return map;
}

/** validate用: 成分変数名→slugマッピング構築 */
export function buildSprayIngVarMap(src: string): Map<string, string> {
  const map = new Map<string, string>();
  const re1 = /const\s+(\w+)\s*=\s*await\s+ensureActiveIngredient\(\{\s*\n?\s*slug:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re1.exec(src)) !== null) map.set(m[1]!, m[2]!);
  const re2 = /const\s+(\w+)\s*=\s*await\s+prisma\.activeIngredient\.findUnique\(\{\s*where:\s*\{\s*slug:\s*'([^']+)'/g;
  while ((m = re2.exec(src)) !== null) map.set(m[1]!, m[2]!);
  return map;
}

/** validate用: linkIngredient呼び出しの生パース */
export function extractSprayLinksRaw(src: string) {
  const links: { pesticideVar: string; ingredientVar: string; contentLabel: string }[] = [];
  const re = /linkIngredient\(\s*(\w+)\.id,\s*(\w+)!?\.id,\s*'([^']+)'\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    links.push({ pesticideVar: m[1]!, ingredientVar: m[2]!, contentLabel: m[3]! });
  }
  return links;
}
