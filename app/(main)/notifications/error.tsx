/**
 * @fileoverview 通知ページのエラーバウンダリ
 *
 * このファイルはNext.js App Routerの規約に従ったエラーUIコンポーネントです。
 * /notificationsページで発生したエラーをキャッチして表示します。
 *
 * @route /notifications
 * @requires 'use client' - エラーバウンダリはクライアントコンポーネントである必要がある
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * 通知ページのエラーコンポーネント
 */
export default function NotificationsError({
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
      title="通知を読み込めません"
      description="通知の取得に失敗しました。再試行してください。"
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
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
      }
    />
  )
}
