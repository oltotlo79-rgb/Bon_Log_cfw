/**
 * @file イベント一覧ページのエラーUI
 * @description イベント一覧ページでエラーが発生した際に表示されるエラーバウンダリ。
 * Next.js App Routerの規約により、このファイルはerror.tsx として配置することで
 * 同階層のpage.tsxで発生したエラーを自動的にキャッチして表示する。
 *
 * 注意: error.tsxはClient Componentである必要がある（'use client'が必須）
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * イベント一覧ページのエラーコンポーネント
 */
export default function EventsError({
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
      title="イベント一覧を読み込めません"
      description="イベントの取得に失敗しました。再試行してください。"
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
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      }
    />
  )
}
