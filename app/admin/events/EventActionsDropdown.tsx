'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical } from 'lucide-react'
import { deleteEventByAdmin } from '@/lib/actions/admin/content'
import { DROPDOWN_DIRECTION_THRESHOLD } from '@/lib/constants/limits'
import { useToast } from '@/hooks/use-toast'

interface EventActionsDropdownProps {
  /** 操作対象のイベントID */
  eventId: string
}

export function EventActionsDropdown({ eventId }: EventActionsDropdownProps) {
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
    const result = await deleteEventByAdmin(eventId, reason)
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
          <MoreVertical className="w-4 h-4" />
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
                className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-red-600"
              >
                イベントを削除
              </button>
            </div>
          </>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">イベントを削除</h3>
            <p className="text-sm text-muted-foreground mb-4">
              このイベントを削除します。削除理由を入力してください。
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
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
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
