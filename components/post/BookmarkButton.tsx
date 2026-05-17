/**
 * ブックマークボタンコンポーネント
 *
 * @module components/post/BookmarkButton
 */

'use client'

/**
 * React Hooks
 *
 * useState: ブックマーク状態の管理
 * useTransition: 非同期処理中のペンディング状態管理
 * useEffect: propsの変更を監視して状態を同期
 */
import { useState, useTransition, useEffect } from 'react'

/**
 * ブックマークアイコン
 * lucide-reactライブラリから使用
 */
import { Bookmark } from 'lucide-react'

/**
 * React Query クライアント
 * ブックマーク成功時にタイムラインキャッシュを無効化
 */
import { useQueryClient } from '@tanstack/react-query'

/**
 * トースト通知
 * 操作結果のフィードバックに使用
 */
import { useToast } from '@/hooks/use-toast'
import { MSG_BOOKMARK_ADDED, MSG_BOOKMARK_FAILED, MSG_BOOKMARK_REMOVED, MSG_ERROR_TITLE } from '@/lib/constants/messages'

/**
 * shadcn/uiのButtonコンポーネント
 */
import { Button } from '@/components/ui/button'

/**
 * ブックマークトグル用Server Action
 */
import { toggleBookmark } from '@/lib/actions/bookmark'

/**
 * BookmarkButtonコンポーネントのprops型
 *
 * @property postId - ブックマーク対象の投稿ID
 * @property initialBookmarked - 初期のブックマーク状態
 */
type BookmarkButtonProps = {
  postId: string
  initialBookmarked: boolean
}

/**
 * ブックマークボタンコンポーネント
 *
 * ## 機能
 * - しおりアイコンでブックマーク状態を表示
 * - ブックマーク済みの場合は黄色で塗りつぶし
 * - クリックでブックマークをトグル
 * - Optimistic UIで即時フィードバック
 *
 * @param postId - 投稿ID
 * @param initialBookmarked - 初期ブックマーク状態
 *
 * @example
 * ```tsx
 * <BookmarkButton
 *   postId="post123"
 *   initialBookmarked={false}
 * />
 * ```
 */
export function BookmarkButton({
  postId,
  initialBookmarked,
}: BookmarkButtonProps) {

  /**
   * ブックマーク状態
   * true: ブックマーク済み, false: 未ブックマーク
   */
  const [bookmarked, setBookmarked] = useState(initialBookmarked)

  /**
   * 非同期処理中のペンディング状態
   */
  const [isPending, startTransition] = useTransition()

  /**
   * React Queryクライアント
   */
  const queryClient = useQueryClient()

  /**
   * トースト通知
   */
  const { toast } = useToast()

  /**
   * propsが更新されたら状態を同期
   */
  useEffect(() => {
    setBookmarked(initialBookmarked)
  }, [initialBookmarked])

  /**
   * ブックマークトグルハンドラ
   *
   * Optimistic UIパターンを使用:
   * 1. UIを即座に更新
   * 2. バックグラウンドでサーバーに送信
   * 3. エラー時はロールバック
   */
  async function handleToggle() {
    /**
     * Optimistic UI: 即座にUIを更新
     */
    const newBookmarked = !bookmarked
    setBookmarked(newBookmarked)

    startTransition(async () => {
      const result = await toggleBookmark(postId)

      if (!result.success) {
        setBookmarked(bookmarked)
        toast({
          title: MSG_ERROR_TITLE,
          description: MSG_BOOKMARK_FAILED,
          variant: 'destructive',
        })
      } else {
        /**
         * 成功時: タイムラインキャッシュを無効化
         */
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
        toast({
          description: newBookmarked ? MSG_BOOKMARK_ADDED : MSG_BOOKMARK_REMOVED,
        })
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`${
        bookmarked
          ? 'text-foreground hover:text-foreground/80'
          : 'text-muted-foreground hover:text-foreground'
      }`}
      onClick={handleToggle}
      disabled={isPending}
      aria-label={bookmarked ? 'ブックマークを解除' : 'ブックマークに追加'}
      aria-pressed={bookmarked}
    >
      <Bookmark
        className={`w-5 h-5 transition-all ${
          bookmarked ? 'fill-current scale-110' : ''
        }`}
        aria-hidden="true"
      />
    </Button>
  )
}
