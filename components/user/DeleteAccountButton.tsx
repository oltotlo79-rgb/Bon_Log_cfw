/**
 * アカウント削除ボタンコンポーネント
 *
 * @module components/user/DeleteAccountButton
 */

'use client'

/**
 * React useState Hook
 * ローディング状態とエラー状態の管理に使用
 */
import { useState } from 'react'

/**
 * NextAuth.js signOut関数
 * アカウント削除後にユーザーをログアウトさせるために使用
 */
import { signOut } from 'next-auth/react'

/**
 * shadcn/ui Buttonコンポーネント
 * アカウント削除ボタンに使用
 */
import { Button } from '@/components/ui/button'

/**
 * shadcn/ui AlertDialogコンポーネント群
 * アカウント削除確認ダイアログのUI
 *
 * - AlertDialog: ダイアログのコンテナ
 * - AlertDialogAction: 確認ボタン（削除実行）
 * - AlertDialogCancel: キャンセルボタン
 * - AlertDialogContent: ダイアログの内容エリア
 * - AlertDialogDescription: 説明テキスト
 * - AlertDialogFooter: ボタン配置エリア
 * - AlertDialogHeader: タイトルエリア
 * - AlertDialogTitle: ダイアログのタイトル
 * - AlertDialogTrigger: ダイアログを開くトリガー
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

/**
 * アカウント削除用Server Action
 * データベースからユーザーとその関連データを完全に削除
 */
import { deleteAccount } from '@/lib/actions/user'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * アカウント削除ボタンコンポーネント
 *
 * ## 機能
 * - 「アカウントを削除」ボタンをクリックすると確認ダイアログを表示
 * - 確認ダイアログで「削除する」をクリックするとアカウントを削除
 * - 削除成功後は自動的にログアウトしてトップページへリダイレクト
 * - エラー発生時はエラーメッセージを表示
 *
 * ## UI構成
 * - 上部: 削除の影響を説明するテキスト
 * - 中央: 赤い「アカウントを削除」ボタン
 * - ダイアログ: 確認メッセージとキャンセル/削除ボタン
 * - 下部: エラーメッセージ（エラー時のみ）
 *
 * ## セキュリティ
 * - Server Actionで認証チェックを行う
 * - 確認ダイアログにより誤操作を防止
 *
 * @example
 * ```tsx
 * // 設定ページでの使用例
 * <section>
 *   <h2>危険ゾーン</h2>
 *   <DeleteAccountButton />
 * </section>
 * ```
 */
export function DeleteAccountButton() {

  /**
   * ローディング状態
   * アカウント削除処理中はtrueになり、削除ボタンが無効化される
   */
  const [loading, setLoading] = useState(false)

  /**
   * エラー状態
   * Server Actionがエラーを返した場合にエラーメッセージを格納
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * アカウント削除ハンドラ
   *
   * ## 処理フロー
   * 1. ローディング開始、エラーをクリア
   * 2. Server Actionを呼び出してアカウントを削除
   * 3. エラー時: エラーメッセージを表示
   * 4. 成功時: signOutを呼び出してログアウトし、トップページへリダイレクト
   */
  async function handleDelete() {
    setLoading(true)
    setError(null)

    // Server Actionを呼び出してアカウントを削除
    const result = await deleteAccount()

    if (!result.success) {
      // エラー時: エラーメッセージを表示
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else {
      // 成功時: ログアウトしてトップページへリダイレクト
      await signOut({ callbackUrl: '/' })
    }
  }

  return (
    <div className="space-y-3">
      {/* 削除の影響を説明するテキスト */}
      <p className="text-sm text-muted-foreground">
        アカウントを削除すると、すべての投稿、コメント、いいねなどのデータが完全に削除されます。この操作は取り消せません。
      </p>

      {/* 確認ダイアログ付きの削除ボタン */}
      <AlertDialog>
        {/* ダイアログを開くトリガーボタン */}
        <AlertDialogTrigger asChild>
          <Button variant="destructive">アカウントを削除</Button>
        </AlertDialogTrigger>

        {/* 確認ダイアログの内容 */}
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* ダイアログタイトル */}
            <AlertDialogTitle>本当にアカウントを削除しますか？</AlertDialogTitle>
            {/* ダイアログ説明: 削除される内容を警告 */}
            <AlertDialogDescription>
              この操作は取り消せません。すべての投稿、コメント、いいね、フォロー関係などが完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* キャンセルボタン: ダイアログを閉じる */}
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {/* 削除実行ボタン: 赤色で強調 */}
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? '削除中...' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* エラーメッセージ（エラーがある場合のみ表示） */}
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
