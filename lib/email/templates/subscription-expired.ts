/**
 * サブスクリプション期限切れ通知メールテンプレート。
 *
 * @module lib/email/templates/subscription-expired
 */

import { escapeHtml } from '@/lib/sanitize'
import { EMAIL_BRAND, renderCard, renderCtaButton, renderEmailShell } from './shared'

/**
 * プレミアム会員の有効期限が切れた時のメール。
 * nickname は HTML に埋め込むため呼び出し側でエスケープする。
 */
export function buildSubscriptionExpiredEmail(params: {
  nickname: string
  settingsUrl: string
}): { html: string; text: string } {
  const { nickname, settingsUrl } = params
  const safeNickname = escapeHtml(nickname)

  const html = renderEmailShell(
    'プレミアム会員の有効期限が切れました',
    renderCard(`    <h2 style="color: ${EMAIL_BRAND.primaryDark}; margin-top: 0;">${safeNickname}さん、プレミアム会員の有効期限が切れました</h2>

    <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #721c24;">
        <strong>プレミアム会員の有効期限が切れました。</strong>
      </p>
    </div>

    <p>プレミアム機能がご利用いただけなくなりました：</p>

    <ul style="color: #666;">
      <li>予約投稿は自動的にキャンセルされました</li>
      <li>投稿文字数が500文字に制限されます</li>
      <li>画像添付が4枚に制限されます</li>
      <li>詳細アナリティクスはご利用いただけません</li>
    </ul>

    <p>引き続きプレミアム機能をご利用いただくには、サブスクリプションを再度お申し込みください。</p>

${renderCtaButton(settingsUrl, 'プレミアムに再登録')}

    <p style="color: #666;">
      BON-LOGをご利用いただきありがとうございます。<br>
      無料会員でも引き続き基本機能をお楽しみいただけます。
    </p>

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">

    <p style="color: #999; font-size: 12px;">
      このメールは自動送信されています。ご不明な点がございましたら、サポートまでお問い合わせください。
    </p>`),
  )

  const text = `
BON-LOG - プレミアム会員有効期限切れのお知らせ

${safeNickname}さん

プレミアム会員の有効期限が切れました。

プレミアム機能がご利用いただけなくなりました：
- 予約投稿は自動的にキャンセルされました
- 投稿文字数が500文字に制限されます
- 画像添付が4枚に制限されます
- 詳細アナリティクスはご利用いただけません

引き続きプレミアム機能をご利用いただくには、サブスクリプションを再度お申し込みください。

プレミアムに再登録: ${settingsUrl}

BON-LOGをご利用いただきありがとうございます。
無料会員でも引き続き基本機能をお楽しみいただけます。

---
BON-LOG
盆栽愛好家のためのSNS
`

  return { html, text }
}
