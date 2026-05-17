/**
 * このファイルは、Content Security Policy (CSP) のnonce値を
 *
 * @module lib/security/nonce
 */

import { headers } from 'next/headers'

/**
 * CSP nonceを取得する
 *
 * proxyで生成されたnonceをヘッダーから取得します。
 * Server Componentでのみ使用可能です。
 *
 * @returns nonce値、またはundefined（nonceが設定されていない場合）
 *
 * @example
 * ```tsx
 * const nonce = await getNonce()
 * <script nonce={nonce}>...</script>
 * ```
 */
export async function getNonce(): Promise<string | undefined> {
  const headersList = await headers()
  return headersList.get('x-nonce') ?? undefined
}
