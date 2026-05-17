'use client'

import { memo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { deleteComment, getReplies } from '@/lib/actions/comment'
import { AVATAR_SIZE_SM } from '@/lib/constants/limits'
import { useToast } from '@/hooks/use-toast'
import { MSG_COMMENT_DELETED } from '@/lib/constants/messages'
import { DeletedCommentPlaceholder } from './DeletedCommentPlaceholder'
import { CommentMeta } from './CommentHeader'
import { CommentContent } from './CommentContent'
import { CommentActions } from './CommentActions'
import { CommentReplySection } from './CommentReplySection'

/** コメントスレッドの最大ネスト深さ。これ以上は投稿詳細へ誘導する。 */
const MAX_COMMENT_DEPTH = 10

type CommentMedia = {
  id: string
  url: string
  type: string
  sortOrder: number
}

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
  media?: CommentMedia[]
  likeCount: number
  replyCount?: number
  isLiked?: boolean
  isBlockedUser?: boolean
  isDeleted?: boolean
}

type MentionUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

type CommentCardProps = {
  comment: Comment
  postId: string
  currentUserId?: string
  /** 現在のスレッド深度。0 がルートコメント。`MAX_COMMENT_DEPTH` 以上で投稿詳細へ誘導する。 */
  depth?: number
  mentionUsers?: Map<string, MentionUser>
  isMuted?: boolean
  rootCommentId?: string
  onDeleted?: (commentId: string) => void
}

// Why memo: コメント一覧で大量にレンダーされ得るため、親 (CommentList) の状態更新による
// 不要な再レンダリングを抑止する。`onDeleted` は親側で useCallback 済み、他 props は primitive。
function CommentCardInner({
  comment,
  postId,
  currentUserId,
  depth = 0,
  mentionUsers = new Map(),
  isMuted = false,
  rootCommentId,
  onDeleted,
}: CommentCardProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [showReplyForm, setShowReplyForm] = useState(false)
  const [showReplies, setShowReplies] = useState(false)
  const [replies, setReplies] = useState<Comment[]>([])
  const [loadingReplies, setLoadingReplies] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const handleToggleReplyForm = useCallback(() => {
    setShowReplyForm(prev => !prev)
  }, [])

  const handleCancelReply = useCallback(() => {
    setShowReplyForm(false)
  }, [])

  const handleNestedDeleted = useCallback((deletedId: string) => {
    setReplies(prev => {
      const target = prev.find(r => r.id === deletedId)
      if (target && (target.replyCount === undefined || target.replyCount === 0)) {
        const remaining = prev.filter(r => r.id !== deletedId)
        // 末端の返信を削除して空になった場合、親コメント自体も論理削除扱いにする (UI 上の見せ方統一)
        if (remaining.length === 0 && onDeleted) {
          onDeleted(comment.id)
        }
        return remaining
      }
      return prev.map(r => r.id === deletedId ? { ...r, isDeleted: true } : r)
    })
  }, [onDeleted, comment.id])

  if (depth >= MAX_COMMENT_DEPTH) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        <Link href={`/posts/${postId}`} className="text-primary hover:underline">
          スレッドの続きを表示 →
        </Link>
      </div>
    )
  }

  const isOwner = currentUserId === comment.user.id

  async function handleDelete() {
    setIsDeleting(true)
    const result = await deleteComment(comment.id)
    if (!result.success) {
      toast({ title: result.error, variant: 'destructive' })
    } else if (onDeleted) {
      onDeleted(comment.id)
    }
    setIsDeleting(false)
  }

  async function handleToggleReplies() {
    if (showReplies) {
      setShowReplies(false)
      return
    }

    if (replies.length === 0 && comment.replyCount !== undefined && comment.replyCount > 0) {
      setLoadingReplies(true)
      const result = await getReplies(comment.id)
      if (result.replies) {
        setReplies(result.replies)
      }
      setLoadingReplies(false)
    }

    setShowReplies(true)
  }

  async function handleReplySuccess() {
    setShowReplyForm(false)
    const result = await getReplies(comment.id)
    if (result.replies) {
      setReplies(result.replies)
      setShowReplies(true)
    }
    router.refresh()
  }

  if (comment.isBlockedUser) {
    return (
      <div>
        <DeletedCommentPlaceholder
          message="ブロック中のユーザーのコメントです"
          replyCount={comment.replyCount}
          showReplies={showReplies}
          loadingReplies={loadingReplies}
          onToggleReplies={handleToggleReplies}
        />
        {showReplies && replies.length > 0 && (
          <div className={`mt-3 space-y-3 ${depth === 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}>
            {replies.map((reply) => (
              <CommentCard
                key={reply.id}
                comment={reply}
                postId={postId}
                currentUserId={currentUserId}
                depth={depth + 1}
                mentionUsers={mentionUsers}
                rootCommentId={rootCommentId || comment.id}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (comment.isDeleted) {
    return (
      <div>
        <DeletedCommentPlaceholder
          message={MSG_COMMENT_DELETED}
          replyCount={comment.replyCount}
          showReplies={showReplies}
          loadingReplies={loadingReplies}
          onToggleReplies={handleToggleReplies}
        />
        {showReplies && replies.length > 0 && (
          <div className={`mt-3 space-y-3 ${depth === 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}>
            {replies.map((reply) => (
              <CommentCard
                key={reply.id}
                comment={reply}
                postId={postId}
                currentUserId={currentUserId}
                depth={depth + 1}
                mentionUsers={mentionUsers}
                rootCommentId={rootCommentId || comment.id}
                onDeleted={handleNestedDeleted}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex gap-3">
        <Link href={`/users/${comment.user.id}`}>
          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
            {comment.user.avatarUrl ? (
              <Image
                src={comment.user.avatarUrl}
                alt={comment.user.nickname}
                width={AVATAR_SIZE_SM}
                height={AVATAR_SIZE_SM}
                sizes={`${AVATAR_SIZE_SM}px`}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
                {comment.user.nickname[0]}
              </div>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0">
          <CommentMeta user={comment.user} createdAt={comment.createdAt} />

          <CommentContent
            content={comment.content}
            media={comment.media}
            mentionUsers={mentionUsers}
          />

          <CommentActions
            commentId={comment.id}
            postId={postId}
            currentUserId={currentUserId}
            isOwner={isOwner}
            isLiked={comment.isLiked ?? false}
            likeCount={comment.likeCount}
            replyCount={comment.replyCount}
            isDeleting={isDeleting}
            showReplyForm={showReplyForm}
            isMuted={isMuted}
            rootCommentId={rootCommentId ?? comment.id}
            onToggleReplyForm={handleToggleReplyForm}
            onDelete={handleDelete}
          />

          <CommentReplySection
            commentId={comment.id}
            postId={postId}
            commentUserNickname={comment.user.nickname}
            currentUserId={currentUserId}
            showReplyForm={showReplyForm}
            onCancelReply={handleCancelReply}
            onReplySuccess={handleReplySuccess}
            replyCount={comment.replyCount}
            showReplies={showReplies}
            loadingReplies={loadingReplies}
            onToggleReplies={handleToggleReplies}
          />
        </div>
      </div>

      {showReplies && replies.length > 0 && (
        <div className={`mt-3 space-y-3 ${depth === 0 ? 'ml-8 border-l-2 border-muted pl-4' : ''}`}>
          {replies.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              postId={postId}
              currentUserId={currentUserId}
              depth={depth + 1}
              mentionUsers={mentionUsers}
              rootCommentId={rootCommentId ?? comment.id}
              isMuted={isMuted}
              onDeleted={handleNestedDeleted}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export const CommentCard = memo(CommentCardInner)
