import { NextRequest, NextResponse } from 'next/server'

/**
 * 忍者AdMax 広告用 iframe コンテンツを返す API。
 *
 * ## CSP 設計の基本方針
 *
 * 広告 SDK は passback 経由で任意の SSP（MicroAd / PubMatic / Rubicon /
 * OpenX / Criteo ...）のスクリプトを動的にロードする。passback チェーンは
 * オークションごとに変わるため、script-src をドメイン単位でホワイトリスト
 * 化すると新 SSP が入るたびに CSP 違反で広告が表示されなくなる
 * （whack-a-mole になる）。
 *
 * そこで:
 *
 * - **`script-src` は `https:` に広げる**（任意 HTTPS ソースを許可）。
 *   Prebid / RTB ベースの広告配信では業界標準の構成。
 * - **ただし `connect-src` / `frame-src` はホワイトリストを維持**する。
 *   スクリプト実行面（= 機能で必要）と、データ送信先・遷移先（= 悪用可能）を
 *   別レイヤで制限することで、万一 SDK 経由で未知の script が注入されても
 *   外部送信・フィッシングへの導線が残らない。
 * - **`default-src 'none'` / `object-src 'none'` / `base-uri 'none'`** は維持。
 *   プラグイン実行や base-URI 乗っ取りによる横移動は引き続き遮断。
 * - **`frame-ancestors 'self'`** と `X-Frame-Options: SAMEORIGIN` により、
 *   この iframe を外部サイトから埋め込めない。
 */

/**
 * 広告 iframe 内で外部送信を許可するホスト群。
 * 計測ピクセル・Cookie sync など「データを送り出す」先を明示的に列挙する。
 * 未知 SSP の connect は blocked になるが、代替 SSP のスクリプト実行自体は
 * 成立するので表示自体は破綻しない（最悪計測欠損のみ）。
 */
const AD_CONNECT_HOSTS = [
  'https://*.shinobi.jp',
  'https://cnobi.jp',
  'https://*.cnobi.jp',
  'https://*.googlesyndication.com',
  'https://*.doubleclick.net',
  'https://*.google-analytics.com',
  'https://*.im-apps.net',
  'https://*.criteo.net',
  'https://*.criteo.com',
  'https://*.pubmatic.com',
  'https://*.michao-ssp.com',
].join(' ')

const AD_FRAME_CSP_DIRECTIVES = [
  "default-src 'none'",
  // 忍者 AdMax の r.js は入札レスポンスを文字列として受け取り `eval` で評価する RTB 実装のため
  // `'unsafe-eval'` が必須。passback チェーンで任意 SSP のスクリプトが呼ばれるため
  // `https:` で HTTPS 全般を許可する（広告業界標準の構成）。
  // 親アプリの CSP（proxy.ts）には `'unsafe-eval'` 無し・厳格ホワイトリスト維持。
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  // 広告 SDK がインラインスタイルを挿入するので 'unsafe-inline' が必要
  "style-src 'self' 'unsafe-inline'",
  // 広告クリエイティブは多様な CDN から配信されるため img/font は広めに許可
  "img-src * data: blob:",
  "font-src * data:",
  // データ送信先は明示許可した SSP/DMP に限定（計測・sync が破綻する SSP は計測欠損のみ）
  `connect-src 'self' ${AD_CONNECT_HOSTS}`,
  // passback チェーンで ad-stir → Rubicon / GMO SSP / Index Exchange 等が
  // 任意に iframe を生成する。script-src 同様 `https:` で広く許可する。
  // 子 iframe 側には別途 CSP / SOP / X-Frame-Options が適用されるため、
  // 広げても親オリジンに到達する経路は増えない。
  "frame-src 'self' https:",
  "frame-ancestors 'self'",
  "base-uri 'none'",
  // object/embed は XSS の温床なので禁止
  "object-src 'none'",
  // form action も禁止（広告経由のフィッシング遷移を遮断）
  "form-action 'none'",
]

const AD_ID_PATTERN = /^[a-f0-9]{32}$/

export async function GET(request: NextRequest) {
  const adId = request.nextUrl.searchParams.get('id')

  if (!adId || !AD_ID_PATTERN.test(adId)) {
    return new NextResponse('Invalid ad ID', { status: 400 })
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;overflow:hidden;}</style>
</head>
<body>
<script type="text/javascript" charset="utf-8" src="https://adm.shinobi.jp/s/${adId}"><\/script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': AD_FRAME_CSP_DIRECTIVES.join('; '),
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    },
  })
}
