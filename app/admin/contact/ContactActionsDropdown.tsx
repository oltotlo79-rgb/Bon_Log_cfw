'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { updateInquiryStatus, deleteInquiry } from '@/lib/actions/contact'
import { useToast } from '@/hooks/use-toast'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  MSG_ADMIN_CONTACT_DELETE_DESC,
  MSG_ADMIN_CONTACT_DELETE_TITLE,
} from '@/lib/constants/messages'

interface ContactActionsDropdownProps {
  /** お問い合わせID */
  inquiryId: string
  /** 現在のステータス */
  currentStatus: string
}

/**
 * createPortal でメニューを body 直下に出す: テーブル内の z-index / overflow 制約を回避し
 * 常に最前面へ表示するため。
 */
export function ContactActionsDropdown({ inquiryId, currentStatus }: ContactActionsDropdownProps) {
  const { toast } = useToast()
  // ドロップダウンの開閉状態
  const [isOpen, setIsOpen] = useState(false)
  // 処理中フラグ（ボタンの二重クリック防止）
  const [isSubmitting, setIsSubmitting] = useState(false)
  // ドロップダウンメニューの表示位置
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
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

  const handleDeleteConfirm = async () => {
    setIsSubmitting(true)
    try {
      const result = await deleteInquiry(inquiryId)
      if ('error' in result) {
        toast({ title: result.error, variant: 'destructive' })
        throw new Error(result.error)
      }
    } finally {
      setIsSubmitting(false)
      setIsOpen(false)
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
            {statusActions.map((action) => (
              <button
                key={action.status}
                onClick={() => handleStatusChange(action.status)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
              >
                {action.label}
              </button>
            ))}
            <hr className="my-1" />
            <button
              onClick={() => { setIsOpen(false); setShowDeleteConfirm(true) }}
              className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
            >
              削除
            </button>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        variant="destructive"
        title={MSG_ADMIN_CONTACT_DELETE_TITLE}
        description={MSG_ADMIN_CONTACT_DELETE_DESC}
        confirmLabel="削除する"
        onConfirm={handleDeleteConfirm}
      />
    </>
  )
}
