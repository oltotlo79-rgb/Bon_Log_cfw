/**
 * @module components/user/BlockButton
 */

'use client'

import { useState } from 'react'
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
} from '@/components/ui/alert-dialog'
import { blockUser, unblockUser } from '@/lib/actions/block'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import {
  MSG_BLOCK_ADDED_DESCRIPTION,
  MSG_BLOCK_ADDED_TITLE,
  MSG_BLOCK_REMOVED_DESCRIPTION,
  MSG_BLOCK_REMOVED_TITLE,
  MSG_ERROR_TITLE,
} from '@/lib/constants/messages'
import { useQueryClient } from '@tanstack/react-query'

type BlockButtonProps = {
  userId: string
  nickname: string
  initialIsBlocked: boolean
  variant?: 'default' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function BlockButton({
  userId,
  nickname,
  initialIsBlocked,
  variant = 'ghost',
  size = 'default',
}: BlockButtonProps) {

  const [isBlocked, setIsBlocked] = useState(initialIsBlocked)
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const _router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  async function handleBlock() {
    setLoading(true)
    setShowDialog(false)

    setIsBlocked(true)

    const result = await blockUser(userId)

    if (!result.success) {
      setIsBlocked(false)
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: MSG_BLOCK_ADDED_TITLE,
        description: MSG_BLOCK_ADDED_DESCRIPTION(nickname),
      })
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  async function handleUnblock() {
    setLoading(true)

    setIsBlocked(false)

    const result = await unblockUser(userId)

    if (!result.success) {
      setIsBlocked(true)
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: MSG_BLOCK_REMOVED_TITLE,
        description: MSG_BLOCK_REMOVED_DESCRIPTION(nickname),
      })
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  return (
    <>
      <Button
        onClick={() => {
          if (isBlocked) {
            handleUnblock()
          } else {
            setShowDialog(true)
          }
        }}
        disabled={loading}
        variant={variant}
        size={size}
      >
        {loading ? '...' : isBlocked ? 'ブロック解除' : 'ブロック'}
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{nickname}さんをブロックしますか?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground text-sm">
                ブロックすると、以下の操作が行われます:
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>相互フォローが解除されます</li>
                  <li>相手の投稿が表示されなくなります</li>
                  <li>相手からのコメントが表示されなくなります</li>
                  <li>相手はあなたのプロフィールにアクセスできなくなります</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBlock}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              ブロック
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
