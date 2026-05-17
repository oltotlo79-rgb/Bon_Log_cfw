/**
 * コメントいいねボタンコンポーネント
 *
 * @module components/comment/CommentLikeButton
 */

'use client'

/**
 * React Hooks
 *
 * useState: いいね状態といいね数の管理
 * useTransition: 非同期処理中のペンディング状態管理
 * useEffect: propsの変更を検知して状態を同期
 */
import { useState, useTransition, useEffect } from 'react'

/**
 * Lucide Reactのハートアイコン
 * いいねボタンのアイコンとして使用
 */
import { Heart } from 'lucide-react'

/**
 * React QueryのuseQueryClientフック
 * いいね操作後にタイムラインのキャッシュを無効化するために使用
 */
import { useQueryClient } from '@tanstack/react-query'

/**
 * トースト通知
 * 操作結果のフィードバックに使用
 */
import { useToast } from '@/hooks/use-toast'
import { MSG_ERROR_TITLE, MSG_LIKE_FAILED } from '@/lib/constants/messages'

/**
 * shadcn/ui Buttonコンポーネント
 * いいねボタンのベースコンポーネント
 */
import { Button } from '@/components/ui/button'

/**
 * Server Actions
 * toggleCommentLike: コメントへのいいねを追加/解除
 */
import { toggleCommentLike } from '@/lib/actions/like'

/**
 * CommentLikeButtonコンポーネントのprops型
 *
 * @property commentId - いいね対象のコメントID
 * @property postId - コメントが属する投稿のID（キャッシュ無効化に使用）
 * @property initialLiked - 初期のいいね状態（true: いいね済み）
 * @property initialCount - 初期のいいね数
 */
type CommentLikeButtonProps = {
  commentId: string
  postId: string
  initialLiked: boolean
  initialCount: number
}

/**
 * コメントいいねボタンコンポーネント
 *
 * コメントに対するいいね機能を提供するボタン。
 * Optimistic UIパターンを採用し、クリック即座に状態を更新して
 * レスポンシブな操作感を実現している。
 *
 * ## Optimistic UIの動作
 * 1. クリック時、即座にliked/countを更新（楽観的）
 * 2. バックグラウンドでServer Actionを実行
 * 3. エラー時は元の状態にロールバック
 * 4. 成功時はReact Queryキャッシュを無効化
 *
 * @param commentId - コメントID
 * @param postId - 投稿ID
 * @param initialLiked - 初期いいね状態
 * @param initialCount - 初期いいね数
 */
export function CommentLikeButton({
  commentId,
  postId,
  initialLiked,
  initialCount,
}: CommentLikeButtonProps) {

  /**
   * 現在のいいね状態
   * trueの場合、現在のユーザーがこのコメントにいいね済み
   */
  const [liked, setLiked] = useState(initialLiked)

  /**
   * 現在のいいね数
   * いいね/解除で増減する
   */
  const [count, setCount] = useState(initialCount)

  /**
   * Server Action実行中のペンディング状態
   * trueの間はボタンが無効化される
   */
  const [isPending, startTransition] = useTransition()

  /**
   * React QueryのQueryClientインスタンス
   * いいね操作後にタイムラインキャッシュを無効化するために使用
   */
  const queryClient = useQueryClient()

  /**
   * トースト通知
   */
  const { toast } = useToast()

  /**
   * propsの変更に応じた状態の同期
   *
   * 親コンポーネントから新しいinitialLiked/initialCountが渡された場合、
   * 内部状態を更新して最新のデータを反映する。
   *
   * ## 条件付き更新
   * - 現在の値と新しい値が異なる場合のみ更新
   * - 不要な再レンダリングを防止
   *
   * ## 使用シナリオ
   * - ページ更新やリアルタイム同期でいいね状態が変更された場合
   *
   * @remarks
   * ESLintのset-state-in-effectルールを意図的に無効化している。
   * これはprops同期パターンとして正当な使用法。
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- props同期のための必要な処理
    setLiked((prev) => (prev !== initialLiked ? initialLiked : prev))
    setCount((prev) => (prev !== initialCount ? initialCount : prev))
  }, [initialLiked, initialCount])

  /**
   * いいねトグルハンドラ
   *
   * いいねボタンをクリックした際に実行される。
   * Optimistic UIパターンで即座にUIを更新し、
   * バックグラウンドでServer Actionを実行する。
   *
   * ## 処理フロー
   * 1. 楽観的更新: liked状態を反転、countを増減
   * 2. useTransitionでServer Actionを実行
   * 3. エラー時: 元の状態にロールバック
   * 4. 成功時: React Queryのtimelineキャッシュを無効化
   *
   * ## ロールバックの仕組み
   * - エラー時はlikedを元に戻し、countもinitialCountに戻す
   * - これにより、サーバーエラー時もUIの整合性を保つ
   */
  async function handleToggle() {
    const newLiked = !liked
    setLiked(newLiked)
    setCount(prev => newLiked ? prev + 1 : prev - 1)

    startTransition(async () => {
      const result = await toggleCommentLike(commentId, postId)

      if (!result.success) {
        setLiked(liked)
        setCount(initialCount)
        toast({
          title: MSG_ERROR_TITLE,
          description: MSG_LIKE_FAILED,
          variant: 'destructive',
        })
      } else {
        queryClient.invalidateQueries({ queryKey: ['timeline'] })
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`h-7 px-2 ${
        liked
          // いいね済み: 塗りつぶしで表示
          ? 'text-foreground hover:text-foreground/80'
          // 未いいね: グレーで表示、ホバーで塗りつぶしに
          : 'text-muted-foreground hover:text-foreground'
      }`}
      onClick={handleToggle}
      disabled={isPending}
      aria-label={liked ? 'コメントのいいねを取り消す' : 'コメントにいいねする'}
      aria-pressed={liked}
    >
      {/* ハートアイコン: いいね済みの場合は塗りつぶし＆拡大アニメーション */}
      <Heart
        className={`w-4 h-4 mr-1 transition-all ${
          liked ? 'fill-current scale-110' : ''
        }`}
        aria-hidden="true"
      />
      {/* いいね数を表示 */}
      <span className="text-xs">{count}</span>
    </Button>
  )
}
