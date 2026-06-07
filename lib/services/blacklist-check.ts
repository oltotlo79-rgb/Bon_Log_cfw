/**
 * @module lib/services/blacklist-check
 *
 * メール / デバイス fingerprint のブラックリスト照会（server-only）。
 *
 * Why server-only (not a Server Action):
 *   照会結果 (boolean) を公開 RPC として露出すると、ブラックリスト登録有無の列挙や
 *   DB 負荷の濫用に使われ得る。register / login の **内部チェックからのみ** 呼ぶ前提で
 *   server-only に閉じる。管理用 CRUD（要 `requireAdmin`）は
 *   `lib/actions/blacklist.ts` 側に残す。
 */

import 'server-only'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'

/** メールアドレスがブラックリスト登録済みかを判定する。DB 障害時は false（fail-open）。 */
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

/** デバイス fingerprint がブラックリスト登録済みかを判定する。DB 障害時は false（fail-open）。 */
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
