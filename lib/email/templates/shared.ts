/**
 * メール HTML テンプレートの共通パーツ。
 *
 * 各テンプレート間で重複するヘッダー・フッター・CTA ボタン・全体ラッパーを集約する。
 * 色・余白・フォントなどのブランド定義もここに寄せることで、
 * デザイン変更時の修正箇所を 1 箇所にまとめる。
 *
 * @module lib/email/templates/shared
 */

export const EMAIL_BRAND = {
  name: 'BON-LOG',
  tagline: '盆栽愛好家のためのSNS',
  gradient: 'linear-gradient(135deg, #2d5016 0%, #4a7c23 100%)',
  primary: '#4a7c23',
  primaryDark: '#2d5016',
  headerTextSecondary: '#e8f5e9',
} as const

const FONT_STACK = `'Hiragino Sans', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif`

/**
 * HTML ドキュメント全体を組み立てる。
 * title は &lt;title&gt; タグに入るため呼び出し側で必ず escapeHtml しておくこと。
 */
export function renderEmailShell(title: string, bodyInner: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: ${FONT_STACK}; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
${renderHeader()}
${bodyInner}
${renderFooter()}
</body>
</html>
`
}

function renderHeader(): string {
  return `  <div style="background: ${EMAIL_BRAND.gradient}; padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
    <h1 style="color: #fff; margin: 0; font-size: 24px;">${EMAIL_BRAND.name}</h1>
    <p style="color: ${EMAIL_BRAND.headerTextSecondary}; margin: 10px 0 0 0; font-size: 14px;">${EMAIL_BRAND.tagline}</p>
  </div>`
}

function renderFooter(): string {
  return `  <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
    <p>このメールは${EMAIL_BRAND.name}から自動送信されています。</p>
  </div>`
}

/**
 * 本文カード（ヘッダー直下の白背景ボックス）を組み立てる。
 */
export function renderCard(inner: string): string {
  return `  <div style="background: #fff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
${inner}
  </div>`
}

/**
 * 緑の CTA ボタン。
 * href はテンプレート呼び出し側でエスケープ・信頼できる URL であることを保証すること。
 */
export function renderCtaButton(href: string, label: string): string {
  return `    <div style="text-align: center; margin: 30px 0;">
      <a href="${href}" style="display: inline-block; background: ${EMAIL_BRAND.primary}; color: #fff; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold;">${label}</a>
    </div>`
}

/**
 * HTML メール末尾にある「ボタンが機能しない場合の URL」注記。
 */
export function renderFallbackUrlNote(url: string): string {
  return `    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">

    <p style="color: #999; font-size: 12px;">
      ボタンが機能しない場合は、以下のURLをブラウザに貼り付けてください：<br>
      <a href="${url}" style="color: ${EMAIL_BRAND.primary}; word-break: break-all;">${url}</a>
    </p>`
}
