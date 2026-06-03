/**
 * @module lib/services/comment-thread-mute
 * コメントスレッドのミュート状態を判定する内部ヘルパ。
 *
 * Why services 層: `'use server'` で公開すると任意の userId に対する
 * mute 状態を列挙可能になり情報漏洩リスク。呼び出し元（Server Component / Action）
 * が認証済み userId を渡す前提で services に隔離する。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'

/**
 * スレッドがミュートされているかチェック
 *
 * @param userId - 認証済みユーザーID（呼び出し元で `auth()` から取得した値のみ渡すこと）
 * @param rootCommentId - ルートコメントのID
 */
export async function isThreadMuted(userId: string, rootCommentId: string): Promise<boolean> {
  try {
    const mute = await prisma.commentThreadMute.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId: rootCommentId,
        },
      },
    })

    return !!mute
  } catch (error) {
    logger.error('Check thread mute error:', error)
    return false
  }
}
