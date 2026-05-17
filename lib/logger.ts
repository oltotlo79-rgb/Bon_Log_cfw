/**
 * 環境対応ロガー
 *
 * - 開発環境: 全レベルをコンソール出力
 * - 本番環境: errorのみSentryに送信、それ以外は抑制
 *
 * Sentry は起動時に静的 import する。以前は Edge Runtime への混入を避けるため
 * `import('@/lib/sentry-shim')` で動的 import していたが、`@sentry/nextjs` 自体が
 * Edge / Node / Browser の各ビルドを切り替えて提供するようになり、動的 import
 * による呼び出し毎のモジュール解決コストが不要になったため静的化した。
 *
 * @module lib/logger
 */

import * as Sentry from '@/lib/sentry-shim'
import { isDevelopment as _isDevelopment } from '@/lib/env'

const isDevelopment = _isDevelopment()

export const logger = {
  log: (...args: unknown[]) => {
    if (isDevelopment) console.log(...args)
  },

  info: (...args: unknown[]) => {
    if (isDevelopment) console.log(...args)
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) console.warn(...args)
  },

  error: (...args: unknown[]) => {
    if (isDevelopment) {
      console.error(...args)
      return
    }

    // 本番環境では Sentry にエラーを送信する。
    // Sentry SDK 自身が無効化状態（DSN 未設定など）でも安全に no-op になる。
    try {
      const error = args.find((arg): arg is Error => arg instanceof Error)
      if (error) {
        Sentry.captureException(error, {
          extra: { args: args.filter((arg) => !(arg instanceof Error)) },
        })
      } else {
        Sentry.captureMessage(args.map(String).join(' '), {
          level: 'error',
          extra: { args },
        })
      }
    } catch {
      // Sentry が利用不能な場合も logger を壊さない。
    }
  },

  debug: (...args: unknown[]) => {
    if (isDevelopment) console.debug('[DEBUG]', ...args)
  },
}

export default logger
