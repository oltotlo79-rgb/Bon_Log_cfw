/**
 * @module components/user/ProfileHeader
 */

'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FollowButton } from './FollowButton'
import { BlockButton } from './BlockButton'
import { ReportButton } from '@/components/report/ReportButton'
import { MuteButton } from './MuteButton'
import { MessageButton } from '@/components/message/MessageButton'
import { ROUTE_SETTINGS_PROFILE } from '@/lib/constants/routes'
import { buildUserFollowingPath, buildUserFollowersPath, buildUserLikesPath } from '@/lib/constants/path-builders'
import {
  MapPin as MapPinIcon,
  Calendar as CalendarIcon,
  Lock as LockIcon,
  Crown as CrownIcon,
  Sprout as SproutIcon,
  User as UserIcon,
} from 'lucide-react'
import { AVATAR_SIZE_2XL } from '@/lib/constants/limits'
import { formatBirthDate, calculateBonsaiExperience } from './profile-utils'

type ProfileHeaderProps = {
  user: {
    id: string
    nickname: string
    avatarUrl: string | null
    headerUrl: string | null
    bio: string | null
    location: string | null
    bonsaiStartYear: number | null
    bonsaiStartMonth: number | null
    birthDate: Date | string | null
    isPublic: boolean
    createdAt: string | Date
    postsCount: number
    followersCount: number
    followingCount: number
  }
  isOwner: boolean
  isFollowing?: boolean
  isBlocked?: boolean
  isMuted?: boolean
  isPremium?: boolean
  hasFollowRequest?: boolean
}

export function ProfileHeader({ user, isOwner, isFollowing, isBlocked, isMuted, isPremium, hasFollowRequest }: ProfileHeaderProps) {
  const joinDate = new Date(user.createdAt)
  const formattedJoinDate = `${joinDate.getFullYear()}年${joinDate.getMonth() + 1}月`

  const bonsaiExperience = calculateBonsaiExperience(user.bonsaiStartYear, user.bonsaiStartMonth)

  const formattedBirthDate = formatBirthDate(user.birthDate)

  return (
    <div className="bg-card rounded-lg border">
      <div className="relative">
        <div className="h-32 sm:h-48 bg-bonsai-green/20 rounded-t-lg overflow-hidden relative z-0">
          {user.headerUrl ? (
            <Image
              src={user.headerUrl}
              alt="ヘッダー画像"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 640px"
            />
          ) : (
            <Image
              src="/images/generated/placeholders/bonsai-placeholder.webp"
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 640px"
              className="object-cover dark:hidden"
            />
          )}
          {!user.headerUrl && (
            <Image
              src="/images/generated/placeholders/bonsai-placeholder-dark.webp"
              alt=""
              fill
              sizes="(max-width: 640px) 100vw, 640px"
              className="object-cover hidden dark:block"
            />
          )}
        </div>

        <div className="absolute left-4 -bottom-12 sm:-bottom-16 z-20" data-testid="user-avatar">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-card bg-muted overflow-hidden">
            {user.avatarUrl ? (
              <Image
                src={user.avatarUrl}
                alt={`${user.nickname}のアバター`}
                width={AVATAR_SIZE_2XL}
                height={AVATAR_SIZE_2XL}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl text-muted-foreground bg-card" data-testid="default-avatar">
                {user.nickname.charAt(0)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-4 pt-14 sm:pt-20">
        <div className="flex justify-end gap-2 mb-4">
          {isOwner ? (
            <Button variant="outline" asChild>
              <Link href={ROUTE_SETTINGS_PROFILE}>プロフィールを編集</Link>
            </Button>
          ) : (
            <>
              <MessageButton userId={user.id} isBlocked={isBlocked} />
              <FollowButton
                userId={user.id}
                initialIsFollowing={isFollowing ?? false}
                isPublic={user.isPublic}
                initialHasRequest={hasFollowRequest ?? false}
              />
              <MuteButton
                userId={user.id}
                nickname={user.nickname}
                initialIsMuted={isMuted ?? false}
                size="default"
              />
              <BlockButton
                userId={user.id}
                nickname={user.nickname}
                initialIsBlocked={isBlocked ?? false}
                size="default"
              />
              <ReportButton targetType="user" targetId={user.id} variant="text" />
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-xl sm:text-2xl font-bold">{user.nickname}</h1>
          {isPremium && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded" title="プレミアム会員">
              <CrownIcon className="w-3 h-3" />
              Premium
            </span>
          )}
          {!user.isPublic && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              <LockIcon className="w-3 h-3" />
              非公開
            </span>
          )}
        </div>

        {user.bio && (
          <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{user.bio}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
          {user.location && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="w-4 h-4" />
              {user.location}
            </span>
          )}
          {formattedBirthDate && (
            <span className="flex items-center gap-1">
              <UserIcon className="w-4 h-4" />
              {formattedBirthDate}生
            </span>
          )}
          {bonsaiExperience && (
            <span className="flex items-center gap-1">
              <SproutIcon className="w-4 h-4" />
              盆栽歴 {bonsaiExperience}
            </span>
          )}
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            {formattedJoinDate}から利用
          </span>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <Link href={buildUserFollowingPath(user.id)} className="hover:underline">
            <span className="font-bold">{user.followingCount}</span>
            <span className="text-muted-foreground ml-1">フォロー中</span>
          </Link>
          <Link href={buildUserFollowersPath(user.id)} className="hover:underline">
            <span className="font-bold">{user.followersCount}</span>
            <span className="text-muted-foreground ml-1">フォロワー</span>
          </Link>
          <Link href={buildUserLikesPath(user.id)} className="hover:underline">
            <span className="text-muted-foreground">いいね</span>
          </Link>
          <span>
            <span className="font-bold">{user.postsCount}</span>
            <span className="text-muted-foreground ml-1">投稿</span>
          </span>
        </div>
      </div>
    </div>
  )
}
