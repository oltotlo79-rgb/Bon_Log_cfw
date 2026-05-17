/**
 * 通知アイテムコンポーネント
 *
 * @module components/notification/NotificationItem
 */

'use client'

/**
 * Next.js Linkコンポーネント
 * 通知クリック時の遷移先リンク
 */
import { memo } from 'react'
import Link from 'next/link'

/**
 * Next.js Imageコンポーネント
 * ユーザーアバターの表示
 */
import Image from 'next/image'

/**
 * date-fns 相対時間フォーマット
 * 「3分前」「2時間前」などの表示に使用
 */
import { formatDistanceToNow } from 'date-fns'

/**
 * date-fns 日本語ロケール
 */
import { ja } from 'date-fns/locale'

/**
 * 既読処理用Server Action
 */
import { markAsRead } from '@/lib/actions/notification'
import { ROUTE_SETTINGS_FOLLOW_REQUESTS } from '@/lib/constants/routes'
import { AVATAR_SIZE_MD } from '@/lib/constants/limits'

/**
 * 通知の型
 *
 * @property id - 通知ID
 * @property type - 通知種別（like, comment, follow等）
 * @property isRead - 既読フラグ
 * @property createdAt - 作成日時
 * @property actor - 通知を発生させたユーザー
 * @property post - 関連する投稿（オプション）
 * @property comment - 関連するコメント（オプション）
 */
export type Notification = {
  id: string
  type: string
  isRead: boolean
  createdAt: Date | string
  actor: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  post?: {
    id: string
    content: string | null
  } | null
  comment?: {
    id: string
    content: string | null
  } | null
}

/**
 * NotificationItemコンポーネントのprops型
 */
type NotificationItemProps = {
  notification: Notification
}

/**
 * ハートアイコン（いいね通知用）
 *
 * @param className - 追加のCSSクラス
 */
function HeartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

/**
 * メッセージアイコン（コメント通知用）
 *
 * @param className - 追加のCSSクラス
 */
function MessageCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

/**
 * ユーザー追加アイコン（フォロー通知用）
 *
 * @param className - 追加のCSSクラス
 */
function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  )
}

/**
 * リピートアイコン（リポスト・引用通知用）
 *
 * @param className - 追加のCSSクラス
 */
function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

/**
 * 返信アイコン（返信通知用）
 *
 * @param className - 追加のCSSクラス
 */
function ReplyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  )
}

/**
 * 通知種別に応じたアイコンを取得
 *
 * ## カラーコード
 * - いいね: 赤
 * - コメント: 青
 * - フォロー: 緑
 * - フォローリクエスト: 黄色
 * - 引用/リポスト: 紫
 * - 返信: オレンジ
 *
 * @param type - 通知種別
 * @returns アイコンコンポーネント
 */
function getNotificationIcon(type: string) {
  switch (type) {
    case 'like':
    case 'comment_like':
      return <HeartIcon className="w-5 h-5 text-muted-foreground" />
    case 'comment':
      return <MessageCircleIcon className="w-5 h-5 text-muted-foreground" />
    case 'follow':
    case 'follow_request_approved':
      return <UserPlusIcon className="w-5 h-5 text-muted-foreground" />
    case 'follow_request':
      return <UserPlusIcon className="w-5 h-5 text-muted-foreground" />
    case 'quote':
    case 'repost':
      return <RepeatIcon className="w-5 h-5 text-muted-foreground" />
    case 'reply':
      return <ReplyIcon className="w-5 h-5 text-muted-foreground" />
    default:
      return <MessageCircleIcon className="w-5 h-5 text-muted-foreground" />
  }
}

/**
 * 通知種別に応じたメッセージを生成
 *
 * @param type - 通知種別
 * @param actorName - 通知発生者の名前
 * @returns メッセージのJSX
 */
function getNotificationMessage(type: string, actorName: string) {
  switch (type) {
    case 'like':
      return <><strong>{actorName}</strong>さんがあなたの投稿にいいねしました</>
    case 'comment_like':
      return <><strong>{actorName}</strong>さんがあなたのコメントにいいねしました</>
    case 'comment':
      return <><strong>{actorName}</strong>さんがあなたの投稿にコメントしました</>
    case 'follow':
      return <><strong>{actorName}</strong>さんがあなたをフォローしました</>
    case 'follow_request':
      return <><strong>{actorName}</strong>さんからフォローリクエストが届きました</>
    case 'follow_request_approved':
      return <><strong>{actorName}</strong>さんがフォローリクエストを承認しました</>
    case 'quote':
      return <><strong>{actorName}</strong>さんがあなたの投稿を引用しました</>
    case 'repost':
      return <><strong>{actorName}</strong>さんがあなたの投稿をリポストしました</>
    case 'reply':
      return <><strong>{actorName}</strong>さんがあなたのコメントに返信しました</>
    default:
      return <><strong>{actorName}</strong>さんからの通知</>
  }
}

/**
 * 通知のリンク先を決定
 *
 * ## リンク先ロジック
 * - フォロー通知: ユーザーページ
 * - コメント関連: 投稿ページ#コメントID
 * - 投稿関連: 投稿ページ
 * - その他: ユーザーページ
 *
 * @param notification - 通知オブジェクト
 * @returns リンク先URL
 */
function getNotificationLink(notification: Notification) {
  const { type, post, comment, actor } = notification

  /**
   * フォロー関連通知はユーザーページへ
   */
  if (type === 'follow' || type === 'follow_request_approved') {
    return `/users/${actor.id}`
  }

  /**
   * フォローリクエスト通知はフォローリクエスト管理ページへ
   */
  if (type === 'follow_request') {
    return ROUTE_SETTINGS_FOLLOW_REQUESTS
  }

  /**
   * 投稿がある場合
   */
  if (post) {
    /**
     * コメントがある場合はコメント位置へアンカーリンク
     */
    if (comment) {
      return `/posts/${post.id}#comment-${comment.id}`
    }
    return `/posts/${post.id}`
  }

  /**
   * デフォルトはユーザーページ
   */
  return `/users/${actor.id}`
}

/**
 * 通知アイテムコンポーネント
 *
 * ## 機能
 * - アバター画像とアイコンの表示
 * - 通知メッセージと投稿プレビュー
 * - 相対時間の表示
 * - 未読インジケーター
 * - クリック時の既読処理
 *
 * @param notification - 通知データ
 *
 * @example
 * ```tsx
 * <NotificationItem
 *   notification={{
 *     id: 'notif1',
 *     type: 'like',
 *     isRead: false,
 *     createdAt: new Date(),
 *     actor: { id: 'user1', nickname: 'ユーザー1', avatarUrl: null },
 *     post: { id: 'post1', content: '投稿内容...' },
 *   }}
 * />
 * ```
 */
/**
 * Why memo: 通知一覧で大量にレンダーされ得るため、
 * 親リストの再レンダリング時の不要な再描画を防ぐ。
 * Props は単一の `notification` オブジェクト（参照が変われば再描画）。
 */
function NotificationItemInner({ notification }: NotificationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ja,
  })

  const handleClick = async () => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }
  }

  const link = getNotificationLink(notification)
  const contentPreview = notification.comment?.content || notification.post?.content

  return (
    <Link
      href={link}
      onClick={handleClick}
      className={`flex gap-3 p-4 hover:bg-muted/50 transition-colors border-b ${
        !notification.isRead ? 'bg-primary/5' : ''
      }`}
    >
      {/* アイコン */}
      <div className="flex-shrink-0 w-10 h-10 relative">
        {notification.actor.avatarUrl ? (
          <Image
            src={notification.actor.avatarUrl}
            alt={notification.actor.nickname}
            width={AVATAR_SIZE_MD}
            height={AVATAR_SIZE_MD}
            sizes={`${AVATAR_SIZE_MD}px`}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
            <span className="text-muted-foreground text-sm">
              {notification.actor.nickname.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute -bottom-1 -right-1 p-1 bg-card rounded-full">
          {getNotificationIcon(notification.type)}
        </div>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          {getNotificationMessage(notification.type, notification.actor.nickname)}
        </p>
        {contentPreview && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
            {contentPreview}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
      </div>

      {/* 未読インジケーター */}
      {!notification.isRead && (
        <div className="flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-primary" />
        </div>
      )}
    </Link>
  )
}

export const NotificationItem = memo(NotificationItemInner)
