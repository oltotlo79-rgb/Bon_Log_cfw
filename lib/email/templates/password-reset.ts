/**
 * パスワードリセットメールテンプレート。
 *
 * @module lib/email/templates/password-reset
 */

import { EMAIL_BRAND, renderCard, renderCtaButton, renderEmailShell, renderFallbackUrlNote } from './shared'

/**
 * パスワードリセットメールの HTML とテキストを組み立てる。
 *
 * @param resetUrl 信頼できる再設定 URL（呼び出し側で検証済みであること）
 */
export function buildPasswordResetEmail(resetUrl: string): { html: string; text: string } {
  const html = renderEmailShell(
    'パスワードリセット',
    renderCard(`    <h2 style="color: ${EMAIL_BRAND.primaryDark}; margin-top: 0;">パスワードリセットのご依頼</h2>

    <p>パスワードリセットのリクエストを受け付けました。</p>
    <p>下記のボタンをクリックして、新しいパスワードを設定してください。</p>

${renderCtaButton(resetUrl, 'パスワードを再設定する')}

    <p style="color: #666; font-size: 14px;">
      このリンクは<strong>1時間</strong>で有効期限が切れます。<br>
      お心当たりがない場合は、このメールを無視してください。
    </p>

${renderFallbackUrlNote(resetUrl)}`),
  )

  const text = `
BON-LOG - パスワードリセット

パスワードリセットのリクエストを受け付けました。
下記のURLにアクセスして、新しいパスワードを設定してください。

${resetUrl}

このリンクは1時間で有効期限が切れます。
お心当たりがない場合は、このメールを無視してください。

---
BON-LOG
盆栽愛好家のためのSNS
`

  return { html, text }
}
