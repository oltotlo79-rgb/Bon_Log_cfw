'use client'

import Link from 'next/link'
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
import { MessageCircle, Trash2 } from 'lucide-react'
import { CommentLikeButton } from './CommentLikeButton'
import { ThreadMuteButton } from './ThreadMuteButton'
import { ROUTE_LOGIN } from '@/lib/constants/routes'

interface CommentActionsProps {
  commentId: string
  postId: string
  currentUserId?: string
  isOwner: boolean
  isLiked: boolean
  likeCount: number
  replyCount?: number
  isDeleting: boolean
  showReplyForm: boolean
  isMuted: boolean
  rootCommentId: string
  onToggleReplyForm: () => void
  onDelete: () => void
}

export function CommentActions({
  commentId,
  postId,
  currentUserId,
  isOwner,
  isLiked,
  likeCount,
  replyCount,
  isDeleting,
  isMuted,
  rootCommentId,
  onToggleReplyForm,
  onDelete,
}: CommentActionsProps) {
  return (
    <div className="flex items-center gap-4 mt-2">
      {currentUserId ? (
        <CommentLikeButton
          commentId={commentId}
          postId={postId}
          initialLiked={isLiked}
          initialCount={likeCount}
        />
      ) : (
        likeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground"
            asChild
          >
            <Link href={ROUTE_LOGIN}>
              <span className="text-xs">{likeCount}</span>
            </Link>
          </Button>
        )
      )}

      {currentUserId && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-muted-foreground"
          onClick={onToggleReplyForm}
        >
          <MessageCircle className="w-4 h-4 mr-1" />
          <span className="text-xs">返信</span>
        </Button>
      )}

      {currentUserId && (
        <ThreadMuteButton
          rootCommentId={rootCommentId}
          initialMuted={isMuted}
        />
      )}

      {isOwner && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-destructive"
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>コメントを削除</AlertDialogTitle>
              <AlertDialogDescription>
                このコメントを削除してもよろしいですか？
                {replyCount !== undefined && replyCount > 0 && (
                  <span className="block mt-2 text-muted-foreground">
                    このコメントには{replyCount}件の返信があります。
                    返信は削除されません。
                  </span>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>キャンセル</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                削除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
