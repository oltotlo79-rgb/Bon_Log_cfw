/**
 * ダイレクトメッセージ機能のServer Actions（バレル再エクスポート）
 *
 * 実装は以下に分割:
 * - message-conversations.ts : getOrCreateConversation, getConversations,
 *                              getConversation, getUnreadMessageCount, markAsRead
 * - message-messages.ts      : sendMessage, getMessages, deleteMessage
 *
 * @module lib/actions/message
 */

'use server'

import { MESSAGES_PAGE_LIMIT } from '@/lib/constants/limits'
import {
  getOrCreateConversation as _getOrCreateConversation,
  getConversations as _getConversations,
  getConversation as _getConversation,
  getUnreadMessageCount as _getUnreadMessageCount,
  markAsRead as _markAsRead,
} from './message-conversations'
import {
  sendMessage as _sendMessage,
  getMessages as _getMessages,
  deleteMessage as _deleteMessage,
} from './message-messages'

export async function getOrCreateConversation(targetUserId: string) {
  return _getOrCreateConversation(targetUserId)
}

export async function sendMessage(conversationId: string, content: string) {
  return _sendMessage(conversationId, content)
}

export async function getConversations() {
  return _getConversations()
}

export async function getConversation(conversationId: string) {
  return _getConversation(conversationId)
}

export async function getMessages(conversationId: string, cursor?: string, limit = MESSAGES_PAGE_LIMIT) {
  return _getMessages(conversationId, cursor, limit)
}

export async function getUnreadMessageCount() {
  return _getUnreadMessageCount()
}

export async function markAsRead(conversationId: string) {
  return _markAsRead(conversationId)
}

export async function deleteMessage(messageId: string) {
  return _deleteMessage(messageId)
}
