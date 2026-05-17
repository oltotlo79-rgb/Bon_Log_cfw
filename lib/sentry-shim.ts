/**
 * @module lib/sentry-shim
 *
 * CFW 移行用の `@sentry/nextjs` シム。
 *
 * Why this exists:
 *   `@sentry/nextjs` は Node SDK に深く依存しており、Cloudflare Workers の
 *   nodejs_compat_v2 環境では `webpack` プラグインが build 失敗する。Phase 2
 *   時点ではエラーモニタリングを一時的に no-op 化してビルドを通す。
 *
 *   Phase 後半で `@sentry/cloudflare` をベースに本実装に置き換える予定。
 *   既存コード (proxy.ts / logger.ts / global-error.tsx 等) は `Sentry.captureException` などを
 *   呼ぶため、シグネチャ互換の no-op 関数を提供することで呼び出し側を一切変更せずに済む。
 *
 * 開発時の挙動:
 *   - NODE_ENV !== 'production': console に出力 (デバッグ用)
 *   - NODE_ENV === 'production': 完全に silent (no-op)
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

type LogLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug' | 'log'

interface CaptureContext {
  level?: LogLevel
  tags?: Record<string, string | number | boolean | undefined | null>
  extra?: Record<string, unknown>
  user?: Record<string, unknown>
  fingerprint?: string[]
  contexts?: Record<string, Record<string, unknown>>
}

/**
 * `beforeSend` の hint 引数 (@sentry/nextjs 互換)。
 * 元 SDK では `EventHint` だが、shim では呼び出し側コードがアクセスするフィールドだけ拾えれば十分なので
 * 必須プロパティを `unknown` 寄りに緩めている。
 */
interface SentryEventHint {
  originalException?: unknown
  syntheticException?: unknown
  [key: string]: unknown
}

/**
 * `beforeSend` に渡される Sentry イベント (@sentry/nextjs 互換)。
 * 呼び出し側コード (instrumentation-client.ts 等) が参照するフィールドのみ
 * 緩く型付けする。詳細は @sentry/types の Event interface を参照。
 */
interface SentryExceptionValue {
  type?: string
  value?: string
  stacktrace?: unknown
}

interface SentryEvent {
  exception?: {
    values?: SentryExceptionValue[]
  }
  message?: string
  level?: LogLevel
  tags?: Record<string, string | number | boolean | undefined | null>
  extra?: Record<string, unknown>
  user?: Record<string, unknown>
  contexts?: Record<string, Record<string, unknown>>
  [key: string]: unknown
}

interface SentryInitConfig {
  dsn?: string
  enabled?: boolean
  environment?: string
  release?: string
  tracesSampleRate?: number
  debug?: boolean
  // @sentry/nextjs の本 SDK は (event, hint) の 2 引数。互換性のため event/hint を弱型付けで露出。
  beforeSend?: (event: SentryEvent, hint: SentryEventHint) => SentryEvent | null | PromiseLike<SentryEvent | null>
  ignoreErrors?: (string | RegExp)[]
  [key: string]: unknown
}

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production'

function devLog(method: string, ...args: unknown[]): void {
  if (isDev) {
    // eslint-disable-next-line no-console
    console.log(`[sentry-shim] ${method}`, ...args)
  }
}

export function init(_config: SentryInitConfig): void {
  devLog('init')
}

export function captureException(
  exception: unknown,
  _context?: CaptureContext,
): string {
  devLog('captureException', exception instanceof Error ? exception.message : exception)
  return 'shim-event-id'
}

export function captureMessage(
  message: string,
  _context?: CaptureContext | LogLevel,
): string {
  devLog('captureMessage', message)
  return 'shim-event-id'
}

export function withScope(callback: (scope: unknown) => void): void {
  const noopScope = {
    setTag: () => noopScope,
    setExtra: () => noopScope,
    setUser: () => noopScope,
    setLevel: () => noopScope,
    setContext: () => noopScope,
    setFingerprint: () => noopScope,
    clear: () => noopScope,
  }
  callback(noopScope)
}

export function setTag(_key: string, _value: string | number | boolean): void {
  // no-op
}

export function setUser(_user: Record<string, unknown> | null): void {
  // no-op
}

export function setContext(_name: string, _context: Record<string, unknown> | null): void {
  // no-op
}

export function addBreadcrumb(_breadcrumb: Record<string, unknown>): void {
  // no-op
}

export function startSpan<T>(_options: Record<string, unknown>, callback: () => T): T {
  return callback()
}

export function flush(_timeout?: number): Promise<boolean> {
  return Promise.resolve(true)
}

export function close(_timeout?: number): Promise<boolean> {
  return Promise.resolve(true)
}

/**
 * Next.js 16+ の `instrumentation-client.ts` で `export const onRouterTransitionStart`
 * として再エクスポートされるルーター遷移計測 hook (`@sentry/nextjs` 互換)。
 * shim では計測しないため no-op。
 */
export function captureRouterTransitionStart(
  _href: string,
  _navigationType: 'push' | 'replace' | 'traverse',
): void {
  // no-op
}

/**
 * `withSentryConfig` の no-op 実装。
 * `next.config.ts` で `withSentryConfig(config, options)` の wrap を残せるが、
 * 単純に config をそのまま返す。
 */
export function withSentryConfig<TConfig>(config: TConfig, _options?: unknown): TConfig {
  return config
}

// 名前空間として import している箇所 (`import * as Sentry from ...`) の互換性のため
// default も提供しておく。
const sentryShim = {
  init,
  captureException,
  captureMessage,
  captureRouterTransitionStart,
  withScope,
  setTag,
  setUser,
  setContext,
  addBreadcrumb,
  startSpan,
  flush,
  close,
  withSentryConfig,
}

export default sentryShim
