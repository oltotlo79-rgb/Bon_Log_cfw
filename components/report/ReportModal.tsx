/**
 * @module components/report/ReportModal
 */
'use client'

import { useState, useTransition, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { createReport } from '@/lib/actions/report'
import { TARGET_TYPE_LABELS, type ReportTargetType, type ReportReason } from '@/lib/constants/report'
import { TIMEOUT_MODAL_AUTO_CLOSE_MS } from '@/lib/constants/limits'
import { ReportSuccessView } from './ReportSuccessView'
import { ReportForm } from './ReportForm'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

interface ReportModalProps {
  targetType: ReportTargetType
  targetId: string
  onClose: () => void
  onSuccess?: () => void
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M18 6 6 18"/>
      <path d="m6 6 12 12"/>
    </svg>
  )
}

export function ReportModal({ targetType, targetId, onClose, onSuccess }: ReportModalProps) {

  const [isPending, startTransition] = useTransition()
  const [reason, setReason] = useState<ReportReason | ''>('')
  const [description, setDescription] = useState('')
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // SSR 時に createPortal を使わないためのマウント検出
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- クライアントサイドマウント検出のため必要
    setMounted(true)
    // モーダル表示中は body のスクロールを無効化
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) return

    setError(null)

    startTransition(async () => {
      const result = await createReport({
        targetType,
        targetId,
        reason,
        description: description || undefined,
      })

      if (!result.success) {
        setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
        return
      }

      setSuccess(true)
      // 「送信できた」ことを目視確認できる時間を空けてから自動クローズする
      setTimeout(() => {
        onClose()
        onSuccess?.()
      }, TIMEOUT_MODAL_AUTO_CLOSE_MS)
    })
  }

  if (!mounted) return null

  const modalContent = (
    <div className="fixed inset-0 z-[9999] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      <div className="min-h-full flex items-center justify-center p-4">
        <div
          className="relative bg-card rounded-lg border shadow-lg w-full max-w-md my-8"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {TARGET_TYPE_LABELS[targetType]}を通報
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <ReportSuccessView />
        ) : (
          <ReportForm
            targetType={targetType}
            reason={reason}
            setReason={setReason}
            description={description}
            setDescription={setDescription}
            isPending={isPending}
            error={error}
            onSubmit={handleSubmit}
            onClose={onClose}
          />
        )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
