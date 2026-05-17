/**
 * @file EventActionsDropdown.tsx
 * @description イベント操作ドロップダウンメニューコンポーネント
 *
 * 目的:
 * - イベントに対する操作（編集、削除、通報、共有）を一箇所にまとめる
 * - イベント作成者と一般ユーザーで表示内容を切り替える
 * - UIをすっきりさせるためのドロップダウン形式
 *
 * 機能概要:
 * - 3点リーダー（...）ボタンでメニューを開閉
 * - オーナー用メニュー: 編集、削除
 * - 一般ユーザー用メニュー: 通報
 * - 全ユーザー共通: 共有（URLコピー）
 *
 * 使用例:
 * ```tsx
 * <EventActionsDropdown
 *   eventId={event.id}
 *   isOwner={session?.user?.id === event.userId}
 *   onDelete={() => setShowDeleteDialog(true)}
 *   onReport={() => setShowReportDialog(true)}
 * />
 * ```
 */

// Client Componentとして宣言（useStateを使用するため）
'use client'

// React Hooks - ドロップダウンの開閉状態管理
import { useState } from 'react'

// Next.jsのLinkコンポーネント - 編集ページへの遷移
import Link from 'next/link'

// shadcn/uiのButtonコンポーネント
import { Button } from '@/components/ui/button'

// lucide-reactのアイコン群
import { MoreHorizontal, Edit, Trash2, Flag, Share } from 'lucide-react'

/**
 * EventActionsDropdownコンポーネントのプロパティ型定義
 */
interface EventActionsDropdownProps {
  /** イベントID（編集・共有URLの生成に使用） */
  eventId: string
  /** 現在のユーザーがイベント作成者かどうか */
  isOwner: boolean
  /** 削除ボタンクリック時のコールバック関数（任意） */
  onDelete?: () => void
  /** 通報ボタンクリック時のコールバック関数（任意） */
  onReport?: () => void
}

/**
 * イベント操作ドロップダウンメニューコンポーネント
 * イベントに対する各種操作をドロップダウン形式で提供する
 *
 * @param props - コンポーネントのプロパティ
 * @returns ドロップダウンメニューのReact要素
 */
export function EventActionsDropdown({
  eventId,
  isOwner,
  onDelete,
  onReport,
}: EventActionsDropdownProps) {
  /**
   * ドロップダウンメニューの開閉状態
   * true: メニュー表示中、false: メニュー非表示
   */
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      {/* 3点リーダーボタン: クリックでメニューを開閉 */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)} // メニューの開閉を切り替え
        aria-label="イベント操作メニュー"
        aria-expanded={open} // スクリーンリーダー用: メニューの展開状態を通知
        aria-haspopup="menu" // スクリーンリーダー用: メニューを持つことを通知
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>

      {/* ドロップダウンメニュー: openがtrueの時のみ表示 */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-48 bg-card border rounded-lg shadow-lg z-50"
          aria-label="イベント操作"
        >
          {/* イベント作成者の場合: 編集と削除を表示 */}
          {isOwner ? (
            <>
              {/* 編集リンク: イベント編集ページへ遷移 */}
              <Link
                href={`/events/${eventId}/edit`}
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted w-full"
                onClick={() => setOpen(false)} // メニューを閉じる
              >
                <Edit className="h-4 w-4" />
                編集
              </Link>
              {/* 削除ボタン: onDeleteコールバックを実行 */}
              <button
                role="menuitem"
                className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted w-full text-left text-destructive"
                onClick={() => {
                  setOpen(false) // メニューを閉じる
                  onDelete?.() // 削除コールバックを実行（存在する場合）
                }}
              >
                <Trash2 className="h-4 w-4" />
                削除
              </button>
            </>
          ) : (
            /* 一般ユーザーの場合: 通報を表示 */
            <button
              role="menuitem"
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted w-full text-left"
              onClick={() => {
                setOpen(false) // メニューを閉じる
                onReport?.() // 通報コールバックを実行（存在する場合）
              }}
            >
              <Flag className="h-4 w-4" />
              通報
            </button>
          )}
          {/* 共有ボタン: イベントのURLをクリップボードにコピー */}
          <button
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted w-full text-left"
            onClick={() => {
              setOpen(false) // メニューを閉じる
              // イベントの完全URLをクリップボードにコピー
              navigator.clipboard.writeText(`${window.location.origin}/events/${eventId}`)
            }}
          >
            <Share className="h-4 w-4" />
            共有
          </button>
        </div>
      )}
    </div>
  )
}
