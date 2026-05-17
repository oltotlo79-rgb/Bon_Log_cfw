/**
 * @file イベント詳細ページのエラーUI
 * @description イベント詳細ページでエラーが発生した際に表示されるエラーバウンダリ。
 * Next.js App Routerの規約により、このファイルはerror.tsx として配置することで
 * 同階層のpage.tsxで発生したエラーを自動的にキャッチして表示する。
 *
 * 注意: error.tsxはClient Componentである必要がある（'use client'が必須）
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * イベント詳細ページのエラーコンポーネント
 */
export default function EventError({
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
      title="イベント情報を表示できません"
      description="イベントが見つからないか、終了している可能性があります。"
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
      linkHref="/events"
      linkLabel="イベント一覧へ"
    />
  )
}
