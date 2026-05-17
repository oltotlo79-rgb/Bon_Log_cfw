/**
 * @file 投稿アクションドロップダウンコンポーネント
 * @description 投稿管理テーブルの各行で使用されるドロップダウンメニュー。
 *              投稿の削除などの操作を提供する。
 */

'use client'

// ReactのuseStateとuseRefフック（状態管理とDOM参照用）
import { useState, useRef } from 'react'
// Next.jsのルーター（ページ更新用）
import { useRouter } from 'next/navigation'
// 投稿削除用のServer Action
import { deletePostByAdmin } from '@/lib/actions/admin/posts'
import { DROPDOWN_DIRECTION_THRESHOLD } from '@/lib/constants/limits'
import { useToast } from '@/hooks/use-toast'

/**
 * 縦三点メニューアイコンコンポーネント
 * @param className - CSSクラス名
 * @returns SVGアイコン要素
 */
function MoreVerticalIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1"/>
      <circle cx="12" cy="5" r="1"/>
      <circle cx="12" cy="19" r="1"/>
    </svg>
  )
}

/**
 * PostActionsDropdownコンポーネントのProps型定義
 */
interface PostActionsDropdownProps {
  /** 操作対象の投稿ID */
  postId: string
}

/**
 * 投稿アクションドロップダウンコンポーネント
 * 投稿に対する管理操作（削除）を提供するドロップダウンメニュー
 *
 * @param postId - 操作対象の投稿ID
 * @returns ドロップダウンメニューのJSX要素
 *
 * 機能:
 * - 投稿削除（理由入力モーダル付き）
 * - メニュー位置の自動調整（画面端対応）
 */
export function PostActionsDropdown({ postId }: PostActionsDropdownProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [reason, setReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < DROPDOWN_DIRECTION_THRESHOLD

      if (openUpward) {
        setMenuStyle({
          bottom: window.innerHeight - rect.top + 4,
          left: rect.right - 150,
        })
      } else {
        setMenuStyle({
          top: rect.bottom + 4,
          left: rect.right - 150,
        })
      }
    }
    setIsOpen(!isOpen)
  }

  const handleDelete = async () => {
    if (!reason.trim()) {
      toast({ title: '削除理由を入力してください', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    const result = await deletePostByAdmin(postId, reason)
    setIsSubmitting(false)

    if (!result.success) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    setShowDeleteModal(false)
    setReason('')
    router.refresh()
  }

  return (
    <>
      <div className="relative">
        <button
          ref={buttonRef}
          onClick={handleToggle}
          className="p-2 hover:bg-muted rounded-lg"
        >
          <MoreVerticalIcon className="w-4 h-4" />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-[100]"
              onClick={() => setIsOpen(false)}
            />
            <div
              className="fixed bg-card border rounded-lg shadow-lg py-1 z-[101] min-w-[150px]"
              style={menuStyle}
            >
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowDeleteModal(true)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-destructive"
              >
                投稿を削除
              </button>
            </div>
          </>
        )}
      </div>

      {/* 削除モーダル */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">投稿を削除</h3>
            <p className="text-sm text-muted-foreground mb-4">
              この投稿を削除します。削除理由を入力してください。
            </p>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="削除理由"
              className="w-full px-3 py-2 border rounded-lg bg-background min-h-[100px] mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowDeleteModal(false)
                  setReason('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
              >
                {isSubmitting ? '処理中...' : '削除する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
