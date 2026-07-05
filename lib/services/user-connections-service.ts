/**
 * @module lib/services/user-connections-service
 * フォロワー/フォロー中一覧取得のドメインロジック。
 *
 * app/api/v1/users/[id]/followers, app/api/v1/users/[id]/following から呼ばれる。
 * 認証・レート制限は呼び出し元が担う前提。非公開アカウントへのアクセス制御は
 * canViewAuthorContent に委譲する（fetchUserPosts と同じ方式）。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_WITH_BIO_SELECT } from '@/lib/prisma/shared-includes'
import { canViewAuthorContent, visibleUserWhere } from '@/lib/services/post-visibility'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { GUEST_EMAIL } from '@/lib/constants/guest'

export type UserConnectionItem = {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  followingCount: number
}

/** Follow.include の user select 形状（followers/following 一覧で共通利用）。 */
const CONNECTION_USER_SELECT = {
  ...USER_MINIMAL_WITH_BIO_SELECT,
  _count: { select: { followers: true, following: true } },
} as const

function formatConnectionUser(user: {
  id: string
  nickname: string
  avatarUrl: string | null
  bio: string | null
  _count: { followers: number; following: number }
}): UserConnectionItem {
  return {
    id: user.id,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    followersCount: user._count.followers,
    followingCount: user._count.following,
  }
}

export type UserConnectionsResult =
  | { ok: true; items: UserConnectionItem[]; nextCursor: string | undefined }
  | { ok: false; reason: 'not_found' | 'private_account' }

/**
 * 対象ユーザーの一覧（フォロワー/フォロー中）を viewer が閲覧してよいかを判定する。
 * fetchUserPosts と同一の判定・reason 分岐。
 */
async function resolveTargetVisibility(
  targetUserId: string,
  viewerId: string | undefined,
): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'private_account' }> {
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isPublic: true, isSuspended: true, email: true },
  })

  if (!targetUser) return { ok: false, reason: 'not_found' }
  if (targetUser.email === GUEST_EMAIL) return { ok: false, reason: 'not_found' }

  const canView = await canViewAuthorContent(viewerId, targetUserId, {
    isPublic: targetUser.isPublic,
    isSuspended: targetUser.isSuspended,
  })

  if (!canView) {
    if (!targetUser.isPublic && viewerId !== targetUserId) {
      return { ok: false, reason: 'private_account' }
    }
    return { ok: false, reason: 'not_found' }
  }

  return { ok: true }
}

/**
 * 指定ユーザーのフォロワー一覧を返す。
 *
 * Follow は `@@id([followerId, followingId])` の複合キーで単一 id を持たない。
 * followers 一覧は followingId（対象ユーザー）固定・followerId が可変側になるため、
 * カーソル値は「直前ページ最後の followerId」を使う。
 */
export async function fetchUserFollowers(
  targetUserId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit?: number,
): Promise<UserConnectionsResult> {
  const visibility = await resolveTargetVisibility(targetUserId, viewerId)
  if (!visibility.ok) return visibility

  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const rows = await prisma.follow.findMany({
    where: { followingId: targetUserId, follower: visibleUserWhere(viewerId) },
    include: { follower: { select: CONNECTION_USER_SELECT } },
    orderBy: [{ createdAt: 'desc' }, { followerId: 'desc' }],
    take: safeLimit,
    ...(safeCursor
      ? {
          cursor: {
            followerId_followingId: { followerId: safeCursor, followingId: targetUserId },
          },
          skip: 1,
        }
      : {}),
  })

  const nextCursor = rows.length === safeLimit ? rows[rows.length - 1]?.followerId : undefined

  return {
    ok: true,
    items: rows.map((r) => formatConnectionUser(r.follower)),
    nextCursor,
  }
}

/**
 * 指定ユーザーのフォロー中一覧を返す。
 *
 * followers 一覧と対称に followerId（対象ユーザー）固定・followingId が可変側になる。
 * 固定側と可変側が followers 一覧と入れ替わるため、カーソルの意味も入れ替わる点に注意。
 */
export async function fetchUserFollowing(
  targetUserId: string,
  viewerId: string | undefined,
  cursor?: string,
  limit?: number,
): Promise<UserConnectionsResult> {
  const visibility = await resolveTargetVisibility(targetUserId, viewerId)
  if (!visibility.ok) return visibility

  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  const rows = await prisma.follow.findMany({
    where: { followerId: targetUserId, following: visibleUserWhere(viewerId) },
    include: { following: { select: CONNECTION_USER_SELECT } },
    orderBy: [{ createdAt: 'desc' }, { followingId: 'desc' }],
    take: safeLimit,
    ...(safeCursor
      ? {
          cursor: {
            followerId_followingId: { followerId: targetUserId, followingId: safeCursor },
          },
          skip: 1,
        }
      : {}),
  })

  const nextCursor = rows.length === safeLimit ? rows[rows.length - 1]?.followingId : undefined

  return {
    ok: true,
    items: rows.map((r) => formatConnectionUser(r.following)),
    nextCursor,
  }
}
