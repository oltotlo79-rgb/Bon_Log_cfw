/**
 * ブラックリスト管理用Server Actions
 *
 * メールアドレスとデバイスフィンガープリントのブラックリスト管理機能を提供します。
 *
 * @module lib/actions/blacklist
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import logger from '@/lib/logger'
import { MIN_FINGERPRINT_LENGTH, MAX_FINGERPRINT_LENGTH, ADMIN_LOGS_PAGE_LIMIT, MAX_EMAIL_LENGTH, MAX_REPORT_DETAIL_LENGTH } from '@/lib/constants/limits'
import { requireAdmin, actionSuccess, actionError, type ActionResult } from '@/lib/actions/utils'
import { buildCursorPagination } from '@/lib/actions/pagination'
import { ROUTE_ADMIN_BLACKLIST } from '@/lib/constants/routes'
import { containsInsensitive } from '@/lib/actions/prisma-filters'
import {
  ERR_INVALID_EMAIL_FORMAT,
  ERR_EMAIL_ALREADY_BLACKLISTED,
  ERR_BLACKLIST_ADD_FAILED,
  ERR_BLACKLIST_REMOVE_FAILED,
  ERR_BLACKLIST_FETCH_FAILED,
  ERR_INVALID_FINGERPRINT,
  ERR_DEVICE_ALREADY_BLACKLISTED,
  ERR_DEVICE_INFO_FETCH_FAILED,
  ERR_NO_ASSOCIATED_DEVICES,
  ERR_ALL_DEVICES_BLACKLISTED,
  ERR_DEVICE_BLACKLIST_FAILED,
} from '@/lib/constants/errors'

/**
 * ブラックリスト操作用バリデーションスキーマ
 */
const addEmailSchema = z.object({
  email: z.string().email(ERR_INVALID_EMAIL_FORMAT).max(MAX_EMAIL_LENGTH).transform((v) => v.toLowerCase().trim()),
  reason: z.string().max(MAX_REPORT_DETAIL_LENGTH).optional(),
})

const addDeviceSchema = z.object({
  fingerprint: z.string().min(MIN_FINGERPRINT_LENGTH, ERR_INVALID_FINGERPRINT).max(MAX_FINGERPRINT_LENGTH),
  reason: z.string().max(MAX_REPORT_DETAIL_LENGTH).optional(),
})

/**
 * メールアドレスをブラックリストに追加する
 */
export async function addEmailToBlacklist(
  email: string,
  reason?: string
): Promise<ActionResult> {
  const admin = await requireAdmin('blacklist:manage')
  if ('error' in admin) return actionError(admin.error)
  const userId = admin.userId

  const parsed = addEmailSchema.safeParse({ email, reason })
  if (!parsed.success) {
    return actionError(ERR_INVALID_EMAIL_FORMAT)
  }
  const normalizedEmail = parsed.data.email

  try {
    // 既に登録されているかチェック
    const existing = await prisma.emailBlacklist.findUnique({
      where: { email: normalizedEmail },
    })

    if (existing) {
      return actionError(ERR_EMAIL_ALREADY_BLACKLISTED)
    }

    await prisma.emailBlacklist.create({
      data: {
        email: normalizedEmail,
        reason: reason || null,
        createdBy: userId,
      },
    })

    revalidatePath(ROUTE_ADMIN_BLACKLIST)
    return actionSuccess()
  } catch (error) {
    logger.error('Failed to add email to blacklist:', error)
    return actionError(ERR_BLACKLIST_ADD_FAILED)
  }
}

/**
 * メールアドレスをブラックリストから削除する
 */
export async function removeEmailFromBlacklist(id: string): Promise<ActionResult> {
  const admin = await requireAdmin('blacklist:manage')
  if ('error' in admin) return actionError(admin.error)

  try {
    await prisma.emailBlacklist.delete({
      where: { id },
    })

    revalidatePath(ROUTE_ADMIN_BLACKLIST)
    return actionSuccess()
  } catch (error) {
    logger.error('Failed to remove email from blacklist:', error)
    return actionError(ERR_BLACKLIST_REMOVE_FAILED)
  }
}

/**
 * メールブラックリストを取得する（カーソルベースページネーション）。
 *
 * @remarks
 * オフセット方式は大規模テーブルで線形に遅くなるため、作成日時＋ID のタイブレーカー付き
 * カーソル方式へ移行した。旧シグネチャの `offset` は受け付けないため、UI 側も
 * `cursor` を渡すように合わせる必要がある。
 */
export async function getEmailBlacklist(options?: {
  search?: string
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('blacklist:view')
  if ('error' in admin) return actionError(admin.error)

  const { search, limit = ADMIN_LOGS_PAGE_LIMIT, cursor } = options || {}

  try {
    const where = search
      ? { email: containsInsensitive(search) }
      : {}

    const [items, total] = await Promise.all([
      prisma.emailBlacklist.findMany({
        where,
        // createdAt の重複時にも決定的な並び順になるよう id でタイブレーク。
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.emailBlacklist.count({ where }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1]?.id : undefined
    return actionSuccess({ items, total, nextCursor })
  } catch (error) {
    logger.error('Failed to get email blacklist:', error)
    return actionError(ERR_BLACKLIST_FETCH_FAILED)
  }
}

/**
 * メールアドレスがブラックリストに登録されているかチェックする
 * （登録時のチェック用 - 管理者権限不要）
 */
export async function isEmailBlacklisted(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim()

  try {
    const entry = await prisma.emailBlacklist.findUnique({
      where: { email: normalizedEmail },
    })

    return !!entry
  } catch (error) {
    logger.error('Failed to check email blacklist:', error)
    return false
  }
}

/**
 * デバイスをブラックリストに追加する
 */
export async function addDeviceToBlacklist(
  fingerprint: string,
  reason?: string,
  originalEmail?: string
): Promise<ActionResult> {
  const admin = await requireAdmin('blacklist:manage')
  if ('error' in admin) return actionError(admin.error)
  const userId = admin.userId

  const parsed = addDeviceSchema.safeParse({ fingerprint, reason })
  if (!parsed.success) {
    return actionError(ERR_INVALID_FINGERPRINT)
  }

  try {
    // 既に登録されているかチェック
    const existing = await prisma.deviceBlacklist.findUnique({
      where: { fingerprint },
    })

    if (existing) {
      return actionError(ERR_DEVICE_ALREADY_BLACKLISTED)
    }

    await prisma.deviceBlacklist.create({
      data: {
        fingerprint,
        reason: reason || null,
        originalEmail: originalEmail || null,
        createdBy: userId,
      },
    })

    revalidatePath(ROUTE_ADMIN_BLACKLIST)
    return actionSuccess()
  } catch (error) {
    logger.error('Failed to add device to blacklist:', error)
    return actionError(ERR_BLACKLIST_ADD_FAILED)
  }
}

/**
 * デバイスをブラックリストから削除する
 */
export async function removeDeviceFromBlacklist(id: string): Promise<ActionResult> {
  const admin = await requireAdmin('blacklist:manage')
  if ('error' in admin) return actionError(admin.error)

  try {
    await prisma.deviceBlacklist.delete({
      where: { id },
    })

    revalidatePath(ROUTE_ADMIN_BLACKLIST)
    return actionSuccess()
  } catch (error) {
    logger.error('Failed to remove device from blacklist:', error)
    return actionError(ERR_BLACKLIST_REMOVE_FAILED)
  }
}

/**
 * デバイスブラックリストを取得する（カーソルベースページネーション）。
 *
 * @see getEmailBlacklist — カーソル化の経緯と移行方針は同じ。
 */
export async function getDeviceBlacklist(options?: {
  search?: string
  limit?: number
  cursor?: string
}) {
  const admin = await requireAdmin('blacklist:view')
  if ('error' in admin) return actionError(admin.error)

  const { search, limit = ADMIN_LOGS_PAGE_LIMIT, cursor } = options || {}

  try {
    const where = search
      ? {
          OR: [
            { fingerprint: containsInsensitive(search) },
            { originalEmail: containsInsensitive(search) },
          ],
        }
      : {}

    const [items, total] = await Promise.all([
      prisma.deviceBlacklist.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...buildCursorPagination(cursor, limit),
      }),
      prisma.deviceBlacklist.count({ where }),
    ])

    const nextCursor = items.length === limit ? items[items.length - 1]?.id : undefined
    return actionSuccess({ items, total, nextCursor })
  } catch (error) {
    logger.error('Failed to get device blacklist:', error)
    return actionError(ERR_BLACKLIST_FETCH_FAILED)
  }
}

/**
 * デバイスがブラックリストに登録されているかチェックする
 * （登録・ログイン時のチェック用 - 管理者権限不要）
 */
export async function isDeviceBlacklisted(fingerprint: string): Promise<boolean> {
  if (!fingerprint) return false

  try {
    const entry = await prisma.deviceBlacklist.findUnique({
      where: { fingerprint },
    })

    return !!entry
  } catch (error) {
    logger.error('Failed to check device blacklist:', error)
    return false
  }
}

/**
 * ユーザーのデバイス一覧を取得する
 */
export async function getUserDevices(userId: string) {
  const admin = await requireAdmin('users:view')
  if ('error' in admin) return actionError(admin.error)

  try {
    const devices = await prisma.userDevice.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    })

    return actionSuccess(devices)
  } catch (error) {
    logger.error('Failed to get user devices:', error)
    return actionError(ERR_DEVICE_INFO_FETCH_FAILED)
  }
}

/**
 * ユーザーの全デバイスをブラックリストに追加する
 */
export async function blacklistUserDevices(
  userId: string,
  reason?: string
) {
  const admin = await requireAdmin('blacklist:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    const devices = await prisma.userDevice.findMany({
      where: { userId },
      select: { fingerprint: true },
    })

    if (devices.length === 0) {
      return actionError(ERR_NO_ASSOCIATED_DEVICES)
    }

    // 既存のブラックリストエントリを除外
    const existingBlacklist = await prisma.deviceBlacklist.findMany({
      where: {
        fingerprint: { in: devices.map((d: { fingerprint: string }) => d.fingerprint) },
      },
      select: { fingerprint: true },
    })

    const existingFingerprints = new Set(existingBlacklist.map((e: { fingerprint: string }) => e.fingerprint))
    const newDevices = devices.filter((d: { fingerprint: string }) => !existingFingerprints.has(d.fingerprint))

    if (newDevices.length === 0) {
      return actionError(ERR_ALL_DEVICES_BLACKLISTED)
    }

    // 新規デバイスをブラックリストに追加
    await prisma.deviceBlacklist.createMany({
      data: newDevices.map((d: { fingerprint: string }) => ({
        fingerprint: d.fingerprint,
        reason: reason || `ユーザー ${userId} のデバイスを一括ブロック`,
        originalEmail: user?.email || null,
        createdBy: adminUserId,
      })),
    })

    revalidatePath(ROUTE_ADMIN_BLACKLIST)
    return actionSuccess({ count: newDevices.length })
  } catch (error) {
    logger.error('Failed to blacklist user devices:', error)
    return actionError(ERR_DEVICE_BLACKLIST_FAILED)
  }
}
