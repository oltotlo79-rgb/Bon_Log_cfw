/**
 * 環境変数の起動時バリデーション
 *
 * Node.jsランタイム初期化時（instrumentation.ts）に呼び出し、
 * 必須環境変数の欠落や不正な値を早期検出する。
 *
 * - 本番環境: バリデーション失敗で起動を中断（fail-fast）
 * - 開発環境: 警告を出力して続行（欠損する機能は動的にスキップ）
 *
 * @module lib/env-validation
 */

import { z } from 'zod'

/**
 * サーバーサイド環境変数のスキーマ定義
 *
 * required: 本番環境で必須（未設定時は起動失敗）
 * optional: 未設定でも起動可（機能が無効化されるのみ）
 */
const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL は必須です'),

  NEXTAUTH_SECRET: z.string().min(16, 'NEXTAUTH_SECRET は16文字以上必要です'),
  NEXTAUTH_URL: z.string().url().optional(),

  // production では HTTPS 必須。canonical / OG / sitemap の URL 生成に直接使われるため
  // 未設定だと localhost に fallback して SEO 致命傷になる。
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

  RESEND_API_KEY: z.string().min(1).optional(),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_').optional(),

  STORAGE_PROVIDER: z.enum(['r2', 'supabase', 'local']).optional(),
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_PUBLIC_URL: z.string().url().optional(),

  TWO_FACTOR_ENCRYPTION_KEY: z.string().length(64, '2FA暗号化キーは64文字（32バイトhex）必要です').optional(),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET は16文字以上推奨').optional(),

  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  SENTRY_DSN: z.string().url().optional(),

  SKIP_DB_CONNECTION: z.enum(['true', 'false']).optional(),
})

/**
 * オプショナルだが本番では「欠落が運用品質に直結する」環境変数と、
 * 欠落時に表示するユーザー向け影響説明の対応表。
 *
 * 欠落しても起動は継続するが、起動ログで明示的に警告する。
 * SRE / 運用担当がログ一瞥で「機能が劣化している」ことを認識できる。
 */
const PRODUCTION_RECOMMENDED_ENV: ReadonlyArray<{ key: string; impact: string }> = [
  { key: 'SENTRY_DSN', impact: 'エラー監視が無効化されます（障害検知が遅延）' },
  { key: 'STRIPE_SECRET_KEY', impact: 'プレミアム決済が動作しません' },
  { key: 'STRIPE_WEBHOOK_SECRET', impact: 'Stripe Webhook 署名検証が行われません' },
  { key: 'RESEND_API_KEY', impact: '認証メール・通知メールが送信されません' },
  { key: 'UPSTASH_REDIS_REST_URL', impact: 'レート制限が fail-open 状態になります' },
  { key: 'TWO_FACTOR_ENCRYPTION_KEY', impact: '2FA セットアップが機能しません' },
]

/**
 * 環境変数を検証し、結果をログ出力する。
 *
 * 本番環境では必須変数の欠落時にプロセスを停止する。
 * 開発/テスト環境では警告のみ出力して続行する。
 * 本番のみ、オプショナル変数の欠落を運用影響とともに警告する。
 */
export function validateEnv(): void {
  const result = serverEnvSchema.safeParse(process.env)
  const isProduction = process.env.NODE_ENV === 'production'

  if (!result.success) {
    const issues = result.error.issues
    const prefix = isProduction ? '[FATAL]' : '[WARN]'

    console.error(`${prefix} 環境変数のバリデーションエラー:`)
    for (const issue of issues) {
      const path = issue.path.join('.')
      console.error(`  ${path}: ${issue.message}`)
    }

    if (isProduction) {
      // 本番では DATABASE_URL と NEXTAUTH_SECRET の欠落は致命的
      const criticalMissing = issues.some(
        (issue) => issue.path[0] === 'DATABASE_URL' || issue.path[0] === 'NEXTAUTH_SECRET'
      )
      if (criticalMissing) {
        throw new Error(
          '必須環境変数（DATABASE_URL / NEXTAUTH_SECRET）が未設定または不正です。起動を中断します。'
        )
      }
    }
  }

  // 本番では NEXT_PUBLIC_APP_URL を HTTPS で必ず設定する (canonical / OG / sitemap が
  // localhost にフォールバックすると SEO 致命傷)。
  // ただし CI の E2E / Lighthouse は NODE_ENV=production + http://localhost:3000 で動くため、
  // localhost / 127.0.0.1 / 0.0.0.0 など loopback hostname は HTTPS 必須から除外する。
  if (isProduction) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      throw new Error(
        '[FATAL] NEXT_PUBLIC_APP_URL が未設定です。canonical / OG / sitemap の URL 生成に必須のため起動を中断します。'
      )
    }
    let parsedAppUrl: URL
    try {
      parsedAppUrl = new URL(appUrl)
    } catch {
      throw new Error(`[FATAL] NEXT_PUBLIC_APP_URL が URL として不正です。現在の値: ${appUrl}`)
    }
    const isLoopback =
      parsedAppUrl.hostname === 'localhost' ||
      parsedAppUrl.hostname === '127.0.0.1' ||
      parsedAppUrl.hostname === '0.0.0.0' ||
      parsedAppUrl.hostname === '[::1]'
    if (!isLoopback && parsedAppUrl.protocol !== 'https:') {
      throw new Error(
        `[FATAL] NEXT_PUBLIC_APP_URL は HTTPS でなければなりません (loopback は例外)。現在の値: ${appUrl}`
      )
    }
    const authUrl = process.env.NEXTAUTH_URL
    if (authUrl) {
      try {
        if (new URL(authUrl).origin !== parsedAppUrl.origin) {
          console.warn(
            `[startup] ⚠ NEXTAUTH_URL (${authUrl}) と NEXT_PUBLIC_APP_URL (${appUrl}) の origin が一致しません。OAuth コールバックや canonical URL に不整合が起きる可能性があります。`
          )
        }
      } catch {
        // NEXTAUTH_URL が URL として parse 不能 — 既存の Zod 検証で別途検出
      }
    }
  }

  // 本番のみ: オプショナルだが推奨される環境変数の欠落を警告
  if (isProduction) {
    for (const { key, impact } of PRODUCTION_RECOMMENDED_ENV) {
      if (!process.env[key]) {
        console.warn(`[startup] ⚠ ${key} 未設定 — ${impact}`)
      }
    }
  }
}
