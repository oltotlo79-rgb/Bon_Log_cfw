/**
 * @module lib/services/message-service
 * モバイル API v1 向けダイレクトメッセージサービス。
 *
 * Web 側の lib/actions/message-*.ts は auth() セッション依存のため Bearer 認証モバイルから
 * は流用できない。本モジュールは明示的 userId 引数で動作し、認証・レート制限は呼び出し元
 * （route handler）が担う前提（lib/services/like-service.ts 等と同じ explicit-userId パターン）。
 *
 * Returns domain-specific types instead of ActionResult because this is a service
 * layer consumed by route handlers that build their own HTTP responses.
 */

import 'server-only'

import { prisma } from '@/lib/db'
import { USER_MINIMAL_RELATION } from '@/lib/prisma/shared-includes'
import { checkInteractionEligibility } from '@/lib/services/user-eligibility'
import { createNotification } from '@/lib/services/notification-core'
import { sanitizeMessageContent } from '@/lib/sanitize'
import { getStartOfToday } from '@/lib/utils'
import {
  MAX_MESSAGE_LENGTH,
  DAILY_MESSAGE_LIMIT,
  MESSAGES_PAGE_LIMIT,
} from '@/lib/constants/limits'
import {
  ERR_SELF_MESSAGE,
  ERR_MESSAGE_BLOCKED,
  ERR_CONVERSATION_ACCESS_DENIED,
  ERR_MESSAGE_DAILY_LIMIT,
  ERR_MESSAGE_NOT_FOUND,
  ERR_MESSAGE_DELETE_DENIED,
  ERR_CONVERSATION_CREATE_FAILED,
  ERR_CONVERSATION_FETCH_FAILED,
  ERR_MESSAGE_FETCH_FAILED,
  ERR_MESSAGE_SEND_FAILED,
  ERR_MESSAGE_READ_FAILED,
  ERR_MESSAGE_CONTENT_REQUIRED,
  ERR_MESSAGE_TOO_LONG,
  ERR_USER_NOT_FOUND,
} from '@/lib/constants/errors'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import logger from '@/lib/logger'

// ─── 共通結果型 ───────────────────────────────────────────────────────────────

/**
 * service 層のエラー種別。route handler がこれを HTTP ステータスにマッピングする。
 * NOT_FOUND = 404、FORBIDDEN = 403、VALIDATION_ERROR = 400、INTERNAL_ERROR = 500。
 */
export type MessageServiceError =
  | { ok: false; code: 'NOT_FOUND'; message: string }
  | { ok: false; code: 'FORBIDDEN'; message: string }
  | { ok: false; code: 'VALIDATION_ERROR'; message: string }
  | { ok: false; code: 'INTERNAL_ERROR'; message: string }

export type MessageServiceResult<T> = { ok: true; data: T } | MessageServiceError

// ─── ドメイン型 ───────────────────────────────────────────────────────────────

type UserMinimal = {
  id: string
  nickname: string
  avatarUrl: string | null
}

export type ConversationItem = {
  id: string
  updatedAt: Date
  otherUser: UserMinimal | null
  lastMessage: {
    id: string
    content: string
    senderId: string
    createdAt: Date
  } | null
  hasUnread: boolean
}

export type MessageItem = {
  id: string
  conversationId: string
  content: string
  senderId: string
  sender: UserMinimal
  createdAt: Date
}

// ─── listConversations ────────────────────────────────────────────────────────

/**
 * 自分が参加する会話一覧を updatedAt DESC のカーソルページネーションで返す。
 * 相手ユーザー情報・最終メッセージ・未読フラグを N+1 なしで取得する。
 */
export async function listConversations(
  userId: string,
  cursor?: string,
  limit?: number,
): Promise<MessageServiceResult<{ items: ConversationItem[]; nextCursor: string | null }>> {
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({ cursor, limit })

  try {
    const conversations = await prisma.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: {
          include: { user: USER_MINIMAL_RELATION },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
      take: safeLimit,
      ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
    })

    const items: ConversationItem[] = conversations.map((conv) => {
      const myParticipant = conv.participants.find((p) => p.userId === userId)
      const otherParticipant = conv.participants.find((p) => p.userId !== userId)
      const lastMessage = conv.messages[0]

      let hasUnread = false
      if (lastMessage && lastMessage.senderId !== userId) {
        hasUnread =
          !myParticipant?.lastReadAt || lastMessage.createdAt > myParticipant.lastReadAt
      }

      return {
        id: conv.id,
        updatedAt: conv.updatedAt,
        otherUser: otherParticipant?.user ?? null,
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              content: lastMessage.content,
              senderId: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
            }
          : null,
        hasUnread,
      }
    })

    const nextCursor =
      conversations.length === safeLimit
        ? (conversations[conversations.length - 1]?.id ?? null)
        : null

    return { ok: true, data: { items, nextCursor } }
  } catch (error) {
    logger.error('listConversations error', {
      error: error instanceof Error ? error.message : String(error),
      userId,
    })
    return { ok: false, code: 'INTERNAL_ERROR', message: ERR_CONVERSATION_FETCH_FAILED }
  }
}

// ─── startConversation ────────────────────────────────────────────────────────

/**
 * 指定ユーザーとの会話を取得または新規作成する。
 * ブロック関係・自己メッセージ・ユーザー不存在は拒否する。
 */
export async function startConversation(
  userId: string,
  targetUserId: string,
): Promise<MessageServiceResult<{ conversationId: string }>> {
  if (userId === targetUserId) {
    return { ok: false, code: 'VALIDATION_ERROR', message: ERR_SELF_MESSAGE }
  }

  try {
    const eligibility = await checkInteractionEligibility(userId, targetUserId)
    if (!eligibility.ok) {
      return {
        ok: false,
        code: eligibility.reason === 'blocked' ? 'FORBIDDEN' : 'NOT_FOUND',
        message: eligibility.reason === 'blocked' ? ERR_MESSAGE_BLOCKED : ERR_USER_NOT_FOUND,
      }
    }

    const existing = await prisma.conversation.findFirst({
      where: {
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: targetUserId } } },
        ],
      },
    })

    if (existing) {
      return { ok: true, data: { conversationId: existing.id } }
    }

    const conversation = await prisma.conversation.create({
      data: {
        participants: { create: [{ userId }, { userId: targetUserId }] },
      },
    })

    return { ok: true, data: { conversationId: conversation.id } }
  } catch (error) {
    logger.error('startConversation error', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      targetUserId,
    })
    return { ok: false, code: 'INTERNAL_ERROR', message: ERR_CONVERSATION_CREATE_FAILED }
  }
}

// ─── listConversationMessages ─────────────────────────────────────────────────

/**
 * 会話のメッセージ一覧を取得する（参加者のみ）。
 * createdAt DESC 取得後に昇順に反転して返す（ポーリング前提: 呼ぶたびに lastReadAt 更新）。
 * nextCursor は最古メッセージの id で、次回呼び出しでより古いメッセージを取得できる。
 */
export async function listConversationMessages(
  userId: string,
  conversationId: string,
  cursor?: string,
  limit?: number,
): Promise<MessageServiceResult<{ items: MessageItem[]; nextCursor: string | null }>> {
  try {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    })
    if (!participant) {
      return { ok: false, code: 'FORBIDDEN', message: ERR_CONVERSATION_ACCESS_DENIED }
    }

    const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination({
      cursor,
      // limit 未指定時は MESSAGES_PAGE_LIMIT をデフォルトとして使う
      limit: limit ?? MESSAGES_PAGE_LIMIT,
    })

    const messages = await prisma.message.findMany({
      where: { conversationId },
      include: { sender: USER_MINIMAL_RELATION },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
      ...(safeCursor && { cursor: { id: safeCursor }, skip: 1 }),
    })

    // messages は DESC（新→古）。既読時刻を更新してから反転する。
    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    })

    // messages[0] は DESC 先頭 = 最新メッセージ。reverse() 後は最古が messages[0] になる。
    // nextCursor は「さらに古い」ページ取得用の最古メッセージ id（reverse 前に確定する）。
    const nextCursorId = messages.length === safeLimit ? messages[messages.length - 1]?.id : null

    const items: MessageItem[] = messages.reverse().map((msg) => ({
      id: msg.id,
      conversationId: msg.conversationId,
      content: msg.content,
      senderId: msg.senderId,
      sender: msg.sender,
      createdAt: msg.createdAt,
    }))

    return { ok: true, data: { items, nextCursor: nextCursorId ?? null } }
  } catch (error) {
    logger.error('listConversationMessages error', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      conversationId,
    })
    return { ok: false, code: 'INTERNAL_ERROR', message: ERR_MESSAGE_FETCH_FAILED }
  }
}

// ─── sendDirectMessage ────────────────────────────────────────────────────────

/**
 * メッセージを送信する。
 * 参加者確認 → 日次上限 → ブロック（会話作成後に発生した可能性）→ サニタイズ → 保存の順。
 * 相手への通知は fire-and-forget（失敗してもメッセージ送信自体は成功扱い）。
 */
export async function sendDirectMessage(
  userId: string,
  conversationId: string,
  content: string,
): Promise<MessageServiceResult<{ message: MessageItem }>> {
  // content の長さバリデーションは呼び出し元（route handler の Zod）が担う前提だが、
  // サービス層でも MAX_MESSAGE_LENGTH を超えていたら防御的に拒否する。
  if (content.trim().length === 0 || content.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: content.trim().length === 0
        ? ERR_MESSAGE_CONTENT_REQUIRED
        : ERR_MESSAGE_TOO_LONG(MAX_MESSAGE_LENGTH),
    }
  }

  try {
    const today = getStartOfToday()
    const [participant, todayMessageCount, otherParticipant] = await Promise.all([
      prisma.conversationParticipant.findUnique({
        where: { conversationId_userId: { conversationId, userId } },
      }),
      prisma.message.count({ where: { senderId: userId, createdAt: { gte: today } } }),
      prisma.conversationParticipant.findFirst({
        where: { conversationId, userId: { not: userId } },
      }),
    ])

    if (!participant) {
      return { ok: false, code: 'FORBIDDEN', message: ERR_CONVERSATION_ACCESS_DENIED }
    }

    if (todayMessageCount >= DAILY_MESSAGE_LIMIT) {
      return { ok: false, code: 'VALIDATION_ERROR', message: ERR_MESSAGE_DAILY_LIMIT }
    }

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
      if (blocked) {
        return { ok: false, code: 'FORBIDDEN', message: ERR_MESSAGE_BLOCKED }
      }
    }

    const sanitizedContent = sanitizeMessageContent(content)

    const message = await prisma.message.create({
      data: { conversationId, senderId: userId, content: sanitizedContent },
      include: { sender: USER_MINIMAL_RELATION },
    })

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    if (otherParticipant) {
      void createNotification({
        userId: otherParticipant.userId,
        actorId: userId,
        type: 'message',
      }).catch((err) => {
        logger.error('Message notification dispatch error', {
          error: err instanceof Error ? err.message : String(err),
          conversationId,
        })
      })
    }

    const item: MessageItem = {
      id: message.id,
      conversationId: message.conversationId,
      content: message.content,
      senderId: message.senderId,
      sender: message.sender,
      createdAt: message.createdAt,
    }

    return { ok: true, data: { message: item } }
  } catch (error) {
    logger.error('sendDirectMessage error', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      conversationId,
    })
    return { ok: false, code: 'INTERNAL_ERROR', message: ERR_MESSAGE_SEND_FAILED }
  }
}

// ─── deleteDirectMessage ──────────────────────────────────────────────────────

/**
 * 自分が送信したメッセージを削除する。他人のメッセージは削除不可。
 * 不存在は NOT_FOUND、他人のメッセージは FORBIDDEN で返す。
 */
export async function deleteDirectMessage(
  userId: string,
  messageId: string,
): Promise<MessageServiceResult<void>> {
  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true },
    })

    if (!message) {
      return { ok: false, code: 'NOT_FOUND', message: ERR_MESSAGE_NOT_FOUND }
    }

    if (message.senderId !== userId) {
      return { ok: false, code: 'FORBIDDEN', message: ERR_MESSAGE_DELETE_DENIED }
    }

    await prisma.message.delete({ where: { id: messageId } })

    return { ok: true, data: undefined }
  } catch (error) {
    logger.error('deleteDirectMessage error', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      messageId,
    })
    return { ok: false, code: 'INTERNAL_ERROR', message: ERR_MESSAGE_SEND_FAILED }
  }
}

// ─── markConversationRead ─────────────────────────────────────────────────────

/**
 * 会話の既読時刻を現在時刻に更新する（参加者のみ）。
 */
export async function markConversationRead(
  userId: string,
  conversationId: string,
): Promise<MessageServiceResult<void>> {
  try {
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    })

    if (!participant) {
      return { ok: false, code: 'FORBIDDEN', message: ERR_CONVERSATION_ACCESS_DENIED }
    }

    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    })

    return { ok: true, data: undefined }
  } catch (error) {
    logger.error('markConversationRead error', {
      error: error instanceof Error ? error.message : String(error),
      userId,
      conversationId,
    })
    return { ok: false, code: 'INTERNAL_ERROR', message: ERR_MESSAGE_READ_FAILED }
  }
}
