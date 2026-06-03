/**
 * @module app/api/upload/_shared/profile-image-upload
 * avatar / header の共通アップロード処理。
 *
 * 処理順序: auth → file 検証 → rate-limit → daily-limit → DB lookup → storage upload。
 * 不正入力で upload quota を消費しないため、validation を rate-limit より前に置く。
 */

import { prisma } from '@/lib/db'
import { uploadFile, deleteFile } from '@/lib/storage'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import {
  ERR_DAILY_UPLOAD_LIMIT,
  ERR_RATE_LIMIT_UPLOAD,
  ERR_UPLOAD_FAILED,
  ERR_UPLOAD_SERVER_ERROR,
} from '@/lib/constants/errors'
import { ALLOWED_PROFILE_IMAGE_TYPES } from '@/lib/constants/limits'
import { logger } from '@/lib/logger'
import { checkUserRateLimit, checkDailyLimit } from '@/lib/rate-limit'
import { STORAGE_FOLDER_AVATARS, STORAGE_FOLDER_HEADERS } from '@/lib/constants/storage'
import { ROUTE_SETTINGS_PROFILE } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'
import { validateUploadFile } from './validate-upload-file'
import { requireUploadUser } from './require-upload-user'

type ProfileImageType = 'avatar' | 'header'

const CONFIG = {
  avatar: {
    dbField: 'avatarUrl' as const,
    storageFolder: STORAGE_FOLDER_AVATARS,
    logLabel: 'Avatar',
  },
  header: {
    dbField: 'headerUrl' as const,
    storageFolder: STORAGE_FOLDER_HEADERS,
    logLabel: 'Header',
  },
} as const

export async function handleProfileImageUpload(request: NextRequest, type: ProfileImageType) {
  const config = CONFIG[type]

  try {
    // 1. 認証 + 認可 (停止 / ゲストは更新前に拒否し、Server Action と同じポリシーに揃える)
    const userResult = await requireUploadUser()
    if (!userResult.ok) return userResult.response
    const userId = userResult.userId

    // 2. 入力検証 (image のみ受け入れ、profile 用 MIME allowlist で更に絞る)
    const validation = await validateUploadFile(request, {
      accept: 'image',
      allowedImageTypes: ALLOWED_PROFILE_IMAGE_TYPES,
    })
    if (!validation.ok) return validation.response
    const { buffer, file } = validation.data

    // 3. レート制限
    const rateLimitResult = await checkUserRateLimit(userId, 'upload')
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: ERR_RATE_LIMIT_UPLOAD }, { status: 429 })
    }

    // 4. 日次制限 (R2 課金保護のため Redis 障害時も fail-closed)
    const dailyLimitResult = await checkDailyLimit(userId, 'upload', {
      failOpen: false,
    })
    if (!dailyLimitResult.allowed) {
      return NextResponse.json(
        { error: ERR_DAILY_UPLOAD_LIMIT(dailyLimitResult.limit) },
        { status: 429 },
      )
    }

    // 5. 古い画像参照取得 → upload → DB 更新 → 古い画像削除
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true, headerUrl: true },
    })

    const result = await uploadFile(buffer, file.name, file.type, config.storageFolder)

    if (!result.success || !result.url) {
      return NextResponse.json(
        { error: result.error || ERR_UPLOAD_FAILED },
        { status: 500 },
      )
    }

    await prisma.user.update({
      where: { id: userId },
      data: { [config.dbField]: result.url },
    })

    const oldUrl = currentUser?.[config.dbField]
    if (oldUrl && !oldUrl.includes('placeholder')) {
      await deleteFile(oldUrl).catch((err: unknown) => {
        logger.warn(`Failed to delete old ${type}:`, err)
      })
    }

    revalidatePath(buildUserPath(userId))
    revalidatePath(ROUTE_SETTINGS_PROFILE)

    return NextResponse.json({
      success: true,
      url: result.url,
    })
  } catch (error) {
    logger.error(`${config.logLabel} upload error:`, error)
    return NextResponse.json({ error: ERR_UPLOAD_SERVER_ERROR }, { status: 500 })
  }
}
