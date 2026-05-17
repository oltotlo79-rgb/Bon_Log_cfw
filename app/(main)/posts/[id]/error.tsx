/**
 * @file 投稿詳細ページ専用エラーコンポーネント
 * @description 投稿詳細ページでエラーが発生した場合に表示されるUI
 *
 * このファイルはNext.js App Routerの規約に基づくエラーバウンダリです。
 * /posts/[id]ページでサーバーエラーやネットワークエラーが発生した際に自動的に表示されます。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
'use client'

import { PageError } from '@/components/common/PageError'

/**
 * 投稿詳細エラーコンポーネント
 */
export default function PostError({
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
      title="投稿を表示できません"
      description="投稿が削除されたか、アクセス権限がない可能性があります。"
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
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      }
      linkHref="/feed"
      linkLabel="タイムラインへ"
    />
  )
}
