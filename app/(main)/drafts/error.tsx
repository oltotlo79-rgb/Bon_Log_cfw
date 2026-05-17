/**
 * @file 下書き一覧・編集ページのエラーバウンダリ
 * @description 下書きページでエラーが発生した際に表示されるエラー画面
 *
 * Next.js App Routerのerror.tsx規約に基づき、
 * /drafts およびその子ルートで発生したエラーをキャッチして表示します。
 *
 * @route /drafts (およびその子ルート)
 * @requires 'use client'
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * 下書きページのエラーコンポーネント
 */
export default function DraftsError({
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
      title="下書きを読み込めません"
      description="下書きの取得に失敗しました。再試行してください。"
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
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      }
      linkHref="/feed"
      linkLabel="タイムラインへ"
    />
  )
}
