/**
 * Sentry Edge ランタイム設定
 *
 * proxy.ts等のEdgeランタイムで実行されるエラーをキャプチャします。
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
})
