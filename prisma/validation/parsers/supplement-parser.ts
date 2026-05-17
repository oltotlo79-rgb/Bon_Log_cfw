/**
 * seed-pesticide-effect-supplement.ts 用パーサー（link()関数形式）
 *
 * ※ effect-supplement のデータは seed-pesticide-data.ts に吸収済み。
 *   このパーサーは現在使用されていないが、互換性のため残している。
 */

export function extractEffectsFromSupplement(src: string) {
  const rows: Record<string, string>[] = [];
  const re = /link\(\s*'([^']+)',\s*'([^']+)',\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const props = m[3];
    const prev = props.match(/preventionLevel:\s*'([^']+)'/);
    const treat = props.match(/treatmentLevel:\s*'([^']+)'/);
    const eff = props.match(/efficacyLevel:\s*'([^']+)'/);
    const pers = props.match(/persistenceLevel:\s*'([^']+)'/);
    rows.push({
      pesticideSlug: m[1],
      diseasePestSlug: m[2],
      preventionLevel: prev ? prev[1] : "",
      treatmentLevel: treat ? treat[1] : "",
      efficacyLevel: eff ? eff[1] : "",
      persistenceLevel: pers ? pers[1] : "",
      source: "supplement",
    });
  }
  return rows;
}
