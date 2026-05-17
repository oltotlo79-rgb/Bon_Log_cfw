/**
 * CSV読み書きユーティリティ
 */

/** Record配列をCSV文字列に変換（BOM付き、Excel互換） */
export function toCsv(headers: string[], rows: Record<string, string>[]): string {
  const escape = (v: string) => {
    if (!v) return "";
    return v.includes(",") || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h] ?? "")).join(","));
  }
  return "\uFEFF" + lines.join("\n") + "\n";
}

/** slug キーで重複除去（カンマ区切りの複合キーに対応） */
export function dedup(rows: Record<string, string>[], key: string): Record<string, string>[] {
  const seen = new Set<string>();
  const keys = key.split(",");
  return rows.filter((r) => {
    const val = keys.map((k) => r[k] ?? "").join("|");
    if (seen.has(val)) return false;
    seen.add(val);
    return true;
  });
}

/**
 * RFC 4180 準拠のCSVフィールド分割。
 * ダブルクォートで囲まれたフィールド内のカンマ・改行を正しく処理する。
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // エスケープされたダブルクォート
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/** CSV文字列をRecord配列にパース（BOM対応、RFC 4180クォート対応） */
export function parseCsv(content: string): Record<string, string>[] {
  const lines = content.trim().split("\n");
  if (lines.length < 2) return [];
  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = splitCsvLine(headerLine);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => { row[h] = vals[j] ?? ""; });
    rows.push(row);
  }
  return rows;
}
