// @vitest-environment node
/**
 * メールアドレス変更関連の 2 テンプレートのユニットテスト。
 *
 * - email-change-confirmation: 新アドレス宛の確認メール（CTA リンクあり）
 * - email-change-notification: 旧アドレス宛のセキュリティ通知（CTA なし）
 */
import { describe, it, expect } from 'vitest'
import { buildEmailChangeConfirmationEmail } from '@/lib/email/templates/email-change-confirmation'
import { buildEmailChangeNotificationEmail } from '@/lib/email/templates/email-change-notification'

describe('buildEmailChangeConfirmationEmail', () => {
  const url = 'https://app.example.com/settings/email/confirm?token=abc123'

  it('confirmUrl を HTML とテキストの両方に含む', () => {
    const { html, text } = buildEmailChangeConfirmationEmail(url)
    expect(html).toContain(url)
    expect(text).toContain(url)
  })

  it('1時間有効期限の案内を含む', () => {
    const { html, text } = buildEmailChangeConfirmationEmail(url)
    expect(html).toContain('1時間')
    expect(text).toContain('1時間')
  })

  it('CTA ボタンラベル「メールアドレス変更を確定する」を含む', () => {
    const { html } = buildEmailChangeConfirmationEmail(url)
    expect(html).toContain('メールアドレス変更を確定する')
  })

  it('心当たりがない場合の注意書きを含む（変更は確定しない旨）', () => {
    const { html, text } = buildEmailChangeConfirmationEmail(url)
    expect(html).toContain('お心当たりがない場合は、このメールを無視してください（変更は確定しません）。')
    expect(text).toContain('お心当たりがない場合は、このメールを無視してください（変更は確定しません）。')
  })

  it('件名相当のタイトルを HTML <title> に含む', () => {
    const { html } = buildEmailChangeConfirmationEmail(url)
    expect(html).toContain('<title>メールアドレス変更の確認</title>')
  })

  it('URL をそのまま貼り付けるフォールバック案内を含む（ボタンが押せない場合の代替）', () => {
    const { html } = buildEmailChangeConfirmationEmail(url)
    // renderFallbackUrlNote は URL を本文にそのまま出力する
    const occurrences = html.split(url).length - 1
    expect(occurrences).toBeGreaterThanOrEqual(2) // CTA ボタン内 + フォールバック本文
  })
})

describe('buildEmailChangeNotificationEmail', () => {
  it('アカウント乗っ取りに対する注意喚起メッセージを含む', () => {
    const { html, text } = buildEmailChangeNotificationEmail()
    expect(html).toContain('心当たりがない場合は、アカウントが第三者に利用されている可能性があります。')
    expect(text).toContain('心当たりがない場合は、アカウントが第三者に利用されている可能性があります。')
  })

  it('パスワード変更・サポート連絡を促す文言を含む', () => {
    const { html, text } = buildEmailChangeNotificationEmail()
    expect(html).toContain('速やかにパスワードを変更し、サポートまでご連絡ください。')
    expect(text).toContain('速やかにパスワードを変更し、サポートまでご連絡ください。')
  })

  it('確認メール受信までは変更が確定しない旨を明記する', () => {
    const { html, text } = buildEmailChangeNotificationEmail()
    expect(html).toContain('変更は新しいメールアドレス宛に送信された確認メールのリンクをクリックするまで確定しません。')
    expect(text).toContain('変更は新しいメールアドレス宛に送信された確認メールのリンクをクリックするまで確定しません。')
  })

  it('件名相当のタイトルを HTML <title> に含む', () => {
    const { html } = buildEmailChangeNotificationEmail()
    expect(html).toContain('<title>メールアドレス変更のリクエストについて</title>')
  })

  it('CTA ボタン（href リンク）を含まない（通知専用でアクション不要のため）', () => {
    const { html } = buildEmailChangeNotificationEmail()
    expect(html).not.toContain('href=')
  })

  it('引数を取らず、呼び出すたびに同一内容を返す（決定的な純粋関数）', () => {
    const first = buildEmailChangeNotificationEmail()
    const second = buildEmailChangeNotificationEmail()
    expect(first).toEqual(second)
  })
})
