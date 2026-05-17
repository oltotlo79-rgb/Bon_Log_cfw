/**
 * @file イベント削除ボタンコンポーネント
 * @description イベントを削除するための確認付きボタンコンポーネント。
 * 削除前に確認ダイアログを表示し、誤削除を防ぐ。
 * 削除完了後はイベント一覧ページにリダイレクトする。
 */

'use client'

// Reactの状態管理・トランジション管理フック
import { useState, useTransition } from 'react'
// Next.jsのルーターフック: プログラマティックなナビゲーション用
import { useRouter } from 'next/navigation'
// イベント削除用のServer Action
import { deleteEvent } from '@/lib/actions/event'
import { ROUTE_EVENTS } from '@/lib/constants/routes'

/**
 * コンポーネントのProps型定義
 */
interface DeleteEventButtonProps {
  eventId: string  // 削除対象のイベントID
}

/**
 * ゴミ箱アイコンコンポーネント
 * 削除ボタンに使用するSVGアイコン
 * @param className - 追加のCSSクラス
 */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18"/>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
      <line x1="10" x2="10" y1="11" y2="17"/>
      <line x1="14" x2="14" y1="11" y2="17"/>
    </svg>
  )
}

/**
 * イベント削除ボタンコンポーネント
 *
 * このClient Componentは以下の機能を提供する:
 * 1. 削除ボタンの表示
 * 2. クリック時に確認ダイアログを表示
 * 3. 確認後にServer Actionを呼び出してイベントを削除
 * 4. 削除成功時にイベント一覧ページへリダイレクト
 *
 * useTransitionを使用して削除処理中のローディング状態を管理し、
 * UIがブロックされないようにしている。
 *
 * @param eventId - 削除対象のイベントID
 */
export function DeleteEventButton({ eventId }: DeleteEventButtonProps) {
  // Next.jsルーター: 削除後のリダイレクト用
  const router = useRouter()
  // トランジション管理: 削除処理中のローディング状態を管理
  const [isPending, startTransition] = useTransition()
  // 確認ダイアログの表示状態
  const [showConfirm, setShowConfirm] = useState(false)

  /**
   * 削除実行ハンドラ
   * Server Actionを呼び出してイベントを削除し、成功時にリダイレクト
   */
  const handleDelete = () => {
    startTransition(async () => {
      // Server Actionを呼び出してイベントを削除
      const result = await deleteEvent(eventId)
      if (result.success) {
        // 削除成功時はイベント一覧ページへリダイレクト
        router.push(ROUTE_EVENTS)
        // キャッシュを更新するためにページをリフレッシュ
        router.refresh()
      }
    })
  }

  // 確認ダイアログ表示中の場合
  if (showConfirm) {
    return (
      <div className="flex items-center gap-2">
        {/* 確認メッセージ */}
        <span className="text-sm text-muted-foreground">削除しますか？</span>
        {/* 削除実行ボタン */}
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
        >
          {isPending ? '削除中...' : '削除'}
        </button>
        {/* キャンセルボタン */}
        <button
          onClick={() => setShowConfirm(false)}
          className="px-3 py-1 text-sm border rounded hover:bg-muted"
        >
          キャンセル
        </button>
      </div>
    )
  }

  // 通常状態: 削除ボタンを表示
  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="flex items-center gap-2 px-3 py-2 text-sm text-red-500 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-950"
    >
      <TrashIcon className="w-4 h-4" />
      <span>削除</span>
    </button>
  )
}
