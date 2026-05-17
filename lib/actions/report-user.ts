/**
 * @module lib/actions/report-user
 * 通報作成 (一般ユーザー向け) の Server Action。
 *
 * 処理順序: auth → guest 除外 → Zod 検証 → rate-limit → DB lookup。
 * AUTO_HIDE_THRESHOLD 到達時はここで自動非表示を発火する。
 */

'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  AUTO_HIDE_THRESHOLD,
  REPORT_DESCRIPTION_MAX_LENGTH,
  REPORT_REASON_VALUES,
  REPORT_TARGET_TYPES,
  TARGET_TYPE_LABELS,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/constants/report'
import { REPORT_STATUS } from '@/lib/constants/status'
import { checkUserRateLimit } from '@/lib/rate-limit'
import {
  ERR_ALREADY_REPORTED,
  ERR_CANNOT_REPORT_SELF,
  ERR_INPUT_INVALID_GENERIC,
  ERR_RATE_LIMIT_OPERATION,
  ERR_REPORT_TARGET_NOT_FOUND,
} from '@/lib/constants/errors'
import { requireAuth, requireNotGuest, actionSuccess, actionError } from '@/lib/actions/utils'

/**
 * createReport の runtime 検証 schema。
 * - targetType / reason は enum
 * - targetId は cuid 想定で長さ制限のみ
 * - description は trim 済み optional
 */
const createReportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES),
  targetId: z.string().min(1).max(64),
  reason: z.enum(REPORT_REASON_VALUES),
  description: z
    .string()
    .trim()
    .max(REPORT_DESCRIPTION_MAX_LENGTH)
    .optional(),
})

export type CreateReportParams = z.infer<typeof createReportSchema>

/** 通報対象の所有者 ID を取得する。対象が存在しない場合は null。 */
async function fetchTargetOwnerId(targetType: ReportTargetType, targetId: string): Promise<string | null> {
  switch (targetType) {
    case 'post': {
      const item = await prisma.post.findUnique({ where: { id: targetId }, select: { userId: true } })
      return item?.userId ?? null
    }
    case 'comment': {
      const item = await prisma.comment.findUnique({ where: { id: targetId }, select: { userId: true } })
      return item?.userId ?? null
    }
    case 'event': {
      const item = await prisma.event.findUnique({ where: { id: targetId }, select: { createdBy: true } })
      return item?.createdBy ?? null
    }
    case 'shop': {
      const item = await prisma.bonsaiShop.findUnique({ where: { id: targetId }, select: { createdBy: true } })
      return item?.createdBy ?? null
    }
    case 'review': {
      const item = await prisma.shopReview.findUnique({ where: { id: targetId }, select: { userId: true } })
      return item?.userId ?? null
    }
    case 'user': {
      const item = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true } })
      return item?.id ?? null
    }
  }
}

/** 通報数が AUTO_HIDE_THRESHOLD に達したコンテンツを自動非表示にする。 */
async function autoHideContent(targetType: ReportTargetType, targetId: string, reportCount: number) {
  const now = new Date()

  switch (targetType) {
    case 'post':
      await prisma.post.update({ where: { id: targetId }, data: { isHidden: true, hiddenAt: now } })
      break
    case 'comment':
      await prisma.comment.update({ where: { id: targetId }, data: { isHidden: true, hiddenAt: now } })
      break
    case 'event':
      await prisma.event.update({ where: { id: targetId }, data: { isHidden: true, hiddenAt: now } })
      break
    case 'shop':
      await prisma.bonsaiShop.update({ where: { id: targetId }, data: { isHidden: true, hiddenAt: now } })
      break
    case 'review':
      await prisma.shopReview.update({ where: { id: targetId }, data: { isHidden: true, hiddenAt: now } })
      break
    case 'user':
      // ユーザーは非表示ではなく停止処理
      await prisma.user.update({ where: { id: targetId }, data: { isSuspended: true, suspendedAt: now } })
      break
  }

  await prisma.report.updateMany({
    where: { targetType, targetId, status: REPORT_STATUS.PENDING },
    data: { status: REPORT_STATUS.AUTO_HIDDEN },
  })

  const label = TARGET_TYPE_LABELS[targetType]
  await prisma.adminNotification.create({
    data: {
      type: 'auto_hidden',
      targetType,
      targetId,
      message: `${label}が${reportCount}件の通報を受け自動非表示になりました`,
      reportCount,
    },
  })
}

/**
 * 通報を作成する (認証済み非ゲストユーザーのみ)。
 * 重複・自己通報は拒否。AUTO_HIDE_THRESHOLD 到達時は自動非表示を発火。
 */
export async function createReport(params: unknown) {
  // 1. 認証
  const auth = await requireAuth()
  if ('error' in auth) return actionError(auth.error)
  const guestCheck = await requireNotGuest()
  if (guestCheck) return actionError(guestCheck.error)
  const userId = auth.userId

  // 2. Zod 検証 (rate-limit より前。不正入力で rate-limit 消費を防ぐ)
  const parsed = createReportSchema.safeParse(params)
  if (!parsed.success) {
    return actionError(ERR_INPUT_INVALID_GENERIC)
  }
  const { targetType, targetId, reason, description } = parsed.data

  // 3. レート制限 (検証通過後にだけ消費)
  const rateLimitResult = await checkUserRateLimit(userId, 'create_report')
  if (!rateLimitResult.success) {
    return actionError(ERR_RATE_LIMIT_OPERATION)
  }

  // 4. 対象の所有者 lookup + 自己通報 / 重複の弾き
  const targetUserId = await fetchTargetOwnerId(targetType, targetId)
  if (!targetUserId) return actionError(ERR_REPORT_TARGET_NOT_FOUND)

  if (targetUserId === userId) {
    return actionError(ERR_CANNOT_REPORT_SELF)
  }

  const existing = await prisma.report.findFirst({
    where: { reporterId: userId, targetType, targetId },
  })
  if (existing) {
    return actionError(ERR_ALREADY_REPORTED)
  }

  // 5. レポート作成 + AUTO_HIDE_THRESHOLD 判定
  await prisma.report.create({
    data: {
      reporterId: userId,
      targetType,
      targetId,
      reason: reason satisfies ReportReason,
      description: description || null,
      status: REPORT_STATUS.PENDING,
    },
  })

  const reportCount = await prisma.report.count({ where: { targetType, targetId } })
  if (reportCount >= AUTO_HIDE_THRESHOLD) {
    await autoHideContent(targetType, targetId, reportCount)
  }

  return actionSuccess()
}
