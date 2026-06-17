/**
 * @module lib/services/device-service
 * モバイル Push 通知デバイストークンの登録・解除サービス。
 *
 * 認証・認可・レート制限はすべて呼び出し元 route handler が保証している前提。
 * トークン文字列はログ・例外メッセージに含めない（宛先 ID として秘匿寄りの扱いをする）。
 */

import { prisma } from '@/lib/db'
import type { DevicePlatform } from '@prisma/client'

/**
 * デバイストークンを冪等な upsert で登録する。
 *
 * token はグローバル一意。既存トークンに別の userId がいる場合は現所有者（新 userId）に
 * 付け替える（端末譲渡・再インストールのシナリオに対応）。
 *
 * @param userId   認証済みユーザー ID（ゲスト不可）
 * @param token    Expo / APNs / FCM の Push トークン文字列
 * @param platform デバイスプラットフォーム（android | ios）
 */
export async function registerDevice(
  userId: string,
  token: string,
  platform: DevicePlatform,
): Promise<void> {
  await prisma.mobileDevice.upsert({
    where: { token },
    update: { userId, platform },
    create: { userId, token, platform },
  })
}

/**
 * デバイストークンを解除する。
 *
 * `where: { token, userId }` の複合条件により、自分のトークンのみ削除できる。
 * 他人のトークンや存在しないトークンを指定した場合も成功扱いとする（冪等・fail-safe）。
 *
 * @param userId 認証済みユーザー ID（ゲスト不可）
 * @param token  解除するトークン文字列
 */
export async function removeDevice(userId: string, token: string): Promise<void> {
  await prisma.mobileDevice.deleteMany({
    where: { token, userId },
  })
}
