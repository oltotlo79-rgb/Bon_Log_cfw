'use server'

import { prisma } from '@/lib/db'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { ERR_ACCOUNT_DELETE_FAILED } from '@/lib/constants/errors'
import logger from '@/lib/logger'

export async function deleteAccount() {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
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
          OR: [
            { userId },
            { actorId: userId },
          ],
        },
      })

      // ユーザーを削除（カスケード削除で残りのデータも削除される）
      await tx.user.delete({
        where: { id: userId },
      })
    })

    return actionSuccess()
  } catch (error) {
    logger.error('Account deletion error:', error)
    return actionError(ERR_ACCOUNT_DELETE_FAILED)
  }
}
