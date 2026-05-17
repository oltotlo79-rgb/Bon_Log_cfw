/**
 * @file DeleteEventButton.tsx
 * @description イベント削除ボタンコンポーネント
 *
 * 目的:
 * - イベント作成者がイベントを削除できる機能を提供する
 * - 誤操作を防ぐための確認ダイアログを表示する
 * - 削除処理の成功/失敗をユーザーに通知する
 *
 * 機能概要:
 * - 2段階の確認プロセス（削除ボタン → 確認ダイアログ）
 * - Server Actionによる非同期削除処理
 * - エラーハンドリングとエラーメッセージ表示
 * - 削除成功時はイベント一覧ページへリダイレクト
 *
 * 使用例:
 * ```tsx
 * // イベント詳細ページで使用
 * {isOwner && <DeleteEventButton eventId={event.id} />}
 * ```
 */

// Client Componentとして宣言（useStateを使用するため）
'use client'

// React Hooks - 状態管理に使用
import { useState } from 'react'

// Next.jsのルーター - ページ遷移に使用
import { useRouter } from 'next/navigation'

// shadcn/uiのButtonコンポーネント
import { Button } from '@/components/ui/button'

// イベント削除のServer Action
import { deleteEvent } from '@/lib/actions/event'
import { ROUTE_EVENTS } from '@/lib/constants/routes'

// lucide-reactのゴミ箱アイコン
import { Trash2 } from 'lucide-react'

/**
 * DeleteEventButtonコンポーネントのプロパティ型定義
 */
interface DeleteEventButtonProps {
  /** 削除対象のイベントID */
  eventId: string
}

/**
 * イベント削除ボタンコンポーネント
 * 削除ボタンと確認ダイアログを提供し、イベント削除処理を行う
 *
 * @param props - コンポーネントのプロパティ
 * @returns イベント削除UIのReact要素
 */
export function DeleteEventButton({ eventId }: DeleteEventButtonProps) {
  // ------------------------------------------------------------
  // 状態管理
  // ------------------------------------------------------------

  /**
   * 確認ダイアログの表示状態
   * true: 確認ダイアログ表示中、false: 削除ボタンのみ表示
   */
  const [showConfirm, setShowConfirm] = useState(false)

  /**
   * 削除処理の実行中フラグ
   * true: 削除処理中（ボタン無効化）、false: 処理待機中
   */
  const [loading, setLoading] = useState(false)

  /**
   * エラーメッセージ
   * 削除処理が失敗した場合のエラーメッセージを保持
   */
  const [error, setError] = useState<string | null>(null)

  // プログラムによるページ遷移に使用
  const router = useRouter()

  /**
   * 削除実行ハンドラ
   * Server Actionを呼び出してイベントを削除する
   * 成功時はイベント一覧ページへリダイレクト
   */
  async function handleDelete() {
    // ローディング状態を開始し、前回のエラーをクリア
    setLoading(true)
    setError(null)

    try {
      // Server Actionを呼び出してイベントを削除
      const result = await deleteEvent(eventId)

      // エラーが返された場合はエラーメッセージを表示
      if (result && 'error' in result) {
        setError(result.error ?? '削除に失敗しました')
        setLoading(false)
        return
      }

      // 削除成功: イベント一覧ページへリダイレクト
      router.push(ROUTE_EVENTS)
      // ページデータを最新に更新（キャッシュをリフレッシュ）
      router.refresh()
    } catch {
      // 予期しないエラーが発生した場合のフォールバック
      setError('イベントの削除に失敗しました')
      setLoading(false)
    }
  }

  // ------------------------------------------------------------
  // 確認ダイアログの表示（showConfirm = true の場合）
  // ------------------------------------------------------------
  if (showConfirm) {
    return (
      <div className="space-y-3" role="dialog" aria-label="削除確認">
        {/* 確認メッセージ: 削除の取り消し不可を明示 */}
        <p className="text-sm text-destructive font-medium">
          このイベントを削除しますか？この操作は取り消せません。
        </p>
        {/* エラーメッセージの表示エリア */}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          {/* 削除実行ボタン: 赤色（destructive）で警告感を表現 */}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading} // 削除処理中は無効化
          >
            {loading ? '削除中...' : '削除する'}
          </Button>
          {/* キャンセルボタン: 確認ダイアログを閉じて元に戻る */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowConfirm(false) // ダイアログを閉じる
              setError(null) // エラーメッセージをクリア
            }}
            disabled={loading} // 削除処理中は無効化
          >
            キャンセル
          </Button>
        </div>
      </div>
    )
  }

  // ------------------------------------------------------------
  // 初期表示: 削除ボタン
  // ------------------------------------------------------------
  return (
    // 削除ボタン: クリックすると確認ダイアログを表示
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowConfirm(true)} // 確認ダイアログを表示
      aria-label="イベントを削除"
    >
      <Trash2 className="h-4 w-4 mr-1" />
      削除
    </Button>
  )
}
