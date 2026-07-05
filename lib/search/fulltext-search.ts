/**
 * @module lib/search/fulltext-search
 * Entity 別の全文検索クエリ実装。SEARCH_MODE に応じて bigm / trgm / like を切替え、
 * 失敗時は LIKE フォールバックで検索機能が完全停止しないようにする。
 *
 * Cursor pagination 設計:
 *   - bigm / like モード (created_at で ORDER): `(created_at, id)` 複合 keyset.
 *     `AND (table.created_at, table.id) < (cursor_row.created_at, cursor_row.id)` で
 *     id だけの比較が取りこぼす同 created_at の境界を正しく扱う。
 *   - trgm モード (similarity で ORDER): similarity スコアは入力クエリに依存し
 *     keyset pagination が原理的に成立しないため cursor を受けない（最初の `limit` 件のみ返す）。
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import logger from '@/lib/logger'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { getEndOfDay } from '@/lib/utils'
import { getSearchMode } from './fulltext-config'

/**
 * 投稿著者の公開可否を SQL に反映する WHERE 断片。
 * `visibleAuthorFilter` と同条件: 停止著者を除外し、公開 / 本人 / フォロー中の非公開のみ通す。
 * raw SQL 側で除外することで、後段 Prisma filter による premature pagination end を防ぐ。
 */
function authorVisibilitySql(viewerId: string | undefined): Prisma.Sql {
  return viewerId
    ? Prisma.sql`AND u.is_suspended = false AND (u.is_public = true OR u.id = ${viewerId} OR EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ${viewerId} AND f.following_id = u.id))`
    : Prisma.sql`AND u.is_suspended = false AND u.is_public = true`
}

export async function fulltextSearchPosts(
  query: string,
  options: {
    excludedUserIds?: string[]
    genreIds?: string[]
    cursor?: string
    limit?: number
    viewerId?: string
    filters?: {
      dateFrom?: string
      dateTo?: string
      minLikes?: number
      mediaType?: 'images' | 'videos' | 'text'
    }
  } = {},
): Promise<string[]> {
  const {
    excludedUserIds = [],
    genreIds = [],
    cursor,
    limit = DEFAULT_PAGE_LIMIT,
    viewerId,
    filters,
  } = options
  const mode = getSearchMode()

  if (!query || query.trim() === '') return []

  const sanitizedQuery = query.trim()
  const authorVisibility = authorVisibilitySql(viewerId)

  const filterSql: Prisma.Sql[] = []
  if (filters?.dateFrom) {
    filterSql.push(Prisma.sql`AND p.created_at >= ${new Date(filters.dateFrom)}`)
  }
  if (filters?.dateTo) {
    const dateTo = getEndOfDay(new Date(filters.dateTo))
    filterSql.push(Prisma.sql`AND p.created_at <= ${dateTo}`)
  }
  if (filters?.mediaType === 'images') {
    filterSql.push(
      Prisma.sql`AND EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.id AND pm.type = 'image')`,
    )
  } else if (filters?.mediaType === 'videos') {
    filterSql.push(
      Prisma.sql`AND EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.id AND pm.type = 'video')`,
    )
  } else if (filters?.mediaType === 'text') {
    filterSql.push(
      Prisma.sql`AND NOT EXISTS (SELECT 1 FROM post_media pm WHERE pm.post_id = p.id)`,
    )
  }
  if (filters?.minLikes && filters.minLikes > 0) {
    filterSql.push(
      Prisma.sql`AND (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) >= ${filters.minLikes}`,
    )
  }
  const filterFragment =
    filterSql.length > 0 ? Prisma.sql`${Prisma.join(filterSql, ' ')}` : Prisma.empty

  try {
    let postIds: { id: string }[]

    // keyset pagination 用: cursor は post.id なので、subquery で created_at を引き当てる。
    // mode === 'trgm' は similarity score order のため cursor を受けない（上の JSDoc 参照）。
    const postsCursorFragment = cursor
      ? Prisma.sql`AND (p.created_at, p.id) < (SELECT created_at, id FROM posts WHERE id = ${cursor} LIMIT 1)`
      : Prisma.empty

    if (mode === 'bigm') {
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.is_hidden = false
        ${authorVisibility}
        AND p.content LIKE '%' || ${sanitizedQuery} || '%'
        ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${
          genreIds.length > 0
            ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM post_genres pg
            WHERE pg.post_id = p.id
            AND pg.genre_id IN (${Prisma.join(genreIds)})
          )
        `
            : Prisma.empty
        }
        ${filterFragment}
        ${postsCursorFragment}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      // trgm の `%` 演算子は類似度が閾値を超えるかチェック。ILIKE と OR して
      // 完全一致でないが部分一致するケースも拾い、similarity でソートして関連度順にする。
      // similarity score は input query 依存で keyset pagination が成立しない。
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.is_hidden = false
        ${authorVisibility}
        AND (p.content % ${sanitizedQuery} OR p.content ILIKE '%' || ${sanitizedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${
          genreIds.length > 0
            ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM post_genres pg
            WHERE pg.post_id = p.id
            AND pg.genre_id IN (${Prisma.join(genreIds)})
          )
        `
            : Prisma.empty
        }
        ${filterFragment}
        ORDER BY similarity(p.content, ${sanitizedQuery}) DESC, p.created_at DESC, p.id DESC
        LIMIT ${limit}
      `
    } else {
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.is_hidden = false
        ${authorVisibility}
        AND p.content ILIKE '%' || ${sanitizedQuery} || '%'
        ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${
          genreIds.length > 0
            ? Prisma.sql`
          AND EXISTS (
            SELECT 1 FROM post_genres pg
            WHERE pg.post_id = p.id
            AND pg.genre_id IN (${Prisma.join(genreIds)})
          )
        `
            : Prisma.empty
        }
        ${filterFragment}
        ${postsCursorFragment}
        ORDER BY p.created_at DESC, p.id DESC
        LIMIT ${limit}
      `
    }

    return postIds.map((p) => p.id)
  } catch (error) {
    logger.error('Fulltext search error:', error)
    return fulltextSearchPostsWithLike(query, options)
  }
}

async function fulltextSearchPostsWithLike(
  query: string,
  options: {
    excludedUserIds?: string[]
    genreIds?: string[]
    cursor?: string
    limit?: number
    viewerId?: string
  } = {},
): Promise<string[]> {
  const { excludedUserIds = [], genreIds = [], cursor, limit = DEFAULT_PAGE_LIMIT, viewerId } = options
  const sanitizedQuery = query.trim()
  const authorVisibility = authorVisibilitySql(viewerId)

  const postIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.is_hidden = false
    ${authorVisibility}
    AND p.content ILIKE '%' || ${sanitizedQuery} || '%'
    ${excludedUserIds.length > 0 ? Prisma.sql`AND p.user_id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
    ${
      genreIds.length > 0
        ? Prisma.sql`
      AND EXISTS (
        SELECT 1 FROM post_genres pg
        WHERE pg.post_id = p.id
        AND pg.genre_id IN (${Prisma.join(genreIds)})
      )
    `
        : Prisma.empty
    }
    ${cursor ? Prisma.sql`AND (p.created_at, p.id) < (SELECT created_at, id FROM posts WHERE id = ${cursor} LIMIT 1)` : Prisma.empty}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT ${limit}
  `

  return postIds.map((p) => p.id)
}

export async function fulltextSearchUsers(
  query: string,
  options: {
    excludedUserIds?: string[]
    currentUserId?: string
    cursor?: string
    limit?: number
  } = {},
): Promise<string[]> {
  const { excludedUserIds = [], currentUserId, cursor, limit = DEFAULT_PAGE_LIMIT } = options
  const mode = getSearchMode()

  if (!query || query.trim() === '') return []

  const sanitizedQuery = query.trim()
  // 検索対象ユーザー自身の公開可否（停止除外 + 公開/本人/フォロー中の非公開のみ）。
  const userVisibility = authorVisibilitySql(currentUserId)

  try {
    let userIds: { id: string }[]

    if (mode === 'bigm') {
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname LIKE '%' || ${sanitizedQuery} || '%' OR u.bio LIKE '%' || ${sanitizedQuery} || '%')
        ${userVisibility}
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        ORDER BY u.id DESC
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname % ${sanitizedQuery} OR u.nickname ILIKE '%' || ${sanitizedQuery} || '%'
               OR u.bio % ${sanitizedQuery} OR u.bio ILIKE '%' || ${sanitizedQuery} || '%')
        ${userVisibility}
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ORDER BY GREATEST(
          similarity(u.nickname, ${sanitizedQuery}),
          COALESCE(similarity(u.bio, ${sanitizedQuery}), 0)
        ) DESC, u.id DESC
        LIMIT ${limit}
      `
    } else {
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname ILIKE '%' || ${sanitizedQuery} || '%' OR u.bio ILIKE '%' || ${sanitizedQuery} || '%')
        ${userVisibility}
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        ORDER BY u.id DESC
        LIMIT ${limit}
      `
    }

    return userIds.map((u) => u.id)
  } catch (error) {
    logger.error('Fulltext user search error:', error)
    return fulltextSearchUsersWithLike(query, options)
  }
}

async function fulltextSearchUsersWithLike(
  query: string,
  options: {
    excludedUserIds?: string[]
    currentUserId?: string
    cursor?: string
    limit?: number
  } = {},
): Promise<string[]> {
  const { excludedUserIds = [], currentUserId, cursor, limit = DEFAULT_PAGE_LIMIT } = options
  const sanitizedQuery = query.trim()
  const userVisibility = authorVisibilitySql(currentUserId)

  const userIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u.id
    FROM users u
    WHERE (u.nickname ILIKE '%' || ${sanitizedQuery} || '%' OR u.bio ILIKE '%' || ${sanitizedQuery} || '%')
    ${userVisibility}
    ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
    ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
    ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
    ORDER BY u.id DESC
    LIMIT ${limit}
  `

  return userIds.map((u) => u.id)
}

export async function fulltextSearchShops(
  query: string,
  options: {
    cursor?: string
    limit?: number
    prefecture?: string
  } = {},
): Promise<string[]> {
  const { cursor, limit = DEFAULT_PAGE_LIMIT, prefecture } = options
  const mode = getSearchMode()

  if (!query || query.trim() === '') return []

  const sanitizedQuery = query.trim()

  try {
    let shopIds: { id: string }[]

    // keyset pagination: cursor は shop.id。trgm モードは similarity score で cursor 未サポート。
    const shopsCursorFragment = cursor
      ? Prisma.sql`AND (s.created_at, s.id) < (SELECT created_at, id FROM bonsai_shops WHERE id = ${cursor} LIMIT 1)`
      : Prisma.empty

    if (mode === 'bigm') {
      shopIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id
        FROM bonsai_shops s
        WHERE s.is_hidden = false
        AND (s.name LIKE '%' || ${sanitizedQuery} || '%' OR s.address LIKE '%' || ${sanitizedQuery} || '%')
        ${prefecture ? Prisma.sql`AND s.address LIKE '%' || ${prefecture} || '%'` : Prisma.empty}
        ${shopsCursorFragment}
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      shopIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id
        FROM bonsai_shops s
        WHERE s.is_hidden = false
        AND (
          s.name % ${sanitizedQuery} OR s.name ILIKE '%' || ${sanitizedQuery} || '%'
          OR s.address % ${sanitizedQuery} OR s.address ILIKE '%' || ${sanitizedQuery} || '%'
        )
        ${prefecture ? Prisma.sql`AND s.address LIKE '%' || ${prefecture} || '%'` : Prisma.empty}
        ORDER BY GREATEST(
          COALESCE(similarity(s.name, ${sanitizedQuery}), 0),
          COALESCE(similarity(s.address, ${sanitizedQuery}), 0)
        ) DESC, s.created_at DESC, s.id DESC
        LIMIT ${limit}
      `
    } else {
      shopIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id
        FROM bonsai_shops s
        WHERE s.is_hidden = false
        AND (s.name ILIKE '%' || ${sanitizedQuery} || '%' OR s.address ILIKE '%' || ${sanitizedQuery} || '%')
        ${prefecture ? Prisma.sql`AND s.address LIKE '%' || ${prefecture} || '%'` : Prisma.empty}
        ${shopsCursorFragment}
        ORDER BY s.created_at DESC, s.id DESC
        LIMIT ${limit}
      `
    }

    return shopIds.map((s) => s.id)
  } catch (error) {
    logger.error('Fulltext shop search error:', error)
    const shopIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT s.id
      FROM bonsai_shops s
      WHERE s.is_hidden = false
      AND (s.name ILIKE '%' || ${sanitizedQuery} || '%' OR s.address ILIKE '%' || ${sanitizedQuery} || '%')
      ${prefecture ? Prisma.sql`AND s.address LIKE '%' || ${prefecture} || '%'` : Prisma.empty}
      ${cursor ? Prisma.sql`AND (s.created_at, s.id) < (SELECT created_at, id FROM bonsai_shops WHERE id = ${cursor} LIMIT 1)` : Prisma.empty}
      ORDER BY s.created_at DESC, s.id DESC
      LIMIT ${limit}
    `
    return shopIds.map((s) => s.id)
  }
}

export async function fulltextSearchEvents(
  query: string,
  options: {
    cursor?: string
    limit?: number
    prefecture?: string
    includeExpired?: boolean
  } = {},
): Promise<string[]> {
  const { cursor, limit = DEFAULT_PAGE_LIMIT, prefecture, includeExpired = false } = options
  const mode = getSearchMode()

  if (!query || query.trim() === '') return []

  const sanitizedQuery = query.trim()
  const now = new Date()

  try {
    let eventIds: { id: string }[]

    // keyset pagination: イベントは start_date ASC の昇順表示。cursor 行の start_date を上回る or
    // 同じ start_date で id を上回るものから次ページ。trgm は similarity 順で cursor 未サポート。
    const eventsCursorFragment = cursor
      ? Prisma.sql`AND (e.start_date, e.id) > (SELECT start_date, id FROM events WHERE id = ${cursor} LIMIT 1)`
      : Prisma.empty

    if (mode === 'bigm') {
      eventIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT e.id
        FROM events e
        WHERE e.is_hidden = false
        ${!includeExpired ? Prisma.sql`AND (e.end_date >= ${now} OR (e.end_date IS NULL AND e.start_date >= ${now}))` : Prisma.empty}
        AND (e.title LIKE '%' || ${sanitizedQuery} || '%' OR e.description LIKE '%' || ${sanitizedQuery} || '%')
        ${prefecture ? Prisma.sql`AND e.prefecture = ${prefecture}` : Prisma.empty}
        ${eventsCursorFragment}
        ORDER BY e.start_date ASC, e.id ASC
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      eventIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT e.id
        FROM events e
        WHERE e.is_hidden = false
        ${!includeExpired ? Prisma.sql`AND (e.end_date >= ${now} OR (e.end_date IS NULL AND e.start_date >= ${now}))` : Prisma.empty}
        AND (
          e.title % ${sanitizedQuery} OR e.title ILIKE '%' || ${sanitizedQuery} || '%'
          OR e.description % ${sanitizedQuery} OR e.description ILIKE '%' || ${sanitizedQuery} || '%'
        )
        ${prefecture ? Prisma.sql`AND e.prefecture = ${prefecture}` : Prisma.empty}
        ORDER BY GREATEST(
          COALESCE(similarity(e.title, ${sanitizedQuery}), 0),
          COALESCE(similarity(e.description, ${sanitizedQuery}), 0)
        ) DESC, e.start_date ASC, e.id ASC
        LIMIT ${limit}
      `
    } else {
      eventIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT e.id
        FROM events e
        WHERE e.is_hidden = false
        ${!includeExpired ? Prisma.sql`AND (e.end_date >= ${now} OR (e.end_date IS NULL AND e.start_date >= ${now}))` : Prisma.empty}
        AND (e.title ILIKE '%' || ${sanitizedQuery} || '%' OR e.description ILIKE '%' || ${sanitizedQuery} || '%')
        ${prefecture ? Prisma.sql`AND e.prefecture = ${prefecture}` : Prisma.empty}
        ${eventsCursorFragment}
        ORDER BY e.start_date ASC, e.id ASC
        LIMIT ${limit}
      `
    }

    return eventIds.map((e) => e.id)
  } catch (error) {
    logger.error('Fulltext event search error:', error)
    const eventIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT e.id
      FROM events e
      WHERE e.is_hidden = false
      ${!includeExpired ? Prisma.sql`AND (e.end_date >= ${now} OR (e.end_date IS NULL AND e.start_date >= ${now}))` : Prisma.empty}
      AND (e.title ILIKE '%' || ${sanitizedQuery} || '%' OR e.description ILIKE '%' || ${sanitizedQuery} || '%')
      ${prefecture ? Prisma.sql`AND e.prefecture = ${prefecture}` : Prisma.empty}
      ${cursor ? Prisma.sql`AND (e.start_date, e.id) > (SELECT start_date, id FROM events WHERE id = ${cursor} LIMIT 1)` : Prisma.empty}
      ORDER BY e.start_date ASC, e.id ASC
      LIMIT ${limit}
    `
    return eventIds.map((e) => e.id)
  }
}

export async function fulltextSearchBonsais(
  query: string,
  options: {
    userId: string
    cursor?: string
    limit?: number
  },
): Promise<string[]> {
  const { userId, cursor, limit = DEFAULT_PAGE_LIMIT } = options
  const mode = getSearchMode()

  if (!query || query.trim() === '') return []

  const sanitizedQuery = query.trim()

  try {
    let bonsaiIds: { id: string }[]

    // keyset pagination: cursor は bonsai.id。trgm モードは similarity 順で cursor 未サポート。
    const bonsaisCursorFragment = cursor
      ? Prisma.sql`AND (b.created_at, b.id) < (SELECT created_at, id FROM bonsais WHERE id = ${cursor} LIMIT 1)`
      : Prisma.empty

    if (mode === 'bigm') {
      bonsaiIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT b.id
        FROM bonsais b
        WHERE (
          b.name LIKE '%' || ${sanitizedQuery} || '%'
          OR b.species LIKE '%' || ${sanitizedQuery} || '%'
          OR b.description LIKE '%' || ${sanitizedQuery} || '%'
        )
        AND b.user_id = ${userId}
        ${bonsaisCursorFragment}
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      bonsaiIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT b.id
        FROM bonsais b
        WHERE (
          b.name % ${sanitizedQuery} OR b.name ILIKE '%' || ${sanitizedQuery} || '%'
          OR b.species % ${sanitizedQuery} OR b.species ILIKE '%' || ${sanitizedQuery} || '%'
          OR b.description % ${sanitizedQuery} OR b.description ILIKE '%' || ${sanitizedQuery} || '%'
        )
        AND b.user_id = ${userId}
        ORDER BY GREATEST(
          COALESCE(similarity(b.name, ${sanitizedQuery}), 0),
          COALESCE(similarity(b.species, ${sanitizedQuery}), 0),
          COALESCE(similarity(b.description, ${sanitizedQuery}), 0)
        ) DESC, b.created_at DESC, b.id DESC
        LIMIT ${limit}
      `
    } else {
      bonsaiIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT b.id
        FROM bonsais b
        WHERE (
          b.name ILIKE '%' || ${sanitizedQuery} || '%'
          OR b.species ILIKE '%' || ${sanitizedQuery} || '%'
          OR b.description ILIKE '%' || ${sanitizedQuery} || '%'
        )
        AND b.user_id = ${userId}
        ${bonsaisCursorFragment}
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT ${limit}
      `
    }

    return bonsaiIds.map((b) => b.id)
  } catch (error) {
    logger.error('Fulltext bonsai search error:', error)
    const bonsaiIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT b.id
      FROM bonsais b
      WHERE (
        b.name ILIKE '%' || ${sanitizedQuery} || '%'
        OR b.species ILIKE '%' || ${sanitizedQuery} || '%'
        OR b.description ILIKE '%' || ${sanitizedQuery} || '%'
      )
      AND b.user_id = ${userId}
      ${cursor ? Prisma.sql`AND (b.created_at, b.id) < (SELECT created_at, id FROM bonsais WHERE id = ${cursor} LIMIT 1)` : Prisma.empty}
      ORDER BY b.created_at DESC, b.id DESC
      LIMIT ${limit}
    `
    return bonsaiIds.map((b) => b.id)
  }
}

/** posts / users / shops / events / bonsais を並列検索して 5 種類の id を返す。 */
export async function fulltextSearchGlobal(
  query: string,
  options: {
    excludedUserIds?: string[]
    currentUserId?: string
    limit?: number
  } = {},
): Promise<{
  postIds: string[]
  userIds: string[]
  shopIds: string[]
  eventIds: string[]
  bonsaiIds: string[]
}> {
  const { excludedUserIds = [], currentUserId, limit = 5 } = options

  if (!query || query.trim() === '') {
    return { postIds: [], userIds: [], shopIds: [], eventIds: [], bonsaiIds: [] }
  }

  const [postIds, userIds, shopIds, eventIds, bonsaiIds] = await Promise.all([
    fulltextSearchPosts(query, { excludedUserIds, limit, viewerId: currentUserId }),
    fulltextSearchUsers(query, { excludedUserIds, currentUserId, limit }),
    fulltextSearchShops(query, { limit }),
    fulltextSearchEvents(query, { limit }),
    // 盆栽は所有者専用。未ログインや他者の盆栽は global search に含めない。
    currentUserId ? fulltextSearchBonsais(query, { userId: currentUserId, limit }) : Promise.resolve<string[]>([]),
  ])

  return { postIds, userIds, shopIds, eventIds, bonsaiIds }
}
