/**
 * @file プロフィール設定ページ専用エラーコンポーネント
 * @description プロフィール設定のデータ取得時にエラーが発生した場合に表示されるUI
 *
 * このファイルはNext.js App Routerの規約に基づくエラーバウンダリです。
 * /settings/profileページでサーバーエラーやネットワークエラーが発生した際に自動的に表示されます。
 *
 * 'use client'ディレクティブが必須です。
 * これはerror.tsxがクライアントサイドでエラーをキャッチする必要があるためです。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling
 */
'use client'

import { PageError } from '@/components/common/PageError'

/**
 * プロフィール設定エラーコンポーネント
 */
export default function ProfileSettingsError({
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
      title="プロフィール設定を表示できません"
      description="プロフィール設定の取得に失敗しました。再試行してください。"
      linkHref="/settings"
      linkLabel="設定トップへ"
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
