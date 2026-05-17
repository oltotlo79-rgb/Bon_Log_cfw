/**
 * メールアドレス確認メールテンプレート。
 *
 * @module lib/email/templates/verification
 */

import { EMAIL_BRAND, renderCard, renderCtaButton, renderEmailShell, renderFallbackUrlNote } from './shared'

/**
 * メール確認メールの HTML とテキストを組み立てる。
 *
 * @param verifyUrl 信頼できる確認 URL（呼び出し側で検証済みであること）
 */
export function buildVerificationEmail(verifyUrl: string): { html: string; text: string } {
  const html = renderEmailShell(
    'メールアドレスの確認',
    renderCard(`    <h2 style="color: ${EMAIL_BRAND.primaryDark}; margin-top: 0;">メールアドレスの確認</h2>

    <p>BON-LOGへのご登録ありがとうございます。</p>
    <p>下記のボタンをクリックして、メールアドレスを確認してください。</p>

${renderCtaButton(verifyUrl, 'メールアドレスを確認する')}

    <p style="color: #666; font-size: 14px;">
      このリンクは<strong>24時間</strong>で有効期限が切れます。<br>
      お心当たりがない場合は、このメールを無視してください。
    </p>

${renderFallbackUrlNote(verifyUrl)}`),
  )

  const text = `
BON-LOG - メールアドレスの確認

BON-LOGへのご登録ありがとうございます。
下記のURLにアクセスして、メールアドレスを確認してください。

${verifyUrl}

このリンクは24時間で有効期限が切れます。
お心当たりがない場合は、このメールを無視してください。

---
BON-LOG
盆栽愛好家のためのSNS
`

  return { html, text }
}
