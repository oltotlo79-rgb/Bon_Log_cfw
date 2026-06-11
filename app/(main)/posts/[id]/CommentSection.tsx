import { getComments, getCommentCount } from '@/lib/actions/comment'
import { prisma } from '@/lib/db'
import { CommentThread } from '@/components/comment'

type CommentSectionProps = {
  postId: string
  currentUserId?: string
}

export async function CommentSection({ postId, currentUserId }: CommentSectionProps) {
  const [commentsResult, countResult] = await Promise.all([
    getComments(postId),
    getCommentCount(postId),
  ])

  let mutedThreadIds: string[] = []
  if (currentUserId && commentsResult.comments && commentsResult.comments.length > 0) {
    const commentIds = commentsResult.comments.map((c: { id: string }) => c.id)
    const mutes = await prisma.commentThreadMute.findMany({
      where: {
        userId: currentUserId,
        commentId: { in: commentIds },
      },
      select: { commentId: true },
    })
    mutedThreadIds = mutes.map((m: { commentId: string }) => m.commentId)
  }

  return (
    <CommentThread
      postId={postId}
      comments={commentsResult.comments || []}
      nextCursor={commentsResult.nextCursor}
      currentUserId={currentUserId}
      commentCount={countResult.count}
      mutedThreadIds={mutedThreadIds}
    />
  )
}

export function CommentSectionSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-5 w-32 bg-muted rounded" />
      <div className="h-20 bg-muted rounded" />
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 bg-muted rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-4 w-full bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
