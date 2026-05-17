/**
 * メンテナンス状態確認API
 * proxy.tsから呼び出されてメンテナンス状態と管理者かどうかを返す
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { rateLimit, getClientIp, RATE_LIMITS } from '@/lib/rate-limit'
import { API_ERR_TOO_MANY_REQUESTS } from '@/lib/constants/errors'
import { SYSTEM_SETTING_KEYS } from '@/lib/constants/system-settings'

export const dynamic = 'force-dynamic'

/**
 * メンテナンス設定のスキーマ。
 * systemSetting.value は Prisma の Json フィールドであり実体の型は `unknown`。
 * Zod で検証することで `as unknown as` キャストを避け、不正形状時に fail-safe で
 * メンテナンス OFF として扱う（誤判定で全サイトをメンテナンスに落とすのを防ぐ）。
 */
const maintenanceSettingsSchema = z.object({
  enabled: z.boolean(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  message: z.string(),
})

type MaintenanceSettings = z.infer<typeof maintenanceSettingsSchema>

/**
 * メンテナンスモードが現在有効かどうかをチェック。
 * 開始/終了時刻の範囲指定にも対応。
 */
function checkMaintenanceMode(settings: MaintenanceSettings): boolean {
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

export async function GET(request: NextRequest) {
  const ip = getClientIp(request)
  const rateLimitResult = await rateLimit(`maintenance:${ip}`, RATE_LIMITS.api)
  if (!rateLimitResult.success) {
    return NextResponse.json({ error: API_ERR_TOO_MANY_REQUESTS }, { status: 429 })
  }

  try {
    const session = await auth()
    const userId = session?.user?.id

    // 管理者チェックとメンテナンス設定取得を並列実行
    const [adminUser, setting] = await Promise.all([
      userId
        ? prisma.adminUser.findUnique({
            where: { userId },
            select: { userId: true },
          })
        : null,
      prisma.systemSetting.findUnique({
        where: { key: SYSTEM_SETTING_KEYS.MAINTENANCE_MODE },
        select: { value: true },
      }),
    ])

    const isAdmin = !!adminUser
    let isMaintenanceMode = false
    if (setting) {
      const parsed = maintenanceSettingsSchema.safeParse(setting.value)
      if (parsed.success) {
        isMaintenanceMode = checkMaintenanceMode(parsed.data)
      } else {
        // 形状不一致なら運用的に fail-safe とみなして OFF 扱い。
        // 原因（古いスキーマ残存・手動更新など）は Sentry で追跡できるよう logger へ委譲する。
        logger.warn('Invalid maintenance_mode setting shape', {
          issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
        })
      }
    }

    return NextResponse.json({
      isMaintenanceMode,
      isAdmin,
    })
  } catch (error) {
    logger.error('Maintenance status check error:', error)
    // エラー時はメンテナンスモードではないとして扱う
    return NextResponse.json({
      isMaintenanceMode: false,
      isAdmin: false,
    })
  }
}
