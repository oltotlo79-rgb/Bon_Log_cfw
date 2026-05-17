'use server'

/**
 * メンテナンスモード管理用のServer Actions
 * @module lib/actions/maintenance
 */

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import logger from '@/lib/logger'
import { redis } from '@/lib/redis'
import { requireAdmin, actionSuccess, actionError, type ActionResult } from '@/lib/actions/utils'
import { ERR_SYSTEM_SETTING_UPDATE_FAILED, ERR_SETTING_UPDATE_FAILED } from '@/lib/constants/errors'
import { ROUTE_ADMIN_MAINTENANCE } from '@/lib/constants/routes'
import { z } from 'zod'

const maintenanceSettingsSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  message: z.string(),
})

/**
 * メンテナンス設定の型
 */
export interface MaintenanceSettings {
  enabled: boolean
  startTime: string | null // ISO 8601形式
  endTime: string | null   // ISO 8601形式
  message: string
}

/**
 * デフォルトのメンテナンス設定
 */
const DEFAULT_SETTINGS: MaintenanceSettings = {
  enabled: false,
  startTime: null,
  endTime: null,
  message: 'ただいまメンテナンス中です。しばらくお待ちください。',
}

const MAINTENANCE_SETTING_KEY = 'maintenance_mode'

/**
 * メンテナンス設定を取得
 * キャッシュせず常に最新を取得
 */
export async function getMaintenanceSettings(): Promise<MaintenanceSettings> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: MAINTENANCE_SETTING_KEY },
    })

    if (!setting) {
      return DEFAULT_SETTINGS
    }

    const parsed = maintenanceSettingsSchema.safeParse(setting.value)
    if (!parsed.success) {
      logger.warn('Failed to parse maintenance settings, using defaults:', parsed.error)
      return DEFAULT_SETTINGS
    }
    return parsed.data
  } catch (error) {
    logger.error('Failed to get maintenance settings:', error)
    return DEFAULT_SETTINGS
  }
}

/**
 * メンテナンスモードが有効かどうかをチェック
 * 時間範囲も考慮する
 */
export async function isMaintenanceMode(): Promise<boolean> {
  const settings = await getMaintenanceSettings()

  if (!settings.enabled) {
    return false
  }

  const now = new Date()

  // 開始時間が設定されている場合、まだ開始前ならfalse
  if (settings.startTime) {
    const startTime = new Date(settings.startTime)
    if (now < startTime) {
      return false
    }
  }

  // 終了時間が設定されている場合、終了後ならfalse
  if (settings.endTime) {
    const endTime = new Date(settings.endTime)
    if (now > endTime) {
      return false
    }
  }

  return true
}

/**
 * 現在のユーザーが管理者かどうかをチェック
 * proxy.tsから呼び出し可能なバージョン
 */
export async function checkIsAdmin(userId: string): Promise<boolean> {
  try {
    const adminUser = await prisma.adminUser.findUnique({
      where: { userId },
    })
    return !!adminUser
  } catch {
    return false
  }
}

/**
 * メンテナンス設定を更新（管理者のみ）
 */
export async function updateMaintenanceSettings(
  settings: Partial<MaintenanceSettings>
): Promise<ActionResult> {
  try {
    const admin = await requireAdmin('maintenance:manage')
    if ('error' in admin) {
      return actionError(admin.error)
    }
    const userId = admin.userId

    logger.info('Updating maintenance settings for user:', userId)

    // 現在の設定を取得
    const currentSettings = await getMaintenanceSettings()

    // 新しい設定をマージ
    const newSettings: MaintenanceSettings = {
      ...currentSettings,
      ...settings,
    }

    // 設定を保存（Prisma Json型に変換）
    const jsonValue = JSON.parse(JSON.stringify(newSettings))

    try {
      await prisma.systemSetting.upsert({
        where: { key: MAINTENANCE_SETTING_KEY },
        update: {
          value: jsonValue,
          updatedBy: userId,
        },
        create: {
          key: MAINTENANCE_SETTING_KEY,
          value: jsonValue,
          updatedBy: userId,
        },
      })
    } catch (dbError) {
      logger.error('Failed to upsert systemSetting:', dbError)
      return actionError(ERR_SYSTEM_SETTING_UPDATE_FAILED)
    }

    // Redisにメンテナンス状態をキャッシュ（proxy Edge Runtimeで参照）
    try {
      await redis.client.set('maintenance_mode_enabled', newSettings.enabled ? 'true' : 'false')
    } catch (redisError) {
      logger.warn('Failed to sync maintenance status to Redis (non-fatal):', redisError)
    }

    // 管理者ログに記録（失敗しても設定自体は保存済み）
    try {
      await prisma.adminLog.create({
        data: {
          adminId: userId,
          action: settings.enabled ? 'maintenance_enabled' : 'maintenance_updated',
          targetType: 'system_setting',
          targetId: MAINTENANCE_SETTING_KEY,
          details: jsonValue,
        },
      })
    } catch (logError) {
      // ログ記録の失敗は警告のみ（設定自体は成功している）
      logger.warn('Failed to create adminLog (non-fatal):', logError)
    }

    revalidatePath(ROUTE_ADMIN_MAINTENANCE)

    return actionSuccess()
  } catch (error) {
    logger.error('Failed to update maintenance settings:', error)
    return actionError(ERR_SETTING_UPDATE_FAILED)
  }
}

/**
 * メンテナンスモードを即座に有効/無効にする
 */
export async function toggleMaintenanceMode(
  enabled: boolean
): Promise<ActionResult> {
  return updateMaintenanceSettings({ enabled })
}
