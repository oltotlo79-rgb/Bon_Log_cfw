/**
 * JSON-LDを `<script type="application/ld+json">` に安全に埋め込むためのシリアライズ。
 *
 * JSON.stringify は `<` `>` `&` をエスケープしないため、
 * ユーザー入力に `</script>` が含まれるとスクリプトタグを脱出してXSSが成立しうる。
 * Unicode エスケープで HTML特殊文字を無害化する（Google 推奨方式）。
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script#embedding_data_in_html
 */
export function safeJsonLdStringify(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

/**
 * 自由記述の入場料テキストを schema.org `Offer.price`（数値文字列）に正規化する。
 *
 * schema.org の `price` は数値を要求するため、"無料" / "前売1,000円" のような
 * 日本語自由記述をそのまま渡すと Rich Results が無効判定になる。
 * - 無料表記 → "0"
 * - 数値を含む → 最初の数値（カンマ除去）を採用（"前売1,000円" → "1000"）
 * - 数値を抽出できない（"応相談" 等）→ null（offers 自体を省略させる）
 */
export function parseAdmissionFeeToOfferPrice(raw: string | null | undefined): string | null {
  if (!raw) return null
  const text = raw.trim()
  if (!text) return null
  if (/無料|むりょう|free/i.test(text)) return '0'
  const match = text.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  return match ? match[0] : null
}

/**
 * 値が schema.org `openingHours` のトークン形式（例: "Mo-Fr 09:00-17:00"）か判定する。
 *
 * 店舗の営業時間は自由記述（"平日9:00〜18:00 土日祝休み" 等）で保存されるため、
 * そのまま `openingHours` に渡すと無効な構造化データになる。トークン形式に
 * 厳密一致する場合のみ true を返し、それ以外は呼び出し側で省略させる。
 */
export function isSchemaOrgOpeningHours(value: string): boolean {
  const day = '(?:Mo|Tu|We|Th|Fr|Sa|Su)'
  const dayRange = `${day}(?:-${day})?`
  const days = `${dayRange}(?:,${dayRange})*`
  const timeRange = '\\d{2}:\\d{2}-\\d{2}:\\d{2}'
  const spec = `${days}\\s+${timeRange}(?:,${timeRange})*`
  return new RegExp(`^${spec}(?:\\s*;\\s*${spec})*$`).test(value.trim())
}
