/**
 * 環境変数の一元取得
 *
 * process.env の参照とデフォルト値をここに集約し、
 * キー名変更やデフォルト変更を一箇所で行えるようにする。
 *
 * @module lib/env
 */

/** アプリのベースURL（開発・テスト時デフォルト: http://localhost:3000） */
const APP_URL_DEFAULT = 'http://localhost:3000'

/** localhost を指す host (production では canonical / sitemap に出してはならない値)。 */
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1'])

/**
 * アプリのベースURLを返す。
 *
 * Why: production で `NEXT_PUBLIC_APP_URL` が未設定だと metadataBase / sitemap / canonical
 * が localhost に向き、検索エンジンに誤った URL を露出させる事故が起きる。本番デプロイでは
 * 未設定・空文字・不正な URL・localhost のいずれも fail-closed で例外を投げ、誤デプロイを防ぐ。
 *
 * `production` の判定基準:
 *   - 未設定 / 空 / 不正 URL: `NODE_ENV === 'production'` で fail-closed
 *     (CI build / Vercel build どちらでも本番設定不備を確実に検知する)
 *   - localhost を指す URL: `VERCEL_ENV === 'production'` で fail-closed
 *     (ローカルで `next build` を試す場合に `.env.local` の localhost を許容するため)
 *
 * 必須環境変数の責務:
 *   - CI (.github/workflows/ci.yml): top-level env に `NEXT_PUBLIC_APP_URL` を設定
 *     (`next build` は `NODE_ENV=production` を強制するため smoke build でもダミー値が必要)
 *   - Vercel: project settings の Environment Variables で本番 URL を設定
 *   - 開発: `.env.local.example` を参照
 */
export function getAppUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim()
  const isProd = process.env.NODE_ENV === 'production'
  const isVercelProd = process.env.VERCEL_ENV === 'production'

  if (!raw) {
    if (isProd) {
      throw new Error(
        'NEXT_PUBLIC_APP_URL must be set in production (used for metadataBase / sitemap / canonical URLs).',
      )
    }
    return APP_URL_DEFAULT
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    if (isProd) {
      throw new Error(`NEXT_PUBLIC_APP_URL is not a valid URL: ${raw}`)
    }
    return APP_URL_DEFAULT
  }

  if (isVercelProd && LOCALHOST_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `NEXT_PUBLIC_APP_URL must not point to localhost in production (got: ${raw}).`,
    )
  }

  return raw
}

/**
 * お問い合わせ通知先の管理者メールアドレス。
 * 未設定の場合は空文字。
 */
export function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL ?? ''
}

/**
 * Resend API キー。未設定の場合は空文字。
 */
export function getResendApiKey(): string {
  return process.env.RESEND_API_KEY ?? ''
}

/**
 * Cron ジョブの共通署名シークレット。
 * 未設定の場合は `undefined` を返し、呼び出し側で fail-closed 判定させる。
 * （既存の `cron-auth.ts` の検証ロジックは undefined/空文字の場合に認証失敗を返す）
 */
export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET
}

/**
 * 共有ゲストアカウントのログインパスワード。
 * 未設定時は空文字（ゲストログインは実質無効になる）。
 */
export function getGuestPassword(): string {
  return process.env.GUEST_PASSWORD ?? ''
}

/**
 * Basic 認証の設定値をまとめて返す。
 * `BASIC_AUTH_ENABLED=true` + USER/PASSWORD が揃っていないと proxy 側で fail-closed になる。
 */
export function getBasicAuthConfig(): {
  enabled: boolean
  user: string | undefined
  password: string | undefined
} {
  return {
    enabled: process.env.BASIC_AUTH_ENABLED === 'true',
    user: process.env.BASIC_AUTH_USER,
    password: process.env.BASIC_AUTH_PASSWORD,
  }
}

/**
 * アプリケーションが本番モードで動作しているか。
 * `NODE_ENV === 'production'` の判定を一元化し、型安全にする。
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

/**
 * 開発モード判定（テストは含まない）。
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Google OAuth プロバイダー設定。
 * NextAuth の GoogleProvider に渡す clientId / clientSecret を束ねる。
 * 未設定時は空文字にフォールバックして NextAuth 側で「未構成」として扱わせる。
 */
export function getGoogleOAuthConfig(): { clientId: string; clientSecret: string } {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
  }
}

/**
 * 送信元メールアドレス。Resend 無料プランのデフォルトを保持。
 */
const EMAIL_FROM_DEFAULT = 'BON-LOG <onboarding@resend.dev>'

/**
 * メール送信プロバイダー種別。
 * - `resend`: Resend API による実送信
 * - `console`: コンソール出力のみ（開発・テスト用）
 */
export type EmailProviderName = 'resend' | 'console'

/**
 * メール設定。provider / fromAddress を束ねて返す。
 */
export function getEmailConfig(): { provider: EmailProviderName; fromAddress: string } {
  const raw = process.env.EMAIL_PROVIDER
  const provider: EmailProviderName = raw === 'resend' ? 'resend' : 'console'
  return {
    provider,
    fromAddress: process.env.EMAIL_FROM || EMAIL_FROM_DEFAULT,
  }
}

/**
 * レガシー Bearer 形式の Cron 認証を無効化するフラグ。
 * true のとき、HMAC 認証のみを受け付ける。
 */
export function isLegacyCronAuthDisabled(): boolean {
  return process.env.DISABLE_LEGACY_CRON_AUTH === 'true'
}
