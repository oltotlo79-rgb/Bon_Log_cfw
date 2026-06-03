'use client'

/**
 * @module components/post/RepostButton
 * リポスト/引用メニュー。リポストはサーバー側でトグルされ、引用はモーダルを開く。
 * Optimistic UI でクリック直後に状態を反映し、失敗時は元に戻す。
 */

import { useState, useTransition } from 'react'
import { Repeat2, Quote } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { createRepost } from '@/lib/actions/post'
import { QuotePostModal } from './QuotePostModal'
import {
  MSG_ERROR_TITLE,
  MSG_REPOST_DONE,
  MSG_REPOST_UNDONE,
  MSG_REPOST_FAILED,
} from '@/lib/constants/messages'

type RepostButtonProps = {
  postId: string
  quoteTarget: { id: string; content: string | null; user: { nickname: string } }
  initialReposted?: boolean
  initialCount?: number
}

export function RepostButton({
  postId,
  quoteTarget,
  initialReposted = false,
  initialCount = 0,
}: RepostButtonProps) {
  const [reposted, setReposted] = useState(initialReposted)
  const [count, setCount] = useState(initialCount)
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  function handleRepost() {
    const prevReposted = reposted
    const prevCount = count
    const next = !prevReposted

    // optimistic
    setReposted(next)
    setCount(next ? prevCount + 1 : Math.max(0, prevCount - 1))

    startTransition(async () => {
      const result = await createRepost(postId)

      if (!result.success) {
        setReposted(prevReposted)
        setCount(prevCount)
        toast({ title: MSG_ERROR_TITLE, description: MSG_REPOST_FAILED, variant: 'destructive' })
        return
      }

      // サーバーを真実とする（トグル結果に合わせる）
      const serverReposted = result.data?.reposted ?? next
      setReposted(serverReposted)
      queryClient.invalidateQueries({ queryKey: ['timeline'] })
      toast({ description: serverReposted ? MSG_REPOST_DONE : MSG_REPOST_UNDONE })
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`gap-1 ${
              reposted
                ? 'text-emerald-600 hover:text-emerald-500'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="リポスト"
            aria-pressed={reposted}
            disabled={isPending}
          >
            <Repeat2 className="w-4 h-4" aria-hidden="true" />
            {count > 0 && <span className="text-xs">{count}</span>}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={handleRepost}>
            <Repeat2 className="w-4 h-4 mr-2" aria-hidden="true" />
            {reposted ? 'リポストを取り消す' : 'リポスト'}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setQuoteOpen(true)}>
            <Quote className="w-4 h-4 mr-2" aria-hidden="true" />
            引用
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <QuotePostModal open={quoteOpen} onOpenChange={setQuoteOpen} quoteTarget={quoteTarget} />
    </>
  )
}
