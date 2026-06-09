'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateInquiryStatus, deleteInquiry } from '@/lib/actions/contact'
import { useToast } from '@/hooks/use-toast'
import { ROUTE_ADMIN_CONTACT } from '@/lib/constants/routes'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  MSG_ADMIN_CONTACT_DELETE_DESC,
  MSG_ADMIN_CONTACT_DELETE_TITLE,
} from '@/lib/constants/messages'

interface ContactDetailActionsProps {
  /** お問い合わせID */
  inquiryId: string
  /** 現在のステータス */
  currentStatus: string
  /** 現在の管理者メモ */
  currentNote: string
}

export function ContactDetailActions({ inquiryId, currentStatus, currentNote }: ContactDetailActionsProps) {
  const { toast } = useToast()
  // フォームの入力値の状態管理
  const [status, setStatus] = useState(currentStatus)
  const [adminNote, setAdminNote] = useState(currentNote)
  // 処理中フラグ（ボタンの二重クリック防止）
  const [isSubmitting, setIsSubmitting] = useState(false)
  // 操作結果メッセージ（成功/エラー）
  const [message, setMessage] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const router = useRouter()

  /**
   * お問い合わせ情報を更新する関数
   * ステータスと管理者メモをデータベースに保存
   */
  const handleUpdate = async () => {
    setIsSubmitting(true)
    setMessage(null)
    try {
      // Server Actionを呼び出して更新
      const result = await updateInquiryStatus(inquiryId, status, adminNote)
      if ('error' in result) {
        // エラー時はメッセージを表示
        setMessage(result.error || 'エラーが発生しました')
      } else {
        // 成功時はメッセージを表示してページを再読み込み
        setMessage('更新しました')
        router.refresh()
      }
    } finally {
      setIsSubmitting(false)
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
      router.push(ROUTE_ADMIN_CONTACT)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-card rounded-lg border p-6 space-y-4">
      <h2 className="text-lg font-semibold">対応操作</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium">ステータス</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-md border px-3 py-2 text-sm bg-background"
        >
          {/* 各ステータスの意味:
              pending: 新規のお問い合わせ、まだ対応していない
              in_progress: 調査中や対応中
              resolved: 対応完了、ユーザーに返信済み
              closed: 対応終了、追加対応不要 */}
          <option value="pending">未対応</option>
          <option value="in_progress">対応中</option>
          <option value="resolved">解決済</option>
          <option value="closed">クローズ</option>
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">管理者メモ</label>
        <textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          rows={4}
          placeholder="対応内容や返信内容のメモ"
          className="w-full rounded-md border px-3 py-2 text-sm bg-background resize-y"
        />
      </div>

      {message && (
        <p className={`text-sm ${message === '更新しました' ? 'text-green-600' : 'text-destructive'}`}>
          {message}
        </p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleUpdate}
          disabled={isSubmitting}
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSubmitting ? '更新中...' : '更新する'}
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isSubmitting}
          className="rounded-md border border-destructive px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          削除
        </button>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        variant="destructive"
        title={MSG_ADMIN_CONTACT_DELETE_TITLE}
        description={MSG_ADMIN_CONTACT_DELETE_DESC}
        confirmLabel="削除する"
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}
