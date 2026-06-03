/**
 * ユーザーカードコンポーネント
 *
 * @module components/user/UserCard
 */

import { memo } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AVATAR_SIZE_LG } from '@/lib/constants/limits'
import { buildUserPath } from '@/lib/constants/path-builders'

type UserCardProps = {
  user: {
    id: string
    nickname: string
    avatar_url: string | null
    bio: string | null
  }
}

export const UserCard = memo(function UserCard({ user }: UserCardProps) {
  return (
    <Link
      href={buildUserPath(user.id)}
      className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-colors"
    >
      <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.nickname}
            width={AVATAR_SIZE_LG}
            height={AVATAR_SIZE_LG}
            sizes={`${AVATAR_SIZE_LG}px`}
            className="object-cover w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg text-muted-foreground">
            {user.nickname.charAt(0)}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{user.nickname}</p>
        {user.bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">{user.bio}</p>
        )}
      </div>
    </Link>
  )
})
