/**
 * 投稿削除ボタンコンポーネント
 *
 * @module components/post/DeletePostButton
 */

'use client'

/**
 * React useState Hook
 * ダイアログの開閉状態とローディング状態の管理
 */
import { useState } from 'react'

/**
 * Next.jsルーター
 * 削除後のページ更新に使用
 */
import { useRouter } from 'next/navigation'

/**
 * React Query クライアント
 * 削除成功時にタイムラインキャッシュを無効化
 */
import { useQueryClient } from '@tanstack/react-query'

/**
 * トースト通知
 * 操作結果のフィードバックに使用
 */
import { useToast } from '@/hooks/use-toast'

/**
 * shadcn/uiのButtonコンポーネント
 */
import { Button } from '@/components/ui/button'

/**
 * shadcn/uiのAlertDialogコンポーネント群
 * 削除確認ダイアログの構築に使用
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
 * 投稿削除用Server Action
 */
import { deletePost } from '@/lib/actions/post'

/**
 * UI メッセージ定数
 */
import { MSG_ERROR_TITLE, MSG_POST_DELETED, MSG_POST_DELETE_FAILED } from '@/lib/constants/messages'

/**
 * DeletePostButtonコンポーネントのprops型
 *
 * @property postId - 削除対象の投稿ID
 * @property variant - 表示形式（icon: アイコンのみ, menu: テキスト付きメニュー）
 * @property onDeleted - 削除成功時のコールバック
 */
type DeletePostButtonProps = {
  postId: string
  variant?: 'icon' | 'menu'
  onDeleted?: () => void
}

/**
 * ゴミ箱アイコン
 *
 * @param className - 追加のCSSクラス
 */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

/**
 * 投稿削除ボタンコンポーネント
 *
 * ## 機能
 * - 削除確認ダイアログを表示
 * - 確認後、投稿を削除
 * - 削除成功時にキャッシュを更新
 *
 * ## 表示形式
 * - icon: ゴミ箱アイコンのみ（PostCard等で使用）
 * - menu: アイコン + テキスト（ドロップダウンメニュー等で使用）
 *
 * @param postId - 投稿ID
 * @param variant - 表示形式
 * @param onDeleted - 削除成功コールバック
 *
 * @example
 * ```tsx
 * <DeletePostButton
 *   postId="post123"
 *   variant="icon"
 *   onDeleted={() => router.push('/feed')}
 * />
 * ```
 */
export function DeletePostButton({ postId, variant = 'icon', onDeleted }: DeletePostButtonProps) {

  /**
   * ローディング状態
   * 削除処理中はtrueになり、ボタンを無効化
   */
  const [loading, setLoading] = useState(false)

  /**
   * ダイアログの開閉状態
   */
  const [open, setOpen] = useState(false)

  /**
   * Next.jsルーター
   */
  const router = useRouter()

  /**
   * React Queryクライアント
   */
  const queryClient = useQueryClient()

  /**
   * トースト通知
   */
  const { toast } = useToast()

  /**
   * 削除実行ハンドラ
   *
   * ## 処理フロー
   * 1. Server Actionで投稿を削除
   * 2. 成功時: 各種キャッシュを無効化
   * 3. ページを更新
   * 4. コールバックを実行（指定されている場合）
   * 5. ダイアログを閉じる
   */
  async function handleDelete() {
    setLoading(true)
    const result = await deletePost(postId)

    if (result.success) {
      /**
       * React Queryのキャッシュを無効化
       *
       * 複数のクエリキーを無効化して、
       * タイムラインやユーザー投稿一覧を最新の状態に更新
       */
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['posts'] })
      await queryClient.invalidateQueries({ queryKey: ['userPosts'] })

      /**
       * サーバーコンポーネントを再取得
       */
      router.refresh()

      /**
       * 成功トースト通知
       */
      toast({
        description: MSG_POST_DELETED,
      })

      /**
       * 削除成功コールバックを実行
       */
      onDeleted?.()
    } else {
      /**
       * エラートースト通知
       */
      toast({
        title: MSG_ERROR_TITLE,
        description: MSG_POST_DELETE_FAILED,
        variant: 'destructive',
      })
    }
    setLoading(false)
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {/* トリガーボタン（クリックでダイアログを開く） */}
      <AlertDialogTrigger asChild>
        {/* 表示形式に応じてボタンを切り替え */}
        {variant === 'icon' ? (
          /* アイコン形式: PostCardのアクションバー等で使用 */
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label="投稿を削除"
          >
            <TrashIcon className="w-4 h-4" aria-hidden="true" />
          </Button>
        ) : (
          /* メニュー形式: ドロップダウンメニュー等で使用 */
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            aria-label="投稿を削除"
          >
            <TrashIcon className="w-4 h-4" aria-hidden="true" />
            <span>削除する</span>
          </button>
        )}
      </AlertDialogTrigger>

      {/* 確認ダイアログ本体 */}
      <AlertDialogContent>
        {/* ダイアログヘッダー */}
        <AlertDialogHeader>
          <AlertDialogTitle>投稿を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。投稿に対するコメントやいいねも削除されます。
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* ダイアログフッター（アクションボタン） */}
        <AlertDialogFooter>
          {/* キャンセルボタン */}
          <AlertDialogCancel>キャンセル</AlertDialogCancel>

          {/* 削除実行ボタン */}
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
  )
}
