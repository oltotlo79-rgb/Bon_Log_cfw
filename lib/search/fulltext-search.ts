/**
 * @module lib/search/fulltext-search
 * Entity 別の全文検索クエリ実装。SEARCH_MODE に応じて bigm / trgm / like を切替え、
 * 失敗時は LIKE フォールバックで検索機能が完全停止しないようにする。
 */

import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import logger from '@/lib/logger'
import { DEFAULT_PAGE_LIMIT } from '@/lib/constants/limits'
import { getEndOfDay } from '@/lib/utils'
import { getSearchMode } from './fulltext-config'

export async function fulltextSearchPosts(
  query: string,
  options: {
    excludedUserIds?: string[]
    genreIds?: string[]
    cursor?: string
    limit?: number
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
    filters,
  } = options
  const mode = getSearchMode()

  if (!query || query.trim() === '') return []

  const sanitizedQuery = query.trim()

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

    if (mode === 'bigm') {
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        WHERE p.is_hidden = false
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
        ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
        ORDER BY p.created_at DESC
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      // trgm の `%` 演算子は類似度が閾値を超えるかチェック。ILIKE と OR して
      // 完全一致でないが部分一致するケースも拾い、similarity でソートして関連度順にする。
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        WHERE p.is_hidden = false
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
        ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
        ORDER BY similarity(p.content, ${sanitizedQuery}) DESC, p.created_at DESC
        LIMIT ${limit}
      `
    } else {
      postIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT p.id
        FROM posts p
        WHERE p.is_hidden = false
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
        ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
        ORDER BY p.created_at DESC
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
  } = {},
): Promise<string[]> {
  const { excludedUserIds = [], genreIds = [], cursor, limit = DEFAULT_PAGE_LIMIT } = options
  const sanitizedQuery = query.trim()

  const postIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT p.id
    FROM posts p
    WHERE p.is_hidden = false
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
    ${cursor ? Prisma.sql`AND p.id < ${cursor}` : Prisma.empty}
    ORDER BY p.created_at DESC
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

  try {
    let userIds: { id: string }[]

    if (mode === 'bigm') {
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname LIKE '%' || ${sanitizedQuery} || '%' OR u.bio LIKE '%' || ${sanitizedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        LIMIT ${limit}
      `
    } else if (mode === 'trgm') {
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname % ${sanitizedQuery} OR u.nickname ILIKE '%' || ${sanitizedQuery} || '%'
               OR u.bio % ${sanitizedQuery} OR u.bio ILIKE '%' || ${sanitizedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
        ORDER BY GREATEST(
          similarity(u.nickname, ${sanitizedQuery}),
          COALESCE(similarity(u.bio, ${sanitizedQuery}), 0)
        ) DESC
        LIMIT ${limit}
      `
    } else {
      userIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT u.id
        FROM users u
        WHERE (u.nickname ILIKE '%' || ${sanitizedQuery} || '%' OR u.bio ILIKE '%' || ${sanitizedQuery} || '%')
        ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
        ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
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

  const userIds = await prisma.$queryRaw<{ id: string }[]>`
    SELECT u.id
    FROM users u
    WHERE (u.nickname ILIKE '%' || ${sanitizedQuery} || '%' OR u.bio ILIKE '%' || ${sanitizedQuery} || '%')
    ${excludedUserIds.length > 0 ? Prisma.sql`AND u.id NOT IN (${Prisma.join(excludedUserIds)})` : Prisma.empty}
    ${currentUserId ? Prisma.sql`AND u.id != ${currentUserId}` : Prisma.empty}
    ${cursor ? Prisma.sql`AND u.id < ${cursor}` : Prisma.empty}
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

    if (mode === 'bigm') {
      shopIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id
        FROM bonsai_shops s
        WHERE s.is_hidden = false
        AND (s.name LIKE '%' || ${sanitizedQuery} || '%' OR s.address LIKE '%' || ${sanitizedQuery} || '%')
        ${prefecture ? Prisma.sql`AND s.address LIKE '%' || ${prefecture} || '%'` : Prisma.empty}
        ${cursor ? Prisma.sql`AND s.id < ${cursor}` : Prisma.empty}
        ORDER BY s.created_at DESC
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
        ${cursor ? Prisma.sql`AND s.id < ${cursor}` : Prisma.empty}
        ORDER BY GREATEST(
          COALESCE(similarity(s.name, ${sanitizedQuery}), 0),
          COALESCE(similarity(s.address, ${sanitizedQuery}), 0)
        ) DESC, s.created_at DESC
        LIMIT ${limit}
      `
    } else {
      shopIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT s.id
        FROM bonsai_shops s
        WHERE s.is_hidden = false
        AND (s.name ILIKE '%' || ${sanitizedQuery} || '%' OR s.address ILIKE '%' || ${sanitizedQuery} || '%')
        ${prefecture ? Prisma.sql`AND s.address LIKE '%' || ${prefecture} || '%'` : Prisma.empty}
        ${cursor ? Prisma.sql`AND s.id < ${cursor}` : Prisma.empty}
        ORDER BY s.created_at DESC
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
      ${cursor ? Prisma.sql`AND s.id < ${cursor}` : Prisma.empty}
      ORDER BY s.created_at DESC
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

    if (mode === 'bigm') {
      eventIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT e.id
        FROM events e
        WHERE e.is_hidden = false
        ${!includeExpired ? Prisma.sql`AND (e.end_date >= ${now} OR (e.end_date IS NULL AND e.start_date >= ${now}))` : Prisma.empty}
        AND (e.title LIKE '%' || ${sanitizedQuery} || '%' OR e.description LIKE '%' || ${sanitizedQuery} || '%')
        ${prefecture ? Prisma.sql`AND e.prefecture = ${prefecture}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND e.id < ${cursor}` : Prisma.empty}
        ORDER BY e.start_date ASC
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
        ${cursor ? Prisma.sql`AND e.id < ${cursor}` : Prisma.empty}
        ORDER BY GREATEST(
          COALESCE(similarity(e.title, ${sanitizedQuery}), 0),
          COALESCE(similarity(e.description, ${sanitizedQuery}), 0)
        ) DESC, e.start_date ASC
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
        ${cursor ? Prisma.sql`AND e.id < ${cursor}` : Prisma.empty}
        ORDER BY e.start_date ASC
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
      ${cursor ? Prisma.sql`AND e.id < ${cursor}` : Prisma.empty}
      ORDER BY e.start_date ASC
      LIMIT ${limit}
    `
    return eventIds.map((e) => e.id)
  }
}

export async function fulltextSearchBonsais(
  query: string,
  options: {
    userId?: string
    cursor?: string
    limit?: number
  } = {},
): Promise<string[]> {
  const { userId, cursor, limit = DEFAULT_PAGE_LIMIT } = options
  const mode = getSearchMode()

  if (!query || query.trim() === '') return []

  const sanitizedQuery = query.trim()

  try {
    let bonsaiIds: { id: string }[]

    if (mode === 'bigm') {
      bonsaiIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT b.id
        FROM bonsais b
        WHERE (
          b.name LIKE '%' || ${sanitizedQuery} || '%'
          OR b.species LIKE '%' || ${sanitizedQuery} || '%'
          OR b.description LIKE '%' || ${sanitizedQuery} || '%'
        )
        ${userId ? Prisma.sql`AND b.user_id = ${userId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND b.id < ${cursor}` : Prisma.empty}
        ORDER BY b.created_at DESC
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
        ${userId ? Prisma.sql`AND b.user_id = ${userId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND b.id < ${cursor}` : Prisma.empty}
        ORDER BY GREATEST(
          COALESCE(similarity(b.name, ${sanitizedQuery}), 0),
          COALESCE(similarity(b.species, ${sanitizedQuery}), 0),
          COALESCE(similarity(b.description, ${sanitizedQuery}), 0)
        ) DESC, b.created_at DESC
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
        ${userId ? Prisma.sql`AND b.user_id = ${userId}` : Prisma.empty}
        ${cursor ? Prisma.sql`AND b.id < ${cursor}` : Prisma.empty}
        ORDER BY b.created_at DESC
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
      ${userId ? Prisma.sql`AND b.user_id = ${userId}` : Prisma.empty}
      ${cursor ? Prisma.sql`AND b.id < ${cursor}` : Prisma.empty}
      ORDER BY b.created_at DESC
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
    fulltextSearchPosts(query, { excludedUserIds, limit }),
    fulltextSearchUsers(query, { excludedUserIds, currentUserId, limit }),
    fulltextSearchShops(query, { limit }),
    fulltextSearchEvents(query, { limit }),
    fulltextSearchBonsais(query, { limit }),
  ])

  return { postIds, userIds, shopIds, eventIds, bonsaiIds }
}
