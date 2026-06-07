'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import {
  approveFollowRequest,
  rejectFollowRequest,
  cancelFollowRequest,
} from '@/lib/actions/follow-request'
import { MSG_ERROR_FALLBACK } from '@/lib/constants/messages'
import { buildUserPath } from '@/lib/constants/path-builders'

type FollowRequestUser = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
}

type FollowRequest = {
  id: string
  user: FollowRequestUser
  createdAt: Date
}

type Props = {
  initialReceivedRequests: FollowRequest[]
  initialSentRequests: FollowRequest[]
}

export function FollowRequestsClient({
  initialReceivedRequests,
  initialSentRequests,
}: Props) {
  const [receivedRequests, setReceivedRequests] = useState(initialReceivedRequests)
  const [sentRequests, setSentRequests] = useState(initialSentRequests)
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'received' | 'sent'>('received')

  const { toast } = useToast()
  const router = useRouter()

  const setLoading = (id: string, loading: boolean) => {
    setLoadingIds((prev) => {
      const next = new Set(prev)
      if (loading) {
        next.add(id)
      } else {
        next.delete(id)
      }
      return next
    })
  }

  async function handleApprove(requestId: string) {
    setLoading(requestId, true)

    const result = await approveFollowRequest(requestId)

    if ('error' in result) {
      toast({
        title: MSG_ERROR_FALLBACK,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: '承認しました',
        description: 'フォロワーに追加されました',
      })
      setReceivedRequests((prev) => prev.filter((r) => r.id !== requestId))
    }

    setLoading(requestId, false)
    router.refresh()
  }

  async function handleReject(requestId: string) {
    setLoading(requestId, true)

    const result = await rejectFollowRequest(requestId)

    if ('error' in result) {
      toast({
        title: MSG_ERROR_FALLBACK,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: '拒否しました',
      })
      setReceivedRequests((prev) => prev.filter((r) => r.id !== requestId))
    }

    setLoading(requestId, false)
    router.refresh()
  }

  async function handleCancel(userId: string, requestId: string) {
    setLoading(requestId, true)

    const result = await cancelFollowRequest(userId)

    if (!result.success) {
      toast({
        title: MSG_ERROR_FALLBACK,
        description: result.error,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'リクエストをキャンセルしました',
      })
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId))
    }

    setLoading(requestId, false)
    router.refresh()
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div>
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
            activeTab === 'received'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          受信したリクエスト
          {receivedRequests.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {receivedRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
            activeTab === 'sent'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          送信したリクエスト
          {sentRequests.length > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded-full">
              {sentRequests.length}
            </span>
          )}
        </button>
      </div>

      <div>
        {activeTab === 'received' ? (
          receivedRequests.length > 0 ? (
            <div className="divide-y">
              {receivedRequests.map((request) => (
                <div key={request.id} className="p-4 flex items-start gap-3">
                  <Link href={buildUserPath(request.user.id)}>
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {request.user.avatarUrl ? (
                        <Image
                          src={request.user.avatarUrl}
                          alt={request.user.nickname}
                          width={48}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg text-muted-foreground">
                          {request.user.nickname.charAt(0)}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={buildUserPath(request.user.id)}
                      className="font-medium hover:underline"
                    >
                      {request.user.nickname}
                    </Link>
                    {request.user.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                        {request.user.bio}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(request.createdAt)}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="bonsai"
                      onClick={() => handleApprove(request.id)}
                      disabled={loadingIds.has(request.id)}
                    >
                      {loadingIds.has(request.id) ? '...' : '承認'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(request.id)}
                      disabled={loadingIds.has(request.id)}
                    >
                      拒否
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              フォローリクエストはありません
            </div>
          )
        ) : (
          sentRequests.length > 0 ? (
            <div className="divide-y">
              {sentRequests.map((request) => (
                <div key={request.id} className="p-4 flex items-start gap-3">
                  <Link href={buildUserPath(request.user.id)}>
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      {request.user.avatarUrl ? (
                        <Image
                          src={request.user.avatarUrl}
                          alt={request.user.nickname}
                          width={48}
                          height={48}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-lg text-muted-foreground">
                          {request.user.nickname.charAt(0)}
                        </div>
                      )}
                    </div>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={buildUserPath(request.user.id)}
                      className="font-medium hover:underline"
                    >
                      {request.user.nickname}
                    </Link>
                    {request.user.bio && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                        {request.user.bio}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDate(request.createdAt)} にリクエスト送信
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancel(request.user.id, request.id)}
                    disabled={loadingIds.has(request.id)}
                    className="flex-shrink-0"
                  >
                    {loadingIds.has(request.id) ? '...' : 'キャンセル'}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              送信中のフォローリクエストはありません
            </div>
          )
        )}
      </div>
    </div>
  )
}
