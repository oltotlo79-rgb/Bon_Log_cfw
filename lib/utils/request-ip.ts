/**
 * @module lib/utils/request-ip
 *
 * Server Action / Route Handler / NextAuth authorize から「信頼できる」クライアント IP を
 * 取得する共通ヘルパー。
 *
 * Why split from `lib/actions/utils`:
 *   `lib/actions/utils` は `@/lib/auth` を import するため、`lib/services/*`
 *   （actions 層に依存できない層）から IP 解決を使うと循環参照になる
 *   (auth → service → actions/utils → auth)。依存方向の中立な本モジュールへ切り出し、
 *   service / auth 双方から安全に import できるようにする。
 */

import { headers } from 'next/headers'
import { extractClientIp } from '@/lib/utils/client-ip'

/** Server 文脈のリクエストヘッダーから信頼できるクライアント IP を取得する。 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers()
  return extractClientIp((name) => headersList.get(name))
}
