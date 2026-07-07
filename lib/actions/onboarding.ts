/**
 * 初回オンボーディング関連の Server Actions。
 *
 * @module lib/actions/onboarding
 */

'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import logger from '@/lib/logger'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { ERR_OPERATION_FAILED } from '@/lib/constants/errors'
import { ROUTE_FEED } from '@/lib/constants/routes'

/**
 * オンボーディングを完了済みにする（onboardedAt を記録）。
 * 既に完了している場合も冪等に成功を返す。
 */
export async function completeOnboarding() {
  // 1. 認証 (非ゲスト)
  const authResult = await requireActiveNonGuestUser()
  if ('error' in authResult) return actionError(authResult.error)
  const userId = authResult.userId

  // 2. レート制限（入力を持たない Action のため Zod は不要。書き込み系の乱用抑止として軽量制限のみ）
  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { onboardedAt: new Date() },
    })

    revalidatePath(ROUTE_FEED)
    return actionSuccess()
  } catch (error) {
    logger.error('Complete onboarding failed', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_OPERATION_FAILED)
  }
}
