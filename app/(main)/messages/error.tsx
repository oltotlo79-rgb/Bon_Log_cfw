/**
 * @fileoverview メッセージ一覧・会話ページのエラーバウンダリ
 *
 * このファイルはNext.js App Routerの規約に従ったエラーUIコンポーネントです。
 * /messagesページおよびその子ルートで発生したエラーをキャッチして表示します。
 *
 * @route /messages (およびその子ルート)
 * @requires 'use client' - エラーバウンダリはクライアントコンポーネントである必要がある
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * メッセージページのエラーコンポーネント
 */
export default function MessagesError({
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
      title="メッセージを読み込めません"
      description="メッセージの取得に失敗しました。再試行してください。"
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
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      }
    />
  )
}
