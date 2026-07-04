/**
 * メールアドレス変更リクエスト通知メールテンプレート（旧アドレス宛）。
 *
 * アカウント乗っ取り検知のためのセキュリティ通知。CTA は持たず注意喚起のみ。
 *
 * @module lib/email/templates/email-change-notification
 */

import { EMAIL_BRAND, renderCard, renderEmailShell } from './shared'

/**
 * メールアドレス変更リクエスト通知メールの HTML とテキストを組み立てる。
 */
export function buildEmailChangeNotificationEmail(): { html: string; text: string } {
  const html = renderEmailShell(
    'メールアドレス変更のリクエストについて',
    renderCard(`    <h2 style="color: ${EMAIL_BRAND.primaryDark}; margin-top: 0;">メールアドレス変更がリクエストされました</h2>

    <p>お客様のアカウントで、ログイン用メールアドレスの変更がリクエストされました。</p>
    <p>変更は新しいメールアドレス宛に送信された確認メールのリンクをクリックするまで確定しません。</p>

    <p style="color: #c62828; font-size: 14px; font-weight: bold;">
      心当たりがない場合は、アカウントが第三者に利用されている可能性があります。
      速やかにパスワードを変更し、サポートまでご連絡ください。
    </p>`),
  )

  const text = `
BON-LOG - メールアドレス変更のリクエストについて

お客様のアカウントで、ログイン用メールアドレスの変更がリクエストされました。
変更は新しいメールアドレス宛に送信された確認メールのリンクをクリックするまで確定しません。

心当たりがない場合は、アカウントが第三者に利用されている可能性があります。
速やかにパスワードを変更し、サポートまでご連絡ください。

---
BON-LOG
盆栽愛好家のためのSNS
`

  return { html, text }
}
