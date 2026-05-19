/**
 * クライアントサイド用ロガー
 *
 * 本番環境ではconsole出力を抑制し、Sentryにエラーを送信する。
 * 開発環境ではconsole出力を維持する。
 */

const isDev = process.env.NODE_ENV === 'development'

export const clientLogger = {
  error(message: string, ...args: unknown[]) {
    if (isDev) {
      console.error(message, ...args)
    }
    // 本番ではSentryに送信
    if (!isDev && typeof window !== 'undefined') {
      import('@sentry/nextjs').then((Sentry) => {
        Sentry.captureException(
          args[0] instanceof Error ? args[0] : new Error(message)
        )
      }).catch(() => {})
    }
  },
  log(message: string, ...args: unknown[]) {
    if (isDev) {
      console.log(message, ...args)
    }
  },
  warn(message: string, ...args: unknown[]) {
    if (isDev) {
      console.warn(message, ...args)
    }
  },
}
