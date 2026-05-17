/** このファイルは盆栽詳細ページで表示される「その他のアクション」メニューを提供します。 */

'use client'

// React のフック: コンポーネントの状態管理に使用
import { useState, useRef, useEffect } from 'react'
// Next.js のルーター: ページ遷移とリフレッシュに使用
import { useRouter } from 'next/navigation'
// Next.js のリンクコンポーネント: クライアントサイドナビゲーション用
import Link from 'next/link'
// Server Action: 盆栽削除処理を実行するサーバーサイド関数
import { deleteBonsai } from '@/lib/actions/bonsai'
import { useToast } from '@/hooks/use-toast'
import { MSG_BONSAI_DELETE_FAILED } from '@/lib/constants/messages'
import { ROUTE_BONSAI } from '@/lib/constants/routes'

/**
 * BonsaiActionsコンポーネントのProps型定義
 */
interface BonsaiActionsProps {
  /** 操作対象の盆栽ID（一意識別子） */
  bonsaiId: string
  /** 盆栽の名前（削除確認ダイアログに表示） */
  bonsaiName: string
}

/**
 * 縦三点リーダーアイコン（その他メニュー用）
 * @param className - カスタムCSSクラス
 */
function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  )
}

/**
 * 鉛筆アイコン（編集ボタン用）
 * @param className - カスタムCSSクラス
 */
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="m15 5 4 4" />
    </svg>
  )
}

/**
 * ゴミ箱アイコン（削除ボタン用）
 * @param className - カスタムCSSクラス
 */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

/**
 * 盆栽アクションメニューコンポーネント
 *
 * ドロップダウン形式のアクションメニューを提供し、
 * 盆栽の編集・削除操作を可能にします。
 *
 * @param props - コンポーネントのプロパティ
 * @param props.bonsaiId - 操作対象の盆栽ID
 * @param props.bonsaiName - 削除確認時に表示する盆栽名
 */
export function BonsaiActions({ bonsaiId, bonsaiName }: BonsaiActionsProps) {
  // ルーターインスタンス: ページ遷移とデータ更新に使用
  const router = useRouter()
  const { toast } = useToast()
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  /**
   * ドロップダウンメニューの開閉状態
   * true: メニューが開いている、false: メニューが閉じている
   */
  const [isOpen, setIsOpen] = useState(false)

  /**
   * 削除処理中かどうかのフラグ
   * true: 削除処理中（ボタン無効化）、false: 待機状態
   */
  const [isDeleting, setIsDeleting] = useState(false)

  /**
   * 盆栽削除処理のイベントハンドラ
   *
   * 処理フロー:
   * 1. 確認ダイアログを表示
   * 2. ユーザーが確認した場合、Server Actionで削除実行
   * 3. 成功時は盆栽一覧ページにリダイレクト
   * 4. 失敗時はエラーメッセージを表示
   */
  const handleDelete = async () => {
    // 削除確認ダイアログを表示（キャンセル時は処理中断）
    if (!confirm(`「${bonsaiName}」を削除しますか？\n成長記録もすべて削除されます。`)) {
      return
    }

    // 削除処理開始（ボタンを無効化）
    setIsDeleting(true)
    try {
      // Server Actionを呼び出して盆栽を削除
      const result = await deleteBonsai(bonsaiId)
      if (!result.success) {
        // エラーがあれば表示
        toast({ title: result.error, variant: 'destructive' })
      } else {
        // 成功時は盆栽一覧ページにリダイレクトし、データをリフレッシュ
        router.push(ROUTE_BONSAI)
        router.refresh()
      }
    } catch {
      // 予期しないエラーの場合
      toast({ title: MSG_BONSAI_DELETE_FAILED, variant: 'destructive' })
    } finally {
      // アンマウント後は setState しない（テスト/ナビ後などの unhandled rejection 防止）
      if (mountedRef.current) {
        setIsDeleting(false)
        setIsOpen(false)
      }
    }
  }

  return (
    <div className="relative">
      {/* メニュー開閉トグルボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 hover:bg-muted rounded-lg transition-colors"
        disabled={isDeleting}
        aria-label="メニュー"
        data-testid="bonsai-menu"
      >
        <MoreVerticalIcon className="w-5 h-5" />
      </button>

      {/* ドロップダウンメニュー（isOpenがtrueの時のみ表示） */}
      {isOpen && (
        <>
          {/* オーバーレイ: メニュー外クリックで閉じる */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          {/* メニュー本体 */}
          <div className="absolute right-0 top-full mt-1 w-48 bg-card border rounded-lg shadow-lg z-50 py-1">
            {/* 編集リンク */}
            <Link
              href={`/bonsai/${bonsaiId}/edit`}
              className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <PencilIcon className="w-4 h-4" />
              編集
            </Link>
            {/* 削除ボタン */}
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-muted transition-colors disabled:opacity-50"
            >
              <TrashIcon className="w-4 h-4" />
              {isDeleting ? '削除中...' : '削除'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
