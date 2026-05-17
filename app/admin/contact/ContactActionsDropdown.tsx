/**
 * @file お問い合わせアクションドロップダウンコンポーネント
 * @description お問い合わせ一覧の各行で使用されるドロップダウンメニュー。
 *              ステータス変更と削除の操作を提供するクライアントコンポーネント。
 */

'use client'

// Reactのフック（状態管理、DOM参照、副作用処理用）
import { useState, useRef, useEffect, useCallback } from 'react'
// React DOMのcreatePortal（ドロップダウンメニューをbody直下に配置するため）
import { createPortal } from 'react-dom'
// Next.jsのルーター（ページ更新用）
import { useRouter } from 'next/navigation'
// お問い合わせ管理用のServer Actions
import { updateInquiryStatus, deleteInquiry } from '@/lib/actions/contact'
import { useToast } from '@/hooks/use-toast'

/**
 * コンポーネントのProps型定義
 */
interface ContactActionsDropdownProps {
  /** お問い合わせID */
  inquiryId: string
  /** 現在のステータス */
  currentStatus: string
}

/**
 * お問い合わせアクションドロップダウンコンポーネント
 * ステータス変更と削除の操作を提供するドロップダウンメニュー
 *
 * @param inquiryId - お問い合わせID
 * @param currentStatus - 現在のステータス
 * @returns ドロップダウンメニューのJSX要素
 *
 * 機能:
 * - ステータス変更（現在のステータス以外の選択肢を表示）
 * - お問い合わせの削除
 * - メニュー位置の自動調整（画面端対応）
 * - 外部クリックで自動的にメニューを閉じる
 *
 * なぜcreatePortalを使うか:
 * テーブル内のz-indexやoverflowの制約を回避し、
 * メニューが常に最前面に表示されるようにするため。
 */
export function ContactActionsDropdown({ inquiryId, currentStatus }: ContactActionsDropdownProps) {
  const { toast } = useToast()
  // ドロップダウンの開閉状態
  const [isOpen, setIsOpen] = useState(false)
  // 処理中フラグ（ボタンの二重クリック防止）
  const [isSubmitting, setIsSubmitting] = useState(false)
  // ドロップダウンメニューの表示位置
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  // ボタンとメニューのDOM参照
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  /**
   * メニューの表示位置を更新する関数
   * ボタンの位置に基づいてメニューの座標を計算
   */
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    // ボタンの画面上の位置を取得
    const rect = buttonRef.current.getBoundingClientRect()
    // ボタンの下4px、右端から160pxの位置にメニューを配置
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.right - 160,
    })
  }, [])

  /**
   * メニュー表示時の副作用処理
   * - メニュー位置の更新
   * - 外部クリックでメニューを閉じる
   * - スクロール時にメニューを閉じる
   */
  useEffect(() => {
    if (!isOpen) return
    // メニュー位置を更新
    updatePosition()

    /**
     * 外部クリックハンドラ
     * ボタンとメニュー以外をクリックしたらメニューを閉じる
     */
    function handleClickOutside(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    /**
     * スクロールハンドラ
     * スクロール時はメニューを閉じる（位置がずれるため）
     */
    function handleScroll() {
      setIsOpen(false)
    }

    // イベントリスナーを登録
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)

    // クリーンアップ関数（コンポーネントアンマウント時にリスナーを削除）
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, updatePosition])

  /**
   * ステータス変更ハンドラ
   * Server Actionを呼び出してステータスを更新
   * @param status - 新しいステータス
   */
  const handleStatusChange = async (status: string) => {
    setIsSubmitting(true)
    try {
      // Server Actionでステータスを更新
      const result = await updateInquiryStatus(inquiryId, status)
      if ('error' in result) {
        toast({ title: result.error, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
      setIsOpen(false)
      // ページを再読み込みして最新のデータを表示
      router.refresh()
    }
  }

  /**
   * お問い合わせ削除ハンドラ
   * 確認ダイアログを表示してから削除を実行
   */
  const handleDelete = async () => {
    // 確認ダイアログで削除を確認（誤操作防止）
    if (!confirm('このお問い合わせを削除しますか？この操作は元に戻せません。')) return
    setIsSubmitting(true)
    try {
      // Server Actionで削除
      const result = await deleteInquiry(inquiryId)
      if ('error' in result) {
        toast({ title: result.error, variant: 'destructive' })
      }
    } finally {
      setIsSubmitting(false)
      setIsOpen(false)
      // ページを再読み込み
      router.refresh()
    }
  }

  /**
   * ステータスアクションの配列
   * 現在のステータスは選択肢から除外
   */
  const statusActions = [
    { status: 'pending', label: '未対応に戻す' },
    { status: 'in_progress', label: '対応中にする' },
    { status: 'resolved', label: '解決済にする' },
    { status: 'closed', label: 'クローズする' },
  ].filter((a) => a.status !== currentStatus)

  return (
    <>
      {/* 操作ボタン（クリックでドロップダウンを表示） */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSubmitting}
        className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
      >
        {isSubmitting ? '...' : '操作'}
      </button>

      {/* ドロップダウンメニュー（createPortalでbody直下に配置）
          z-indexやoverflowの制約を回避し、常に最前面に表示される */}
      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[9999] w-40 rounded-md border bg-card shadow-lg"
          style={{ top: menuPos.top, left: menuPos.left }}
        >
          <div className="py-1">
            {/* ステータス変更アクション */}
            {statusActions.map((action) => (
              <button
                key={action.status}
                onClick={() => handleStatusChange(action.status)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {action.label}
              </button>
            ))}
            {/* 区切り線 */}
            <hr className="my-1" />
            {/* 削除アクション（危険な操作なので赤色で表示） */}
            <button
              onClick={handleDelete}
              className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              削除
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
