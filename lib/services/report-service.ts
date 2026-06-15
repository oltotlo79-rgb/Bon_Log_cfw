/**
 * @module lib/services/report-service
 * v1 用。Web の lib/actions/report-user と同等のドメインロジックを Bearer 認証経路向けに提供する。
 *
 * 呼び出し元（route handler）が認証・Zod・レート制限を済ませた前提で動作する。
 * Web の lib/actions/report-user.ts は変更しない。
 */

import 'server-only'

import { prisma } from '@/lib/db'
import {
  AUTO_HIDE_THRESHOLD,
  TARGET_TYPE_LABELS,
  type ReportReason,
  type ReportTargetType,
} from '@/lib/constants/report'
import { REPORT_STATUS } from '@/lib/constants/status'
import { revalidateShopRatingsCache } from '@/lib/cache'
import logger from '@/lib/logger'

export type CreateReportServiceInput = {
  reporterId: string
  targetType: ReportTargetType
  targetId: string
  reason: ReportReason
  description?: string
}

export type CreateReportServiceResult =
  | { ok: true }
  | { ok: false; reason: 'self' | 'not_found' | 'already_reported' | 'error' }

/** 通報対象の所有者 ID を取得する。対象が存在しない場合は null。Web の fetchTargetOwnerId と同一ロジック。 */
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

/** 通報数が AUTO_HIDE_THRESHOLD に達したコンテンツを自動非表示にする。Web の autoHideContent と同一ロジック。 */
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

  // review の自動非表示は店舗一覧の集計平均（getCachedShopRatings）に影響するため無効化する
  if (targetType === 'review') revalidateShopRatingsCache()

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
 * 通報を作成する。
 * 対象不在→not_found / 自己通報→self / 重複→already_reported / 成功→ok。
 * AUTO_HIDE_THRESHOLD 到達時は自動非表示を発火する。
 */
export async function createReportService(input: CreateReportServiceInput): Promise<CreateReportServiceResult> {
  const { reporterId, targetType, targetId, reason, description } = input

  const targetOwnerId = await fetchTargetOwnerId(targetType, targetId)
  if (!targetOwnerId) return { ok: false, reason: 'not_found' }

  if (targetOwnerId === reporterId) return { ok: false, reason: 'self' }

  const existing = await prisma.report.findFirst({
    where: { reporterId, targetType, targetId },
  })
  if (existing) return { ok: false, reason: 'already_reported' }

  try {
    await prisma.report.create({
      data: {
        reporterId,
        targetType,
        targetId,
        reason: reason satisfies ReportReason,
        description: description ?? null,
        status: REPORT_STATUS.PENDING,
      },
    })

    const reportCount = await prisma.report.count({ where: { targetType, targetId } })
    if (reportCount >= AUTO_HIDE_THRESHOLD) {
      await autoHideContent(targetType, targetId, reportCount)
    }

    return { ok: true }
  } catch (error) {
    logger.error('createReportService error:', error)
    return { ok: false, reason: 'error' }
  }
}
