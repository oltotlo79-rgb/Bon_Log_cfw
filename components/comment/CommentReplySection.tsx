'use client'

/**
 * @file CommentReplySection.tsx
 * @description コメント返信セクション（返信フォームと返信一覧）
 */

import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CommentForm } from './CommentForm'

interface CommentReplySectionProps {
  /** コメントID */
  commentId: string
  /** 投稿ID */
  postId: string
  /** コメント投稿者のニックネーム（返信プレースホルダー用） */
  commentUserNickname: string
  /** 現在のユーザーID */
  currentUserId?: string
  /** 返信フォームを表示するか */
  showReplyForm: boolean
  /** 返信フォームキャンセルハンドラ */
  onCancelReply: () => void
  /** 返信投稿成功ハンドラ */
  onReplySuccess: () => void
  /** 返信件数 */
  replyCount?: number
  /** 返信一覧を表示するか */
  showReplies: boolean
  /** 返信読み込み中かどうか */
  loadingReplies: boolean
  /** 返信トグルハンドラ */
  onToggleReplies: () => void
}

/**
 * コメント返信セクションコンポーネント
 *
 * 返信フォームと返信一覧の展開/折りたたみボタンを提供します。
 */
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
      {/* 返信フォーム */}
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

      {/* 返信を表示/非表示ボタン */}
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
