/**
 * ブロックボタンコンポーネント
 *
 * @module components/user/BlockButton
 */

'use client'

/**
 * React useState Hook
 * ブロック状態、ローディング状態、ダイアログ表示状態の管理に使用
 */
import { useState } from 'react'

/**
 * shadcn/ui Buttonコンポーネント
 * クリック可能なボタンUI
 */
import { Button } from '@/components/ui/button'

/**
 * shadcn/ui AlertDialogコンポーネント群
 * ブロック確認用のダイアログUI
 *
 * - AlertDialog: ダイアログのコンテナ
 * - AlertDialogAction: 確認ボタン（ブロック実行）
 * - AlertDialogCancel: キャンセルボタン
 * - AlertDialogContent: ダイアログの内容エリア
 * - AlertDialogDescription: 説明テキスト
 * - AlertDialogFooter: ボタン配置エリア
 * - AlertDialogHeader: タイトルエリア
 * - AlertDialogTitle: ダイアログのタイトル
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
} from '@/components/ui/alert-dialog'

/**
 * ブロック/ブロック解除用Server Action
 * - blockUser: ユーザーをブロック
 * - unblockUser: ブロックを解除
 */
import { blockUser, unblockUser } from '@/lib/actions/block'

/**
 * Next.js useRouter Hook
 * 認証エラー時のリダイレクトに使用
 */
import { useRouter } from 'next/navigation'

/**
 * トースト通知用カスタムHook
 * 操作結果（成功/エラー）をユーザーに通知
 */
import { useToast } from '@/hooks/use-toast'
import {
  MSG_BLOCK_ADDED_DESCRIPTION,
  MSG_BLOCK_ADDED_TITLE,
  MSG_BLOCK_REMOVED_DESCRIPTION,
  MSG_BLOCK_REMOVED_TITLE,
  MSG_ERROR_TITLE,
} from '@/lib/constants/messages'

/**
 * React QueryのuseQueryClientフック
 * 操作成功時にタイムラインキャッシュを無効化
 */
import { useQueryClient } from '@tanstack/react-query'

/**
 * BlockButtonコンポーネントのprops型
 *
 * @property userId - ブロック対象のユーザーID
 * @property nickname - ブロック対象のユーザー名（ダイアログ表示用）
 * @property initialIsBlocked - 初期のブロック状態（true=ブロック中）
 * @property variant - ボタンのスタイル（default, ghost, destructive）
 * @property size - ボタンのサイズ（default, sm, lg, icon）
 */
type BlockButtonProps = {
  userId: string
  nickname: string
  initialIsBlocked: boolean
  variant?: 'default' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * ブロックボタンコンポーネント
 *
 * ## 機能
 * - クリックでブロック/ブロック解除をトグル
 * - ブロック時は確認ダイアログを表示
 * - ブロック解除は確認なしで即実行
 * - Optimistic UIで即時フィードバック
 *
 * ## ユーザー体験
 * - ブロック時はダイアログで影響を説明
 * - トースト通知で操作完了を確認
 *
 * @param userId - ブロック対象のユーザーID
 * @param nickname - ユーザー名（表示用）
 * @param initialIsBlocked - 初期ブロック状態
 * @param variant - ボタンスタイル
 * @param size - ボタンサイズ
 *
 * @example
 * ```tsx
 * <BlockButton
 *   userId="user123"
 *   nickname="盆栽太郎"
 *   initialIsBlocked={false}
 *   variant="ghost"
 *   size="sm"
 * />
 * ```
 */
export function BlockButton({
  userId,
  nickname,
  initialIsBlocked,
  variant = 'ghost',
  size = 'default',
}: BlockButtonProps) {

  /**
   * ブロック状態
   * true: ブロック中, false: ブロックしていない
   */
  const [isBlocked, setIsBlocked] = useState(initialIsBlocked)

  /**
   * ローディング状態
   * Server Action呼び出し中はtrueになり、ボタンが無効化される
   */
  const [loading, setLoading] = useState(false)

  /**
   * ダイアログ表示状態
   * ブロック確認ダイアログの開閉を制御
   */
  const [showDialog, setShowDialog] = useState(false)

  /**
   * Next.jsルーター
   * 認証エラー時のリダイレクトに使用（将来の機能拡張用）
   */
  const _router = useRouter()

  /**
   * トースト通知
   * 操作結果をユーザーに通知
   */
  const { toast } = useToast()

  /**
   * React Queryクライアント
   * タイムラインキャッシュの無効化に使用
   */
  const queryClient = useQueryClient()

  /**
   * ブロック実行ハンドラ
   *
   * ## 処理フロー
   * 1. ローディング開始、ダイアログを閉じる
   * 2. Optimistic UIで即座にブロック状態に更新
   * 3. Server Actionでブロックを実行
   * 4. エラー時はロールバックしてエラートーストを表示
   * 5. 成功時は成功トーストを表示
   * 6. ページをリフレッシュ
   */
  async function handleBlock() {
    setLoading(true)
    setShowDialog(false)

    // Optimistic UI: 即座にブロック状態に更新
    setIsBlocked(true)

    // Server Actionでブロックを実行
    const result = await blockUser(userId)

    if (!result.success) {
      setIsBlocked(false)
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: MSG_BLOCK_ADDED_TITLE,
        description: MSG_BLOCK_ADDED_DESCRIPTION(nickname),
      })
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  async function handleUnblock() {
    setLoading(true)

    setIsBlocked(false)

    const result = await unblockUser(userId)

    if (!result.success) {
      setIsBlocked(true)
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: MSG_BLOCK_REMOVED_TITLE,
        description: MSG_BLOCK_REMOVED_DESCRIPTION(nickname),
      })
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  return (
    <>
      {/* ブロック/ブロック解除ボタン */}
      <Button
        onClick={() => {
          if (isBlocked) {
            // ブロック中の場合: 確認なしでブロック解除
            handleUnblock()
          } else {
            // 未ブロックの場合: 確認ダイアログを表示
            setShowDialog(true)
          }
        }}
        disabled={loading}
        variant={variant}
        size={size}
      >
        {/* ボタンテキスト: ローディング中は「...」、それ以外は状態に応じて表示 */}
        {loading ? '...' : isBlocked ? 'ブロック解除' : 'ブロック'}
      </Button>

      {/* ブロック確認ダイアログ */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* ダイアログタイトル */}
            <AlertDialogTitle>{nickname}さんをブロックしますか?</AlertDialogTitle>
            {/* ダイアログ説明: ブロックの影響を箇条書きで説明 */}
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground text-sm">
                ブロックすると、以下の操作が行われます:
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>相互フォローが解除されます</li>
                  <li>相手の投稿が表示されなくなります</li>
                  <li>相手からのコメントが表示されなくなります</li>
                  <li>相手はあなたのプロフィールにアクセスできなくなります</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* キャンセルボタン: ダイアログを閉じる */}
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {/* ブロック実行ボタン: 赤色で強調 */}
            <AlertDialogAction
              onClick={handleBlock}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              ブロック
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
