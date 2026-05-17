'use client'

/**
 * @file CommentHeader.tsx
 * @description コメントヘッダーコンポーネント（アバター、ニックネーム、タイムスタンプ）
 */

import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import { ja } from 'date-fns/locale'

interface CommentHeaderProps {
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  createdAt: string | Date
}

/**
 * コメントヘッダーコンポーネント
 *
 * ユーザーアバター、ニックネーム、投稿時間を表示します。
 */
export function CommentHeader({ user, createdAt }: CommentHeaderProps) {
  const timeAgo = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: ja,
  })

  return (
    <Link href={`/users/${user.id}`}>
      <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.nickname}
            width={32}
            height={32}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
            {user.nickname[0]}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-sm sr-only">
        <span className="font-medium">{user.nickname}</span>
        <span className="text-muted-foreground text-xs">{timeAgo}</span>
      </div>
    </Link>
  )
}

interface CommentMetaProps {
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
  }
  createdAt: string | Date
}

/**
 * コメントメタ情報（ニックネーム + 時刻）
 */
export function CommentMeta({ user, createdAt }: CommentMetaProps) {
  const timeAgo = formatDistanceToNow(new Date(createdAt), {
    addSuffix: true,
    locale: ja,
  })

  return (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={`/users/${user.id}`}
        className="font-medium hover:underline truncate"
      >
        {user.nickname}
      </Link>
      <span className="text-muted-foreground text-xs">{timeAgo}</span>
    </div>
  )
}
