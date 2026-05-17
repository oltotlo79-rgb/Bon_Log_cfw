/**
 * Next.js Client-side Instrumentation
 *
 * ブラウザで実行されるJavaScriptエラーをキャプチャします。
 * エラー発生時にSentryに自動的に報告されます。
 *
 * Next.js 16 以降、Sentry のクライアント設定はこのファイルで行います。
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation-client
 */
import * as Sentry from '@/lib/sentry-shim'

if (typeof window !== 'undefined') {
  (window as typeof window & { Sentry: typeof Sentry }).Sentry = Sentry
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  enabled: process.env.NODE_ENV === 'production',

  debug: false,

  beforeSend(event, hint) {
    if (process.env.NODE_ENV !== 'production') {
      return null
    }

    if (event.exception?.values?.[0]?.type === 'ChunkLoadError') {
      return null
    }

    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    if (userAgent.includes('Twitter')) {
      const errorMessage = event.exception?.values?.[0]?.value || ''
      if (
        errorMessage.includes("Can't find variable: CONFIG") ||
        errorMessage.includes("Can't find variable: currentInset") ||
        errorMessage.includes('updateGapFiller') ||
        errorMessage.includes('updateFooterPositions')
      ) {
        return null
      }
    }

    const originalException = hint?.originalException
    if (originalException instanceof Error) {
      const message = originalException.message || ''
      if (
        message.includes("Can't find variable: CONFIG") ||
        message.includes("Can't find variable: currentInset")
      ) {
        return null
      }
    }

    return event
  },

  ignoreErrors: [
    'top.GLOBALS',
    'originalCreateNotification',
    'canvas.contentDocument',
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',
    'ResizeObserver loop',
    'Non-Error promise rejection',
    /Can't find variable: CONFIG/,
    /Can't find variable: currentInset/,
    /updateGapFiller/,
    /updateFooterPositions/,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
