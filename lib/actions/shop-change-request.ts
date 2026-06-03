'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { revalidatePath } from 'next/cache'
import {
  requireActiveNonGuestUser,
  requireAdmin,
  actionSuccess,
  actionError,
  enforceUserRateLimit,
} from '@/lib/actions/utils'
import { actionZodError } from '@/lib/actions/schemas/common'
import {
  ERR_SHOP_NOT_FOUND,
  ERR_REGISTRANT_CAN_EDIT,
  ERR_CHANGE_CONTENT_REQUIRED,
  ERR_PENDING_REQUEST_EXISTS,
  ERR_REQUEST_NOT_FOUND,
  ERR_REQUEST_ALREADY_PROCESSED,
} from '@/lib/constants/errors'
import { MAX_SHOP_CHANGE_REASON_LENGTH } from '@/lib/constants/limits'
import { normalizeCursorPagination } from '@/lib/actions/pagination'
import { SHOP_CHANGE_REQUEST_STATUS } from '@/lib/constants/status'
import { ROUTE_SHOPS, ROUTE_ADMIN_SHOP_REQUESTS } from '@/lib/constants/routes'
import { buildShopPath } from '@/lib/constants/path-builders'

import {
  type ShopChangeRequestData,
  shopChangeRequestInputSchema,
  parseShopChangeRequestedChanges,
  hasMeaningfulChanges,
} from '@/lib/shop/change-request'

const createShopChangeRequestSchema = z.object({
  // 入力 ID は cuid を期待するが、長さだけ守らせて DB ルックアップ前に弾く。
  shopId: z.string().trim().min(1).max(64),
  changes: shopChangeRequestInputSchema,
  reason: z.string().trim().max(MAX_SHOP_CHANGE_REASON_LENGTH).optional(),
})

/**
 * 盆栽園の変更リクエストを作成する。登録者以外のユーザーが情報修正を依頼できる。
 *
 * 順序は CLAUDE.md ルール3 に従い「認証 + 非ゲスト + 停止チェック → Zod → レート制限 → ロジック」。
 * client 由来の `changes` は strict schema (`shopChangeRequestInputSchema`) を通り、未知キー / 過大長 /
 * 不正 URL が DB JSON 保存される前に弾かれる。
 */
export async function createShopChangeRequest(
  shopId: string,
  changes: ShopChangeRequestData,
  reason?: string,
) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = createShopChangeRequestSchema.safeParse({ shopId, changes, reason })
  if (!parsed.success) {
    return actionZodError(parsed.error)
  }
  const sanitized = parsed.data

  if (!hasMeaningfulChanges(sanitized.changes)) {
    return actionError(ERR_CHANGE_CONTENT_REQUIRED)
  }

  const rl = await enforceUserRateLimit(userId, 'create_shop_change_request')
  if (rl) return actionError(rl.error)

  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: sanitized.shopId, isHidden: false },
    select: { id: true, createdBy: true },
  })

  if (!shop) {
    return actionError(ERR_SHOP_NOT_FOUND)
  }

  if (shop.createdBy === userId) {
    return actionError(ERR_REGISTRANT_CAN_EDIT)
  }

  const existingRequest = await prisma.shopChangeRequest.findFirst({
    where: {
      shopId: sanitized.shopId,
      userId,
      status: SHOP_CHANGE_REQUEST_STATUS.PENDING,
    },
  })

  if (existingRequest) {
    return actionError(ERR_PENDING_REQUEST_EXISTS)
  }

  const request = await prisma.shopChangeRequest.create({
    data: {
      shopId: sanitized.shopId,
      userId,
      requestedChanges: sanitized.changes,
      reason: sanitized.reason || null,
    },
  })

  return actionSuccess({ requestId: request.id })
}

/** 盆栽園変更リクエスト一覧を取得する（管理者用）。 */
export async function getShopChangeRequests(options?: {
  status?: 'pending' | 'approved' | 'rejected' | 'all'
  cursor?: string
  limit?: number
}) {
  const { status = SHOP_CHANGE_REQUEST_STATUS.PENDING } = options || {}
  const { cursor: safeCursor, limit: safeLimit } = normalizeCursorPagination(options ?? {})

  const admin = await requireAdmin('shops:view')
  if ('error' in admin) return actionError(admin.error)

  const requests = await prisma.shopChangeRequest.findMany({
    where: {
      ...(status !== 'all' && { status }),
    },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          website: true,
          businessHours: true,
          closedDays: true,
        },
      },
      user: {
        select: USER_MINIMAL_SELECT,
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: safeLimit,
    ...(safeCursor && {
      cursor: { id: safeCursor },
      skip: 1,
    }),
  })

  const hasMore = requests.length === safeLimit

  return {
    requests,
    nextCursor: hasMore ? requests[requests.length - 1]?.id : undefined,
  }
}

/** 未対応の盆栽園変更リクエスト数を取得する（管理者用）。 */
export async function getPendingShopChangeRequestCount() {
  const admin = await requireAdmin('shops:view')
  if ('error' in admin) return { count: 0 }

  const count = await prisma.shopChangeRequest.count({
    where: { status: SHOP_CHANGE_REQUEST_STATUS.PENDING },
  })

  return { count }
}

/** 盆栽園変更リクエスト詳細を取得する（管理者用）。 */
export async function getShopChangeRequest(requestId: string) {
  const admin = await requireAdmin('shops:view')
  if ('error' in admin) return actionError(admin.error)

  const request = await prisma.shopChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          website: true,
          businessHours: true,
          closedDays: true,
        },
      },
      user: {
        select: USER_MINIMAL_SELECT,
      },
    },
  })

  if (!request) {
    return actionError(ERR_REQUEST_NOT_FOUND)
  }

  return { request }
}

/** 盆栽園変更リクエストを承認し、盆栽園情報を更新する（管理者用）。 */
export async function approveShopChangeRequest(
  requestId: string,
  adminComment?: string
) {
  const admin = await requireAdmin('shops:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const request = await prisma.shopChangeRequest.findUnique({
    where: { id: requestId },
    include: {
      shop: true,
    },
  })

  if (!request) {
    return actionError(ERR_REQUEST_NOT_FOUND)
  }

  if (request.status !== SHOP_CHANGE_REQUEST_STATUS.PENDING) {
    return actionError(ERR_REQUEST_ALREADY_PROCESSED)
  }

  const changes = parseShopChangeRequestedChanges(request.requestedChanges)

  await prisma.$transaction([
    prisma.bonsaiShop.update({
      where: { id: request.shopId },
      data: {
        ...(changes.name && { name: changes.name }),
        ...(changes.address && { address: changes.address }),
        ...(changes.phone !== undefined && { phone: changes.phone || null }),
        ...(changes.website !== undefined && { website: changes.website || null }),
        ...(changes.businessHours !== undefined && { businessHours: changes.businessHours || null }),
        ...(changes.closedDays !== undefined && { closedDays: changes.closedDays || null }),
      },
    }),
    prisma.shopChangeRequest.update({
      where: { id: requestId },
      data: {
        status: SHOP_CHANGE_REQUEST_STATUS.APPROVED,
        adminComment: adminComment?.trim() || null,
        resolvedAt: new Date(),
      },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUserId,
        action: 'approve_shop_change_request',
        targetType: 'shop_change_request',
        targetId: requestId,
        details: {
          shopId: request.shopId,
          changes,
        },
      },
    }),
  ])

  revalidatePath(ROUTE_SHOPS)
  revalidatePath(buildShopPath(request.shopId))
  revalidatePath(ROUTE_ADMIN_SHOP_REQUESTS)

  return actionSuccess()
}

/** 盆栽園変更リクエストを却下する（管理者用）。 */
export async function rejectShopChangeRequest(
  requestId: string,
  adminComment?: string
) {
  const admin = await requireAdmin('shops:manage')
  if ('error' in admin) return actionError(admin.error)
  const adminUserId = admin.userId

  const request = await prisma.shopChangeRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    return actionError(ERR_REQUEST_NOT_FOUND)
  }

  if (request.status !== SHOP_CHANGE_REQUEST_STATUS.PENDING) {
    return actionError(ERR_REQUEST_ALREADY_PROCESSED)
  }

  await prisma.$transaction([
    prisma.shopChangeRequest.update({
      where: { id: requestId },
      data: {
        status: SHOP_CHANGE_REQUEST_STATUS.REJECTED,
        adminComment: adminComment?.trim() || null,
        resolvedAt: new Date(),
      },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminUserId,
        action: 'reject_shop_change_request',
        targetType: 'shop_change_request',
        targetId: requestId,
        details: {
          shopId: request.shopId,
          reason: adminComment,
        },
      },
    }),
  ])

  revalidatePath(ROUTE_ADMIN_SHOP_REQUESTS)

  return actionSuccess()
}

/** 保留中の変更リクエスト数を取得する（管理者用）。 */
export async function getPendingShopChangeRequestsCount() {
  const admin = await requireAdmin('shops:view')
  if ('error' in admin) return { count: 0 }

  const count = await prisma.shopChangeRequest.count({
    where: { status: SHOP_CHANGE_REQUEST_STATUS.PENDING },
  })

  return { count }
}
