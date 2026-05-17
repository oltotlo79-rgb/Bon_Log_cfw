/**
 * メッセージ送信ボタンコンポーネント
 *
 * @module components/message/MessageButton
 */

'use client'

/**
 * React Hooks
 * useState: エラーメッセージの状態管理
 * useTransition: 非同期処理の状態管理（isPendingフラグ）
 */
import { useState, useTransition } from 'react'

/**
 * Next.js ルーターフック
 * 会話画面への遷移に使用
 */
import { useRouter } from 'next/navigation'

/**
 * 会話取得/作成用Server Action
 * 既存の会話があればそれを返し、なければ新規作成する
 */
import { getOrCreateConversation } from '@/lib/actions/message'

/**
 * shadcn/ui ボタンコンポーネント
 * 統一されたスタイルのボタンを提供
 */
import { Button } from '@/components/ui/button'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

/**
 * メッセージアイコン（吹き出し型）
 *
 * SVGで描画されるメッセージアイコンコンポーネント。
 * Lucide Iconsの "message-square" を参考にした実装。
 *
 * @param className - 追加のCSSクラス（サイズ調整などに使用）
 */
function MessageSquareIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      {/* 吹き出し本体のパス */}
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

/**
 * MessageButtonコンポーネントのprops型定義
 *
 * @property userId - メッセージを送る相手のユーザーID
 * @property isBlocked - 相手がブロック中かどうか（trueの場合ボタン無効化）
 */
interface MessageButtonProps {
  userId: string
  isBlocked?: boolean
}

/**
 * メッセージ送信ボタンコンポーネント
 *
 * ユーザープロフィールページに表示され、クリックすると
 * そのユーザーとのダイレクトメッセージ画面に遷移します。
 *
 * ## 動作フロー
 * 1. ボタンクリック
 * 2. getOrCreateConversation Server Actionを呼び出し
 * 3. 既存の会話があればそのID、なければ新規作成したIDを取得
 * 4. /messages/{conversationId} に遷移
 *
 * @param userId - メッセージ相手のユーザーID
 * @param isBlocked - ブロック状態（デフォルト: false）
 *
 * @returns メッセージボタンのJSX
 */
export function MessageButton({ userId, isBlocked = false }: MessageButtonProps) {
  /** ページ遷移用のルーター */
  const router = useRouter()

  /**
   * 非同期処理の状態管理
   * isPending: 処理中フラグ（trueの間はボタン無効化）
   * startTransition: 非同期処理を開始する関数
   */
  const [isPending, startTransition] = useTransition()

  /**
   * エラーメッセージの状態
   * null: エラーなし
   * string: エラーメッセージを表示
   */
  const [error, setError] = useState<string | null>(null)

  /**
   * ボタンクリック時のハンドラ
   *
   * 会話を取得または作成し、会話画面に遷移します。
   * ブロック中の場合は何もしません。
   */
  const handleClick = () => {
    // ブロック中の場合は処理しない
    if (isBlocked) return

    // エラー状態をクリア
    setError(null)

    // useTransitionで非同期処理を実行
    startTransition(async () => {
      // Server Actionで会話を取得/作成
      const result = await getOrCreateConversation(userId)

      // エラーが発生した場合
      if (!result.success) {
        setError(result.error ?? MSG_ERROR_FALLBACK)
        return
      }

      // 成功した場合は会話画面に遷移
      if (result.data?.conversationId) {
        router.push(`/messages/${result.data.conversationId}`)
      }
    })
  }

  return (
    <>
      {/* メッセージボタン */}
      <Button
        variant="outline"
        size="icon"
        onClick={handleClick}
        disabled={isPending || isBlocked}
        aria-label={isBlocked ? 'メッセージを送れません' : 'メッセージを送る'}
      >
        <MessageSquareIcon className="w-4 h-4" aria-hidden="true" />
      </Button>

      {/* エラーメッセージ表示 */}
      {error && (
        <span className="text-xs text-destructive">{error}</span>
      )}
    </>
  )
}
