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
import * as Sentry from '@sentry/nextjs'
import type { ErrorEvent } from '@sentry/nextjs'

if (typeof window !== 'undefined') {
  (window as typeof window & { Sentry: typeof Sentry }).Sentry = Sentry
}

/**
 * React の streaming Suspense 用インラインランタイム（`$RC` / `$RS` / `$RM` …）で発生した
 * 例外かどうかを判定する。
 *
 * Why: これらは React が SSR ストリーミングで Suspense 境界を差し替える際の関数で、
 * `node.parentNode.removeChild(...)` 等で **ストリーム済み DOM ノードを移動**する。
 * `Cannot read properties of null (reading 'parentNode')` は、リビール前にブラウザ拡張
 * （翻訳・パスワード管理等）や Edge 内蔵翻訳が対象ノードを DOM から切り離した時にのみ起きる。
 * アプリのコードに起因せず復旧可能なため、ノイズとして除外する（拡張機能の DOM 改変は
 * 直前の React #418 hydration mismatch としても観測される）。関数名 `$R<英大文字>` は
 * React の内部ランタイム専用でアプリ識別子と衝突しないため、誤って実バグを握り潰さない。
 */
function isReactStreamingRuntimeError(event: ErrorEvent): boolean {
  const frames = event.exception?.values?.flatMap((v) => v.stacktrace?.frames ?? []) ?? []
  return frames.some((f) => typeof f.function === 'string' && /^\$R[A-Z]$/.test(f.function))
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

    // ブラウザ拡張/内蔵翻訳による streaming Suspense リビール時の DOM 切り離し
    // （$RS 等での parentNode null）はアプリ起因でなく復旧可能なため除外する。
    if (isReactStreamingRuntimeError(event)) {
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
