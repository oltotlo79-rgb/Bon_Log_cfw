/**
 * ミュートボタンコンポーネント
 *
 * @module components/user/MuteButton
 */

'use client'

/**
 * React useState Hook
 * ミュート状態、ローディング状態、ダイアログ表示状態の管理に使用
 */
import { useState } from 'react'

/**
 * shadcn/ui Buttonコンポーネント
 * クリック可能なボタンUI
 */
import { Button } from '@/components/ui/button'

/**
 * shadcn/ui AlertDialogコンポーネント群
 * ミュート確認用のダイアログUI
 *
 * - AlertDialog: ダイアログのコンテナ
 * - AlertDialogAction: 確認ボタン（ミュート実行）
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
 * ミュート/ミュート解除用Server Action
 * - muteUser: ユーザーをミュート
 * - unmuteUser: ミュートを解除
 */
import { muteUser, unmuteUser } from '@/lib/actions/mute'

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
import { MSG_ERROR_TITLE, MSG_MUTE_REMOVED_DESCRIPTION, MSG_MUTE_REMOVED_TITLE } from '@/lib/constants/messages'

/**
 * React QueryのuseQueryClientフック
 * 操作成功時にタイムラインキャッシュを無効化
 */
import { useQueryClient } from '@tanstack/react-query'

/**
 * MuteButtonコンポーネントのprops型
 *
 * @property userId - ミュート対象のユーザーID
 * @property nickname - ミュート対象のユーザー名（ダイアログ表示用）
 * @property initialIsMuted - 初期のミュート状態（true=ミュート中）
 * @property variant - ボタンのスタイル（default, ghost, destructive）
 * @property size - ボタンのサイズ（default, sm, lg, icon）
 */
type MuteButtonProps = {
  userId: string
  nickname: string
  initialIsMuted: boolean
  variant?: 'default' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

/**
 * ミュートボタンコンポーネント
 *
 * ## 機能
 * - クリックでミュート/ミュート解除をトグル
 * - ミュート時は確認ダイアログを表示
 * - ミュート解除は確認なしで即実行
 * - Optimistic UIで即時フィードバック
 *
 * ## ユーザー体験
 * - ミュート時はダイアログで効果を説明
 * - トースト通知で操作完了を確認
 *
 * @param userId - ミュート対象のユーザーID
 * @param nickname - ユーザー名（表示用）
 * @param initialIsMuted - 初期ミュート状態
 * @param variant - ボタンスタイル
 * @param size - ボタンサイズ
 *
 * @example
 * ```tsx
 * <MuteButton
 *   userId="user123"
 *   nickname="盆栽太郎"
 *   initialIsMuted={false}
 *   variant="ghost"
 *   size="sm"
 * />
 * ```
 */
export function MuteButton({
  userId,
  nickname,
  initialIsMuted,
  variant = 'ghost',
  size = 'default',
}: MuteButtonProps) {

  /**
   * ミュート状態
   * true: ミュート中, false: ミュートしていない
   */
  const [isMuted, setIsMuted] = useState(initialIsMuted)

  /**
   * ローディング状態
   * Server Action呼び出し中はtrueになり、ボタンが無効化される
   */
  const [loading, setLoading] = useState(false)

  /**
   * ダイアログ表示状態
   * ミュート確認ダイアログの開閉を制御
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
   * ミュート実行ハンドラ
   *
   * ## 処理フロー
   * 1. ローディング開始、ダイアログを閉じる
   * 2. Optimistic UIで即座にミュート状態に更新
   * 3. Server Actionでミュートを実行
   * 4. エラー時はロールバックしてエラートーストを表示
   * 5. 成功時は成功トーストを表示
   * 6. ページをリフレッシュ
   */
  async function handleMute() {
    setLoading(true)
    setShowDialog(false)

    // Optimistic UI: 即座にミュート状態に更新
    setIsMuted(true)

    // Server Actionでミュートを実行
    const result = await muteUser(userId)

    if (!result.success) {
      setIsMuted(false)
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'ミュートしました',
        description: `${nickname}さんをミュートしました`,
      })
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  async function handleUnmute() {
    setLoading(true)

    setIsMuted(false)

    const result = await unmuteUser(userId)

    if (!result.success) {
      setIsMuted(true)
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: MSG_MUTE_REMOVED_TITLE,
        description: MSG_MUTE_REMOVED_DESCRIPTION(nickname),
      })
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  return (
    <>
      {/* ミュート/ミュート解除ボタン */}
      <Button
        onClick={() => {
          if (isMuted) {
            // ミュート中の場合: 確認なしでミュート解除
            handleUnmute()
          } else {
            // 未ミュートの場合: 確認ダイアログを表示
            setShowDialog(true)
          }
        }}
        disabled={loading}
        variant={variant}
        size={size}
      >
        {/* ボタンテキスト: ローディング中は「...」、それ以外は状態に応じて表示 */}
        {loading ? '...' : isMuted ? 'ミュート解除' : 'ミュート'}
      </Button>

      {/* ミュート確認ダイアログ */}
      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            {/* ダイアログタイトル */}
            <AlertDialogTitle>{nickname}さんをミュートしますか?</AlertDialogTitle>
            {/* ダイアログ説明: ミュートの効果を箇条書きで説明 */}
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground text-sm">
                ミュートすると、以下の効果があります:
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>タイムラインに投稿が表示されなくなります</li>
                  <li>通知が表示されなくなります</li>
                </ul>
                {/* ブロックとの違いを説明 */}
                <span className="block mt-2">フォロー関係は維持されます。</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            {/* キャンセルボタン: ダイアログを閉じる */}
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            {/* ミュート実行ボタン */}
            <AlertDialogAction onClick={handleMute}>ミュート</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
