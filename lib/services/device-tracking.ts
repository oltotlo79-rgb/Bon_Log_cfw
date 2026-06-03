/**
 * @module lib/services/device-tracking
 * ログイン時のデバイス記録ロジック。
 *
 * Why service (not action): 任意の userId を受け取って書き込むため、`'use server'` の
 * RPC として公開すると未認証クライアントが他人の userDevice を書き換えられてしまう。
 * `server-only` で client バンドルへの混入を防ぎ、認証済みのサーバー経路
 * （auth フロー）からのみ呼ぶ前提の内部ロジックとして閉じる。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'

/**
 * ユーザーのデバイス情報を記録する。
 * 呼び出し元が認証と userId の正当性を保証している前提（認可はここでは行わない）。
 */
export async function recordUserDevice(
  userId: string,
  fingerprint: string,
  userAgent?: string,
  ipAddress?: string,
): Promise<void> {
  if (!userId || !fingerprint) return

  try {
    await prisma.userDevice.upsert({
      where: {
        userId_fingerprint: { userId, fingerprint },
      },
      create: {
        userId,
        fingerprint,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
      },
      update: {
        lastSeenAt: new Date(),
        userAgent: userAgent || undefined,
        ipAddress: ipAddress || undefined,
      },
    })
  } catch (error) {
    logger.error('Failed to record user device:', error)
  }
}
