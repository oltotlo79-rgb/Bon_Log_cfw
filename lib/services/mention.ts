/**
 * @module lib/services/mention
 * メンション通知・解決の内部ロジック。
 *
 * Why services 層: `'use server'` で公開すると任意の authorId / userIds を
 * 受け取る公開 RPC になり、メンション通知のなりすましや任意ユーザー情報の
 * 列挙が可能になる。Action 層 (`lib/actions/post.ts` 等) から認証済み userId
 * を渡して呼ぶ前提で services に隔離する。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { createNotificationsBulk } from '@/lib/services/notification-bulk'
import logger from '@/lib/logger'
import { extractMentionIds } from '@/lib/mention-utils'

type MentionUser = {
  id: string
  nickname: string
  avatarUrl: string | null
}

/**
 * 投稿本文中の `<@userId>` 形式のメンションを抽出し、対象ユーザーへ通知する。
 *
 * Why createNotificationsBulk: 直接 `prisma.notification.create` を叩くと
 * ブロック関係チェック・通知設定（mention=false 設定）・重複防止・プッシュ通知送信が
 * 抜け落ちる（CLAUDE.md ルール6）。失敗しても投稿作成はブロックしない。
 */
export async function notifyMentionedUsers(
  postId: string,
  content: string | null,
  authorId: string,
): Promise<void> {
  if (!content) return

  const mentionedUserIds = extractMentionIds(content)
  if (mentionedUserIds.length === 0) return

  try {
    const users = await prisma.user.findMany({
      where: {
        id: { in: mentionedUserIds },
        isSuspended: false,
        NOT: { id: authorId },
      },
      select: { id: true },
    })

    if (users.length > 0) {
      await createNotificationsBulk({
        recipientIds: users.map((user) => user.id),
        actorId: authorId,
        type: 'mention',
        postId,
      })
    }
  } catch (error) {
    logger.error('Notify mentioned users error', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * ユーザーID 配列から表示用の最小ユーザー情報を解決する。
 * 投稿表示時に `<@userId>` を `@nickname` 表示へ置換するために使用。
 */
export async function resolveMentionUsers(
  userIds: string[],
): Promise<Map<string, MentionUser>> {
  if (!userIds || userIds.length === 0) return new Map()

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, isSuspended: false },
      select: USER_MINIMAL_SELECT,
    })
    return new Map(users.map((u: MentionUser) => [u.id, u]))
  } catch (error) {
    logger.error('Resolve mention users error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return new Map()
  }
}
