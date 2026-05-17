/**
 * @file 盆栽園マップページのエラーUI
 * @description 盆栽園マップページでエラーが発生した際に表示されるエラーバウンダリ。
 * Next.js App Routerの規約により、このファイルはerror.tsx として配置することで
 * 同階層のpage.tsxで発生したエラーを自動的にキャッチして表示する。
 *
 * 注意: error.tsxはClient Componentである必要がある（'use client'が必須）
 */

'use client'

import { PageError } from '@/components/common/PageError'

/**
 * 盆栽園マップページのエラーコンポーネント
 */
export default function ShopsError({
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
      title="盆栽園マップを読み込めません"
      description="地図の読み込みに失敗しました。再試行してください。"
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
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
      }
    />
  )
}
