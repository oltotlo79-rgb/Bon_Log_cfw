/**
 * ユーザー自身のセキュリティ活動（ログイン失敗・パスワード変更・2FA 切替・メール変更）を取得する。
 *
 * Why custom shape: 読み取り専用の一覧取得で、UI 上は空配列が自然なため
 * `ActionResult` ではなく `{ events }` を返す（server-actions.md の読み取り例外）。
 *
 * @module lib/actions/security-activity
 */

'use server'

import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/actions/utils'
import { SECURITY_ACTIVITY_LIMIT } from '@/lib/constants/limits'

export type SecurityActivityEvent = {
  id: string
  eventType: string
  ipAddress: string | null
  userAgent: string | null
  createdAt: Date
}

/**
 * 現在のユーザーの直近のセキュリティイベントを新しい順で返す。
 * 認証情報（IP / UA）の自己確認用。details は機微情報を含みうるため返さない。
 */
export async function getMySecurityEvents(): Promise<{ events: SecurityActivityEvent[] }> {
  const authResult = await requireAuth()
  if ('error' in authResult) return { events: [] }

  const events = await prisma.securityEvent.findMany({
    where: { userId: authResult.userId },
    select: { id: true, eventType: true, ipAddress: true, userAgent: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: SECURITY_ACTIVITY_LIMIT,
  })

  return { events }
}
