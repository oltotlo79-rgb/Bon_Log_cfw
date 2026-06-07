'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { suspendUser, activateUser, deleteUserByAdmin } from '@/lib/actions/admin/users'
import { ROUTE_ADMIN_USERS } from '@/lib/constants/routes'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

type UserDetailActionsProps = {
  userId: string
  isSuspended: boolean
  nickname: string
}

export function UserDetailActions({ userId, isSuspended, nickname }: UserDetailActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [reason, setReason] = useState('')

  async function handleSuspend() {
    if (!reason.trim()) {
      setError('理由を入力してください')
      return
    }

    setLoading('suspend')
    setError(null)

    const result = await suspendUser(userId, reason)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
    } else {
      setReason('')
      router.refresh()
    }

    setLoading(null)
  }

  async function handleActivate() {
    setLoading('activate')
    setError(null)

    const result = await activateUser(userId)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
    } else {
      router.refresh()
    }

    setLoading(null)
  }

  async function handleDelete() {
    if (!reason.trim()) {
      setError('理由を入力してください')
      return
    }

    setLoading('delete')
    setError(null)

    const result = await deleteUserByAdmin(userId, reason)

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(null)
    } else {
      router.push(ROUTE_ADMIN_USERS)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-muted text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      {isSuspended ? (
        <button
          onClick={handleActivate}
          disabled={loading === 'activate'}
          className="w-full px-4 py-2 bg-foreground text-background rounded-lg hover:bg-foreground/90 disabled:opacity-50"
        >
          {loading === 'activate' ? '処理中...' : 'アカウントを復帰'}
        </button>
      ) : (
        <div className="space-y-2">
          <textarea
            placeholder="停止理由を入力..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2 border rounded-lg bg-background text-sm resize-none"
            rows={2}
          />
          <button
            onClick={handleSuspend}
            disabled={loading === 'suspend' || !reason.trim()}
            className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
          >
            {loading === 'suspend' ? '処理中...' : 'アカウントを停止'}
          </button>
        </div>
      )}

      <hr className="border-muted" />

      {!showDeleteConfirm ? (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full px-4 py-2 border border-destructive text-destructive rounded-lg hover:bg-destructive/10"
        >
          アカウントを削除
        </button>
      ) : (
        <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-semibold">アカウント削除の確認</span>
          </div>
          <p className="text-sm text-muted-foreground">
            <strong>{nickname}</strong> のアカウントを削除します。
            この操作は取り消せません。すべての投稿、コメント、関連データが削除されます。
          </p>
          {!isSuspended && (
            <textarea
              placeholder="削除理由を入力..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2 border rounded-lg bg-background text-sm resize-none"
              rows={2}
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 px-3 py-2 border rounded-lg hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              onClick={handleDelete}
              disabled={loading === 'delete' || (!isSuspended && !reason.trim())}
              className="flex-1 px-3 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 disabled:opacity-50"
            >
              {loading === 'delete' ? '削除中...' : '削除する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
