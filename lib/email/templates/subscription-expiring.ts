/**
 * サブスクリプション期限切れ間近通知メールテンプレート。
 *
 * @module lib/email/templates/subscription-expiring
 */

import { escapeHtml } from '@/lib/sanitize'
import { EMAIL_BRAND, renderCard, renderCtaButton, renderEmailShell } from './shared'

/**
 * プレミアム会員の有効期限が近づいている時のメール。
 * nickname / expirationDate は HTML に埋め込むため呼び出し側でエスケープする。
 */
export function buildSubscriptionExpiringEmail(params: {
  nickname: string
  expirationDate: string
  daysRemaining: number
  settingsUrl: string
}): { html: string; text: string } {
  const { nickname, expirationDate, daysRemaining, settingsUrl } = params
  const safeNickname = escapeHtml(nickname)
  const safeExpirationDate = escapeHtml(expirationDate)

  const html = renderEmailShell(
    'プレミアム会員の有効期限について',
    renderCard(`    <h2 style="color: ${EMAIL_BRAND.primaryDark}; margin-top: 0;">${safeNickname}さん、プレミアム会員の有効期限が近づいています</h2>

    <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; color: #856404;">
        <strong>有効期限: ${safeExpirationDate}</strong><br>
        残り<strong>${daysRemaining}日</strong>で有効期限が切れます。
      </p>
    </div>

    <p>プレミアム会員が終了すると、以下の機能がご利用いただけなくなります：</p>

    <ul style="color: #666;">
      <li>予約投稿機能</li>
      <li>拡張文字数（1000文字→500文字）</li>
      <li>拡張画像添付（8枚→4枚）</li>
      <li>詳細アナリティクス</li>
      <li>広告非表示</li>
    </ul>

    <p>引き続きプレミアム機能をご利用いただくには、サブスクリプションを更新してください。</p>

${renderCtaButton(settingsUrl, 'サブスクリプションを確認')}

    <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;">

    <p style="color: #999; font-size: 12px;">
      このメールは自動送信されています。ご不明な点がございましたら、サポートまでお問い合わせください。
    </p>`),
  )

  const text = `
BON-LOG - プレミアム会員有効期限のお知らせ

${safeNickname}さん

プレミアム会員の有効期限が近づいています。

有効期限: ${safeExpirationDate}
残り${daysRemaining}日で有効期限が切れます。

プレミアム会員が終了すると、以下の機能がご利用いただけなくなります：
- 予約投稿機能
- 拡張文字数（1000文字→500文字）
- 拡張画像添付（8枚→4枚）
- 詳細アナリティクス
- 広告非表示

引き続きプレミアム機能をご利用いただくには、サブスクリプションを更新してください。

サブスクリプションを確認: ${settingsUrl}

---
BON-LOG
盆栽愛好家のためのSNS
`

  return { html, text }
}
