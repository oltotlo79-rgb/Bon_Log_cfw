/**
 * @module lib/api/v1/follow-state-resolver
 * v1 API レスポンス用フォロー状態一括解決ユーティリティ。
 *
 * 複数のターゲットユーザーに対して閲覧者のフォロー状態を 2 本のバッチクエリで解決する。
 * 共有サービス（user-read-service / search-service）は変更せず、
 * v1 ルート層でのみ付加する（Web レスポンスへの影響をゼロにするため）。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { FOLLOW_REQUEST_STATUS } from '@/lib/constants/status'

export type FollowStateItem = {
  following: boolean
  requested: boolean
}

/**
 * 複数ターゲットのフォロー状態を一括解決する。
 *
 * バッチ戦略: Follow / FollowRequest 各 1 本の findMany で解決（N+1 なし）。
 * following と requested が両方 true になる異常データは following=true を優先する。
 */
export async function resolveFollowStates(
  viewerId: string,
  targetIds: string[],
): Promise<Map<string, FollowStateItem>> {
  if (targetIds.length === 0) return new Map()

  const [follows, requests] = await Promise.all([
    prisma.follow.findMany({
      where: { followerId: viewerId, followingId: { in: targetIds } },
      select: { followingId: true },
    }),
    prisma.followRequest.findMany({
      where: {
        requesterId: viewerId,
        targetId: { in: targetIds },
        status: FOLLOW_REQUEST_STATUS.PENDING,
      },
      select: { targetId: true },
    }),
  ])

  const followingSet = new Set(follows.map((f) => f.followingId))
  const requestedSet = new Set(requests.map((r) => r.targetId))

  const result = new Map<string, FollowStateItem>()
  for (const id of targetIds) {
    const isFollowing = followingSet.has(id)
    result.set(id, {
      following: isFollowing,
      // following が true のとき requested を false に矯正（防御的）
      requested: isFollowing ? false : requestedSet.has(id),
    })
  }
  return result
}

/**
 * 単一ターゲットのフォロー状態を解決する（プロフィール詳細用）。
 * isSelf も同時に計算する。
 */
export async function resolveFollowStateForOne(
  viewerId: string,
  targetId: string,
): Promise<FollowStateItem & { isSelf: boolean }> {
  const isSelf = viewerId === targetId
  if (isSelf) {
    return { following: false, requested: false, isSelf: true }
  }
  const map = await resolveFollowStates(viewerId, [targetId])
  const state = map.get(targetId) ?? { following: false, requested: false }
  return { ...state, isSelf: false }
}

/**
 * 検索結果ユーザー一覧の isPublic を一括取得する。
 *
 * fetchSearchUsers の返り値に isPublic が含まれていないため、
 * 共有サービスを変更せずこちらで 1 クエリ補う。
 */
export async function resolveIsPublicMap(
  targetIds: string[],
): Promise<Map<string, boolean>> {
  if (targetIds.length === 0) return new Map()

  const users = await prisma.user.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, isPublic: true },
  })

  return new Map(users.map((u) => [u.id, u.isPublic]))
}

export type BlockMuteState = {
  isBlocked: boolean
  isMuted: boolean
}

/**
 * 閲覧者が対象ユーザーをブロック/ミュートしているかを解決する（プロフィール詳細用）。
 *
 * Block / Mute の複合キー findUnique を 2 クエリ並列実行（N+1 なし）。
 * 自分自身への操作はスキーマ上不可のため isSelf 時は常に false。
 */
export async function resolveBlockMuteStateForOne(
  viewerId: string,
  targetId: string,
): Promise<BlockMuteState> {
  if (viewerId === targetId) {
    return { isBlocked: false, isMuted: false }
  }

  try {
    const [block, mute] = await Promise.all([
      prisma.block.findUnique({
        where: { blockerId_blockedId: { blockerId: viewerId, blockedId: targetId } },
        select: { blockerId: true },
      }),
      prisma.mute.findUnique({
        where: { muterId_mutedId: { muterId: viewerId, mutedId: targetId } },
        select: { muterId: true },
      }),
    ])

    return {
      isBlocked: block !== null,
      isMuted: mute !== null,
    }
  } catch {
    return { isBlocked: false, isMuted: false }
  }
}
