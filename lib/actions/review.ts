'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { revalidatePath } from 'next/cache'
import logger from '@/lib/logger'
import { revalidateShopRatingsCache } from '@/lib/cache'
import {
  MAX_REVIEW_IMAGES,
  MIN_RATING,
  MAX_RATING,
  MAX_REVIEW_IMAGE_SIZE,
  REVIEWS_PAGE_LIMIT,
} from '@/lib/constants/limits'
import {
  ERR_SHOP_NOT_FOUND,
  ERR_REVIEW_NOT_FOUND,
  ERR_PERMISSION_DENIED,
  ERR_EDIT_PERMISSION_DENIED,
  ERR_RATING_RANGE,
  ERR_REVIEW_IMAGE_LIMIT,
  ERR_REVIEW_ALREADY_EXISTS,
  ERR_IMAGE_ONLY,
  ERR_IMAGE_SIZE_4MB,
  ERR_UPLOAD_FAILED,
  ERR_FILE_NOT_SELECTED,
  ERR_REVIEW_SHOP_ID_REQUIRED,
  ERR_REVIEW_RATING_REQUIRED,
} from '@/lib/constants/errors'
import { requireActiveNonGuestUser, actionSuccess, actionError, enforceUserRateLimit } from '@/lib/actions/utils'
import { actionZodError } from '@/lib/actions/schemas/common'
import { validateImageFile, generateSafeFileName } from '@/lib/file-validation'
import { buildShopPath } from '@/lib/constants/path-builders'
import { STORAGE_FOLDER_REVIEW_IMAGES } from '@/lib/constants/storage'
import type { ActionResult } from '@/types/action-result'

const reviewSchema = z.object({
  shopId: z.string().min(1, ERR_REVIEW_SHOP_ID_REQUIRED),
  rating: z.string().min(1, ERR_REVIEW_RATING_REQUIRED),
  content: z.string().nullable().optional(),
  imageUrls: z.array(z.string()).default([]),
})

const updateReviewSchema = z.object({
  rating: z.string().min(1, ERR_REVIEW_RATING_REQUIRED),
  content: z.string().nullable().optional(),
  newImageUrls: z.array(z.string()).default([]),
  deleteImageIds: z.array(z.string()).default([]),
})

/** 盆栽園に新しいレビューを投稿する。1店舗につき1ユーザー1件まで。 */
export async function createReview(formData: FormData): Promise<ActionResult<{ reviewId: string }>> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = reviewSchema.safeParse({
    shopId: formData.get('shopId') || '',
    rating: formData.get('rating') || '',
    content: formData.get('content') || null,
    imageUrls: formData.getAll('imageUrls'),
  })

  if (!parsed.success) {
    return actionZodError(parsed.error)
  }

  const { shopId, rating: ratingStr, content, imageUrls } = parsed.data

  const rating = parseInt(ratingStr, 10)
  if (isNaN(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    return actionError(ERR_RATING_RANGE)
  }

  if (imageUrls.length > MAX_REVIEW_IMAGES) {
    return actionError(ERR_REVIEW_IMAGE_LIMIT)
  }

  const rl = await enforceUserRateLimit(userId, 'create_review')
  if (rl) return actionError(rl.error)

  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId },
  })

  if (!shop) {
    return actionError(ERR_SHOP_NOT_FOUND)
  }

  const existingReview = await prisma.shopReview.findFirst({
    where: {
      shopId,
      userId,
    },
  })

  if (existingReview) {
    return actionError(ERR_REVIEW_ALREADY_EXISTS)
  }

  const review = await prisma.shopReview.create({
    data: {
      shopId,
      userId,
      rating,
      content: content?.trim() || null,
      images: imageUrls.length > 0
        ? {
            create: imageUrls.map((url: string) => ({ url })),
          }
        : undefined,
    },
  })

  revalidatePath(buildShopPath(shopId))
  revalidateShopRatingsCache()

  return actionSuccess({ reviewId: review.id })
}

/** 既存のレビューを編集する。所有者のみ実行可能。 */
export async function updateReview(reviewId: string, formData: FormData): Promise<ActionResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = updateReviewSchema.safeParse({
    rating: formData.get('rating') || '',
    content: formData.get('content') || null,
    newImageUrls: formData.getAll('imageUrls'),
    deleteImageIds: formData.getAll('deleteImageIds'),
  })
  if (!parsed.success) return actionZodError(parsed.error)

  const rl = await enforceUserRateLimit(userId, 'update_review')
  if (rl) return actionError(rl.error)

  const { rating: ratingStr, content, newImageUrls, deleteImageIds } = parsed.data

  const review = await prisma.shopReview.findUnique({
    where: { id: reviewId },
    select: {
      userId: true,
      shopId: true,
      images: { select: { id: true } },
    },
  })

  if (!review) {
    return actionError(ERR_REVIEW_NOT_FOUND)
  }

  if (review.userId !== userId) {
    return actionError(ERR_EDIT_PERMISSION_DENIED)
  }

  const rating = parseInt(ratingStr, 10)
  if (isNaN(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    return actionError(ERR_RATING_RANGE)
  }

  const existingImageCount = review.images.length
  const remainingImageCount = existingImageCount - deleteImageIds.length
  const totalImageCount = remainingImageCount + newImageUrls.length

  if (totalImageCount > MAX_REVIEW_IMAGES) {
    return actionError(ERR_REVIEW_IMAGE_LIMIT)
  }

  await prisma.$transaction(async (tx) => {
    if (deleteImageIds.length > 0) {
      await tx.shopReviewImage.deleteMany({
        where: {
          id: { in: deleteImageIds },
          reviewId: reviewId,
        },
      })
    }

    if (newImageUrls.length > 0) {
      await tx.shopReviewImage.createMany({
        data: newImageUrls.map((url: string) => ({
          reviewId: reviewId,
          url,
        })),
      })
    }

    await tx.shopReview.update({
      where: { id: reviewId },
      data: {
        rating,
        content: content?.trim() || null,
      },
    })
  })

  revalidatePath(buildShopPath(review.shopId))
  revalidateShopRatingsCache()

  return actionSuccess()
}

/** レビューを削除する。所有者のみ実行可能。 */
export async function deleteReview(reviewId: string): Promise<ActionResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rl = await enforceUserRateLimit(userId, 'delete_review')
  if (rl) return actionError(rl.error)

  const review = await prisma.shopReview.findUnique({
    where: { id: reviewId },
    select: { userId: true, shopId: true },
  })

  if (!review) {
    return actionError(ERR_REVIEW_NOT_FOUND)
  }

  if (review.userId !== userId) {
    return actionError(ERR_PERMISSION_DENIED)
  }

  await prisma.shopReview.delete({
    where: { id: reviewId },
  })

  revalidatePath(buildShopPath(review.shopId))
  revalidateShopRatingsCache()

  return actionSuccess()
}

/** 盆栽園のレビュー一覧をカーソルベースページネーションで取得する。 */
export async function getReviews(shopId: string, cursor?: string, limit = REVIEWS_PAGE_LIMIT) {
  try {
    const reviews = await prisma.shopReview.findMany({
      where: { shopId },
      include: {
        user: {
          select: USER_MINIMAL_SELECT,
        },
        images: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
    })

    const hasMore = reviews.length === limit

    return {
      reviews,
      nextCursor: hasMore ? reviews[reviews.length - 1]?.id : undefined,
    }
  } catch (error) {
    logger.error('getReviews failed', { error: error instanceof Error ? error.message : String(error) })
    return { reviews: [], nextCursor: undefined }
  }
}

/** レビュー用画像をアップロードする。画像形式のみ、最大4MB。 */
export async function uploadReviewImage(formData: FormData): Promise<ActionResult<{ url: string }>> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const rawFile = formData.get('file')
  if (!(rawFile instanceof File)) {
    return actionError(ERR_FILE_NOT_SELECTED)
  }
  const file = rawFile

  if (!file.type.startsWith('image/')) {
    return actionError(ERR_IMAGE_ONLY)
  }

  if (file.size > MAX_REVIEW_IMAGE_SIZE) {
    return actionError(ERR_IMAGE_SIZE_4MB)
  }

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  try {
    const { uploadFile } = await import('@/lib/storage')
    const buffer = Buffer.from(await file.arrayBuffer())

    // マジックバイト検証で偽装 Content-Type を拒否する
    const validation = validateImageFile(buffer, file.type)
    if (!validation.valid) {
      return actionError(validation.error || ERR_IMAGE_ONLY)
    }

    const safeName = generateSafeFileName(file.name, file.type)
    const result = await uploadFile(buffer, safeName, file.type, STORAGE_FOLDER_REVIEW_IMAGES)

    if (!result.success || !result.url) {
      if (result.error) logger.error('Review image upload failed:', result.error)
      return actionError(ERR_UPLOAD_FAILED)
    }

    return actionSuccess({ url: result.url })
  } catch (error) {
    logger.error('Upload review image error', {
      userId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_UPLOAD_FAILED)
  }
}
