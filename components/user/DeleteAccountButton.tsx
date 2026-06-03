/**
 * @module components/user/DeleteAccountButton
 */

'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteAccount } from '@/lib/actions/user'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'

export function DeleteAccountButton() {

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setLoading(true)
    setError(null)

    const result = await deleteAccount()

    if (!result.success) {
      setError(('error' in result ? result.error : null) ?? MSG_ERROR_FALLBACK)
      setLoading(false)
    } else {
      await signOut({ callbackUrl: '/' })
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        アカウントを削除すると、すべての投稿、コメント、いいねなどのデータが完全に削除されます。この操作は取り消せません。
      </p>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive">アカウントを削除</Button>
        </AlertDialogTrigger>

        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>本当にアカウントを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。すべての投稿、コメント、いいね、フォロー関係などが完全に削除されます。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? '削除中...' : '削除する'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
