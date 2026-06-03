'use server'

import { z } from 'zod'
import { prisma } from '@/lib/db'
import { USER_MINIMAL_SELECT, USER_MINIMAL_RELATION, GENRE_MINIMAL_SELECT } from '@/lib/prisma/shared-includes'
import { Prisma } from '@prisma/client'
import { getRegionById } from '@/lib/prefectures'
import { auth } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import { requireActiveNonGuestUser, requireAuth, actionSuccess, actionError, type ActionResult, enforceUserRateLimit } from '@/lib/actions/utils'
import { actionZodError } from '@/lib/actions/schemas/common'
import {
  ERR_INVALID_INPUT,
  ERR_SHOP_NOT_FOUND,
  ERR_SHOP_DUPLICATE_ADDRESS,
  ERR_PERMISSION_DENIED,
  ERR_EDIT_PERMISSION_DENIED,
  ERR_SHOP_CREATE_FAILED,
  ERR_SHOP_UPDATE_FAILED,
  ERR_ADDRESS_SEARCH_FAILED,
  ERR_ADDRESS_PARSE_FAILED,
  ERR_ADDRESS_NOT_FOUND,
  ERR_ADDRESS_SEARCH_ERROR,
  ERR_GENRE_LIMIT,
  ERR_INVALID_GENRE,
  ERR_SHOP_NAME_REQUIRED,
  ERR_SHOP_ADDRESS_REQUIRED,
} from '@/lib/constants/errors'
import { MAX_SHOP_GENRES, MAX_ADDRESS_SUGGESTIONS, MIN_SEARCH_QUERY_LENGTH, MAX_ADDRESS_LENGTH, ADDRESS_SEARCH_TIMEOUT_MS, MAX_SHOPS_LIMIT, MAX_REVIEWS_PER_SHOP, GSI_ADDRESS_SEARCH_URL, MAX_NOTIFICATION_ID_LENGTH } from '@/lib/constants/limits'

const shopIdSchema = z.string().min(1).max(MAX_NOTIFICATION_ID_LENGTH)
import { shouldSkipBuildTimeDbAccess } from '@/lib/build/db-availability'
import logger from '@/lib/logger'
import { canUserEditShop } from '@/lib/services/authorization'
import { getCachedShopRatings } from '@/lib/cache'
import { ROUTE_SHOPS } from '@/lib/constants/routes'
import { buildShopPath } from '@/lib/constants/path-builders'
import { containsInsensitive } from '@/lib/actions/prisma-filters'

/**
 * 国土地理院 (GSI) 住所検索 API のレスポンス schema。
 * 各エントリは `geometry.coordinates: [経度, 緯度]` を持つ GeoJSON 風の形状。
 * 任意 cast を避けるため Zod で narrow し、未知 shape を runtime で弾く。
 */
const gsiSearchResultsSchema = z.array(
  z.object({
    geometry: z.object({
      coordinates: z.tuple([z.number(), z.number()]),
    }),
    properties: z.object({
      title: z.string(),
    }),
  }),
)

/**
 * `getShops` 用の include 形状。型推論の安定化のため定数化する。
 */
const SHOP_LIST_INCLUDE = {
  creator: USER_MINIMAL_RELATION,
  genres: { select: { genre: { select: GENRE_MINIMAL_SELECT } } },
  _count: { select: { reviews: { where: { isHidden: false } } } },
} as const satisfies Prisma.BonsaiShopInclude

type ShopRow = Prisma.BonsaiShopGetPayload<{ include: typeof SHOP_LIST_INCLUDE }>

type ShopWithRating = Omit<ShopRow, 'latitude' | 'longitude' | 'genres'> & {
  latitude: number | null
  longitude: number | null
  genres: ShopRow['genres'][number]['genre'][]
  averageRating: number | null
  reviewCount: number
}

// Why http(s) 強制: 旧 schema は `website` を素の string として受け、`javascript:alert(1)` 等の
// 危険スキームをそのまま DB 保存できていた。表示側 (`app/(main)/shops/[id]/page.tsx`) は
// `<a href={shop.website}>` で直接展開するため Stored XSS の経路だった。空文字 / null / undefined は
// 任意フィールドのため許容、それ以外は http/https プロトコル必須。
const websiteSchema = z
  .string()
  .nullable()
  .optional()
  .refine(
    (v) => v == null || v === '' || /^https?:\/\//i.test(v),
    { message: 'website は http(s) URL でなければなりません' },
  )

const shopSchema = z.object({
  name: z.string().min(1, ERR_SHOP_NAME_REQUIRED),
  address: z.string().min(1, ERR_SHOP_ADDRESS_REQUIRED),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  phone: z.string().nullable().optional(),
  website: websiteSchema,
  businessHours: z.string().nullable().optional(),
  closedDays: z.string().nullable().optional(),
  genreIds: z.array(z.string()).default([]),
})

/**
 * 座標文字列を数値に変換する。
 *
 * - `null`: 空文字や未指定（任意入力として正常扱い）
 * - `number`: 有効な数値
 * - `'invalid'`: 非数値文字列（呼び出し元でエラー応答する）
 */
function parseCoordinate(raw: string | undefined): number | null | 'invalid' {
  if (!raw?.trim()) return null
  const value = parseFloat(raw)
  return isNaN(value) ? 'invalid' : value
}

/**
 * 盆栽園フォームの FormData を {@link shopSchema} で検証して返す。
 *
 * `createShop` / `updateShop` が同一のフィールド形でフォーム送信されるため、
 * パース処理を 1 箇所に集約する。
 */
function parseShopFormData(formData: FormData) {
  return shopSchema.safeParse({
    name: formData.get('name') || '',
    address: formData.get('address') || '',
    latitude: formData.get('latitude') || undefined,
    longitude: formData.get('longitude') || undefined,
    phone: formData.get('phone'),
    website: formData.get('website'),
    businessHours: formData.get('businessHours'),
    closedDays: formData.get('closedDays'),
    genreIds: formData.getAll('genreIds'),
  })
}

/**
 * 盆栽園一覧のwhere句フィルター条件を構築する。
 *
 * Why AND-of-OR: search（name OR address）と prefectureFilter（address startsWith
 * の OR 配列）はどちらも `OR` キーを使うため、単純な spread では後者が前者を
 * 上書きして検索条件が消える。両方が指定されたケースで両条件を AND として効かせる
 * ため、OR ブロックは AND 配列にまとめる。
 */
function buildBonsaiShopWhereClause(options: {
  search?: string
  genreId?: string
  prefectureFilter?: string[]
}): Prisma.BonsaiShopWhereInput {
  const { search, genreId, prefectureFilter } = options
  const andConditions: Prisma.BonsaiShopWhereInput[] = []

  if (search) {
    andConditions.push({
      OR: [
        { name: containsInsensitive(search) },
        { address: containsInsensitive(search) },
      ],
    })
  }

  if (prefectureFilter && prefectureFilter.length > 0) {
    andConditions.push({
      OR: prefectureFilter.map((pref) => ({
        address: { startsWith: pref },
      })),
    })
  }

  return {
    isHidden: false,
    ...(genreId && { genres: { some: { genreId } } }),
    ...(andConditions.length > 0 && { AND: andConditions }),
  }
}

type ShopSortBy = 'rating' | 'name' | 'newest' | 'location'

type ShopFindManyOrderBy = Prisma.BonsaiShopFindManyArgs['orderBy']

/**
 * 盆栽園一覧の orderBy を sortBy から組み立てる。
 *
 * Why a typed helper: Prisma の `Prisma.SortOrder` / `Prisma.NullsOrder` リテラル型は
 * 文字列リテラルのままだと TS が `string` に widening するため、各オブジェクトに
 * `as const` を散在させる必要があった。戻り値型を明示して型推論側で literal を
 * 維持することで `as const` キャストを排除する。
 */
function buildShopOrderBy(sortBy: ShopSortBy): ShopFindManyOrderBy {
  switch (sortBy) {
    case 'name':
      return { name: 'asc' }
    case 'newest':
      return { createdAt: 'desc' }
    case 'location':
      // 緯度の降順（最北端から南へ）でグルーピングし、同一緯度内は名前昇順。
      // null 緯度（座標未登録）は末尾へ。
      return [{ latitude: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }]
    case 'rating':
    default:
      return { createdAt: 'desc' }
  }
}

/** 盆栽園一覧を検索・フィルター条件付きで取得する。 */
export async function getShops(options?: {
  search?: string
  genreId?: string
  prefecture?: string
  region?: string
  sortBy?: ShopSortBy
}) {
  try {
  const { search, genreId, prefecture, region, sortBy = 'location' } = options || {}

  if (prefecture && region) {
    logger.warn('getShops: both prefecture and region provided, prefecture takes precedence')
  }

  let prefectureFilter: string[] | undefined
  if (prefecture) {
    prefectureFilter = [prefecture]
  } else if (region) {
    const regionData = getRegionById(region)
    if (regionData) {
      prefectureFilter = regionData.prefectures
    }
  }

  const whereClause = buildBonsaiShopWhereClause({ search, genreId, prefectureFilter })

  // 盆栽園データとレビュー平均評価を並列取得
  // 個別レビュー行の取得を避け、groupBy 集計で平均評価を取得する
  const [shops, ratingAggs] = await Promise.all([
    prisma.bonsaiShop.findMany({
      where: whereClause,
      include: SHOP_LIST_INCLUDE,
      orderBy: buildShopOrderBy(sortBy),
      take: MAX_SHOPS_LIMIT,
    }),
    getCachedShopRatings(),
  ])

  // 平均評価をMapで O(1) ルックアップ可能にする
  const ratingMap = new Map(
    ratingAggs.map((r: typeof ratingAggs[number]) => [r.shopId, { avg: r._avg.rating, count: r._count.rating }])
  )

  const shopsWithRating: ShopWithRating[] = shops.map((shop) => {
    const ratingData = ratingMap.get(shop.id)

    // Prisma Decimal -> JS number conversion
    const lat = shop.latitude !== null ? Number(shop.latitude.toString()) : null
    const lng = shop.longitude !== null ? Number(shop.longitude.toString()) : null

    return {
      ...shop,
      latitude: lat,
      longitude: lng,
      genres: shop.genres.map((sg) => sg.genre),
      averageRating: ratingData?.avg ?? null,
      reviewCount: shop._count?.reviews ?? ratingData?.count ?? 0,
    }
  })

  // 評価順ソート（DBでは集計値によるORDER BYが困難なためJSで実施、ただし個別レビュー行は不要）
  if (sortBy === 'rating') {
    shopsWithRating.sort((a, b) => {
      if (a.averageRating === null && b.averageRating === null) return 0
      if (a.averageRating === null) return 1
      if (b.averageRating === null) return -1
      return b.averageRating - a.averageRating
    })
  }

  return { shops: shopsWithRating }
  } catch (error) {
    logger.error('getShops failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { shops: [] }
  }
}

/** 盆栽園詳細を取得する。 */
export async function getShop(shopId: string) {
  const session = await auth()
  const currentUserId = session?.user?.id

  const [shop, ratingAgg] = await Promise.all([
    prisma.bonsaiShop.findUnique({
      where: {
        id: shopId,
        isHidden: false,
      },
      include: {
        creator: {
          select: USER_MINIMAL_SELECT,
        },
        genres: {
          select: { genre: { select: GENRE_MINIMAL_SELECT } },
        },
        reviews: {
          where: { isHidden: false },
          include: {
            user: {
              select: USER_MINIMAL_SELECT,
            },
            images: true,
          },
          orderBy: { createdAt: 'desc' },
          take: MAX_REVIEWS_PER_SHOP,
        },
      },
    }),
    prisma.shopReview.aggregate({
      where: { shopId, isHidden: false },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ])

  if (!shop) {
    return actionError(ERR_SHOP_NOT_FOUND)
  }

  const lat = shop.latitude !== null ? Number(shop.latitude.toString()) : null
  const lng = shop.longitude !== null ? Number(shop.longitude.toString()) : null

  return {
    shop: {
      ...shop,
      latitude: lat,
      longitude: lng,
      genres: shop.genres.map((sg: typeof shop.genres[number]) => sg.genre),
      averageRating: ratingAgg._avg.rating ?? null,
      reviewCount: ratingAgg._count.rating,
      isOwner: currentUserId === shop.createdBy,
    },
  }
}

type CreateShopResult =
  | { success: true; data?: { shopId: string } }
  | { success: false; error: string; existingId?: string }

/** 新しい盆栽園を登録する。同一住所の重複チェックあり。 */
export async function createShop(formData: FormData): Promise<CreateShopResult> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = parseShopFormData(formData)

  if (!parsed.success) {
    return actionZodError(parsed.error)
  }

  const { name, address, latitude: latStr, longitude: lngStr, phone, website, businessHours, closedDays, genreIds } = parsed.data

  const latitude = parseCoordinate(latStr)
  const longitude = parseCoordinate(lngStr)
  if (latitude === 'invalid' || longitude === 'invalid') {
    return actionError(ERR_INVALID_INPUT)
  }

  const rl = await enforceUserRateLimit(userId, 'create_shop')
  if (rl) return actionError(rl.error)

  const existing = await prisma.bonsaiShop.findFirst({
    where: { address: address.trim() },
  })

  if (existing) {
    return {
      success: false as const,
      error: ERR_SHOP_DUPLICATE_ADDRESS,
      existingId: existing.id,
    }
  }

  try {
    const shop = await prisma.bonsaiShop.create({
      data: {
        name: name.trim(),
        address: address.trim(),
        latitude,
        longitude,
        phone: phone?.trim() || null,
        website: website?.trim() || null,
        businessHours: businessHours?.trim() || null,
        closedDays: closedDays?.trim() || null,
        createdBy: userId,
        genres: genreIds.length > 0
          ? {
              create: genreIds.map((genreId: string) => ({ genreId })),
            }
          : undefined,
      },
    })

    revalidatePath(ROUTE_SHOPS)
    return actionSuccess({ shopId: shop.id })
  } catch (error) {
    logger.error('Create shop failed', {
      userId,
      address: address.trim(),
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_SHOP_CREATE_FAILED)
  }
}

/** 既存の盆栽園情報を更新する。作成者または管理者のみ実行可能。 */
export async function updateShop(shopId: string, formData: FormData): Promise<ActionResult<void>> {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = parseShopFormData(formData)

  if (!parsed.success) {
    return actionZodError(parsed.error)
  }

  const { name, address, latitude: latStr, longitude: lngStr, phone, website, businessHours, closedDays, genreIds } = parsed.data

  const latitude = parseCoordinate(latStr)
  const longitude = parseCoordinate(lngStr)
  if (latitude === 'invalid' || longitude === 'invalid') {
    return actionError(ERR_INVALID_INPUT)
  }

  const rl = await enforceUserRateLimit(userId, 'update_shop')
  if (rl) return actionError(rl.error)

  const authz = await canUserEditShop(userId, shopId)
  if (!authz.allowed) {
    if (authz.reason === 'Shop not found') {
      return actionError(ERR_SHOP_NOT_FOUND)
    }
    return actionError(ERR_EDIT_PERMISSION_DENIED)
  }

  try {
    // ジャンル削除 + ショップ更新をトランザクションで原子的に実行
    await prisma.$transaction(async (tx) => {
      await tx.shopGenre.deleteMany({
        where: { shopId },
      })

      await tx.bonsaiShop.update({
        where: { id: shopId },
        data: {
          name: name.trim(),
          address: address.trim(),
          latitude,
          longitude,
          phone: phone?.trim() || null,
          website: website?.trim() || null,
          businessHours: businessHours?.trim() || null,
          closedDays: closedDays?.trim() || null,
          genres: genreIds.length > 0
            ? {
                create: genreIds.map((genreId: string) => ({ genreId })),
              }
            : undefined,
        },
      })
    })

    revalidatePath(ROUTE_SHOPS)
    revalidatePath(buildShopPath(shopId))
    return actionSuccess()
  } catch (error) {
    logger.error('Update shop failed', {
      userId,
      shopId,
      error: error instanceof Error ? error.message : String(error),
    })
    return actionError(ERR_SHOP_UPDATE_FAILED)
  }
}

/** 盆栽園を削除する。作成者のみ実行可能。 */
export async function deleteShop(shopId: string) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  const parsed = shopIdSchema.safeParse(shopId)
  if (!parsed.success) return actionError(ERR_INVALID_INPUT)

  const rl = await enforceUserRateLimit(userId, 'delete_shop')
  if (rl) return actionError(rl.error)

  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: parsed.data },
    select: { createdBy: true },
  })

  if (!shop) {
    return actionError(ERR_SHOP_NOT_FOUND)
  }

  if (shop.createdBy !== userId) {
    return actionError(ERR_PERMISSION_DENIED)
  }

  await prisma.bonsaiShop.delete({
    where: { id: parsed.data },
  })

  revalidatePath(ROUTE_SHOPS)
  return actionSuccess()
}

/** 住所から緯度経度を取得する（国土地理院API）。 */
export async function geocodeAddress(address: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return actionError(authResult.error)

  if (address.length > MAX_ADDRESS_LENGTH) {
    return actionError(ERR_INVALID_INPUT)
  }

  try {
    const encodedAddress = encodeURIComponent(address)

    const response = await fetch(
      `${GSI_ADDRESS_SEARCH_URL}?q=${encodedAddress}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(ADDRESS_SEARCH_TIMEOUT_MS),
      }
    )

    if (!response.ok) {
      return actionError(ERR_ADDRESS_SEARCH_FAILED)
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      return actionError(ERR_ADDRESS_PARSE_FAILED)
    }

    const parsed = gsiSearchResultsSchema.safeParse(data)
    if (!parsed.success || parsed.data.length === 0) {
      return actionError(ERR_ADDRESS_NOT_FOUND)
    }

    // 国土地理院APIは [経度, 緯度] の順序で返す
    const first = parsed.data[0]
    if (!first) return actionError(ERR_ADDRESS_NOT_FOUND)
    const [longitude, latitude] = first.geometry.coordinates

    return {
      latitude,
      longitude,
      displayName: first.properties.title,
    }
  } catch {
    return actionError(ERR_ADDRESS_SEARCH_ERROR)
  }
}

/** 住所候補を検索する（オートコンプリート用）。 */
export async function searchAddressSuggestions(query: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { suggestions: [] }

  if (query.length > MAX_ADDRESS_LENGTH) {
    return { suggestions: [] }
  }

  if (!query.trim() || query.length < MIN_SEARCH_QUERY_LENGTH) {
    return { suggestions: [] }
  }

  try {
    const encodedQuery = encodeURIComponent(query)

    const response = await fetch(
      `${GSI_ADDRESS_SEARCH_URL}?q=${encodedQuery}`,
      {
        headers: {
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(ADDRESS_SEARCH_TIMEOUT_MS),
      }
    )

    if (!response.ok) {
      return { suggestions: [], originalQuery: query }
    }

    let data: unknown
    try {
      data = await response.json()
    } catch {
      return { suggestions: [], originalQuery: query }
    }

    if (!Array.isArray(data) || data.length === 0) {
      return { suggestions: [], originalQuery: query }
    }

    const parsedList = gsiSearchResultsSchema.safeParse(data)
    if (!parsedList.success || parsedList.data.length === 0) {
      return { suggestions: [], originalQuery: query }
    }

    // 国土地理院APIは [経度, 緯度] の順序で返す
    const suggestions = parsedList.data.slice(0, MAX_ADDRESS_SUGGESTIONS).map((item) => {
      const [longitude, latitude] = item.geometry.coordinates
      return {
        latitude,
        longitude,
        displayName: item.properties.title,
        formattedAddress: item.properties.title,
      }
    })

    return { suggestions, originalQuery: query }
  } catch {
    return { suggestions: [], originalQuery: query }
  }
}

/** 盆栽園のジャンル一覧を取得する。 */
export async function getShopGenres() {
  // SKIP_DB_CONNECTION=true / ダミー DB の build 中はクエリを発行しない。
  if (shouldSkipBuildTimeDbAccess()) return { genres: [] }

  const genres = await prisma.genre.findMany({
    where: { type: 'shop' },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  return { genres }
}

/** 盆栽園の取り扱いジャンルを更新する。作成者または管理者のみ実行可能。 */
export async function updateShopGenres(shopId: string, genreIds: string[]) {
  const auth = await requireActiveNonGuestUser()
  if ('error' in auth) return actionError(auth.error)
  const userId = auth.userId

  if (!Array.isArray(genreIds)) {
    return actionError(ERR_INVALID_INPUT)
  }

  if (genreIds.length > MAX_SHOP_GENRES) {
    return actionError(ERR_GENRE_LIMIT(MAX_SHOP_GENRES))
  }

  const rl = await enforceUserRateLimit(userId, 'engagement')
  if (rl) return actionError(rl.error)

  const authz = await canUserEditShop(userId, shopId)
  if (!authz.allowed) {
    if (authz.reason === 'Shop not found') {
      return actionError(ERR_SHOP_NOT_FOUND)
    }
    return actionError(ERR_EDIT_PERMISSION_DENIED)
  }

  // isHidden チェック（canUserEditShop ではチェックしないため）
  const shop = await prisma.bonsaiShop.findUnique({
    where: { id: shopId, isHidden: false },
    select: { id: true },
  })

  if (!shop) {
    return actionError(ERR_SHOP_NOT_FOUND)
  }

  if (genreIds.length > 0) {
    const validGenres = await prisma.genre.findMany({
      where: { id: { in: genreIds }, type: 'shop' },
      select: { id: true },
    })

    if (validGenres.length !== genreIds.length) {
      return actionError(ERR_INVALID_GENRE)
    }
  }

  await prisma.$transaction([
    prisma.shopGenre.deleteMany({
      where: { shopId },
    }),
    ...(genreIds.length > 0
      ? [
          prisma.shopGenre.createMany({
            data: genreIds.map((genreId) => ({ shopId, genreId })),
          }),
        ]
      : []),
  ])

  revalidatePath(buildShopPath(shopId))

  return actionSuccess()
}

// 変更リクエスト関連は `lib/actions/shop-change-request.ts` に分離済み。
// 既存 import 互換性のため `@/lib/actions/shop` 経由でも参照できるようラッパー経由で公開する。
// Why wrappers (not `export { } from`):
//   Next.js 16 (SWC) の `'use server'` 制約により、ファイル内では async function declaration のみが許可される。
//   `export { name } from '...'` の re-export は build 時 SWC で reject される (vitest はこの制約を通すため要注意)。
import type { ShopChangeRequestData as _ShopChangeRequestData } from '@/lib/shop/change-request'
import {
  createShopChangeRequest as _createShopChangeRequest,
  getShopChangeRequests as _getShopChangeRequests,
  getPendingShopChangeRequestCount as _getPendingShopChangeRequestCount,
  getShopChangeRequest as _getShopChangeRequest,
  approveShopChangeRequest as _approveShopChangeRequest,
  rejectShopChangeRequest as _rejectShopChangeRequest,
  getPendingShopChangeRequestsCount as _getPendingShopChangeRequestsCount,
} from './shop-change-request'

export type ShopChangeRequestData = _ShopChangeRequestData

export async function createShopChangeRequest(shopId: string, changes: ShopChangeRequestData, reason?: string) {
  return _createShopChangeRequest(shopId, changes, reason)
}

export async function getShopChangeRequests(options?: { status?: 'pending' | 'approved' | 'rejected' | 'all'; cursor?: string; limit?: number }) {
  return _getShopChangeRequests(options)
}

export async function getPendingShopChangeRequestCount() {
  return _getPendingShopChangeRequestCount()
}

export async function getShopChangeRequest(requestId: string) {
  return _getShopChangeRequest(requestId)
}

export async function approveShopChangeRequest(requestId: string, adminComment?: string) {
  return _approveShopChangeRequest(requestId, adminComment)
}

export async function rejectShopChangeRequest(requestId: string, adminComment?: string) {
  return _rejectShopChangeRequest(requestId, adminComment)
}

export async function getPendingShopChangeRequestsCount() {
  return _getPendingShopChangeRequestsCount()
}
