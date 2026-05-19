/**
 * Sentry サーバーサイド設定
 *
 * Node.jsランタイムで実行されるサーバーサイドエラーをキャプチャします。
 * Server Actions、API Routes、Server Componentsのエラーを監視します。
 */
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // パフォーマンストレーシングのサンプリングレート
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // 本番環境でのみ有効化
  enabled: process.env.NODE_ENV === 'production',

  // デバッグモード
  debug: false,

  // エラーフィルタリング
  beforeSend(event) {
    // 開発環境ではエラーを送信しない
    if (process.env.NODE_ENV !== 'production') {
      return null
    }

    return event
  },

  // 無視するエラーパターン
  ignoreErrors: [
    // 認証関連（通常のフロー）
    'NEXT_REDIRECT',
    'NEXT_NOT_FOUND',
    // データベース接続の一時的なエラー
    'Connection pool timeout',
    'Connection terminated unexpectedly',
  ],
})
