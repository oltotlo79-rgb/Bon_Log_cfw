/**
 * メール送信抽象化レイヤー。
 *
 * 環境変数 `EMAIL_PROVIDER` で `console` / `resend` を切替える。開発時は console、
 * 本番は resend を使うことで、ローカル開発では外部サービスに送らずに済む。
 *
 * プロバイダーは最初の送信時にシングルトンとして初期化される。
 *
 * HTML テンプレートは `./templates/` に分離している（デザイン変更時の影響範囲局所化）。
 *
 * @module lib/email
 */

import { getAppUrl, getEmailConfig, getResendApiKey } from '@/lib/env'
import logger from '@/lib/logger'
import { ONE_DAY_MS } from '@/lib/constants/limits'
import { ROUTE_SETTINGS_SUBSCRIPTION } from '@/lib/constants/routes'
import { Resend } from 'resend'
import { buildPasswordResetEmail } from './templates/password-reset'
import { buildVerificationEmail } from './templates/verification'
import { buildSubscriptionExpiringEmail } from './templates/subscription-expiring'
import { buildSubscriptionExpiredEmail } from './templates/subscription-expired'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

interface EmailProvider {
  send(options: EmailOptions): Promise<EmailResult>
}

/** ログに出す際に「先頭2文字 + *** + @以降」へ簡易マスクする（PII 漏えい防止）。 */
function maskEmailForLog(email: string): string {
  return email.replace(/(.{2}).*(@.*)/, '$1***$2')
}

/** 開発用: 実送信せずコンソールにメタ情報だけ出すプロバイダー。HTML 本文はトークン含みうるためログしない。 */
class ConsoleEmailProvider implements EmailProvider {
  async send(options: EmailOptions): Promise<EmailResult> {
    logger.log('========== EMAIL (Console Provider) ==========')
    logger.log('To:', maskEmailForLog(options.to))
    logger.log('Subject:', options.subject)
    logger.log('HTML: [omitted to avoid PII/tokens in logs]')
    logger.log('===============================================')
    return { success: true, messageId: `console-${Date.now()}` }
  }
}

/** 本番用: Resend API 経由でメール送信する。 */
class ResendEmailProvider implements EmailProvider {
  private resend: Resend

  constructor() {
    const apiKey = getResendApiKey()
    logger.log('Resend API key configured:', apiKey ? 'yes' : 'NOT SET')
    this.resend = new Resend(apiKey)
  }

  async send(options: EmailOptions): Promise<EmailResult> {
    try {
      const { fromAddress } = getEmailConfig()
      logger.log('Sending email via Resend:')
      logger.log('  From:', fromAddress)
      logger.log('  To:', maskEmailForLog(options.to))
      logger.log('  Subject:', options.subject)

      const { data, error } = await this.resend.emails.send({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      })

      if (error) {
        logger.error('Resend API error:', JSON.stringify(error))
        return { success: false, error: error.message }
      }

      logger.log('Resend success, messageId:', data?.id)
      return { success: true, messageId: data?.id }
    } catch (err) {
      logger.error('Resend exception:', err)
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }
}

let emailProvider: EmailProvider | null = null

function getEmailProvider(): EmailProvider {
  if (emailProvider) return emailProvider

  const { provider } = getEmailConfig()
  emailProvider = provider === 'resend' ? new ResendEmailProvider() : new ConsoleEmailProvider()
  logger.log(`Email provider initialized: ${provider}`)
  return emailProvider
}

/**
 * 汎用メール送信。EmailOptions をそのまま受け取るので
 * 特別なテンプレートが不要な送信（お問い合わせ自動返信など）にも使える。
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const provider = getEmailProvider()
  return provider.send(options)
}

/**
 * パスワードリセットリンク送信。resetUrl は呼び出し側で生成・検証済みである前提。
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
): Promise<EmailResult> {
  const { html, text } = buildPasswordResetEmail(resetUrl)
  return sendEmail({
    to: email,
    subject: '【BON-LOG】パスワードリセットのご案内',
    html,
    text,
  })
}

/**
 * 新規登録時のメール確認リンク送信。verifyUrl は呼び出し側で生成・検証済みである前提。
 */
export async function sendVerificationEmail(
  email: string,
  verifyUrl: string,
): Promise<EmailResult> {
  const { html, text } = buildVerificationEmail(verifyUrl)
  return sendEmail({
    to: email,
    subject: '【BON-LOG】メールアドレスの確認',
    html,
    text,
  })
}

/**
 * プレミアム会員の有効期限が近づいている時の通知メール。
 * 期限までの日数は expiresAt と現在時刻から算出する（呼び出し側で時刻を固定したい場合は
 * テスト用に expiresAt を調整すること）。
 */
export async function sendSubscriptionExpiringEmail(
  email: string,
  nickname: string,
  expiresAt: Date,
): Promise<EmailResult> {
  const daysRemaining = Math.ceil((expiresAt.getTime() - Date.now()) / ONE_DAY_MS)
  const expirationDate = expiresAt.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const settingsUrl = `${getAppUrl()}${ROUTE_SETTINGS_SUBSCRIPTION}`

  const { html, text } = buildSubscriptionExpiringEmail({
    nickname,
    expirationDate,
    daysRemaining,
    settingsUrl,
  })
  return sendEmail({
    to: email,
    subject: '【BON-LOG】プレミアム会員の有効期限が近づいています',
    html,
    text,
  })
}

/** プレミアム会員の有効期限が切れた時の通知メール。 */
export async function sendSubscriptionExpiredEmail(
  email: string,
  nickname: string,
): Promise<EmailResult> {
  const settingsUrl = `${getAppUrl()}${ROUTE_SETTINGS_SUBSCRIPTION}`
  const { html, text } = buildSubscriptionExpiredEmail({ nickname, settingsUrl })
  return sendEmail({
    to: email,
    subject: '【BON-LOG】プレミアム会員の有効期限が切れました',
    html,
    text,
  })
}
