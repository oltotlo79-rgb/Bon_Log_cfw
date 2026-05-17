/**
 * @fileoverview 検索ページのエラーバウンダリ
 *
 * このファイルはNext.js App Routerの規約に従ったエラーUIコンポーネントです。
 * /searchページで発生したエラーをキャッチして表示します。
 *
 * @route /search
 * @requires 'use client' - エラーバウンダリはクライアントコンポーネントである必要がある
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * 検索ページのエラーコンポーネント
 */
export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <PageError
      error={error}
      reset={reset}
      title="検索結果を読み込めません"
      description="検索に失敗しました。再試行してください。"
      icon={
        <svg
          className="w-8 h-8 text-destructive"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      }
    />
  )
}
