/**
 * メッセージバッジコンポーネント
 *
 * @module components/message/MessageBadge
 */

'use client'

/**
 * React Query のフック
 * データフェッチングとキャッシュ管理
 */
import { useQuery } from '@tanstack/react-query'

/**
 * 未読メッセージ数取得用Server Action
 */
import { getUnreadMessageCount } from '@/lib/actions/message'
import {
  BADGE_OVERFLOW_THRESHOLD,
  BADGES_CONVERSATIONS_LIMIT,
  REFETCH_INTERVAL_MS,
} from '@/lib/constants/limits'

/**
 * MessageBadgeコンポーネントのprops型
 *
 * @property className - 追加のCSSクラス
 */
type MessageBadgeProps = {
  className?: string
}

/**
 * メッセージバッジコンポーネント
 *
 * ## 機能
 * - React Queryで未読メッセージ数を取得
 * - 30秒ごとに自動更新
 * - 未読が0件の場合は何も表示しない
 *
 * @param className - 追加のCSSクラス
 *
 * @example
 * ```tsx
 * <MessageBadge className="absolute -top-1 -right-1" />
 * ```
 */
export function MessageBadge({ className }: MessageBadgeProps) {
  /**
   * React Queryで未読メッセージ数を取得
   *
   * queryKey: キャッシュのキー
   * queryFn: データ取得関数
   * refetchInterval: 30秒ごとにバックグラウンドで再取得
   */
  const { data } = useQuery({
    queryKey: ['unreadMessageCount'],
    queryFn: async () => {
      const result = await getUnreadMessageCount()
      return result.success ? result.data : undefined
    },
    refetchInterval: REFETCH_INTERVAL_MS, // 30秒ごとに更新
  })

  /**
   * 未読数（取得失敗時は0）
   * 直近200会話で概算しており、上限に達した場合は capReached が true
   */
  const count = data?.count ?? 0
  const capReached = data?.capReached === true

  /**
   * 未読が0件の場合は何も表示しない
   */
  if (count === 0) {
    return null
  }

  /**
   * 200会話上限に達し未読が200以上のときは「200+」、それ以外は99+または実数
   */
  const label =
    capReached && count >= BADGES_CONVERSATIONS_LIMIT
      ? `${BADGES_CONVERSATIONS_LIMIT}+`
      : count > BADGE_OVERFLOW_THRESHOLD
        ? `${BADGE_OVERFLOW_THRESHOLD}+`
        : count

  return (
    <span
      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-medium bg-foreground text-background rounded-full ${className}`}
      aria-label={`未読メッセージ${count}件`}
    >
      {label}
    </span>
  )
}
