/**
 * @module lib/services/account-deletion-service
 *
 * モバイル API v1 専用のアカウント削除サービス。
 * lib/actions/user-account.ts の deleteAccount トランザクションを忠実移植する。
 * Web Action (lib/actions/user-account.ts) は無編集。
 *
 * 削除順序は Web と完全一致させる:
 *   1. UserAnalytics（後付リレーションのため明示削除）
 *   2. Message（sentMessages: 送信済みメッセージ）
 *   3. ConversationParticipant（会話参加情報）
 *   4. Notification（actor として送った通知 + 受け取った通知）
 *   5. User（Cascade で残りのすべてのリレーションを自動削除）
 *
 * RefreshToken は User に onDelete: Cascade が設定されているため、
 * User 削除により自動削除される。リフレッシュトークンの失効は Cascade で保証。
 *
 * 認証・認可・レート制限はすべて呼び出し元 route handler が保証している前提。
 */

import { prisma } from '@/lib/db'

/**
 * 指定ユーザーのアカウントをすべてのデータとともに削除する（不可逆）。
 *
 * @param userId 削除対象のユーザー ID（認証済み、ゲスト不可）
 * @throws Prisma トランザクション失敗時に Error をスロー
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // UserAnalytics を明示的に削除（リレーションが後から追加されたため）
    await tx.userAnalytics.deleteMany({
      where: { userId },
    })

    // メッセージ関連
    await tx.message.deleteMany({
      where: { senderId: userId },
    })

    await tx.conversationParticipant.deleteMany({
      where: { userId },
    })

    // 通知関連（actor として送った通知も削除）
    await tx.notification.deleteMany({
      where: {
        OR: [{ userId }, { actorId: userId }],
      },
    })

    // ユーザーを削除（Cascade で残りのデータを自動削除。RefreshToken も含む）
    await tx.user.delete({
      where: { id: userId },
    })
  })
}
