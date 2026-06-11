'use server'

import { prisma } from '@/lib/db'
import { requireAuth, requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { revalidatePath } from 'next/cache'
import { cache } from 'react'
import { z } from 'zod'
import {
  MAX_NICKNAME_LENGTH,
  MAX_BIO_LENGTH,
  MAX_LOCATION_LENGTH,
  USER_BONSAI_START_MIN_YEAR,
  DEFAULT_PAGE_LIMIT,
} from '@/lib/constants/limits'
import {
  ERR_NICKNAME_RESERVED,
  ERR_USER_NOT_FOUND,
  ERR_USER_FETCH_FAILED,
  ERR_NICKNAME_REQUIRED,
  ERR_NICKNAME_TOO_LONG,
  ERR_BIO_TOO_LONG,
  ERR_LOCATION_TOO_LONG,
  ERR_INVALID_INPUT,
  ERR_BONSAI_START_YEAR_INVALID,
  ERR_BONSAI_START_MONTH_INVALID,
  ERR_BIRTH_DATE_INVALID,
} from '@/lib/constants/errors'
import { isReservedNickname } from '@/lib/constants/reserved'
import { GUEST_EMAIL } from '@/lib/constants/guest'
import { getFormString } from '@/lib/utils/form-data'
import { ROUTE_SETTINGS_PROFILE, ROUTE_SETTINGS_ACCOUNT } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'

const profileSchema = z.object({
  nickname: z
    .string()
    .min(1, ERR_NICKNAME_REQUIRED)
    .max(MAX_NICKNAME_LENGTH, ERR_NICKNAME_TOO_LONG(MAX_NICKNAME_LENGTH)),
  bio: z.string().max(MAX_BIO_LENGTH, ERR_BIO_TOO_LONG(MAX_BIO_LENGTH)).optional(),
  location: z
    .string()
    .max(MAX_LOCATION_LENGTH, ERR_LOCATION_TOO_LONG(MAX_LOCATION_LENGTH))
    .optional(),
  bonsaiStartYear: z
    .number({ message: ERR_BONSAI_START_YEAR_INVALID })
    .int(ERR_BONSAI_START_YEAR_INVALID)
    .min(USER_BONSAI_START_MIN_YEAR, ERR_BONSAI_START_YEAR_INVALID)
    .max(new Date().getFullYear(), ERR_BONSAI_START_YEAR_INVALID)
    .nullable()
    .optional(),
  bonsaiStartMonth: z
    .number({ message: ERR_BONSAI_START_MONTH_INVALID })
    .int(ERR_BONSAI_START_MONTH_INVALID)
    .min(1, ERR_BONSAI_START_MONTH_INVALID)
    .max(12, ERR_BONSAI_START_MONTH_INVALID)
    .nullable()
    .optional(),
  birthDate: z.string({ message: ERR_BIRTH_DATE_INVALID }).nullable().optional(),
})

// cache() でリクエスト単位のメモ化を行う（P-8）。
export const getUser = cache(async function getUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user) {
    return actionError(ERR_USER_NOT_FOUND)
  }

  if (user.email === GUEST_EMAIL) {
    return actionError(ERR_USER_NOT_FOUND)
  }

  const { email: _email, _count, ...publicUser } = user

  // 非公開アカウントの場合、bio/location等の詳細を除外
  // （呼び出し元のページ側でフォロー状態に応じた詳細制御を行う）
  return actionSuccess({
    user: {
      ...publicUser,
      postsCount: _count.posts,
      followersCount: _count.followers,
      followingCount: _count.following,
    },
  })
})

export async function getCurrentUser() {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const user = await prisma.user.findUnique({
    where: { id: userId },
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
      isSuspended: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!user) {
    return actionError(ERR_USER_FETCH_FAILED)
  }

  return actionSuccess({ user })
}

export async function updateProfile(formData: FormData) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const bonsaiStartYearStr = getFormString(formData, 'bonsaiStartYear')
  const bonsaiStartMonthStr = getFormString(formData, 'bonsaiStartMonth')
  const bonsaiStartYear = bonsaiStartYearStr ? parseInt(bonsaiStartYearStr, 10) : null
  const bonsaiStartMonth = bonsaiStartMonthStr ? parseInt(bonsaiStartMonthStr, 10) : null

  const birthDateStr = getFormString(formData, 'birthDate')

  const result = profileSchema.safeParse({
    nickname: getFormString(formData, 'nickname'),
    bio: getFormString(formData, 'bio') ?? '',
    location: getFormString(formData, 'location') ?? '',
    bonsaiStartYear: bonsaiStartYear !== null && !Number.isNaN(bonsaiStartYear) ? bonsaiStartYear : null,
    bonsaiStartMonth: bonsaiStartMonth !== null && !Number.isNaN(bonsaiStartMonth) ? bonsaiStartMonth : null,
    birthDate: birthDateStr || null,
  })

  if (!result.success) {
    const issueMessage = result.error.issues[0]?.message
    return actionError(issueMessage || ERR_INVALID_INPUT)
  }

  if (isReservedNickname(result.data.nickname)) {
    return actionError(ERR_NICKNAME_RESERVED)
  }

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  await prisma.user.update({
    where: { id: userId },
    data: {
      nickname: result.data.nickname,
      bio: result.data.bio || null,
      location: result.data.location || null,
      bonsaiStartYear: result.data.bonsaiStartYear ?? null,
      bonsaiStartMonth: result.data.bonsaiStartMonth ?? null,
      birthDate: result.data.birthDate ? new Date(result.data.birthDate) : null,
    },
  })

  revalidatePath(buildUserPath(userId))
  revalidatePath(ROUTE_SETTINGS_PROFILE)
  return actionSuccess()
}

export async function getFollowing(userId: string, cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  const { getFollowing: _getFollowing } = await import('@/lib/actions/follow')
  const result = await _getFollowing(userId, cursor, limit)
  return { following: result.users ?? [], nextCursor: result.nextCursor }
}

const updatePrivacySchema = z.object({ isPublic: z.boolean() })

export async function updatePrivacy(isPublic: boolean) {
  // 1. 認証
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  // 2. Zod バリデーション
  const parsed = updatePrivacySchema.safeParse({ isPublic })
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  // 3. レート制限
  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  await prisma.user.update({
    where: { id: userId },
    data: { isPublic },
  })

  revalidatePath(buildUserPath(userId))
  revalidatePath(ROUTE_SETTINGS_ACCOUNT)
  return actionSuccess()
}
