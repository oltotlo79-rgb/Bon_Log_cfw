'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { MoreVertical as MoreVerticalIcon } from 'lucide-react'
import { deleteReviewByAdmin } from '@/lib/actions/admin/content'
import {
  DROPDOWN_DIRECTION_THRESHOLD,
  DROPDOWN_VERTICAL_OFFSET_PX,
  DROPDOWN_MIN_WIDTH_PX,
} from '@/lib/constants/limits'
import { buildShopPath } from '@/lib/constants/path-builders'
import { useToast } from '@/hooks/use-toast'

interface ReviewActionsDropdownProps {
  reviewId: string
  shopId: string
}

export function ReviewActionsDropdown({ reviewId, shopId }: ReviewActionsDropdownProps) {
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
      // viewport 下端近くで開く場合は menu を上方向に展開する (画面外切れ防止)。
      const openUpward = spaceBelow < DROPDOWN_DIRECTION_THRESHOLD

      const horizontalLeft = rect.right - DROPDOWN_MIN_WIDTH_PX
      setMenuStyle(
        openUpward
          ? { bottom: window.innerHeight - rect.top + DROPDOWN_VERTICAL_OFFSET_PX, left: horizontalLeft }
          : { top: rect.bottom + DROPDOWN_VERTICAL_OFFSET_PX, left: horizontalLeft },
      )
    }
    setIsOpen(!isOpen)
  }

  const handleDelete = async () => {
    if (!reason.trim()) {
      toast({ title: '削除理由を入力してください', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    const result = await deleteReviewByAdmin(reviewId, reason)
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
              <Link
                href={buildShopPath(shopId)}
                target="_blank"
                className="block px-4 py-2 text-sm hover:bg-muted"
                onClick={() => setIsOpen(false)}
              >
                盆栽園を確認
              </Link>
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  setIsOpen(false)
                  setShowDeleteModal(true)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-destructive"
              >
                レビューを削除
              </button>
            </div>
          </>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">レビューを削除</h3>
            <p className="text-sm text-muted-foreground mb-4">
              このレビューを削除します。削除理由を入力してください。
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
