'use client'

import { memo, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { deleteComment, updateComment, getReplies } from '@/lib/actions/comment'
import { AVATAR_SIZE_SM, MAX_COMMENT_LENGTH } from '@/lib/constants/limits'
import { useToast } from '@/hooks/use-toast'
import { MSG_COMMENT_DELETED, MSG_COMMENT_UPDATED, MSG_ERROR_TITLE } from '@/lib/constants/messages'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { buildPostPath, buildUserPath } from '@/lib/constants/path-builders'
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
  editedAt?: string | Date | null
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

  // 編集状態。content/editedAt はローカルに持ち、保存成功で即時反映する。
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [content, setContent] = useState(comment.content)
  const [editValue, setEditValue] = useState(comment.content)
  const [editedAt, setEditedAt] = useState<string | Date | null>(comment.editedAt ?? null)

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
        <Link href={buildPostPath(postId)} className="text-primary hover:underline">
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

  function handleEditStart() {
    setEditValue(content)
    setIsEditing(true)
  }

  function handleEditCancel() {
    setIsEditing(false)
  }

  async function handleEditSave() {
    if (editValue.trim() === content.trim()) {
      setIsEditing(false)
      return
    }
    setIsSaving(true)
    const result = await updateComment(comment.id, editValue)
    setIsSaving(false)
    if (!result.success) {
      toast({ title: MSG_ERROR_TITLE, description: result.error, variant: 'destructive' })
      return
    }
    setContent(result.data?.content ?? editValue)
    setEditedAt(result.data?.editedAt ?? new Date())
    setIsEditing(false)
    toast({ description: MSG_COMMENT_UPDATED })
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
        <Link href={buildUserPath(comment.user.id)}>
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

          {isEditing ? (
            <div className="mt-1 space-y-2">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={3}
                maxLength={MAX_COMMENT_LENGTH}
                aria-label="コメントを編集"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleEditCancel} disabled={isSaving}>
                  キャンセル
                </Button>
                <Button
                  variant="bonsai"
                  size="sm"
                  onClick={handleEditSave}
                  disabled={isSaving || editValue.trim().length === 0}
                >
                  {isSaving ? '保存中...' : '保存'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <CommentContent
                content={content}
                media={comment.media}
                mentionUsers={mentionUsers}
              />
              {editedAt && (
                <span className="text-xs text-muted-foreground">（編集済み）</span>
              )}
            </>
          )}

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
            onEdit={handleEditStart}
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
