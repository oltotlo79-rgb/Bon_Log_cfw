/**
 * 通知アイテムコンポーネント
 *
 * @module components/notification/NotificationItem
 */

'use client'

import { memo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'
import { markAsRead } from '@/lib/actions/notification'
import {
  ROUTE_SETTINGS_FOLLOW_REQUESTS,
  ROUTE_MESSAGES,
  ROUTE_NOTIFICATIONS,
  ROUTE_SETTINGS_SUBSCRIPTION,
} from '@/lib/constants/routes'
import { buildUserPath, buildPostPath } from '@/lib/constants/path-builders'
import { AVATAR_SIZE_MD } from '@/lib/constants/limits'

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

type NotificationItemProps = {
  notification: Notification
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function MessageCircleIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  )
}

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

function RepeatIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" />
      <path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" />
    </svg>
  )
}

function ReplyIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="9 17 4 12 9 7" />
      <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  )
}

function AtSignIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
    </svg>
  )
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
    </svg>
  )
}

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
    case 'mention':
      return <AtSignIcon className="w-5 h-5 text-muted-foreground" />
    case 'message':
      return <MailIcon className="w-5 h-5 text-muted-foreground" />
    case 'subscription_expiring':
      return <CrownIcon className="w-5 h-5 text-muted-foreground" />
    case 'system':
      return <BellIcon className="w-5 h-5 text-muted-foreground" />
    default:
      return <MessageCircleIcon className="w-5 h-5 text-muted-foreground" />
  }
}

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
    case 'mention':
      return <><strong>{actorName}</strong>さんがあなたをメンションしました</>
    case 'message':
      return <><strong>{actorName}</strong>さんからメッセージが届きました</>
    // system / subscription_expiring は actor=受信者本人のため actorName を使わない
    case 'subscription_expiring':
      return <>プレミアム会員の有効期限が近づいています</>
    case 'system':
      return <>運営からのお知らせがあります</>
    default:
      return <><strong>{actorName}</strong>さんからの通知</>
  }
}

function getNotificationLink(notification: Notification) {
  const { type, post, comment, actor } = notification

  if (type === 'follow' || type === 'follow_request_approved') {
    return buildUserPath(actor.id)
  }

  if (type === 'follow_request') {
    return ROUTE_SETTINGS_FOLLOW_REQUESTS
  }

  // 会話 ID は通知に保持していないためメッセージ一覧で着地させる
  if (type === 'message') {
    return ROUTE_MESSAGES
  }

  if (type === 'subscription_expiring') {
    return ROUTE_SETTINGS_SUBSCRIPTION
  }

  // actor=本人のためプロフィール遷移は不適切。通知一覧に留める
  if (type === 'system') {
    return ROUTE_NOTIFICATIONS
  }

  if (post) {
    if (comment) {
      return `/posts/${post.id}#comment-${comment.id}`
    }
    return buildPostPath(post.id)
  }

  return buildUserPath(actor.id)
}

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

      {!notification.isRead && (
        <div className="flex-shrink-0">
          <div className="w-2 h-2 rounded-full bg-primary" />
        </div>
      )}
    </Link>
  )
}

export const NotificationItem = memo(NotificationItemInner)
