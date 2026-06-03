/**
 * 会話（Conversation）関連のServer Actions
 *
 * 会話の開始・一覧・詳細・既読管理・未読数取得。
 * 個々のメッセージ操作は message-messages.ts を参照。
 *
 * @module lib/actions/message-conversations
 */

'use server'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { requireAuth, requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { actionZodError } from '@/lib/actions/schemas/common'
import type { ActionResult } from '@/types/action-result'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { MAX_CONVERSATIONS_LIMIT, BADGES_CONVERSATIONS_LIMIT } from '@/lib/constants/limits'
import {
  ERR_SELF_MESSAGE,
  ERR_MESSAGE_BLOCKED,
  ERR_CONVERSATION_ACCESS_DENIED,
  ERR_CONVERSATION_NOT_FOUND,
  ERR_CONVERSATION_CREATE_FAILED,
  ERR_CONVERSATION_FETCH_FAILED,
  ERR_MESSAGE_READ_FAILED,
  ERR_USER_ID_REQUIRED,
  ERR_USER_NOT_FOUND,
} from '@/lib/constants/errors'
import { ROUTE_MESSAGES } from '@/lib/constants/routes'
import { checkInteractionEligibility } from '@/lib/services/user-eligibility'
import logger from '@/lib/logger'

const targetUserIdSchema = z.string().min(1, ERR_USER_ID_REQUIRED)

/**
 * 指定ユーザーとの会話を取得、なければ新規作成する。
 * ブロック関係がある場合は拒否。
 */
export async function getOrCreateConversation(
  targetUserId: string,
): Promise<ActionResult<{ conversationId: string }>> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const currentUserId = auth.userId

  const parsed = targetUserIdSchema.safeParse(targetUserId)
  if (!parsed.success) {
    return actionZodError(parsed.error)
  }
  const userId = parsed.data

  if (currentUserId === userId) return actionError(ERR_SELF_MESSAGE)

  const rl = await enforceUserRateLimit(currentUserId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    // target の存在・停止・ゲスト・双方向 block を一括検証してから会話を作成する
    const eligibility = await checkInteractionEligibility(currentUserId, userId)
    if (!eligibility.ok) {
      return actionError(eligibility.reason === 'blocked' ? ERR_MESSAGE_BLOCKED : ERR_USER_NOT_FOUND)
    }

    const existingConversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId } } },
        ],
      },
    })
    if (existingConversation) {
      return actionSuccess({ conversationId: existingConversation.id })
    }

    const conversation = await prisma.conversation.create({
      data: {
        participants: { create: [{ userId: currentUserId }, { userId }] },
      },
    })
    return actionSuccess({ conversationId: conversation.id })
  } catch (error) {
    logger.error('Get or create conversation error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_CONVERSATION_CREATE_FAILED)
  }
}

type ConversationsSummary = {
  id: string
  updatedAt: Date
  otherUser: { id: string; nickname: string; avatarUrl: string | null } | null
  lastMessage: { id: string; content: string; createdAt: Date } | null
  hasUnread: boolean
}

/**
 * 自分が参加しているすべての会話を更新日時降順で取得する。
 */
export async function getConversations(): Promise<
  ActionResult<{ conversations: ConversationsSummary[] }>
> {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: {
      participants: {
        include: { user: USER_MINIMAL_RELATION },
      },
      messages: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_CONVERSATIONS_LIMIT,
  })

  const conversationsWithDetails: ConversationsSummary[] = conversations.map(
    (conv: typeof conversations[number]) => {
      const currentUserParticipant = conv.participants.find(
        (p: typeof conv.participants[number]) => p.userId === userId,
      )
      const otherParticipant = conv.participants.find(
        (p: typeof conv.participants[number]) => p.userId !== userId,
      )
      const lastMessage = conv.messages[0]
      let unreadCount = 0
      // 自分が最後に送信した会話は未読扱いしない（getUnreadMessageCount のバッジと整合させる）。
      if (lastMessage && lastMessage.senderId !== userId) {
        unreadCount =
          !currentUserParticipant?.lastReadAt || lastMessage.createdAt > currentUserParticipant.lastReadAt
            ? 1
            : 0
      }
      return {
        id: conv.id,
        updatedAt: conv.updatedAt,
        otherUser: otherParticipant?.user || null,
        lastMessage: lastMessage
          ? { id: lastMessage.id, content: lastMessage.content, createdAt: lastMessage.createdAt }
          : null,
        hasUnread: unreadCount > 0,
      }
    },
  )

  return actionSuccess({ conversations: conversationsWithDetails })
}

/**
 * 単一会話の詳細を取得する（メッセージ画面ヘッダー用）。
 */
export async function getConversation(
  conversationId: string,
): Promise<
  ActionResult<{
    conversation: {
      id: string
      otherUser: { id: string; nickname: string; avatarUrl: string | null } | null
    }
  }>
> {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  try {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    })
    if (!participant) return actionError(ERR_CONVERSATION_ACCESS_DENIED)

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: { user: USER_MINIMAL_RELATION },
        },
      },
    })
    if (!conversation) return actionError(ERR_CONVERSATION_NOT_FOUND)

    const otherParticipant = conversation.participants.find(
      (p: typeof conversation.participants[number]) => p.userId !== userId,
    )

    return actionSuccess({
      conversation: {
        id: conversation.id,
        otherUser: otherParticipant?.user || null,
      },
    })
  } catch (error) {
    logger.error('Get conversation error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_CONVERSATION_FETCH_FAILED)
  }
}

/**
 * 未読メッセージがある会話数を取得する（ナビバッジ用）。
 * 負荷対策のため直近 BADGES_CONVERSATIONS_LIMIT 会話のみが対象。
 */
export async function getUnreadMessageCount(): Promise<
  ActionResult<{ count: number; capReached: boolean }>
> {
  const auth = await requireAuth()
  if ('error' in auth) return actionSuccess({ count: 0, capReached: false })
  const userId = auth.userId

  try {
    const participants = await prisma.conversationParticipant.findMany({
      where: { userId },
      take: BADGES_CONVERSATIONS_LIMIT,
      orderBy: { conversation: { updatedAt: 'desc' } },
      include: {
        conversation: {
          include: { messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
        },
      },
    })

    const capReached = participants.length >= BADGES_CONVERSATIONS_LIMIT

    let unreadCount = 0
    for (const participant of participants) {
      const lastMessage = participant.conversation.messages[0]
      if (!lastMessage) continue
      if (lastMessage.senderId === userId) continue
      if (!participant.lastReadAt || lastMessage.createdAt > participant.lastReadAt) {
        unreadCount++
      }
    }

    return actionSuccess({ count: unreadCount, capReached })
  } catch (error) {
    logger.error('Get unread message count error', { error: error instanceof Error ? error.message : String(error) })
    return actionSuccess({ count: 0, capReached: false })
  }
}

/**
 * 指定会話の既読時刻を現在時刻に更新する。
 */
export async function markAsRead(conversationId: string) {
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  try {
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    })

    revalidatePath(ROUTE_MESSAGES)
    return actionSuccess()
  } catch (error) {
    logger.error('Mark message as read error', { error: error instanceof Error ? error.message : String(error) })
    return actionError(ERR_MESSAGE_READ_FAILED)
  }
}
