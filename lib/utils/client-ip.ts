/**
 * @module lib/utils/client-ip
 *
 * リクエストヘッダーから「信頼できる」クライアント IP を抽出する共通ロジック。
 *
 * Why centralized: rate-limit / seed-auth / Server Action helper の 3 箇所で
 * 同じ目的のロジックが分散しており、過去には片方が `x-forwarded-for` の先頭を
 * 採用していた (= クライアントが偽装可能) ため、レート制限と監査ログで異なる
 * IP が記録される矛盾が発生していた。シングルソース化して信頼モデルを統一する。
 *
 * 優先順位:
 *   1. `cf-connecting-ip` — Cloudflare 経由時のみ存在。Cloudflare が付与するため偽装不可
 *   2. `x-vercel-forwarded-for` — Vercel 経由時のみ存在。Vercel が付与するため偽装不可
 *   3. `x-forwarded-for` — 末尾は最寄りプロキシ自身の IP。末尾から 2 番目が
 *      「最外プロキシが見た接続元」= 信頼できるクライアント IP。
 *      ただし要素が 2 個以下のとき (single-hop) は末尾から 2 番目が無いため
 *      先頭を採用する (この場合は信頼できる proxy が 1 段以下しか無いと仮定)。
 *   4. `x-real-ip` — Nginx などが付与。プロキシが信頼できる場合のみ意味を持つ。
 *   5. `'unknown'` — どのヘッダーも無いとき。allowlist チェックでは絶対に
 *      マッチしないため、null の代わりに使ってもセキュリティ上等価。
 */

/** ヘッダー取得関数を渡して、信頼できるクライアント IP を抽出する。 */
export function extractClientIp(getHeader: (name: string) => string | null): string {
  const cfIp = getHeader('cf-connecting-ip')
  if (cfIp) return cfIp

  const vercelIp = getHeader('x-vercel-forwarded-for')
  if (vercelIp) {
    const first = vercelIp.split(',')[0]?.trim()
    if (first) return first
  }

  const xForwardedFor = getHeader('x-forwarded-for')
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',').map((ip) => ip.trim()).filter(Boolean)
    const candidate = ips.length > 2 ? ips[ips.length - 2] : ips[0]
    if (candidate) return candidate
  }

  const xRealIp = getHeader('x-real-ip')
  if (xRealIp) return xRealIp

  return 'unknown'
}

/** Web標準 `Request` 互換オブジェクトから信頼できるクライアント IP を取得する。 */
export function getClientIpFromRequest(request: Request): string {
  return extractClientIp((name) => request.headers.get(name))
}
