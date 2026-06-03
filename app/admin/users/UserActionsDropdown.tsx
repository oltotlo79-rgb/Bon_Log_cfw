'use client'

// ReactのuseStateとuseRefフック（状態管理とDOM参照用）
import { useState, useRef } from 'react'
// Next.jsのルーター（ページ更新用）
import { useRouter } from 'next/navigation'
// ユーザー停止・復帰用のServer Action
import { suspendUser, activateUser } from '@/lib/actions/admin/users'
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

interface UserActionsDropdownProps {
  /** 操作対象のユーザーID */
  userId: string
  /** ユーザーが停止中かどうか */
  isSuspended: boolean
}

/**
 * ユーザーアクションドロップダウンコンポーネント
 * ユーザーに対する管理操作（停止/復帰）を提供するドロップダウンメニュー
 *
 * @param userId - 操作対象のユーザーID
 * @param isSuspended - ユーザーの停止状態
 * @returns ドロップダウンメニューのJSX要素
 *
 * 機能:
 * - アカウント停止（理由入力モーダル付き）
 * - アカウント復帰（確認ダイアログ付き）
 * - メニュー位置の自動調整（画面端対応）
 */
export function UserActionsDropdown({ userId, isSuspended }: UserActionsDropdownProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [showSuspendModal, setShowSuspendModal] = useState(false)
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

  const handleSuspend = async () => {
    if (!reason.trim()) {
      toast({ title: '停止理由を入力してください', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    const result = await suspendUser(userId, reason)
    setIsSubmitting(false)

    if (!result.success) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    setShowSuspendModal(false)
    setReason('')
    router.refresh()
  }

  const handleActivate = async () => {
    if (!confirm('このユーザーのアカウントを復帰させますか？')) {
      return
    }

    setIsSubmitting(true)
    const result = await activateUser(userId)
    setIsSubmitting(false)

    if (!result.success) {
      toast({ title: result.error, variant: 'destructive' })
      return
    }

    setIsOpen(false)
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
              {isSuspended ? (
                <button
                  onClick={handleActivate}
                  disabled={isSubmitting}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-green-600"
                >
                  アカウント復帰
                </button>
              ) : (
                <button
                  onClick={() => {
                    setIsOpen(false)
                    setShowSuspendModal(true)
                  }}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-muted text-red-600"
                >
                  アカウント停止
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {showSuspendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg border p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">アカウント停止</h3>
            <p className="text-sm text-muted-foreground mb-4">
              このユーザーのアカウントを停止します。停止理由を入力してください。
            </p>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="停止理由"
              className="w-full px-3 py-2 border rounded-lg bg-background min-h-[100px] mb-4"
            />

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowSuspendModal(false)
                  setReason('')
                }}
                className="px-4 py-2 border rounded-lg hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={handleSuspend}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {isSubmitting ? '処理中...' : '停止する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
