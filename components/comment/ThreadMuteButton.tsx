/**
 * スレッドミュートボタンコンポーネント
 *
 * @module components/comment/ThreadMuteButton
 */

'use client'

/**
 * React Hooks
 * useState: ミュート状態とローディング状態の管理
 */
import { useState } from 'react'

/**
 * Lucide Reactアイコン
 * BellOff: ミュート中のベルオフアイコン
 * Bell: 通知オンのベルアイコン
 */
import { BellOff, Bell } from 'lucide-react'

/**
 * shadcn/ui Buttonコンポーネント
 * ミュートトグルボタンのベースコンポーネント
 */
import { Button } from '@/components/ui/button'

/**
 * Server Actions
 * muteThread: スレッドをミュートする
 * unmuteThread: スレッドのミュートを解除する
 */
import { muteThread, unmuteThread } from '@/lib/actions/comment-thread-mute'

/**
 * ThreadMuteButtonコンポーネントのprops型
 *
 * @property rootCommentId - ルート（親）コメントのID（スレッド全体を識別）
 * @property initialMuted - 初期のミュート状態（true: ミュート済み）
 */
type ThreadMuteButtonProps = {
  rootCommentId: string
  initialMuted: boolean
}

/**
 * スレッドミュートボタンコンポーネント
 *
 * コメントスレッドの通知をミュート/解除するトグルボタン。
 * クリックで即座に状態を更新し、バックグラウンドでServer Actionを実行する。
 *
 * ## 動作説明
 * - ミュートされたスレッドは、返信があっても通知が届かない
 * - ベルアイコン: 通知オン（クリックでミュート）
 * - ベルオフアイコン: 通知ミュート中（クリックで解除）
 *
 * @param rootCommentId - ルートコメントID
 * @param initialMuted - 初期ミュート状態
 */
export function ThreadMuteButton({ rootCommentId, initialMuted }: ThreadMuteButtonProps) {

  /**
   * 現在のミュート状態
   * trueの場合、このスレッドはミュート済み
   */
  const [muted, setMuted] = useState(initialMuted)

  /**
   * Server Action実行中のローディング状態
   * trueの間はボタンが無効化される
   */
  const [loading, setLoading] = useState(false)

  /**
   * ミュートトグルハンドラ
   *
   * ボタンをクリックした際に実行される。
   * 現在のミュート状態に応じて、ミュートまたはミュート解除のServer Actionを呼び出す。
   *
   * ## 処理フロー
   * 1. ローディング状態をtrueに設定
   * 2. 現在の状態に応じてServer Actionを実行
   *    - ミュート中の場合: unmuteThread（解除）
   *    - 通知オンの場合: muteThread（ミュート）
   * 3. エラーがない場合、状態を反転
   * 4. ローディング状態をfalseに戻す
   */
  async function handleToggle() {
    setLoading(true)

    // 現在の状態に応じてServer Actionを選択
    const result = muted
      ? await unmuteThread(rootCommentId)  // ミュート解除
      : await muteThread(rootCommentId)     // ミュート

    if (result.success) {
      setMuted(!muted)
    }

    setLoading(false)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-muted-foreground"
      onClick={handleToggle}
      disabled={loading}
      // ホバー時のツールチップテキスト
      title={muted ? 'スレッド通知をオンにする' : 'スレッド通知をミュート'}
      aria-label={muted ? 'スレッド通知をオンにする' : 'スレッド通知をミュート'}
    >
      {/* ミュート状態に応じてアイコンを切り替え */}
      {muted ? (
        // ミュート中: ベルオフアイコン
        <BellOff className="w-4 h-4" />
      ) : (
        // 通知オン: ベルアイコン
        <Bell className="w-4 h-4" />
      )}
    </Button>
  )
}
