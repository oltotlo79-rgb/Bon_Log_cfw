/**
 * 個々のメッセージ（Message）関連のServer Actions
 *
 * 送信・取得・削除を扱う。会話自体の操作は message-conversations.ts を参照。
 *
 * @module lib/actions/message-messages
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { createNotification } from '@/lib/services/notification-core'
import { requireAuth, requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { actionZodError } from '@/lib/actions/schemas/common'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  MAX_MESSAGE_LENGTH,
  DAILY_MESSAGE_LIMIT,
  MESSAGES_PAGE_LIMIT,
  MAX_NOTIFICATION_ID_LENGTH,
} from '@/lib/constants/limits'
import {
  ERR_MESSAGE_BLOCKED,
  ERR_CONVERSATION_ACCESS_DENIED,
  ERR_MESSAGE_DAILY_LIMIT,
  ERR_MESSAGE_NOT_FOUND,
  ERR_MESSAGE_DELETE_DENIED,
  ERR_MESSAGE_FETCH_FAILED,
  ERR_MESSAGE_SEND_FAILED,
  ERR_CONVERSATION_ID_REQUIRED,
  ERR_MESSAGE_CONTENT_REQUIRED,
  ERR_MESSAGE_TOO_LONG,
  ERR_INVALID_INPUT,
} from '@/lib/constants/errors'

const messageIdSchema = z.string().min(1).max(MAX_NOTIFICATION_ID_LENGTH)
import { getStartOfToday } from '@/lib/utils'
import { sanitizeMessageContent } from '@/lib/sanitize'
import { ROUTE_MESSAGES } from '@/lib/constants/routes'
import { buildMessageConversationPath } from '@/lib/constants/path-builders'
import logger from '@/lib/logger'

const sendMessageSchema = z.object({
  conversationId: z.string().min(1, ERR_CONVERSATION_ID_REQUIRED),
  content: z
    .string()
    .refine((s) => s.trim().length > 0, { message: ERR_MESSAGE_CONTENT_REQUIRED })
    .refine((s) => s.length <= MAX_MESSAGE_LENGTH, { message: ERR_MESSAGE_TOO_LONG(MAX_MESSAGE_LENGTH) }),
})

/**
 * メッセージを送信する。送信前に参加者確認・日次上限・ブロック関係をチェック。
 * 相手への通知は fire-and-forget（失敗してもメッセージ送信自体は成功扱い）。
 */
export async function sendMessage(conversationId: string, content: string) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = sendMessageSchema.safeParse({ conversationId, content })
  if (!parsed.success) {
    return actionZodError(parsed.error)
  }
  const { conversationId: convId, content: messageContent } = parsed.data

  const engagementRl = await enforceUserRateLimit(userId, 'engagement')
  if (engagementRl) return actionError(engagementRl.error)
  const sendMessageRl = await enforceUserRateLimit(userId, 'send_message')
  if (sendMessageRl) return actionError(sendMessageRl.error)

  // count と実際の create（下部）が同一トランザクションでないため、同時送信では
  // 日次上限をわずかに超過しうる（write skew）。実害は許容範囲のため Redis INCR 方式
  // までは導入していない（許容できる上限超過については checkDailyPostLimit のコメント参照）。
  const today = getStartOfToday()
  const [participant, todayMessageCount, otherParticipant] = await Promise.all([
    prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: convId, userId } },
    }),
    prisma.message.count({ where: { senderId: userId, createdAt: { gte: today } } }),
    prisma.conversationParticipant.findFirst({
      where: { conversationId: convId, userId: { not: userId } },
    }),
  ])

  if (!participant) return actionError(ERR_CONVERSATION_ACCESS_DENIED)
  if (todayMessageCount >= DAILY_MESSAGE_LIMIT) return actionError(ERR_MESSAGE_DAILY_LIMIT)

  // 会話作成後にブロックされた可能性があるため再チェック
  if (otherParticipant) {
    const blocked = await prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userId, blockedId: otherParticipant.userId },
          { blockerId: otherParticipant.userId, blockedId: userId },
        ],
      },
    })
    if (blocked) return actionError(ERR_MESSAGE_BLOCKED)
  }

  const sanitizedContent = sanitizeMessageContent(messageContent)

  try {
    const message = await prisma.message.create({
      data: { conversationId: convId, senderId: userId, content: sanitizedContent },
      include: { sender: USER_MINIMAL_RELATION },
    })

    await prisma.conversation.update({
      where: { id: convId },
      data: { updatedAt: new Date() },
    })

    // 通知作成は createNotification 経由（CLAUDE.md ルール6）。
    // 失敗してもメッセージ送信自体は成功扱いとするため fire-and-forget で待機しない。
    if (otherParticipant) {
      void createNotification({
        userId: otherParticipant.userId,
        actorId: userId,
        type: 'message',
        conversationId: convId,
      }).then((result) => {
        if (!result.success) {
          logger.error('Message notification creation failed', {
            error: result.error,
            conversationId: convId,
          })
        }
      }).catch((err) => {
        logger.error('Message notification dispatch error', {
          error: err instanceof Error ? err.message : String(err),
          conversationId: convId,
        })
      })
    }

    revalidatePath(buildMessageConversationPath(convId))
    revalidatePath(ROUTE_MESSAGES)

    return actionSuccess({ message })
  } catch (error) {
    logger.error('Send message failed', {
      error: error instanceof Error ? error.message : String(error),
      conversationId: convId,
      userId,
    })
    return actionError(ERR_MESSAGE_SEND_FAILED)
  }
}

/**
 * 会話のメッセージ履歴をカーソルベースで取得する。取得時に既読時刻も更新。
 */
export async function getMessages(conversationId: string, cursor?: string, limit = MESSAGES_PAGE_LIMIT) {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  try {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    })
    if (!participant) return actionError(ERR_CONVERSATION_ACCESS_DENIED)

    const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: { sender: USER_MINIMAL_RELATION },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
    })

    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    })

    return actionSuccess({
      messages: messages.reverse(),
      nextCursor: messages.length === safeLimit ? messages[0]?.id : undefined,
      currentUserId: userId,
    })
  } catch (error) {
    logger.error('Get messages error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_MESSAGE_FETCH_FAILED)
  }
}

/**
 * 自分が送信したメッセージを削除する。他人のメッセージは削除不可。
 */
export async function deleteMessage(messageId: string) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = messageIdSchema.safeParse(messageId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  const message = await prisma.message.findUnique({
    where: { id: parsed.data },
    select: { id: true, senderId: true, conversationId: true },
  })
  if (!message) return actionError(ERR_MESSAGE_NOT_FOUND)
  if (message.senderId !== userId) return actionError(ERR_MESSAGE_DELETE_DENIED)

  await prisma.message.delete({ where: { id: parsed.data } })

  revalidatePath(buildMessageConversationPath(message.conversationId))
  revalidatePath(ROUTE_MESSAGES)
  return actionSuccess()
}
