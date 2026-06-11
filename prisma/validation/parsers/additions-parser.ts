/**
 * seed-pesticide-additions.ts 用パーサー（pMap/aiMap/dpMap + 配列形式, シングルクォート）
 */

export function extractPesticidesFromAdditions(src: string) {
  const rows: Record<string, string>[] = [];
  const re = /slug:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)',\s*\n\s*registrationNumber:\s*('([^']*)'|null)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const after = src.slice(m.index, m.index + 400);
    const pt = after.match(/pesticideType:\s*'([^']+)'/);
    const ft = after.match(/formulationTypeCode:\s*'([^']+)'/);
    if (pt) {
      rows.push({
        name: m[2]!,
        slug: m[1]!,
        registrationNumber: m[4] ?? "",
        pesticideType: pt[1]!,
        formulationType: ft ? ft[1]! : "",
        description: "",
        source: "additions",
      });
    }
  }
  return rows;
}

export function extractIngredientsFromAdditions(src: string) {
  const rows: Record<string, string>[] = [];
  const re = /slug:\s*'([^']+)',\s*\n\s*name:\s*'([^']+)',\s*\n\s*nameEn:\s*'([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    // 次のエントリ境界(次の slug: or 閉じ括弧)までに限定し、隣接エントリのコード誤取得を防止
    const nextSlug = src.indexOf("slug:", m.index + 10);
    const blockEnd = nextSlug > 0 ? nextSlug : m.index + 800;
    const block = src.slice(m.index, blockEnd);
    const fc = block.match(/fracCode:\s*'([^']+)'/);
    const ic = block.match(/iracCode:\s*'([^']+)'/);
    const ig = block.match(/ingredientGroup:\s*'([^']+)'/);
    const rr = block.match(/resistanceRisk:\s*'([^']+)'/);
    // ingredientGroupがなければ農薬定義であって有効成分定義ではない
    if (!ig) continue;
    rows.push({
      name: m[2]!,
      nameEn: m[3]!,
      fracCode: fc ? fc[1]! : "",
      iracCode: ic ? ic[1]! : "",
      ingredientGroup: ig[1]!,
      slug: m[1]!,
      resistanceRisk: rr ? rr[1]! : "",
      source: "additions",
    });
  }
  return rows;
}

export function extractLinksFromAdditions(src: string) {
  const rows: Record<string, string>[] = [];
  // パターン: pMap['slug'], activeIngredientId: aiMap['slug'], contentLabel: 'X%'
  const re = /pesticideId:\s*pMap\['([^']+)'\],\s*activeIngredientId:\s*aiMap\['([^']+)'\](?:,\s*contentLabel:\s*'([^']*)')?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    rows.push({
      pesticideSlug: m[1]!,
      ingredientSlug: m[2]!,
      contentLabel: m[3] ?? "",
      source: "additions",
    });
  }
  return rows;
}

export function extractEffectsFromAdditions(src: string) {
  const rows: Record<string, string>[] = [];

  function extractRating(block: string, field: string): string {
    const re = new RegExp(field + ":\\s*['\"]?(\\w+)['\"]?\\s*(?:as\\s+\\w+)?");
    const m = re.exec(block);
    return m ? m[1]! : "";
  }

  // パターン1: pMap["slug"] or pMap['slug'], dpMap["slug"] or dpMap['slug'] 形式
  const re =
    /pesticideId:\s*pMap\[['"]([^'"]+)['"]\],\s*(?:\n\s*)?diseasePestId:\s*dpMap\[['"]([^'"]+)['"]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    // コメント行を除外
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    if (src.slice(lineStart, m.index).trim().startsWith("//")) continue;
    // マッチ位置から閉じ括弧 } まで（最大300文字）のブロックを取得
    const blockEnd = src.indexOf("}", m.index);
    const block = src.slice(m.index, blockEnd > 0 ? blockEnd + 1 : m.index + 300);
    rows.push({
      pesticideSlug: m[1]!,
      diseasePestSlug: m[2]!,
      preventionLevel: extractRating(block, "preventionLevel"),
      treatmentLevel: extractRating(block, "treatmentLevel"),
      efficacyLevel: extractRating(block, "efficacyLevel"),
      persistenceLevel: extractRating(block, "persistenceLevel"),
      source: "additions",
    });
  }
  // パターン2: pesticideSlug: 'slug', diseasePestSlug: 'slug' 形式（配列format）
  const re2 =
    /pesticideSlug:\s*'([^']+)',\s*diseasePestSlug:\s*'([^']+)'(?:,\s*efficacyLevel:\s*'([^']+)')?(?:,\s*persistenceLevel:\s*'([^']+)')?/g;
  while ((m = re2.exec(src)) !== null) {
    rows.push({
      pesticideSlug: m[1] ?? "",
      diseasePestSlug: m[2] ?? "",
      preventionLevel: "",
      treatmentLevel: "",
      efficacyLevel: m[3] ?? "",
      persistenceLevel: m[4] ?? "",
      source: "additions",
    });
  }

  // パターン3: kariEffectSpecs スタイル（slug ベース + spec 配列）。
  // noUncheckedIndexedAccess 対応で `[{ pesticideId: pMap['X'], ... }]` 形式を
  // `kariEffectSpecs.flatMap((spec) => ...)` 形式に書き換えたため、追加で対応する。
  // 親スコープから `${prefix}PesticideId` 形式の変数名で pesticide slug を解決する。
  const specsBlockRe =
    /const\s+(\w+)PesticideId\s*=\s*pMap\['([^']+)'\]\s*[\s\S]*?const\s+\w+Specs[^=]*=\s*\[([\s\S]*?)\]\s*\n\s*const\s+\w+Effects\s*=/g;
  let specsMatch: RegExpExecArray | null;
  while ((specsMatch = specsBlockRe.exec(src)) !== null) {
    const pesticideSlug = specsMatch[2] ?? "";
    const specsBlock = specsMatch[3] ?? "";
    const entryRe =
      /\{\s*slug:\s*'([^']+)'(?:[^}]*?preventionLevel:\s*'([^']+)')?(?:[^}]*?treatmentLevel:\s*'([^']+)')?(?:[^}]*?efficacyLevel:\s*'([^']+)')?(?:[^}]*?persistenceLevel:\s*'([^']+)')?[^}]*?\}/g;
    let em: RegExpExecArray | null;
    while ((em = entryRe.exec(specsBlock)) !== null) {
      rows.push({
        pesticideSlug,
        diseasePestSlug: em[1] ?? "",
        preventionLevel: em[2] ?? "",
        treatmentLevel: em[3] ?? "",
        efficacyLevel: em[4] ?? "",
        persistenceLevel: em[5] ?? "",
        source: "additions",
      });
    }
  }

  return rows;
}
