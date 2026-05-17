/**
 * プロフィールヘッダーコンポーネント
 *
 * @module components/user/ProfileHeader
 */

'use client'

/**
 * Next.js Imageコンポーネント
 * アバター画像の最適化表示に使用
 */
import Image from 'next/image'

/**
 * Next.js Linkコンポーネント
 * プロフィール編集ページやフォロー一覧へのリンクに使用
 */
import Link from 'next/link'

/**
 * shadcn/ui Buttonコンポーネント
 * プロフィール編集ボタンに使用
 */
import { Button } from '@/components/ui/button'

/**
 * フォローボタンコンポーネント
 * 他ユーザーをフォロー/フォロー解除する
 */
import { FollowButton } from './FollowButton'

/**
 * ブロックボタンコンポーネント
 * 他ユーザーをブロック/ブロック解除する
 */
import { BlockButton } from './BlockButton'

/**
 * ミュートボタンコンポーネント
 * 他ユーザーをミュート/ミュート解除する
 */
import { MuteButton } from './MuteButton'

/**
 * メッセージボタンコンポーネント
 * 他ユーザーにダイレクトメッセージを送信する
 */
import { MessageButton } from '@/components/message/MessageButton'
import { ROUTE_SETTINGS_PROFILE } from '@/lib/constants/routes'
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

/**
 * ProfileHeaderコンポーネントのprops型
 *
 * @property user - 表示するユーザー情報
 * @property user.id - ユーザーの一意識別子
 * @property user.nickname - ユーザーの表示名
 * @property user.avatarUrl - アバター画像のURL（nullの場合はイニシャル表示）
 * @property user.headerUrl - ヘッダー画像のURL（nullの場合はデフォルト背景）
 * @property user.bio - 自己紹介文（nullの場合は非表示）
 * @property user.location - 居住地域（nullの場合は非表示）
 * @property user.bonsaiStartYear - 盆栽を始めた年（nullの場合は盆栽歴非表示）
 * @property user.bonsaiStartMonth - 盆栽を始めた月（nullの場合は1月として計算）
 * @property user.isPublic - アカウントの公開状態（true=公開, false=非公開）
 * @property user.createdAt - アカウント登録日
 * @property user.postsCount - 投稿数
 * @property user.followersCount - フォロワー数
 * @property user.followingCount - フォロー中の数
 * @property isOwner - 自分のプロフィールかどうか（true=自分）
 * @property isFollowing - 現在フォロー中かどうか
 * @property isBlocked - 現在ブロック中かどうか
 * @property isMuted - 現在ミュート中かどうか
 * @property isPremium - プレミアム会員かどうか
 */
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

/**
 * プロフィールヘッダーコンポーネント
 *
 * ## 機能
 * - ヘッダー画像とアバターを重ねて表示
 * - ユーザー名とバッジ（プレミアム、非公開）を表示
 * - 自己紹介文を改行を保持して表示
 * - メタ情報（居住地、盆栽歴、登録日）を表示
 * - フォロー/フォロワー/投稿数を表示
 * - 自分の場合はプロフィール編集ボタンを表示
 * - 他人の場合はフォロー、メッセージ、ミュート、ブロックボタンを表示
 *
 * ## レイアウト
 * - 上部: ヘッダー画像（高さ128px〜192px）
 * - ヘッダー下端: アバター画像（一部重なる）
 * - 中央: ユーザー情報
 * - 下部: フォロー情報
 *
 * @param user - ユーザー情報
 * @param isOwner - 自分のプロフィールかどうか
 * @param isFollowing - フォロー中かどうか
 * @param isBlocked - ブロック中かどうか
 * @param isMuted - ミュート中かどうか
 * @param isPremium - プレミアム会員かどうか
 *
 * @example
 * ```tsx
 * <ProfileHeader
 *   user={userData}
 *   isOwner={false}
 *   isFollowing={true}
 *   isBlocked={false}
 *   isMuted={false}
 *   isPremium={true}
 * />
 * ```
 */
export function ProfileHeader({ user, isOwner, isFollowing, isBlocked, isMuted, isPremium, hasFollowRequest }: ProfileHeaderProps) {
  // 登録日をフォーマット（例: 2024年1月）
  const joinDate = new Date(user.createdAt)
  const formattedJoinDate = `${joinDate.getFullYear()}年${joinDate.getMonth() + 1}月`

  // 盆栽歴を計算
  const bonsaiExperience = calculateBonsaiExperience(user.bonsaiStartYear, user.bonsaiStartMonth)

  // 生年月日をフォーマット
  const formattedBirthDate = formatBirthDate(user.birthDate)

  return (
    <div className="bg-card rounded-lg border">
      {/* ヘッダー画像とアバター */}
      <div className="relative">
        {/* ヘッダー画像 - relative z-0 を追加して背面に固定 */}
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

        {/* アバター（絶対配置でヘッダーの上に重ねる） - z-20 に引き上げ */}
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

      {/* プロフィール情報 */}
      <div className="px-4 pb-4 pt-14 sm:pt-20">
        {/* 編集ボタン・アクションボタン */}
        <div className="flex justify-end gap-2 mb-4">
          {isOwner ? (
            // 自分のプロフィールの場合: プロフィール編集ボタン
            <Button variant="outline" asChild>
              <Link href={ROUTE_SETTINGS_PROFILE}>プロフィールを編集</Link>
            </Button>
          ) : (
            // 他人のプロフィールの場合: アクションボタン群
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
            </>
          )}
        </div>

        {/* 名前・プレミアムバッジ・非公開マーク */}
        <div className="flex items-center gap-2 mb-2">
          <h1 className="text-xl sm:text-2xl font-bold">{user.nickname}</h1>
          {/* プレミアム会員バッジ */}
          {isPremium && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded" title="プレミアム会員">
              <CrownIcon className="w-3 h-3" />
              Premium
            </span>
          )}
          {/* 非公開アカウントマーク */}
          {!user.isPublic && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
              <LockIcon className="w-3 h-3" />
              非公開
            </span>
          )}
        </div>

        {/* 自己紹介 */}
        {user.bio && (
          <p className="text-sm text-foreground mb-3 whitespace-pre-wrap">{user.bio}</p>
        )}

        {/* メタ情報（居住地、盆栽歴、登録日） */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mb-4">
          {/* 居住地域 */}
          {user.location && (
            <span className="flex items-center gap-1">
              <MapPinIcon className="w-4 h-4" />
              {user.location}
            </span>
          )}
          {/* 生年月日 */}
          {formattedBirthDate && (
            <span className="flex items-center gap-1">
              <UserIcon className="w-4 h-4" />
              {formattedBirthDate}生
            </span>
          )}
          {/* 盆栽歴 */}
          {bonsaiExperience && (
            <span className="flex items-center gap-1">
              <SproutIcon className="w-4 h-4" />
              盆栽歴 {bonsaiExperience}
            </span>
          )}
          {/* 登録日 */}
          <span className="flex items-center gap-1">
            <CalendarIcon className="w-4 h-4" />
            {formattedJoinDate}から利用
          </span>
        </div>

        {/* フォロー情報 */}
        <div className="flex flex-wrap gap-4 text-sm">
          {/* フォロー中 */}
          <Link href={`/users/${user.id}/following`} className="hover:underline">
            <span className="font-bold">{user.followingCount}</span>
            <span className="text-muted-foreground ml-1">フォロー中</span>
          </Link>
          {/* フォロワー */}
          <Link href={`/users/${user.id}/followers`} className="hover:underline">
            <span className="font-bold">{user.followersCount}</span>
            <span className="text-muted-foreground ml-1">フォロワー</span>
          </Link>
          {/* いいね */}
          <Link href={`/users/${user.id}/likes`} className="hover:underline">
            <span className="text-muted-foreground">いいね</span>
          </Link>
          {/* 投稿数 */}
          <span>
            <span className="font-bold">{user.postsCount}</span>
            <span className="text-muted-foreground ml-1">投稿</span>
          </span>
        </div>
      </div>
    </div>
  )
}
