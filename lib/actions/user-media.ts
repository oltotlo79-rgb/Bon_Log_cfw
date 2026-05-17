'use server'

import { prisma } from '@/lib/db'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { revalidatePath } from 'next/cache'
import { uploadFile } from '@/lib/storage'
import { validateImageFile, generateSafeFileName } from '@/lib/file-validation'
import {
  MAX_IMAGE_SIZE,
  ALLOWED_PROFILE_IMAGE_TYPES,
} from '@/lib/constants/limits'
import {
  ERR_FILE_NOT_SELECTED,
  ERR_IMAGE_SIZE_EXCEEDED,
  ERR_INVALID_IMAGE_FORMAT,
  ERR_UPLOAD_FAILED,
  ERR_INVALID_IMAGE_GENERIC,
} from '@/lib/constants/errors'
import {
  STORAGE_FOLDER_AVATARS,
  STORAGE_FOLDER_HEADERS,
} from '@/lib/constants/storage'
import { ROUTE_SETTINGS_PROFILE } from '@/lib/constants/routes'
import { buildUserPath } from '@/lib/constants/path-builders'
import logger from '@/lib/logger'

export async function uploadAvatar(formData: FormData) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rawFile = formData.get('file')
  if (!(rawFile instanceof File)) {
    return actionError(ERR_FILE_NOT_SELECTED)
  }
  const file = rawFile

  if (file.size > MAX_IMAGE_SIZE) {
    return actionError(ERR_IMAGE_SIZE_EXCEEDED)
  }

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    const allowedTypes: string[] = [...ALLOWED_PROFILE_IMAGE_TYPES]
    const validation = validateImageFile(buffer, file.type, allowedTypes)
    if (!validation.valid) {
      return actionError(validation.error || ERR_INVALID_IMAGE_GENERIC)
    }

    if (!allowedTypes.includes(file.type)) {
      return actionError(ERR_INVALID_IMAGE_FORMAT)
    }

    const safeFileName = generateSafeFileName(file.name, file.type)

    const result = await uploadFile(buffer, safeFileName, file.type, STORAGE_FOLDER_AVATARS)

    if (!result.success || !result.url) {
      if (result.error) logger.error('Avatar upload failed:', result.error)
      return actionError(ERR_UPLOAD_FAILED)
    }

    await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: result.url },
    })

    revalidatePath(buildUserPath(userId))
    revalidatePath(ROUTE_SETTINGS_PROFILE)
    return actionSuccess({ url: result.url })
  } catch (error) {
    logger.error('Upload avatar error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_UPLOAD_FAILED)
  }
}

export async function uploadHeader(formData: FormData) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rawFile = formData.get('file')
  if (!(rawFile instanceof File)) {
    return actionError(ERR_FILE_NOT_SELECTED)
  }
  const file = rawFile

  if (file.size > MAX_IMAGE_SIZE) {
    return actionError(ERR_IMAGE_SIZE_EXCEEDED)
  }

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    const buffer = Buffer.from(await file.arrayBuffer())

    const allowedTypes: string[] = [...ALLOWED_PROFILE_IMAGE_TYPES]
    const validation = validateImageFile(buffer, file.type, allowedTypes)
    if (!validation.valid) {
      return actionError(validation.error || ERR_INVALID_IMAGE_GENERIC)
    }

    if (!allowedTypes.includes(file.type)) {
      return actionError(ERR_INVALID_IMAGE_FORMAT)
    }

    const safeFileName = generateSafeFileName(file.name, file.type)

    const result = await uploadFile(buffer, safeFileName, file.type, STORAGE_FOLDER_HEADERS)

    if (!result.success || !result.url) {
      if (result.error) logger.error('Header upload failed:', result.error)
      return actionError(ERR_UPLOAD_FAILED)
    }

    await prisma.user.update({
      where: { id: userId },
      data: { headerUrl: result.url },
    })

    revalidatePath(buildUserPath(userId))
    revalidatePath(ROUTE_SETTINGS_PROFILE)
    return actionSuccess({ url: result.url })
  } catch (error) {
    logger.error('Upload header error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_UPLOAD_FAILED)
  }
}
