/**
 * seed-pesticide-additions2.ts 用パーサー (ensurePesticide / ensureIngredient 形式)。
 * シングル/ダブルクォート両方の表記を受け付ける (seed 内で混在しているため)。
 */

/** 引用符を捕捉する正規表現フラグメント。シングル/ダブル混在対応。 */
const QUOTE = `["']`

export function extractPesticidesFromAdditions2(src: string) {
  const rows: Record<string, string>[] = [];
  const re = new RegExp(
    `ensurePesticide\\(\\{\\s*\\n?\\s*slug:\\s*${QUOTE}([^"']+)${QUOTE},\\s*name:\\s*${QUOTE}([^"']+)${QUOTE},\\s*registrationNumber:\\s*(${QUOTE}([^"']*)${QUOTE}|null)`,
    'g',
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const after = src.slice(m.index, m.index + 400);
    const pt = after.match(new RegExp(`pesticideType:\\s*${QUOTE}([^"']+)${QUOTE}`));
    const ft = after.match(new RegExp(`formulationTypeCode:\\s*${QUOTE}([^"']+)${QUOTE}`));
    rows.push({
      name: m[2],
      slug: m[1],
      registrationNumber: m[4] ?? "",
      pesticideType: pt ? pt[1] : "",
      formulationType: ft ? ft[1] : "",
      description: "",
      source: "additions2",
    });
  }
  return rows;
}

export function extractIngredientsFromAdditions2(src: string) {
  const rows: Record<string, string>[] = [];
  // ensureIngredient と ensureActiveIngredient の両方を対象にする
  const re = /ensure(?:Active)?Ingredient\(\{\s*\n?\s*slug:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*nameEn:\s*"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const nextCall = src.indexOf("await ensure", m.index + 10);
    const blockEnd = nextCall > 0 ? nextCall : m.index + 600;
    const block = src.slice(m.index, blockEnd);
    const fc = block.match(/fracCode:\s*"([^"]+)"/);
    const ic = block.match(/iracCode:\s*"([^"]+)"/);
    const ig = block.match(/ingredientGroup:\s*"([^"]+)"/);
    const rr = block.match(/resistanceRisk:\s*"([^"]+)"/);
    rows.push({
      name: m[2],
      nameEn: m[3],
      fracCode: fc ? fc[1] : "",
      iracCode: ic ? ic[1] : "",
      ingredientGroup: ig ? ig[1] : "",
      slug: m[1],
      resistanceRisk: rr ? rr[1] : "",
      source: "additions2",
    });
  }
  return rows;
}

export function extractLinksFromAdditions2(src: string) {
  const rows: Record<string, string>[] = [];
  let m: RegExpExecArray | null;

  // 変数→slug マッピング
  const pestVarMap = new Map<string, string>();
  const re0 = /const\s+(\w+)\s*=\s*await\s+ensurePesticide\(\{\s*\n?\s*slug:\s*['"]([^'"]+)['"]/g;
  while ((m = re0.exec(src)) !== null) {
    pestVarMap.set(m[1], m[2]);
  }
  // ensureSprayProduct も農薬製品として扱う（ベニカXスプレー等）
  const re0s = /const\s+(\w+)\s*=\s*await\s+ensureSprayProduct\(\{\s*\n?\s*slug:\s*['"]([^'"]+)['"]/g;
  while ((m = re0s.exec(src)) !== null) {
    pestVarMap.set(m[1], m[2]);
  }
  const re0p = /const\s+(\w+)\s*=\s*await\s+prisma\.pesticide\.findUnique\(\{\s*where:\s*\{\s*slug:\s*['"]([^'"]+)['"]\s*\}\s*\}\)/g;
  while ((m = re0p.exec(src)) !== null) {
    pestVarMap.set(m[1], m[2]);
  }
  const ingVarMap = new Map<string, string>();
  const re0i = /const\s+(\w+)\s*=\s*await\s+ensure(?:Active)?Ingredient\(\{\s*\n?\s*slug:\s*['"]([^'"]+)['"]/g;
  while ((m = re0i.exec(src)) !== null) {
    ingVarMap.set(m[1], m[2]);
  }

  // パターン1: linkIngredient(varName, <mapName>["slug"], "X%") または linkIngredient(varName, <mapName>['slug'], 'X%')
  // <mapName> は ingMap / p4ing / その他局所マップを全て受け付ける。
  const re1 = /linkIngredient\((\w+),\s*\w+\[['"]([^'"]+)['"]\],\s*['"]([^'"]+)['"]\)/g;
  while ((m = re1.exec(src)) !== null) {
    const pSlug = pestVarMap.get(m[1]);
    if (pSlug) {
      rows.push({ pesticideSlug: pSlug, ingredientSlug: m[2], contentLabel: m[3], source: "additions2" });
    }
  }

  // パターン2: linkIngredient(varName, ingVarName, "X%") — ingredient is local variable
  const re2 = /linkIngredient\((\w+),\s*(\w+),\s*['"]([^'"]+)['"]\)/g;
  while ((m = re2.exec(src)) !== null) {
    const pSlug = pestVarMap.get(m[1]);
    const iSlug = ingVarMap.get(m[2]);
    if (pSlug && iSlug) {
      rows.push({ pesticideSlug: pSlug, ingredientSlug: iSlug, contentLabel: m[3], source: "additions2" });
    }
  }

  // パターン3: linkIngredient(varName, (await prisma...slug: "xxx")...id, "Y%")
  const re3 = /linkIngredient\((\w+),\s*\(await\s+prisma\.activeIngredient\.findUnique\(\{\s*where:\s*\{\s*slug:\s*"([^"]+)"\s*\}\s*\}\)\)!?\.id,\s*"([^"]+)"\)/g;
  while ((m = re3.exec(src)) !== null) {
    const pSlug = pestVarMap.get(m[1]);
    if (pSlug) {
      rows.push({ pesticideSlug: pSlug, ingredientSlug: m[2], contentLabel: m[3], source: "additions2" });
    }
  }

  // パターン4: linkIngredient(varName.id, ingVarName.id, 'X%') — .id suffix and single quotes
  const re4 = /linkIngredient\((\w+)\.id,\s*(\w+)\.id,\s*['"]([^'"]+)['"]\)/g;
  while ((m = re4.exec(src)) !== null) {
    const pSlug = pestVarMap.get(m[1]);
    const iSlug = ingVarMap.get(m[2]);
    if (pSlug && iSlug) {
      rows.push({ pesticideSlug: pSlug, ingredientSlug: iSlug, contentLabel: m[3], source: "additions2" });
    }
  }

  // パターン5: linkIngredient(pestVar, ingVar.id, 'X%')
  // ensurePesticide は string id を返すため pest 側に .id が付かないが、ingredient は findUnique 経由で
  // optional のため `.id` を必要とするケース (benica-x-fine-aerosol → mepanipyrim 等)。
  const re5 = /linkIngredient\((\w+),\s*(\w+)\.id,\s*['"]([^'"]+)['"]\)/g;
  while ((m = re5.exec(src)) !== null) {
    const pSlug = pestVarMap.get(m[1]);
    const iSlug = ingVarMap.get(m[2]);
    if (pSlug && iSlug) {
      rows.push({ pesticideSlug: pSlug, ingredientSlug: iSlug, contentLabel: m[3], source: "additions2" });
    }
  }

  // findUnique で取得した ingredient 変数 (例: `const ingMepanipyrimP4 = await prisma.activeIngredient.findUnique({slug:'mepanipyrim'})`)
  // を ingredient 変数として追加で登録し、re5 で拾えなかった `if (var) ... linkIngredient(pest, var.id, 'X%')` パターン
  // を補足する。
  const re0fa = /const\s+(\w+)\s*=\s*await\s+prisma\.activeIngredient\.findUnique\(\{\s*where:\s*\{\s*slug:\s*['"]([^'"]+)['"]\s*\}\s*\}\)/g;
  const ingFaMap = new Map<string, string>();
  while ((m = re0fa.exec(src)) !== null) {
    ingFaMap.set(m[1], m[2]);
  }
  const seen = new Set(rows.map((r) => `${r.pesticideSlug}|${r.ingredientSlug}`));
  const re6 = /linkIngredient\((\w+),\s*(\w+)\.id,\s*['"]([^'"]+)['"]\)/g;
  while ((m = re6.exec(src)) !== null) {
    const pSlug = pestVarMap.get(m[1]);
    const iSlug = ingFaMap.get(m[2]);
    if (pSlug && iSlug && !seen.has(`${pSlug}|${iSlug}`)) {
      rows.push({ pesticideSlug: pSlug, ingredientSlug: iSlug, contentLabel: m[3], source: "additions2" });
      seen.add(`${pSlug}|${iSlug}`);
    }
  }

  return rows;
}

export function extractEffectsFromAdditions2(src: string) {
  const rows: Record<string, string>[] = [];
  const pestVarMap = new Map<string, string>();

  // パターン1: const varName = await ensurePesticide({ slug: "xxx" ... })
  const re0 = /const\s+(\w+)\s*=\s*await\s+ensurePesticide\(\{\s*\n?\s*slug:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re0.exec(src)) !== null) {
    pestVarMap.set(m[1], m[2]);
  }

  // パターン2: const varName = await ensureSprayProduct({ slug: 'xxx' ... })
  const re0s = /const\s+(\w+)\s*=\s*await\s+ensureSprayProduct\(\{\s*\n?\s*slug:\s*['"]([^'"]+)['"]/g;
  while ((m = re0s.exec(src)) !== null) {
    pestVarMap.set(m[1], m[2]);
  }

  // パターン3: const varName = await prisma.pesticide.findUnique({ where: { slug: 'xxx' } })
  const re0p = /const\s+(\w+)\s*=\s*await\s+prisma\.pesticide\.findUnique\(\{\s*where:\s*\{\s*slug:\s*['"]([^'"]+)['"]\s*\}\s*\}\)/g;
  while ((m = re0p.exec(src)) !== null) {
    pestVarMap.set(m[1], m[2]);
  }

  function parseEffectProps(props: string) {
    const prev = props.match(/preventionLevel:\s*['"]([^'"]+)['"]/);
    const treat = props.match(/treatmentLevel:\s*['"]([^'"]+)['"]/);
    const eff = props.match(/efficacyLevel:\s*['"]([^'"]+)['"]/);
    const pers = props.match(/persistenceLevel:\s*['"]([^'"]+)['"]/);
    return {
      preventionLevel: prev ? prev[1] : "",
      treatmentLevel: treat ? treat[1] : "",
      efficacyLevel: eff ? eff[1] : "",
      persistenceLevel: pers ? pers[1] : "",
    };
  }

  // 全 linkEffect 呼び出しを統一パターンで抽出
  // linkEffect(varName, "slug", { ... })  — varName は変数名そのまま
  // linkEffect(varName.id, 'slug', { ... }) — .id suffix付き
  const reAll = /linkEffect\((\w+?)(?:\.id)?,\s*['"]([^'"]+)['"]\s*,\s*\{([^}]*)\}/g;
  while ((m = reAll.exec(src)) !== null) {
    // コメントアウト行を除外
    const lineStart = src.lastIndexOf("\n", m.index) + 1;
    const linePrefix = src.slice(lineStart, m.index).trim();
    if (linePrefix.startsWith("//")) continue;

    const varName = m[1];
    const pSlug = pestVarMap.get(varName);
    if (!pSlug) continue;
    const parsed = parseEffectProps(m[3]);
    rows.push({
      pesticideSlug: pSlug,
      diseasePestSlug: m[2],
      ...parsed,
      source: "additions2",
    });
  }
  return rows;
}
