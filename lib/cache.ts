/**
 * サーバーサイドのデータキャッシュ。
 * 変更頻度が低く多ユーザーが参照する共通データを `unstable_cache` で包む。
 *
 * @module lib/cache
 */

import { unstable_cache, revalidateTag } from 'next/cache'
import { prisma } from '@/lib/db'
import { shouldSkipBuildTimeDbAccess } from '@/lib/build/db-availability'
import {
  CACHE_TTL_GENRES,
  CACHE_TTL_TRENDING,
  CACHE_TTL_POPULAR_TAGS,
  CACHE_TTL_SHOP_RATINGS,
  TRENDING_HOURS,
  POPULAR_TAGS_DAYS,
  TRENDING_GENRES_DEFAULT_LIMIT,
  POPULAR_TAGS_DEFAULT_LIMIT,
  TRENDING_MAX_LIMIT,
  TRENDING_MIN_LIMIT,
  GENRE_CATEGORY_ORDER,
} from '@/lib/constants/limits'

/** Build 中の DB 未接続環境向けの空既定値 (cache 戻り値の型を満たすため定数化)。 */
const EMPTY_GENRES_RESULT = {
  genres: {} as Record<string, never[]>,
  allGenres: [] as never[],
} as const

/**
 * 手動無効化用のキャッシュタグ。
 * `revalidateTag` に渡す文字列を 1 箇所に集約する。
 */
export const CACHE_TAGS = {
  GENRES: 'genres',
  TRENDING_GENRES: 'trending-genres',
  POPULAR_TAGS: 'popular-tags',
  SHOP_RATINGS: 'shop-ratings',
  ADMIN_STATS: 'admin-stats',
  PESTICIDE_MASTER: 'pesticide-master',
  FERTILIZER_MASTER: 'fertilizer-master',
} as const

/**
 * ジャンル一覧（カテゴリ別にグループ化＋フラット配列）を返す。
 *
 * ジャンルは管理者のみが更新するため TTL を長めに設定。
 * カテゴリ表示順は UI との一貫性を保つため明示的に指定する。
 */
export const getCachedGenres = unstable_cache(
  async () => {
    // SKIP_DB_CONNECTION=true / ダミー DB の build 中はクエリを発行しない。
    // 実 runtime では DB が必ず接続可能な前提なのでこの分岐は no-op になる。
    if (shouldSkipBuildTimeDbAccess()) return EMPTY_GENRES_RESULT
    const genres = await prisma.genre.findMany({
      orderBy: [{ sortOrder: 'asc' }],
    })

    type GenreType = typeof genres[number]
    const groupedMap = genres.reduce((acc: Record<string, GenreType[]>, genre: GenreType) => {
      const bucket = acc[genre.category] ?? (acc[genre.category] = [])
      bucket.push(genre)
      return acc
    }, {})

    const grouped: Record<string, typeof genres> = {}
    for (const category of GENRE_CATEGORY_ORDER) {
      const list = groupedMap[category]
      if (list) {
        grouped[category] = list
      }
    }

    return { genres: grouped, allGenres: genres }
  },
  ['all-genres'],
  {
    revalidate: CACHE_TTL_GENRES,
    tags: [CACHE_TAGS.GENRES],
  }
)

/**
 * 直近 TRENDING_HOURS 時間で投稿数が多いジャンル上位 N 件を返す。
 * トレンドは変動が激しいため TTL は短め。
 */
function getCachedTrendingGenresImpl(limit: number) {
  return unstable_cache(
  async () => {
    if (shouldSkipBuildTimeDbAccess()) return { genres: [] }
    const fortyEightHoursAgo = new Date()
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - TRENDING_HOURS)

    const trendingGenres = await prisma.postGenre.groupBy({
      by: ['genreId'],
      where: {
        post: {
          createdAt: { gte: fortyEightHoursAgo },
          // 公開面の集計のため、非表示投稿・非公開/停止著者の投稿は除外する（人気タグ集計と条件を揃える）
          isHidden: false,
          user: { isPublic: true, isSuspended: false },
        },
      },
      _count: {
        genreId: true,
      },
      orderBy: {
        _count: {
          genreId: 'desc',
        },
      },
      take: limit,
    })

    const genreIds = trendingGenres.map((g: typeof trendingGenres[number]) => g.genreId)

    // groupBy からは ID しか取れないため詳細を別途取得する
    const genres = await prisma.genre.findMany({
      where: {
        id: { in: genreIds },
      },
    })

    return {
      // 型述語でフィルタしてから map する。先に map すると `id?: string` 型になり、
      // 呼び出し側（path-builders 等）で string 必須の引数に渡せなくなる。
      genres: trendingGenres
        .map((g: typeof trendingGenres[number]) => {
          const genre = genres.find((gen: typeof genres[number]) => gen.id === g.genreId)
          return genre ? { ...genre, postCount: g._count.genreId } : null
        })
        .filter(
          (g): g is NonNullable<typeof g> => g !== null,
        ),
    }
  },
  ['trending-genres', String(limit)],
  {
    revalidate: CACHE_TTL_TRENDING,
    tags: [CACHE_TAGS.TRENDING_GENRES],
  }
  )
}

export async function getCachedTrendingGenres(limit = TRENDING_GENRES_DEFAULT_LIMIT) {
  const safeLimit = Math.max(TRENDING_MIN_LIMIT, Math.min(limit, TRENDING_MAX_LIMIT))
  return getCachedTrendingGenresImpl(safeLimit)()
}

/**
 * 直近 POPULAR_TAGS_DAYS 日で使用が多いハッシュタグ上位 N 件。
 * 全投稿スキャンを避けるため Hashtag テーブルから直接集計する。
 */
export const getCachedPopularTags = unstable_cache(
  async (limit = POPULAR_TAGS_DEFAULT_LIMIT) => {
    const safeLimit = Math.max(TRENDING_MIN_LIMIT, Math.min(limit, TRENDING_MAX_LIMIT))
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - POPULAR_TAGS_DAYS)

    // 公開面のトレンド表示。非表示投稿に加え、非公開アカウント・停止ユーザーの投稿由来タグも
    // 集計から除外する（探索導線に閲覧不可コンテンツのタグを出さない）。
    const popularTags = await prisma.$queryRaw<{ name: string; tag_count: bigint }[]>`
      SELECT h.name, COUNT(ph.post_id) as tag_count
      FROM hashtags h
      INNER JOIN post_hashtags ph ON ph.hashtag_id = h.id
      INNER JOIN posts p ON p.id = ph.post_id
      INNER JOIN users u ON u.id = p.user_id
      WHERE p.is_hidden = false
        AND u.is_public = true
        AND u.is_suspended = false
        AND p.created_at >= ${oneWeekAgo}
      GROUP BY h.id, h.name
      ORDER BY tag_count DESC
      LIMIT ${safeLimit}
    `

    const sortedTags = popularTags.map(t => ({
      tag: t.name,
      count: Number(t.tag_count),
    }))

    return { tags: sortedTags }
  },
  ['popular-tags'],
  {
    revalidate: CACHE_TTL_POPULAR_TAGS,
    tags: [CACHE_TAGS.POPULAR_TAGS],
  }
)

// Next.js 16 では revalidateTag の第 2 引数に `{ expire: 0 }`（即時無効化）が必要。

/** ジャンルキャッシュを即時無効化する。ジャンル追加/編集/削除/並び替え時に呼ぶ。 */
export function revalidateGenresCache() {
  revalidateTag(CACHE_TAGS.GENRES, { expire: 0 })
}

/** トレンドジャンルキャッシュを即時無効化する。 */
export function revalidateTrendingGenresCache() {
  revalidateTag(CACHE_TAGS.TRENDING_GENRES, { expire: 0 })
}

/** 人気タグキャッシュを即時無効化する。 */
export function revalidatePopularTagsCache() {
  revalidateTag(CACHE_TAGS.POPULAR_TAGS, { expire: 0 })
}

/**
 * 盆栽園の評価集約データ（shopReview.groupBy）をキャッシュして返す。
 * 全レビュー集約は高コストのため 5 分キャッシュし、レビュー変更時に無効化する。
 */
export const getCachedShopRatings = unstable_cache(
  async () => {
    const ratingAggs = await prisma.shopReview.groupBy({
      by: ['shopId'],
      _avg: { rating: true },
      _count: { rating: true },
      where: { isHidden: false },
    })
    return ratingAggs
  },
  ['shop-ratings'],
  { revalidate: CACHE_TTL_SHOP_RATINGS, tags: [CACHE_TAGS.SHOP_RATINGS] }
)

/** 盆栽園レビュー評価キャッシュを即時無効化する。レビュー作成/更新/削除時に呼ぶ。 */
export function revalidateShopRatingsCache() {
  revalidateTag(CACHE_TAGS.SHOP_RATINGS, { expire: 0 })
}

/** 農薬マスタキャッシュを即時無効化する。管理者による農薬 作成/更新/削除時に呼ぶ。 */
export function revalidatePesticideMasterCache() {
  revalidateTag(CACHE_TAGS.PESTICIDE_MASTER, { expire: 0 })
}
