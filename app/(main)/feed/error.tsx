/**
 * @file タイムラインページ専用エラーコンポーネント
 * @description タイムラインのデータ取得時にエラーが発生した場合に表示されるUI
 *
 * このファイルはNext.js App Routerの規約に基づくエラーバウンダリです。
 * /feedページでサーバーエラーやネットワークエラーが発生した際に自動的に表示されます。
 *
 * 'use client'ディレクティブが必須です。
 * これはerror.tsxがクライアントサイドでエラーをキャッチする必要があるためです。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
'use client'

import { PageError } from '@/components/common/PageError'

/**
 * タイムラインエラーコンポーネント
 */
export default function FeedError({
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
      title="タイムラインを読み込めません"
      description="一時的な問題が発生しています。しばらく待ってから再試行してください。"
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
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
      }
    />
  )
}
