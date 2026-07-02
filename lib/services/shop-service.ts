/**
 * @module lib/services/shop-service
 * モバイル API v1 向け盆栽園マップ CRUD サービス層。
 *
 * 認証・レート制限は呼び出し元（route handler）が担う前提。
 * Web の lib/actions/shop.ts / lib/actions/review.ts と同等のロジックを
 * Bearer 経路向けに提供する。Web 側 Server Actions は無編集。
 */

import 'server-only'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT, GENRE_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { Prisma } from '@prisma/client'
import { getCachedShopRatings, revalidateShopRatingsCache } from '@/lib/cache'
import { canUserEditShop } from '@/lib/services/authorization'
import { assertMediaUrlsFromOwnStorage } from '@/lib/services/media-url-validator'
import { sanitizeText } from '@/lib/sanitize'
import logger from '@/lib/logger'
import {
  MAX_SHOPS_LIMIT,
  MAX_REVIEWS_PER_SHOP,
  MAX_SHOP_GENRES,
  MAX_SHOP_NAME_LENGTH,
  MAX_SHOP_ADDRESS_LENGTH,
  MAX_SHOP_PHONE_LENGTH,
  MAX_SHOP_URL_LENGTH,
  MAX_SHOP_BUSINESS_HOURS_LENGTH,
  MAX_SHOP_CLOSED_DAYS_LENGTH,
  MIN_RATING,
  MAX_RATING,
  MAX_REVIEW_IMAGES,
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  MAX_NOTIFICATION_ID_LENGTH,
  MAX_MAP_PINS_LIMIT,
} from '@/lib/constants/limits'
import {
  ERR_SHOP_NOT_FOUND,
  ERR_SHOP_DUPLICATE_ADDRESS,
  ERR_SHOP_CREATE_FAILED,
  ERR_SHOP_UPDATE_FAILED,
  ERR_EDIT_PERMISSION_DENIED,
  ERR_INVALID_INPUT,
  ERR_REVIEW_ALREADY_EXISTS,
  ERR_INVALID_GENRE,
  ERR_OPERATION_FAILED,
  ERR_SHOP_NAME_REQUIRED,
  ERR_SHOP_ADDRESS_REQUIRED,
  ERR_RATING_RANGE,
  ERR_REVIEW_IMAGE_LIMIT,
} from '@/lib/constants/errors'
import { PREFECTURES, REGION_NAME_LIST, isRegionName, getPrefecturesByRegion } from '@/lib/prefectures'
import { containsInsensitive } from '@/lib/actions/prisma-filters'
import { SHOP_SORT_BY_VALUES, type ShopSortByValue } from '@/lib/api/v1/schemas/request'

// ──────────────────────────────────────────────────
// 盆栽園一覧の sortBy 型エイリアス
// ──────────────────────────────────────────────────

export type ShopSortBy = ShopSortByValue

export { SHOP_SORT_BY_VALUES }

// ──────────────────────────────────────────────────
// Zod スキーマ
// ──────────────────────────────────────────────────

/** region クエリパラメータで許可される値の配列（OpenAPI enum 生成用）。 */
export const SHOP_REGION_VALUES = REGION_NAME_LIST as readonly string[]

/** GET /api/v1/shops クエリパラメータスキーマ */
export const listShopsV1QuerySchema = z.object({
  cursor: z.string().max(MAX_NOTIFICATION_ID_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  search: z.string().max(MAX_SHOP_NAME_LENGTH).optional(),
  genreId: z.string().max(MAX_NOTIFICATION_ID_LENGTH).optional(),
  prefecture: z
    .string()
    .max(20)
    .optional()
    .refine(
      (v) => v === undefined || (PREFECTURES as readonly string[]).includes(v),
      { message: ERR_INVALID_INPUT },
    ),
  sortBy: z.enum(SHOP_SORT_BY_VALUES).optional(),
  region: z.string().optional().refine(
    (v) => v === undefined || isRegionName(v),
    { message: ERR_INVALID_INPUT },
  ),
})
export type ListShopsV1Query = z.infer<typeof listShopsV1QuerySchema>

/**
 * POST /api/v1/shops リクエストボディスキーマ。
 * Web の shopSchema と同等のフィールド検証（FormData ではなく JSON ボディ用）。
 */
export const createShopV1Schema = z.object({
  name: z.string().min(1, ERR_SHOP_NAME_REQUIRED).max(MAX_SHOP_NAME_LENGTH),
  address: z.string().min(1, ERR_SHOP_ADDRESS_REQUIRED).max(MAX_SHOP_ADDRESS_LENGTH),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  phone: z.string().max(MAX_SHOP_PHONE_LENGTH).nullable().optional(),
  website: z
    .string()
    .max(MAX_SHOP_URL_LENGTH)
    .nullable()
    .optional()
    .refine(
      (v) => v == null || v === '' || /^https?:\/\//i.test(v),
      { message: 'website は http(s) URL でなければなりません' },
    ),
  businessHours: z.string().max(MAX_SHOP_BUSINESS_HOURS_LENGTH).nullable().optional(),
  closedDays: z.string().max(MAX_SHOP_CLOSED_DAYS_LENGTH).nullable().optional(),
  genreIds: z.array(z.string()).max(MAX_SHOP_GENRES).default([]),
})
export type CreateShopV1Input = z.infer<typeof createShopV1Schema>

/**
 * PATCH /api/v1/shops/{id} リクエストボディスキーマ。
 * すべてのフィールドが optional（部分更新）。
 */
export const updateShopV1Schema = z.object({
  name: z.string().min(1, ERR_SHOP_NAME_REQUIRED).max(MAX_SHOP_NAME_LENGTH).optional(),
  address: z.string().min(1, ERR_SHOP_ADDRESS_REQUIRED).max(MAX_SHOP_ADDRESS_LENGTH).optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  phone: z.string().max(MAX_SHOP_PHONE_LENGTH).nullable().optional(),
  website: z
    .string()
    .max(MAX_SHOP_URL_LENGTH)
    .nullable()
    .optional()
    .refine(
      (v) => v == null || v === '' || /^https?:\/\//i.test(v),
      { message: 'website は http(s) URL でなければなりません' },
    ),
  businessHours: z.string().max(MAX_SHOP_BUSINESS_HOURS_LENGTH).nullable().optional(),
  closedDays: z.string().max(MAX_SHOP_CLOSED_DAYS_LENGTH).nullable().optional(),
  genreIds: z.array(z.string()).max(MAX_SHOP_GENRES).optional(),
})
export type UpdateShopV1Input = z.infer<typeof updateShopV1Schema>

/** GET /api/v1/shops/{id}/reviews クエリパラメータスキーマ */
export const listReviewsV1QuerySchema = z.object({
  cursor: z.string().max(MAX_NOTIFICATION_ID_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
})
export type ListReviewsV1Query = z.infer<typeof listReviewsV1QuerySchema>

/**
 * POST /api/v1/shops/{id}/reviews リクエストボディスキーマ。
 * rating は数値として受け取る（Web は FormData の文字列とは異なる）。
 * mediaUrls は自社ストレージ URL のみ許可。
 */
export const createReviewV1Schema = z.object({
  rating: z
    .number({ message: ERR_RATING_RANGE })
    .int(ERR_RATING_RANGE)
    .min(MIN_RATING, ERR_RATING_RANGE)
    .max(MAX_RATING, ERR_RATING_RANGE),
  content: z.string().nullable().optional(),
  mediaUrls: z.array(z.string()).max(MAX_REVIEW_IMAGES, ERR_REVIEW_IMAGE_LIMIT).default([]),
})
export type CreateReviewV1Input = z.infer<typeof createReviewV1Schema>

/** GET /api/v1/genres クエリパラメータスキーマ */
export const listGenresV1QuerySchema = z.object({
  type: z.enum(['shop', 'post']).default('shop'),
})
export type ListGenresV1Query = z.infer<typeof listGenresV1QuerySchema>

// ──────────────────────────────────────────────────
// Prisma include
// ──────────────────────────────────────────────────

const SHOP_LIST_INCLUDE = {
  creator: { select: USER_MINIMAL_SELECT },
  genres: { select: { genre: { select: GENRE_MINIMAL_SELECT } } },
  _count: { select: { reviews: { where: { isHidden: false } } } },
} as const satisfies Prisma.BonsaiShopInclude

const REVIEW_LIST_INCLUDE = {
  user: { select: USER_MINIMAL_SELECT },
  images: true,
} as const satisfies Prisma.ShopReviewInclude

// ──────────────────────────────────────────────────
// 内部型エイリアス
// ──────────────────────────────────────────────────

type ShopRow = Prisma.BonsaiShopGetPayload<{ include: typeof SHOP_LIST_INCLUDE }>

type ReviewRow = Prisma.ShopReviewGetPayload<{ include: typeof REVIEW_LIST_INCLUDE }>

// ──────────────────────────────────────────────────
// フォーマット関数
// ──────────────────────────────────────────────────

/** ShopRow を API レスポンス形式に変換する。isOwner は呼び出し側で付与する。 */
function formatShopForApi(
  shop: ShopRow,
  averageRating: number | null,
  reviewCount: number,
  requestUserId: string | null,
) {
  const latitude = shop.latitude !== null ? Number(shop.latitude.toString()) : null
  const longitude = shop.longitude !== null ? Number(shop.longitude.toString()) : null

  return {
    id: shop.id,
    name: shop.name,
    address: shop.address,
    latitude,
    longitude,
    phone: shop.phone,
    website: shop.website,
    businessHours: shop.businessHours,
    closedDays: shop.closedDays,
    genres: shop.genres.map((sg) => ({ id: sg.genre.id, name: sg.genre.name })),
    averageRating,
    reviewCount,
    isOwner: requestUserId !== null ? requestUserId === shop.createdBy : false,
  }
}

/** ReviewRow を API レスポンス形式に変換する。 */
function formatReviewForApi(review: ReviewRow) {
  return {
    id: review.id,
    rating: review.rating,
    content: review.content,
    images: review.images.map((img) => ({ url: img.url })),
    user: {
      id: review.user.id,
      nickname: review.user.nickname,
      avatarUrl: review.user.avatarUrl,
    },
    createdAt: review.createdAt.toISOString(),
  }
}

// ──────────────────────────────────────────────────
// 内部ヘルパー
// ──────────────────────────────────────────────────

type ShopFindManyOrderBy = Prisma.BonsaiShopFindManyArgs['orderBy']

/**
 * sortBy 指定を Prisma の orderBy に変換する。
 * rating ソートは DB 集計不可のため listShopsV1 内でメモリソートする。
 */
function buildShopOrderBy(sortBy: ShopSortBy): ShopFindManyOrderBy {
  switch (sortBy) {
    case 'name':
      return { name: 'asc' }
    case 'newest':
      return { createdAt: 'desc' }
    case 'location':
      return [{ latitude: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }]
    case 'rating':
    default:
      return { createdAt: 'desc' }
  }
}

/**
 * isHidden 除外・検索・都道府県/地方フィルタを含む where 節を構築する。
 * prefecture が指定されている場合は prefecture を優先（region より狭い絞り込み）。
 * region のみ指定の場合は getPrefecturesByRegion で都道府県群に展開して OR 絞り込み。
 */
function buildShopWhereClause(options: {
  search?: string
  genreId?: string
  prefecture?: string
  region?: string
  cursor?: string
}): Prisma.BonsaiShopWhereInput {
  const { search, genreId, prefecture, region, cursor } = options
  const andConditions: Prisma.BonsaiShopWhereInput[] = []

  if (search) {
    andConditions.push({
      OR: [
        { name: containsInsensitive(search) },
        { address: containsInsensitive(search) },
      ],
    })
  }

  if (prefecture) {
    andConditions.push({ address: { startsWith: prefecture } })
  } else if (region && isRegionName(region)) {
    const prefs = getPrefecturesByRegion(region)
    if (prefs.length > 0) {
      andConditions.push({
        OR: prefs.map((pref) => ({ address: { startsWith: pref } })),
      })
    }
  }

  return {
    isHidden: false,
    ...(genreId && { genres: { some: { genreId } } }),
    ...(andConditions.length > 0 && { AND: andConditions }),
    ...(cursor && { id: { lt: cursor } }),
  }
}

// ──────────────────────────────────────────────────
// Service 関数 — 盆栽園
// ──────────────────────────────────────────────────

/**
 * GET /api/v1/shops — 盆栽園一覧をカーソルページネーションで取得する。
 *
 * Web の getShops は全件取得（MAX_SHOPS_LIMIT=300）+ インメモリ rating ソートの戦略を採る。
 * v1 も同じ戦略で実装し、Web と同等の地図描画品質を確保する。
 * cursor はカーソルキー（BonsaiShop.id の lt フィルタ）として機能する。
 */
export async function listShopsV1(
  query: ListShopsV1Query,
  requestUserId: string | null,
): Promise<{
  ok: true
  items: ReturnType<typeof formatShopForApi>[]
  nextCursor: string | null
} | { ok: false; error: string }> {
  try {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT
    const sortBy: ShopSortBy = query.sortBy ?? 'location'

    const [shops, ratingAggs] = await Promise.all([
      prisma.bonsaiShop.findMany({
        where: buildShopWhereClause({
          search: query.search,
          genreId: query.genreId,
          prefecture: query.prefecture,
          region: query.region,
          cursor: query.cursor,
        }),
        include: SHOP_LIST_INCLUDE,
        orderBy: buildShopOrderBy(sortBy),
        take: MAX_SHOPS_LIMIT,
      }),
      getCachedShopRatings(),
    ])

    const ratingMap = new Map(
      ratingAggs.map((r) => [r.shopId, { avg: r._avg.rating, count: r._count.rating }])
    )

    type ShopWithRating = ReturnType<typeof formatShopForApi>
    let result: ShopWithRating[] = shops.map((shop) => {
      const ratingData = ratingMap.get(shop.id)
      const averageRating = ratingData?.avg ?? null
      const reviewCount = shop._count?.reviews ?? ratingData?.count ?? 0
      return formatShopForApi(shop, averageRating, reviewCount, requestUserId)
    })

    if (sortBy === 'rating') {
      result = result.sort((a, b) => {
        if (a.averageRating === null && b.averageRating === null) return 0
        if (a.averageRating === null) return 1
        if (b.averageRating === null) return -1
        return b.averageRating - a.averageRating
      })
    }

    const hasNext = result.length > limit
    const page = hasNext ? result.slice(0, limit) : result
    const nextCursor = hasNext ? (page[page.length - 1]?.id ?? null) : null

    return { ok: true, items: page, nextCursor }
  } catch (error) {
    logger.error('listShopsV1 failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

/**
 * GET /api/v1/shops/{id} — 盆栽園詳細を取得する。
 *
 * Web の getShop と同等のロジック。レビューは別エンドポイント（GET /api/v1/shops/{id}/reviews）で
 * カーソルページネーションに分離しているため、詳細レスポンスにはレビューを含まない。
 */
export async function getShopV1(
  shopId: string,
  requestUserId: string | null,
): Promise<{
  ok: true
  shop: ReturnType<typeof formatShopForApi>
} | { ok: false; error: string }> {
  try {
    const [shop, ratingAgg] = await Promise.all([
      prisma.bonsaiShop.findUnique({
        where: { id: shopId, isHidden: false },
        include: SHOP_LIST_INCLUDE,
      }),
      prisma.shopReview.aggregate({
        where: { shopId, isHidden: false },
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ])

    if (!shop) {
      return { ok: false, error: ERR_SHOP_NOT_FOUND }
    }

    const averageRating = ratingAgg._avg.rating ?? null
    const reviewCount = ratingAgg._count.rating

    return {
      ok: true,
      shop: formatShopForApi(shop, averageRating, reviewCount, requestUserId),
    }
  } catch (error) {
    logger.error('getShopV1 failed', {
      shopId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

/** POST /api/v1/shops — 盆栽園を新規登録する。 */
export async function createShopV1(
  input: CreateShopV1Input,
  userId: string,
): Promise<{ ok: true; shop: { id: string } } | { ok: false; error: string; existingId?: string }> {
  const trimmedAddress = input.address.trim()

  const existing = await prisma.bonsaiShop.findFirst({
    where: { address: trimmedAddress },
    select: { id: true },
  })

  if (existing) {
    return {
      ok: false,
      error: ERR_SHOP_DUPLICATE_ADDRESS,
      existingId: existing.id,
    }
  }

  if (input.genreIds.length > 0) {
    const validGenres = await prisma.genre.findMany({
      where: { id: { in: input.genreIds }, type: 'shop' },
      select: { id: true },
    })
    if (validGenres.length !== input.genreIds.length) {
      return { ok: false, error: ERR_INVALID_GENRE }
    }
  }

  try {
    const shop = await prisma.bonsaiShop.create({
      data: {
        name: sanitizeText(input.name.trim()),
        address: trimmedAddress,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        phone: input.phone?.trim() || null,
        website: input.website?.trim() || null,
        businessHours: input.businessHours?.trim() || null,
        closedDays: input.closedDays?.trim() || null,
        createdBy: userId,
        genres:
          input.genreIds.length > 0
            ? { create: input.genreIds.map((genreId) => ({ genreId })) }
            : undefined,
      },
      select: { id: true },
    })

    return { ok: true, shop: { id: shop.id } }
  } catch (error) {
    logger.error('createShopV1 failed', {
      userId,
      address: trimmedAddress,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_SHOP_CREATE_FAILED }
  }
}

/**
 * PATCH /api/v1/shops/{id} — 盆栽園を部分更新する。
 * 作成者または管理者のみ実行可能（Web の canUserEditShop と同等）。
 */
export async function updateShopV1(
  shopId: string,
  input: UpdateShopV1Input,
  userId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const authz = await canUserEditShop(userId, shopId)
  if (!authz.allowed) {
    if (authz.reason === 'Shop not found') {
      return { ok: false, error: ERR_SHOP_NOT_FOUND }
    }
    return { ok: false, error: ERR_EDIT_PERMISSION_DENIED }
  }

  if (input.genreIds !== undefined && input.genreIds.length > 0) {
    const validGenres = await prisma.genre.findMany({
      where: { id: { in: input.genreIds }, type: 'shop' },
      select: { id: true },
    })
    if (validGenres.length !== input.genreIds.length) {
      return { ok: false, error: ERR_INVALID_GENRE }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (input.genreIds !== undefined) {
        await tx.shopGenre.deleteMany({ where: { shopId } })
      }

      await tx.bonsaiShop.update({
        where: { id: shopId },
        data: {
          ...(input.name !== undefined && { name: sanitizeText(input.name.trim()) }),
          ...(input.address !== undefined && { address: input.address.trim() }),
          ...(input.latitude !== undefined && { latitude: input.latitude }),
          ...(input.longitude !== undefined && { longitude: input.longitude }),
          ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
          ...(input.website !== undefined && { website: input.website?.trim() || null }),
          ...(input.businessHours !== undefined && {
            businessHours: input.businessHours?.trim() || null,
          }),
          ...(input.closedDays !== undefined && { closedDays: input.closedDays?.trim() || null }),
          ...(input.genreIds !== undefined &&
            input.genreIds.length > 0 && {
              genres: { create: input.genreIds.map((genreId) => ({ genreId })) },
            }),
        },
      })
    })

    return { ok: true }
  } catch (error) {
    logger.error('updateShopV1 failed', {
      userId,
      shopId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_SHOP_UPDATE_FAILED }
  }
}

// ──────────────────────────────────────────────────
// Service 関数 — レビュー
// ──────────────────────────────────────────────────

/**
 * GET /api/v1/shops/{id}/reviews — 盆栽園レビュー一覧をカーソルページネーションで取得する。
 * Web の getReviews と同等のロジック。isHidden=true は除外しない（Web に倣う）。
 */
export async function listReviewsV1(
  shopId: string,
  query: ListReviewsV1Query,
): Promise<{
  ok: true
  items: ReturnType<typeof formatReviewForApi>[]
  nextCursor: string | null
} | { ok: false; error: string }> {
  try {
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT
    const safeLimit = Math.min(limit + 1, MAX_REVIEWS_PER_SHOP)

    const reviews = await prisma.shopReview.findMany({
      where: {
        shopId,
        ...(query.cursor && { id: { lt: query.cursor } }),
      },
      include: REVIEW_LIST_INCLUDE,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: safeLimit,
    })

    const hasNext = reviews.length > limit
    const page = hasNext ? reviews.slice(0, limit) : reviews
    const nextCursor = hasNext ? (page[page.length - 1]?.id ?? null) : null

    return {
      ok: true,
      items: page.map(formatReviewForApi),
      nextCursor,
    }
  } catch (error) {
    logger.error('listReviewsV1 failed', {
      shopId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

/**
 * POST /api/v1/shops/{id}/reviews — レビューを投稿する。
 * - @@unique([shopId, userId]) の二重投稿は 409 CONFLICT で返す（ok: false, conflict: true）。
 * - mediaUrls は assertMediaUrlsFromOwnStorage で自社ストレージのみ許可。
 */
export async function createReviewV1(
  shopId: string,
  input: CreateReviewV1Input,
  userId: string,
): Promise<
  | { ok: true; review: ReturnType<typeof formatReviewForApi> }
  | { ok: false; error: string; conflict?: boolean }
> {
  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId, isHidden: false },
    select: { id: true },
  })

  if (!shop) {
    return { ok: false, error: ERR_SHOP_NOT_FOUND }
  }

  if (input.mediaUrls.length > 0 && !assertMediaUrlsFromOwnStorage(input.mediaUrls)) {
    return { ok: false, error: ERR_INVALID_INPUT }
  }

  const existing = await prisma.shopReview.findUnique({
    where: { shopId_userId: { shopId, userId } },
    select: { id: true },
  })

  if (existing) {
    return { ok: false, error: ERR_REVIEW_ALREADY_EXISTS, conflict: true }
  }

  try {
    const review = await prisma.shopReview.create({
      data: {
        shopId,
        userId,
        rating: input.rating,
        content: input.content?.trim() || null,
        images:
          input.mediaUrls.length > 0
            ? { create: input.mediaUrls.map((url) => ({ url })) }
            : undefined,
      },
      include: REVIEW_LIST_INCLUDE,
    })

    revalidateShopRatingsCache()

    return { ok: true, review: formatReviewForApi(review) }
  } catch (error) {
    logger.error('createReviewV1 failed', {
      userId,
      shopId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

// ──────────────────────────────────────────────────
// Service 関数 — ジャンル
// ──────────────────────────────────────────────────

/**
 * GET /api/v1/genres?type=shop|post — ジャンル一覧を type フィルタで取得する。
 * Web の getShopGenres と同等（type=shop のみ）。type=post でも対応できる形で実装。
 */
export async function listGenresV1(query: ListGenresV1Query): Promise<{
  ok: true
  items: Array<{ id: string; name: string }>
} | { ok: false; error: string }> {
  try {
    const genres = await prisma.genre.findMany({
      where: { type: query.type },
      select: { id: true, name: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    })

    return { ok: true, items: genres }
  } catch (error) {
    logger.error('listGenresV1 failed', {
      type: query.type,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}

// ──────────────────────────────────────────────────
// Service 関数 — マップピン（M-1）
// ──────────────────────────────────────────────────

type ShopMapPin = {
  id: string
  name: string
  latitude: number
  longitude: number
  address: string
  averageRating: number | null
  reviewCount: number
}

/**
 * GET /api/v1/shops/map-pins — 位置情報付き店舗を全件取得してマーカー用軽量形式で返す。
 *
 * lat/lng が null の店舗は where で除外する。Decimal → number 変換は formatShopForApi パターンに倣う。
 * ratings は getCachedShopRatings() を Promise.all で並列取得して付与する。
 */
export async function getShopMapPinsV1(): Promise<{
  ok: true
  items: ShopMapPin[]
} | { ok: false; error: string }> {
  try {
    const [shops, ratingAggs] = await Promise.all([
      prisma.bonsaiShop.findMany({
        where: {
          isHidden: false,
          latitude: { not: null },
          longitude: { not: null },
        },
        select: {
          id: true,
          name: true,
          address: true,
          latitude: true,
          longitude: true,
        },
        orderBy: { name: 'asc' },
        take: MAX_MAP_PINS_LIMIT,
      }),
      getCachedShopRatings(),
    ])

    const ratingMap = new Map(
      ratingAggs.map((r) => [r.shopId, { avg: r._avg.rating, count: r._count.rating }])
    )

    const items: ShopMapPin[] = shops.map((shop) => {
      const ratingData = ratingMap.get(shop.id)
      return {
        id: shop.id,
        name: shop.name,
        // where 条件で null を除外済みだが Prisma 型は Decimal | null のため変換
        latitude: shop.latitude !== null ? Number(shop.latitude.toString()) : 0,
        longitude: shop.longitude !== null ? Number(shop.longitude.toString()) : 0,
        address: shop.address,
        averageRating: ratingData?.avg ?? null,
        reviewCount: ratingData?.count ?? 0,
      }
    })

    return { ok: true, items }
  } catch (error) {
    logger.error('getShopMapPinsV1 failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, error: ERR_OPERATION_FAILED }
  }
}
