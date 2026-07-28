/**
 * @module lib/services/account-deletion-service
 *
 * モバイル API v1 専用のアカウント削除サービス。
 * lib/actions/user-account.ts の deleteAccount トランザクションを忠実移植する。
 * Web Action (lib/actions/user-account.ts) は無編集。
 *
 * 削除順序は Web と完全一致させる:
 *   1. 所有メディア URL の収集 + ストレージ削除 outbox（StorageDeletionJob）への登録
 *   2. UserAnalytics（後付リレーションのため明示削除）
 *   3. Message（sentMessages: 送信済みメッセージ）
 *   4. ConversationParticipant（会話参加情報）
 *   5. Notification（actor として送った通知 + 受け取った通知）
 *   6. User（Cascade で残りのすべてのリレーションを自動削除）
 *
 * RefreshToken は User に onDelete: Cascade が設定されているため、
 * User 削除により自動削除される。リフレッシュトークンの失効は Cascade で保証。
 *
 * ストレージ実体の削除は transactional outbox パターンで非同期に行う
 * （`app/api/cron/process-storage-deletions` が StorageDeletionJob を処理する）。
 * User 削除と同一トランザクションで outbox 行を作成することで、
 * 「DB 上ユーザーは消えたが削除対象 URL がどこにも記録されない」orphan を防ぐ。
 * outbox 作成に失敗した場合は User 削除自体も rollback される。
 *
 * 認証・認可・レート制限はすべて呼び出し元 route handler が保証している前提。
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import { filterOwnStorageUrls } from '@/lib/services/media-url-validator'
import { ACCOUNT_DELETION_TRANSACTION_TIMEOUT_MS } from '@/lib/constants/limits/storage-deletion'

type TransactionClient = Prisma.TransactionClient

/**
 * ユーザーが所有するメディア URL（ストレージ実体を持つもの）を全て収集する。
 *
 * inventory（2026-07 時点。新しい User 所有メディアモデルを追加した場合はここに追記すること）:
 *   - User.avatarUrl / User.headerUrl
 *   - PostMedia.url            (Post.userId 経由)
 *   - CommentMedia.url         (Comment.userId 経由)
 *   - ShopReviewImage.url      (ShopReview.userId 経由)
 *   - ScheduledPostMedia.url   (ScheduledPost.userId 経由)
 *   - DraftPostMedia.url       (DraftPost.userId 経由)
 *   - BonsaiRecordImage.url    (BonsaiRecord.bonsai.userId 経由)
 *
 * User 削除トランザクション内（cascade 削除の前）で呼ぶ必要がある。
 * 戻り値は重複除去済み・自社ストレージ由来のみにフィルタ済み。
 */
async function collectOwnedMediaUrls(tx: TransactionClient, userId: string): Promise<string[]> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true, headerUrl: true },
  })

  const postMedia = await tx.postMedia.findMany({
    where: { post: { userId } },
    select: { url: true },
  })
  const commentMedia = await tx.commentMedia.findMany({
    where: { comment: { userId } },
    select: { url: true },
  })
  const reviewImages = await tx.shopReviewImage.findMany({
    where: { review: { userId } },
    select: { url: true },
  })
  const scheduledMedia = await tx.scheduledPostMedia.findMany({
    where: { scheduledPost: { userId } },
    select: { url: true },
  })
  const draftMedia = await tx.draftPostMedia.findMany({
    where: { draftPost: { userId } },
    select: { url: true },
  })
  const recordImages = await tx.bonsaiRecordImage.findMany({
    where: { record: { bonsai: { userId } } },
    select: { url: true },
  })

  const rawUrls = [
    user?.avatarUrl,
    user?.headerUrl,
    ...postMedia.map((m) => m.url),
    ...commentMedia.map((m) => m.url),
    ...reviewImages.map((m) => m.url),
    ...scheduledMedia.map((m) => m.url),
    ...draftMedia.map((m) => m.url),
    ...recordImages.map((m) => m.url),
  ]

  const deduped = Array.from(
    new Set(rawUrls.filter((u): u is string => typeof u === 'string' && u.length > 0))
  )

  // 任意外部 URL を削除 outbox に混入させない（allowed-origin 検証）。
  return filterOwnStorageUrls(deduped)
}

/**
 * 指定ユーザーのアカウントをすべてのデータとともに削除する（不可逆）。
 *
 * @param userId 削除対象のユーザー ID（認証済み、ゲスト不可）
 * @throws Prisma トランザクション失敗時に Error をスロー
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const mediaUrls = await collectOwnedMediaUrls(tx, userId)

      // ストレージ削除 outbox への登録。ここで失敗した場合、以降の User 削除も
      // 実行されずトランザクション全体が rollback される（追跡不能な orphan を作らないため）。
      if (mediaUrls.length > 0) {
        await tx.storageDeletionJob.createMany({
          data: mediaUrls.map((url) => ({ url, ownerUserId: userId })),
        })
      }

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
      // StorageDeletionJob は User への FK を持たないため cascade されず、
      // outbox 行としてそのまま残り cron worker の処理対象になる。
      await tx.user.delete({
        where: { id: userId },
      })
    },
    // メディア点数が多いユーザーは既定 5 秒を超え得るため timeout を明示的に延長する。
    { timeout: ACCOUNT_DELETION_TRANSACTION_TIMEOUT_MS }
  )
}
