/**
 * @file 予約投稿一覧・編集ページのエラーバウンダリ
 * @description 予約投稿ページでエラーが発生した際に表示されるエラー画面
 *
 * Next.js App Routerのerror.tsx規約に基づき、
 * /posts/scheduled およびその子ルートで発生したエラーをキャッチして表示します。
 *
 * @route /posts/scheduled (およびその子ルート)
 * @requires 'use client'
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * 予約投稿ページのエラーコンポーネント
 */
export default function ScheduledPostsError({
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
      title="予約投稿を読み込めません"
      description="予約投稿の取得に失敗しました。再試行してください。"
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      }
      linkHref="/feed"
      linkLabel="タイムラインへ"
    />
  )
}
