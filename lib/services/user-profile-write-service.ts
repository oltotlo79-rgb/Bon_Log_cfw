/**
 * @module lib/services/user-profile-write-service
 *
 * モバイル API v1 専用のプロフィール書き込みサービス。
 * lib/actions/user-profile.ts の updateProfile ロジックを JSON 部分更新形式に移植する。
 * Web Action (lib/actions/user-profile.ts) は無編集。
 *
 * 認証・認可・レート制限はすべて呼び出し元 route handler が保証している前提。
 */

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { isReservedNickname } from '@/lib/constants/reserved'
import { buildUserPath } from '@/lib/constants/path-builders'
import { ROUTE_SETTINGS_PROFILE, ROUTE_SETTINGS_ACCOUNT } from '@/lib/constants/routes'
import { isPremiumUser } from '@/lib/premium'
import type { UpdateProfileRequest } from '@/lib/api/v1/schemas/request'

export interface UpdateProfileResult {
  id: string
  email: string
  nickname: string
  avatarUrl: string | null
  headerUrl: string | null
  bio: string | null
  location: string | null
  isPublic: boolean
  bonsaiStartYear: number | null
  bonsaiStartMonth: number | null
  birthDate: string | null
  isPremium: boolean
}

/** nickname が予約済みかどうかを検証して返す（予約済みなら true） */
export function isNicknameReserved(nickname: string): boolean {
  return isReservedNickname(nickname)
}

/**
 * プロフィールを部分更新し、更新後の全フィールドを返す。
 *
 * @param userId 更新対象のユーザー ID（認証済み、ゲスト不可）
 * @param data   検証済みの部分更新データ
 * @returns 更新後のユーザー情報
 * @throws 更新対象ユーザーが存在しない場合に Error をスロー
 */
export async function updateUserProfile(
  userId: string,
  data: UpdateProfileRequest,
): Promise<UpdateProfileResult> {
  const updateData: Parameters<typeof prisma.user.update>[0]['data'] = {}

  if (data.nickname !== undefined) {
    updateData.nickname = data.nickname
  }
  if (data.bio !== undefined) {
    // Web の updateProfile と同様に空文字を null に正規化する（"" をそのまま保存しない）。
    updateData.bio = data.bio || null
  }
  if (data.location !== undefined) {
    // 同上。
    updateData.location = data.location || null
  }
  if (data.bonsaiStartYear !== undefined) {
    updateData.bonsaiStartYear = data.bonsaiStartYear ?? null
  }
  if (data.bonsaiStartMonth !== undefined) {
    updateData.bonsaiStartMonth = data.bonsaiStartMonth ?? null
  }
  if (data.birthDate !== undefined) {
    updateData.birthDate = data.birthDate ? new Date(data.birthDate) : null
  }
  if (data.isPublic !== undefined) {
    updateData.isPublic = data.isPublic
  }
  if (data.avatarUrl !== undefined) {
    updateData.avatarUrl = data.avatarUrl ?? null
  }
  if (data.headerUrl !== undefined) {
    updateData.headerUrl = data.headerUrl ?? null
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      email: true,
      nickname: true,
      avatarUrl: true,
      headerUrl: true,
      bio: true,
      location: true,
      isPublic: true,
      bonsaiStartYear: true,
      bonsaiStartMonth: true,
      birthDate: true,
    },
  })

  // Web の updateProfile / updatePrivacy と同じパスを無効化して、
  // モバイル経由の編集が Web 側の表示にも即座に反映されるようにする。
  revalidatePath(buildUserPath(userId))
  revalidatePath(ROUTE_SETTINGS_PROFILE)
  // isPublic 変更時は Web の updatePrivacy と同様にアカウント設定ページも無効化する。
  if (data.isPublic !== undefined) {
    revalidatePath(ROUTE_SETTINGS_ACCOUNT)
  }

  const isPremium = await isPremiumUser(userId)

  return {
    id: updated.id,
    email: updated.email,
    nickname: updated.nickname,
    avatarUrl: updated.avatarUrl,
    headerUrl: updated.headerUrl,
    bio: updated.bio,
    location: updated.location,
    isPublic: updated.isPublic,
    bonsaiStartYear: updated.bonsaiStartYear,
    bonsaiStartMonth: updated.bonsaiStartMonth,
    birthDate: updated.birthDate ? updated.birthDate.toISOString().split('T')[0] ?? null : null,
    isPremium,
  }
}
