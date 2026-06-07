'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CommentForm } from './CommentForm'
import { CommentList } from './CommentList'
import { ROUTE_LOGIN } from '@/lib/constants/routes'

type Comment = {
  id: string
  content: string
  createdAt: string | Date
  parentId: string | null
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  likeCount: number
  replyCount?: number
  isBlockedUser?: boolean
}

type CommentThreadProps = {
  postId: string
  comments: Comment[]
  nextCursor?: string
  currentUserId?: string
  commentCount: number
  mutedThreadIds?: string[]
}

export function CommentThread({
  postId,
  comments,
  nextCursor,
  currentUserId,
  commentCount,
  mutedThreadIds = [],
}: CommentThreadProps) {
  const router = useRouter()
  const [optimisticComments, setOptimisticComments] = useState<Comment[]>([])

  // router.refresh() でサーバーから最新コメントが届いたら楽観表示を破棄する
  // (これが無いと実コメント反映後も「送信中...」プレースホルダが残り続ける)。
  // prop 変化時の state リセットは effect ではなく描画中調整で行う (React 公式パターン)。
  const [prevComments, setPrevComments] = useState(comments)
  if (comments !== prevComments) {
    setPrevComments(comments)
    setOptimisticComments([])
  }

  function handleCommentSuccess(content: string) {
    if (!currentUserId) return
    const optimistic: Comment = {
      id: `optimistic-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      parentId: null,
      user: {
        id: currentUserId,
        nickname: '',
        avatarUrl: null,
      },
      likeCount: 0,
    }
    setOptimisticComments((prev) => [optimistic, ...prev])
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold">
          コメント
          {commentCount > 0 && (
            <span className="ml-2 text-muted-foreground font-normal">
              ({commentCount})
            </span>
          )}
        </h3>
      </div>

      {currentUserId ? (
        <CommentForm postId={postId} onSuccess={handleCommentSuccess} />
      ) : (
        <div className="text-center py-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            コメントするには
            <Link href={ROUTE_LOGIN} className="text-primary hover:underline mx-1">
              ログイン
            </Link>
            してください
          </p>
        </div>
      )}

      {optimisticComments.length > 0 && (
        <div className="space-y-3 animate-fade-in-up">
          {optimisticComments.map((c) => (
            <div key={c.id} className="bg-muted/30 rounded-lg p-4 text-sm opacity-70">
              <p className="whitespace-pre-wrap break-words">{c.content}</p>
              <p className="text-xs text-muted-foreground mt-1">送信中...</p>
            </div>
          ))}
        </div>
      )}

      <CommentList
        postId={postId}
        initialComments={comments}
        initialNextCursor={nextCursor}
        currentUserId={currentUserId}
        mutedThreadIds={mutedThreadIds}
      />
    </div>
  )
}
