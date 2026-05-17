import 'server-only'

import { prisma } from '@/lib/db'

/**
 * セキュリティイベント記録 (内部ユーティリティ)
 *
 * 認証フロー (ログイン失敗・パスワード変更・2FA切替) などから直接呼び出す。
 * Server Action として公開すると、外部クライアントから任意イベントを偽装注入され
 * 監査ログを汚染できるため、`'use server'` ファイルには置かない。
 */
export async function logSecurityEvent(data: {
  eventType: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  details?: Record<string, unknown>
}): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      eventType: data.eventType,
      userId: data.userId ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      details: data.details ? JSON.parse(JSON.stringify(data.details)) : undefined,
    },
  })
}
