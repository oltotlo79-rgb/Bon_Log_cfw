/**
 * スレッドミュートボタンコンポーネント
 *
 * @module components/comment/ThreadMuteButton
 */

'use client'

import { useState } from 'react'
import { BellOff, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { muteThread, unmuteThread } from '@/lib/actions/comment-thread-mute'

type ThreadMuteButtonProps = {
  rootCommentId: string
  initialMuted: boolean
}

export function ThreadMuteButton({ rootCommentId, initialMuted }: ThreadMuteButtonProps) {
  const [muted, setMuted] = useState(initialMuted)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    const result = muted
      ? await unmuteThread(rootCommentId)
      : await muteThread(rootCommentId)
    if (result.success) {
      setMuted(!muted)
    }
    setLoading(false)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-muted-foreground"
      onClick={handleToggle}
      disabled={loading}
      title={muted ? 'スレッド通知をオンにする' : 'スレッド通知をミュート'}
      aria-label={muted ? 'スレッド通知をオンにする' : 'スレッド通知をミュート'}
    >
      {muted ? <BellOff className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
    </Button>
  )
}
