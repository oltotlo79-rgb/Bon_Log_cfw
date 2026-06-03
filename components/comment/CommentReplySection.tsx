'use client'

/**
 * @module components/comment/CommentReplySection
 */

import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CommentForm } from './CommentForm'

interface CommentReplySectionProps {
  commentId: string
  postId: string
  commentUserNickname: string
  currentUserId?: string
  showReplyForm: boolean
  onCancelReply: () => void
  onReplySuccess: () => void
  replyCount?: number
  showReplies: boolean
  loadingReplies: boolean
  onToggleReplies: () => void
}

export function CommentReplySection({
  commentId,
  postId,
  commentUserNickname,
  showReplyForm,
  onCancelReply,
  onReplySuccess,
  replyCount,
  showReplies,
  loadingReplies,
  onToggleReplies,
}: CommentReplySectionProps) {
  return (
    <>
      {showReplyForm && (
        <div className="mt-3">
          <CommentForm
            postId={postId}
            parentId={commentId}
            onSuccess={onReplySuccess}
            onCancel={onCancelReply}
            placeholder={`@${commentUserNickname} への返信...`}
            autoFocus
          />
        </div>
      )}

      {replyCount !== undefined && replyCount > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 px-2 text-primary"
          onClick={onToggleReplies}
          disabled={loadingReplies}
        >
          {loadingReplies ? (
            '読み込み中...'
          ) : showReplies ? (
            <>
              <ChevronUp className="w-4 h-4 mr-1" />
              返信を非表示
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-1" />
              {replyCount}件の返信を表示
            </>
          )}
        </Button>
      )}
    </>
  )
}
