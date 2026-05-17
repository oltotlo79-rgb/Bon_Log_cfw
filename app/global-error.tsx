'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * ルートレイアウトを含むすべての error.tsx で捕捉できなかったエラーの最終バウンダリ。
 * Next.js の仕様により独自の `<html>` / `<body>` を持つ必要がある (ルートレイアウト
 * 側で発生した想定で動作するため)。
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="ja">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              エラーが発生しました
            </h1>
            <p className="text-gray-600 mb-8">
              申し訳ございません。予期しないエラーが発生しました。
              問題が継続する場合は、サポートまでお問い合わせください。
            </p>
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => reset()}
                className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                再試行する
              </button>
              {/*
                global-error.tsx はルートレイアウト外で動作するため next/link の RouterProvider が
                保証されない。フルリロードでエラー状態・レイアウト状態を確実にリセットする。
              */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="block w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center"
              >
                ホームに戻る
              </a>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-8 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                  エラー詳細（開発用）
                </summary>
                {error.digest && (
                  <p className="mt-2 text-xs text-gray-500">
                    Digest: <code className="font-mono">{error.digest}</code>
                  </p>
                )}
                <pre className="mt-2 p-4 bg-gray-100 rounded-lg text-xs overflow-auto max-h-48">
                  {error.message}
                  {error.stack && `\n\n${error.stack}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
