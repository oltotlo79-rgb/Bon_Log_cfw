/**
 * 機能概要:
 * - 新しいパスワードの入力フォーム表示
 * - パスワード確認入力によるバリデーション
 * - トークン検証と新パスワードの設定処理
 * - Suspenseによる非同期読み込み対応
 *
 * @remarks
 * パスワードリセットのフローにおける最終ステップです:
 * 1. /password-reset でメールアドレスを入力してリセット申請
 * 2. メールで送信されたリンク（このページへのリンク）をクリック
 * 3. このページで新しいパスワードを入力して設定完了
 *
 * URLにはリセット用トークンがクエリパラメータとして含まれます。
 * このトークンはPasswordResetConfirmFormコンポーネント内で
 * useSearchParamsフックを使用して取得されます。
 *
 * Suspenseを使用している理由:
 * Next.js App RouterではuseSearchParamsを使用するコンポーネントは
 * Suspense境界でラップする必要があります。
 */

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'パスワード再設定',
  description: '新しいパスワードを設定してアカウントを回復できます。',
  // メールリンク経由のトークン専用フローのため、検索結果に表示する価値はない
  robots: { index: false, follow: false },
}

// ReactのSuspenseコンポーネント
// 非同期コンポーネントの読み込み中にフォールバックUIを表示するために使用
import { Suspense } from 'react'

// shadcn/uiのCardコンポーネント群
// 統一されたカードUIを提供するためのコンポーネント
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// パスワードリセット確認フォームコンポーネント（Client Component）
// URLからトークンを取得し、新パスワードの設定処理を担当
import { PasswordResetConfirmForm } from '@/components/auth/PasswordResetConfirmForm'

/**
 * ローディングフォールバックコンポーネント
 *
 * 処理内容:
 * - PasswordResetConfirmFormの読み込み中に表示される
 * - 回転するスピナーと「読み込み中...」テキストを表示
 *
 * @remarks
 * useSearchParamsを使用するコンポーネントはクライアントサイドで
 * 実行される必要があるため、初回読み込み時にこのフォールバックが表示されます。
 *
 * @returns ローディング表示のJSX要素
 */
function LoadingFallback() {
  return (
    // 中央揃えのコンテナ
    <div className="text-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
      <p className="mt-4 text-muted-foreground">読み込み中...</p>
    </div>
  )
}

/**
 * パスワードリセット確認ページのメインコンポーネント
 *
 * 処理内容:
 * - Cardコンポーネントでフォームをラップして表示
 * - タイトル「新しいパスワードを設定」を表示
 * - SuspenseでPasswordResetConfirmFormをラップし、非同期読み込みに対応
 *
 * @remarks
 * PasswordResetConfirmFormはuseSearchParamsを使用するため、
 * Suspense境界でラップする必要があります。
 * これはNext.js App Routerの要件です。
 *
 * @returns パスワードリセット確認ページのJSX要素
 */
export default function PasswordResetConfirmPage() {
  return (
    // shadcn/uiのCardコンポーネントでフォームを囲む
    <Card>
      <CardHeader>
        {/* ページタイトル - 中央揃えで表示。
            CardTitle は <div> 要素として描画されるため、
            ドキュメントランドマークとしての <h1> を直接埋め込む。 */}
        <h1 className="text-center text-base font-semibold tracking-wide">
          新しいパスワードを設定
        </h1>
      </CardHeader>

      <CardContent>
        {/* useSearchParamsを使用するコンポーネントには必須 */}
        <Suspense fallback={<LoadingFallback />}>
          <PasswordResetConfirmForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
