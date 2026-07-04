/**
 * メールアドレス変更確認メールテンプレート（新アドレス宛）。
 *
 * @module lib/email/templates/email-change-confirmation
 */

import { EMAIL_BRAND, renderCard, renderCtaButton, renderEmailShell, renderFallbackUrlNote } from './shared'

/**
 * メールアドレス変更確認メールの HTML とテキストを組み立てる。
 *
 * @param confirmUrl 信頼できる確認 URL（呼び出し側で検証済みであること）
 */
export function buildEmailChangeConfirmationEmail(confirmUrl: string): { html: string; text: string } {
  const html = renderEmailShell(
    'メールアドレス変更の確認',
    renderCard(`    <h2 style="color: ${EMAIL_BRAND.primaryDark}; margin-top: 0;">メールアドレス変更のご確認</h2>

    <p>このメールアドレスを新しいログイン用アドレスとして設定するリクエストを受け付けました。</p>
    <p>下記のボタンをクリックして、変更を確定してください。</p>

${renderCtaButton(confirmUrl, 'メールアドレス変更を確定する')}

    <p style="color: #666; font-size: 14px;">
      このリンクは<strong>1時間</strong>で有効期限が切れます。<br>
      お心当たりがない場合は、このメールを無視してください（変更は確定しません）。
    </p>

${renderFallbackUrlNote(confirmUrl)}`),
  )

  const text = `
BON-LOG - メールアドレス変更の確認

このメールアドレスを新しいログイン用アドレスとして設定するリクエストを受け付けました。
下記のURLにアクセスして、変更を確定してください。

${confirmUrl}

このリンクは1時間で有効期限が切れます。
お心当たりがない場合は、このメールを無視してください（変更は確定しません）。

---
BON-LOG
盆栽愛好家のためのSNS
`

  return { html, text }
}
