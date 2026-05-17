/**
 * フォローボタンコンポーネント
 *
 * @module components/user/FollowButton
 */

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toggleFollow } from '@/lib/actions/follow'
import { sendFollowRequest, cancelFollowRequest } from '@/lib/actions/follow-request'
import { useFollowAction } from '@/hooks/use-follow-action'
import {
  MSG_FOLLOW_REQUEST_CANCELED,
  MSG_FOLLOW_REQUEST_PENDING,
  MSG_FOLLOW_REQUEST_SENT,
} from '@/lib/constants/messages'

/**
 * FollowButtonコンポーネントのprops型
 *
 * @property userId - フォロー対象のユーザーID
 * @property initialIsFollowing - 初期のフォロー状態（true=フォロー中）
 * @property isPublic - 対象ユーザーが公開アカウントかどうか
 * @property initialHasRequest - 初期のリクエスト送信状態（true=リクエスト済み）
 */
type FollowButtonProps = {
  userId: string
  initialIsFollowing: boolean
  isPublic?: boolean
  initialHasRequest?: boolean
}

/**
 * フォローボタンコンポーネント
 *
 * ## 機能
 * - 公開アカウント: クリックでフォロー/フォロー解除をトグル
 * - 非公開アカウント: フォローリクエストを送信/キャンセル
 * - Optimistic UIで即時フィードバック
 * - ホバー時に「フォロー解除」表示
 *
 * @param userId - フォロー対象のユーザーID
 * @param initialIsFollowing - 初期フォロー状態
 * @param isPublic - 公開アカウントかどうか（デフォルト: true）
 * @param initialHasRequest - リクエスト送信済みかどうか（デフォルト: false）
 *
 * @example
 * ```tsx
 * // 公開アカウント
 * <FollowButton
 *   userId="user123"
 *   initialIsFollowing={false}
 *   isPublic={true}
 * />
 *
 * // 非公開アカウント
 * <FollowButton
 *   userId="user456"
 *   initialIsFollowing={false}
 *   isPublic={false}
 *   initialHasRequest={false}
 * />
 * ```
 */
export function FollowButton({
  userId,
  initialIsFollowing,
  isPublic = true,
  initialHasRequest = false,
}: FollowButtonProps) {

  /** フォロー状態: true=フォロー中, false=未フォロー */
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)

  /** フォローリクエスト送信状態（非公開アカウント用） */
  const [hasRequest, setHasRequest] = useState(initialHasRequest)

  /** ホバー状態 */
  const [isHovered, setIsHovered] = useState(false)

  /** 楽観的更新・ロールバック・エラーハンドリングを共通化したフック */
  const { execute, isPending } = useFollowAction()

  /** 公開アカウントのフォロー/フォロー解除 */
  function handleFollow() {
    const previousState = isFollowing
    execute({
      onOptimistic: () => setIsFollowing(!isFollowing),
      onRollback: () => setIsFollowing(previousState),
      action: () => toggleFollow(userId),
      getError: (result) => (!result.success ? result.error : null),
    })
  }

  /** 非公開アカウントへのフォローリクエスト送信 */
  function handleSendRequest() {
    execute({
      onOptimistic: () => setHasRequest(true),
      onRollback: () => setHasRequest(false),
      action: () => sendFollowRequest(userId),
      getError: (result) => ('error' in result ? result.error : null),
      successToast: {
        title: MSG_FOLLOW_REQUEST_SENT,
        description: MSG_FOLLOW_REQUEST_PENDING,
      },
    })
  }

  /** フォローリクエストのキャンセル */
  function handleCancelRequest() {
    execute({
      onOptimistic: () => setHasRequest(false),
      onRollback: () => setHasRequest(true),
      action: () => cancelFollowRequest(userId),
      getError: (result) => (!result.success ? result.error : null),
      successToast: { title: MSG_FOLLOW_REQUEST_CANCELED },
    })
  }

  /**
   * ボタンクリックハンドラ
   *
   * ## 処理分岐
   * - フォロー中の場合 → フォロー解除
   * - 非公開アカウントでリクエスト済みの場合 → リクエストキャンセル
   * - 非公開アカウントでリクエスト未送信の場合 → リクエスト送信
   * - 公開アカウントでフォローしていない場合 → フォロー
   */
  function handleClick() {
    if (isFollowing) {
      // フォロー中の場合はフォロー解除
      handleFollow()
    } else if (!isPublic && hasRequest) {
      // 非公開アカウントでリクエスト済みの場合はキャンセル
      handleCancelRequest()
    } else if (!isPublic) {
      // 非公開アカウントでリクエスト未送信の場合はリクエスト送信
      handleSendRequest()
    } else {
      // 公開アカウントでフォローしていない場合はフォロー
      handleFollow()
    }
  }

  /**
   * ボタンテキストを取得
   *
   * ## テキスト表示ルール
   * - ローディング中: 「...」
   * - フォロー中でホバー: 「フォロー解除」
   * - フォロー中: 「フォロー中」
   * - 非公開でリクエスト済みでホバー: 「キャンセル」
   * - 非公開でリクエスト済み: 「リクエスト済み」
   * - 非公開で未リクエスト: 「フォローリクエスト」
   * - 公開で未フォロー: 「フォローする」
   *
   * @returns ボタンに表示するテキスト
   */
  const getButtonText = () => {
    // ローディング中は「...」を表示
    if (isPending) return '...'

    // フォロー中の場合
    if (isFollowing) {
      // ホバー時は「フォロー解除」、通常時は「フォロー中」
      return isHovered ? 'フォロー解除' : 'フォロー中'
    }

    // 非公開アカウントの場合
    if (!isPublic) {
      if (hasRequest) {
        // リクエスト済みでホバー時は「キャンセル」、通常時は「リクエスト済み」
        return isHovered ? 'キャンセル' : 'リクエスト済み'
      }
      // リクエスト未送信の場合
      return 'フォローリクエスト'
    }

    // 公開アカウントで未フォローの場合
    return 'フォローする'
  }

  /**
   * ボタンのCSSクラスを取得
   *
   * ## スタイルルール
   * - フォロー中でホバー時: 赤色（解除を示唆）
   * - リクエスト済みでホバー時: 赤色（キャンセルを示唆）
   * - 未フォロー/未リクエスト: 緑色（アクションを促す）
   * - それ以外: デフォルトスタイル
   *
   * @returns ボタンに適用するCSSクラス
   */
  const getButtonClass = () => {
    // フォロー中でホバー時は赤色（警告色）
    if (isFollowing && isHovered) {
      return 'border-destructive text-destructive hover:bg-destructive/10'
    }
    // リクエスト済みでホバー時は赤色（警告色）
    if (!isPublic && hasRequest && isHovered) {
      return 'border-destructive text-destructive hover:bg-destructive/10'
    }
    // 未フォロー / フォロー中 / リクエスト済みのデフォルト時は variant 側でスタイルを決める
    return ''
  }

  /**
   * ボタンのvariantを取得
   *
   * ## Variantルール
   * - フォロー中またはリクエスト済み: 'outline'（アウトラインスタイル）
   * - それ以外（未フォロー）: 'bonsai'（松葉色 CTA。ダークモードでも text-white が
   *   担保され、`text-primary-foreground` のテーマ依存で文字が読みにくくなる
   *   問題を回避する）
   *
   * @returns ボタンのvariant
   */
  const getButtonVariant = () => {
    if (isFollowing || hasRequest) {
      return 'outline'
    }
    return 'bonsai'
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending} // ローディング中は無効化
      variant={getButtonVariant()} // 状態に応じたvariant
      className={getButtonClass()} // 状態に応じたスタイル
      onMouseEnter={() => setIsHovered(true)} // ホバー開始時
      onMouseLeave={() => setIsHovered(false)} // ホバー終了時
    >
      {/* 状態に応じたボタンテキストを表示 */}
      {getButtonText()}
    </Button>
  )
}
