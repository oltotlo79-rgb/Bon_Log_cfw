/**
 * @file 農薬・病害虫情報ページ専用エラーコンポーネント
 * @description 農薬・病害虫情報のデータ取得時にエラーが発生した場合に表示されるUI
 *
 * このファイルはNext.js App Routerの規約に基づくエラーバウンダリです。
 * /pesticidesページでサーバーエラーやネットワークエラーが発生した際に自動的に表示されます。
 *
 * 'use client'ディレクティブが必須です。
 * これはerror.tsxがクライアントサイドでエラーをキャッチする必要があるためです。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
'use client'

import { PageError } from '@/components/common/PageError'

/**
 * 農薬・病害虫情報エラーコンポーネント
 */
export default function PesticidesError({
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
      title="農薬・病害虫情報を読み込めません"
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
            d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
    />
  )
}
