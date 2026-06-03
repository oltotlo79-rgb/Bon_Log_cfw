/**
 * @module components/post/DeletePostButton
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
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
import { deletePost } from '@/lib/actions/post'
import { MSG_ERROR_TITLE, MSG_POST_DELETED, MSG_POST_DELETE_FAILED } from '@/lib/constants/messages'

type DeletePostButtonProps = {
  postId: string
  variant?: 'icon' | 'menu'
  onDeleted?: () => void
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  )
}

export function DeletePostButton({ postId, variant = 'icon', onDeleted }: DeletePostButtonProps) {

  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  async function handleDelete() {
    setLoading(true)
    const result = await deletePost(postId)

    if (result.success) {
      await queryClient.invalidateQueries({ queryKey: ['timeline'] })
      await queryClient.invalidateQueries({ queryKey: ['posts'] })
      await queryClient.invalidateQueries({ queryKey: ['userPosts'] })

      router.refresh()

      toast({
        description: MSG_POST_DELETED,
      })

      onDeleted?.()
    } else {
      toast({
        title: MSG_ERROR_TITLE,
        description: MSG_POST_DELETE_FAILED,
        variant: 'destructive',
      })
    }
    setLoading(false)
    setOpen(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {variant === 'icon' ? (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            aria-label="投稿を削除"
          >
            <TrashIcon className="w-4 h-4" aria-hidden="true" />
          </Button>
        ) : (
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
            aria-label="投稿を削除"
          >
            <TrashIcon className="w-4 h-4" aria-hidden="true" />
            <span>削除する</span>
          </button>
        )}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>投稿を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription>
            この操作は取り消せません。投稿に対するコメントやいいねも削除されます。
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
  )
}
