/**
 * @module components/user/MuteButton
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
import { muteUser, unmuteUser } from '@/lib/actions/mute'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { MSG_ERROR_TITLE, MSG_MUTE_REMOVED_DESCRIPTION, MSG_MUTE_REMOVED_TITLE } from '@/lib/constants/messages'
import { useQueryClient } from '@tanstack/react-query'

type MuteButtonProps = {
  userId: string
  nickname: string
  initialIsMuted: boolean
  variant?: 'default' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function MuteButton({
  userId,
  nickname,
  initialIsMuted,
  variant = 'ghost',
  size = 'default',
}: MuteButtonProps) {

  const [isMuted, setIsMuted] = useState(initialIsMuted)
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const _router = useRouter()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  async function handleMute() {
    setLoading(true)
    setShowDialog(false)

    setIsMuted(true)

    const result = await muteUser(userId)

    if (!result.success) {
      setIsMuted(false)
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'ミュートしました',
        description: `${nickname}さんをミュートしました`,
      })
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  async function handleUnmute() {
    setLoading(true)

    setIsMuted(false)

    const result = await unmuteUser(userId)

    if (!result.success) {
      setIsMuted(true)
      toast({
        title: MSG_ERROR_TITLE,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: MSG_MUTE_REMOVED_TITLE,
        description: MSG_MUTE_REMOVED_DESCRIPTION(nickname),
      })
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
    }

    setLoading(false)
  }

  return (
    <>
      <Button
        onClick={() => {
          if (isMuted) {
            handleUnmute()
          } else {
            setShowDialog(true)
          }
        }}
        disabled={loading}
        variant={variant}
        size={size}
      >
        {loading ? '...' : isMuted ? 'ミュート解除' : 'ミュート'}
      </Button>

      <AlertDialog open={showDialog} onOpenChange={setShowDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{nickname}さんをミュートしますか?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-muted-foreground text-sm">
                ミュートすると、以下の効果があります:
                <ul className="mt-2 space-y-1 list-disc list-inside">
                  <li>タイムラインに投稿が表示されなくなります</li>
                  <li>通知が表示されなくなります</li>
                </ul>
                <span className="block mt-2">フォロー関係は維持されます。</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleMute}>ミュート</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
