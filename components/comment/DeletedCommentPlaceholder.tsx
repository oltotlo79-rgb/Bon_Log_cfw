'use client'

/**
 * @file DeletedCommentPlaceholder.tsx
 * @description 削除・ブロック中コメントのプレースホルダーコンポーネント
 */

import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp } from 'lucide-react'

interface DeletedCommentPlaceholderProps {
  /** プレースホルダーに表示するメッセージ */
  message: string
  /** 返信件数（0またはundefinedの場合は表示しない） */
  replyCount?: number
  /** 返信を表示中かどうか */
  showReplies: boolean
  /** 返信読み込み中かどうか */
  loadingReplies: boolean
  /** 返信トグルハンドラ */
  onToggleReplies: () => void
}

/**
 * 削除・ブロック中コメントのプレースホルダーコンポーネント
 *
 * 削除されたコメントやブロック中ユーザーのコメントに表示します。
 * 返信がある場合は展開ボタンも表示します。
 */
export function DeletedCommentPlaceholder({
  message,
  replyCount,
  showReplies,
  loadingReplies,
  onToggleReplies,
}: DeletedCommentPlaceholderProps) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-muted flex-shrink-0 flex items-center justify-center">
        <span className="text-muted-foreground text-xs">×</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground py-1">{message}</p>
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
      </div>
    </div>
  )
}
