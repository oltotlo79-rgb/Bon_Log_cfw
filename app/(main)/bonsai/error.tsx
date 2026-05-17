/**
 * @file 盆栽関連ページのエラーバウンダリ
 * @description 盆栽ページでエラーが発生した際に表示されるエラー画面
 *              Next.js App Routerのerror.tsxファイル規約に基づく実装
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * 盆栽エラー画面コンポーネント
 */
export default function BonsaiError({
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
      title="盆栽情報を読み込めません"
      description="盆栽の取得に失敗しました。再試行してください。"
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
            d="M12 3c-3 2-5 5-5 8 0 2 1 3.5 3 4.5M12 3c3 2 5 5 5 8 0 2-1 3.5-3 4.5M12 15v4M7 19h10"
          />
        </svg>
      }
      linkHref="/feed"
      linkLabel="タイムラインへ"
    />
  )
}
