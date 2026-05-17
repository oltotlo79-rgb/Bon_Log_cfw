/**
 * @file 管理画面のエラーバウンダリ
 * @description 管理画面でエラーが発生した際に表示されるエラー画面
 *
 * Next.js App Routerのerror.tsx規約に基づき、
 * /admin およびその子ルートで発生したエラーをキャッチして表示します。
 *
 * @route /admin (およびその子ルート)
 * @requires 'use client'
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * 管理画面のエラーコンポーネント
 */
export default function AdminError({
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
      title="管理画面を読み込めません"
      description="データの取得に失敗しました。再試行してください。"
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
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      }
      linkHref="/admin"
      linkLabel="ダッシュボードへ"
    />
  )
}
