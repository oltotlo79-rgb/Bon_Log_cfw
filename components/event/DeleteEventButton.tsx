/**
 * @module components/event/DeleteEventButton
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { deleteEvent } from '@/lib/actions/event'
import { ROUTE_EVENTS } from '@/lib/constants/routes'
import { Trash2 } from 'lucide-react'

interface DeleteEventButtonProps {
  eventId: string
}

export function DeleteEventButton({ eventId }: DeleteEventButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    setError(null)

    try {
      const result = await deleteEvent(eventId)

      if (result && 'error' in result) {
        setError(result.error ?? '削除に失敗しました')
        setLoading(false)
        return
      }

      router.push(ROUTE_EVENTS)
      router.refresh()
    } catch {
      setError('イベントの削除に失敗しました')
      setLoading(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="space-y-3" role="dialog" aria-label="削除確認">
        <p className="text-sm text-destructive font-medium">
          このイベントを削除しますか？この操作は取り消せません。
        </p>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? '削除中...' : '削除する'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setShowConfirm(false)
              setError(null)
            }}
            disabled={loading}
          >
            キャンセル
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setShowConfirm(true)}
      aria-label="イベントを削除"
    >
      <Trash2 className="h-4 w-4 mr-1" />
      削除
    </Button>
  )
}
