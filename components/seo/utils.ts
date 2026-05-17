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
