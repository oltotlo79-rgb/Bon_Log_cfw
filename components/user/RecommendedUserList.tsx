/**
 * おすすめユーザーの一覧表示（フォローボタン付き）。
 * 空フィードのオンボーディングや Explore ページから再利用する。
 *
 * @module components/user/RecommendedUserList
 */

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { FollowButton } from './FollowButton'
import { buildUserPath } from '@/lib/constants/path-builders'
import { AVATAR_SIZE_MD } from '@/lib/constants/limits'

export type RecommendedUser = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio?: string | null
  followersCount: number
}

type RecommendedUserListProps = {
  users: RecommendedUser[]
}

export function RecommendedUserList({ users }: RecommendedUserListProps) {
  if (users.length === 0) return null

  return (
    <ul className="space-y-3" data-testid="recommended-user-list">
      {users.map((user) => (
        <li key={user.id} className="flex items-center gap-3">
          <Link href={buildUserPath(user.id)} className="flex items-center gap-3 flex-1 min-w-0 group">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={user.nickname}
                width={AVATAR_SIZE_MD}
                height={AVATAR_SIZE_MD}
                sizes={`${AVATAR_SIZE_MD}px`}
                className="rounded-full object-cover ring-1 ring-border/60"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center ring-1 ring-border/60 flex-shrink-0">
                <span className="text-muted-foreground text-sm font-medium">{user.nickname.charAt(0)}</span>
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{user.nickname}</p>
              {user.bio ? (
                <p className="text-xs text-muted-foreground truncate">{user.bio}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{user.followersCount}フォロワー</p>
              )}
            </div>
          </Link>
          <div className="flex-shrink-0">
            <FollowButton userId={user.id} initialIsFollowing={false} />
          </div>
        </li>
      ))}
    </ul>
  )
}
