/**
 * @module lib/services/user-read-service
 * ユーザープロフィール取得のクエリ・整形ロジック。
 *
 * lib/actions/user-profile.ts の getUser と app/api/v1/users/[id] の
 * 双方から呼ばれる。認証・レート制限は呼び出し元が担う前提。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { canViewAuthorContent } from '@/lib/services/post-visibility'
import { GUEST_EMAIL } from '@/lib/constants/guest'

export type UserProfileResult =
  | { found: false }
  | { found: true; user: UserProfile }

/**
 * ユーザープロフィール（email を含まない公開フィールド）。
 * isPremium はモバイル UI の表示制御に必要なため含める。
 */
export type UserProfile = {
  id: string
  nickname: string
  avatarUrl: string | null
  headerUrl: string | null
  bio: string | null
  location: string | null
  isPublic: boolean
  bonsaiStartYear: number | null
  bonsaiStartMonth: number | null
  createdAt: Date
  updatedAt: Date
  postsCount: number
  followersCount: number
  followingCount: number
}

/**
 * ユーザープロフィールを取得する。
 * 存在しない・ゲストユーザー・閲覧不可（停止・非公開フォロー関係なし）は found: false。
 */
export async function fetchUserProfile(
  targetUserId: string,
  viewerId: string | undefined,
): Promise<UserProfileResult> {
  const user = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      headerUrl: true,
      bio: true,
      location: true,
      isPublic: true,
      isSuspended: true,
      bonsaiStartYear: true,
      bonsaiStartMonth: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          posts: true,
          followers: true,
          following: true,
        },
      },
    },
  })

  if (!user) return { found: false }

  // ゲストアカウントはプロフィールとして公開しない
  if (user.email === GUEST_EMAIL) return { found: false }

  const canView = await canViewAuthorContent(viewerId, targetUserId, {
    isPublic: user.isPublic,
    isSuspended: user.isSuspended,
  })
  if (!canView) return { found: false }

  const { email: _email, isSuspended: _isSuspended, _count, ...publicUser } = user

  return {
    found: true,
    user: {
      ...publicUser,
      postsCount: _count.posts,
      followersCount: _count.followers,
      followingCount: _count.following,
    },
  }
}
