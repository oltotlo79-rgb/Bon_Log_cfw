/**
 * 機能概要:
 * - メールアドレス入力フォームの表示
 * - パスワードリセット用メールの送信申請
 * - shadcn/uiのCardコンポーネントによるレイアウト
 *
 * @remarks
 * パスワードリセットのフローは以下の通りです:
 * 1. このページでメールアドレスを入力
 * 2. リセット用リンクがメールで送信される
 * 3. ユーザーはメール内のリンクをクリック
 * 4. /password-reset/confirm ページで新しいパスワードを設定
 *
 * セキュリティ上の配慮として、メールアドレスが登録されているかどうかに
 * 関わらず、同じメッセージを表示することが推奨されます。
 */

import type { Metadata } from 'next'
import { ROUTE_PASSWORD_RESET } from '@/lib/constants/routes'
import { pageCanonical } from '@/lib/utils/seo'

export const metadata: Metadata = {
  title: 'パスワードリセット',
  description: 'パスワードをお忘れの場合は、登録メールアドレスを入力してリセットできます。',
  alternates: { canonical: pageCanonical(ROUTE_PASSWORD_RESET) },
  robots: { index: false, follow: false },
}

// shadcn/uiのCardコンポーネント群
// 統一されたカードUIを提供するためのコンポーネント
import { Card, CardContent, CardHeader } from '@/components/ui/card'

// パスワードリセット申請フォームコンポーネント（Client Component）
// メールアドレス入力とリセットメール送信処理を担当
import { PasswordResetForm } from '@/components/auth/PasswordResetForm'

/**
 * パスワードリセット申請ページのメインコンポーネント
 *
 * 処理内容:
 * - Cardコンポーネントでフォームをラップして表示
 * - タイトル「パスワードリセット」を表示
 * - PasswordResetFormコンポーネントをレンダリング
 *
 * @remarks
 * シンプルなラッパーコンポーネントとして機能し、
 * 実際のフォーム処理ロジックはPasswordResetFormに委譲しています。
 *
 * @returns パスワードリセット申請ページのJSX要素
 */
export default function PasswordResetPage() {
  return (
    // shadcn/uiのCardコンポーネントでフォームを囲む
    <Card>
      <CardHeader>
        {/* ページタイトル - 中央揃えで表示。
            CardTitle は <div> 要素として描画されるため、
            ドキュメントランドマークとしての <h1> を直接埋め込む。 */}
        <h1 className="text-center text-base font-semibold tracking-wide">
          パスワードリセット
        </h1>
      </CardHeader>

      <CardContent>
        <PasswordResetForm />
      </CardContent>
    </Card>
  )
}
