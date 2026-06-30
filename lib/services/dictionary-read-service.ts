/**
 * @module lib/services/dictionary-read-service
 * モバイル API v1 向けの盆栽用語辞典読み取りサービス。
 *
 * Web の lib/actions/dictionary と同等のクエリを提供する。
 * row フィルタは Prisma 側でなくアプリケーション層（route handler）で行う
 * （Web と同じ方式: KANA_ROWS.pattern.test(reading) による in-memory フィルタ）。
 *
 * 'use server' を付けない（API route から呼ばれる services 層）。
 * import 'server-only' で誤った client 側利用を防ぐ。
 */
import 'server-only'

import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import {
  MAX_DICTIONARY_TERMS_LIMIT,
  DICTIONARY_RELATED_TERMS_LIMIT,
  MAX_PAGE_LIMIT,
  DEFAULT_PAGE_LIMIT,
  MAX_SLUG_LENGTH,
  MAX_SEARCH_QUERY_LENGTH,
} from '@/lib/constants/limits'
import { DICTIONARY_CATEGORIES, KANA_ROWS, isKanaRowLabel } from '@/lib/constants/dictionary'
import { z } from 'zod'

// ── 入力バリデーションスキーマ ────────────────────────────────

export const dictionaryListQuerySchema = z.object({
  cursor: z.string().max(MAX_SLUG_LENGTH).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional().default(DEFAULT_PAGE_LIMIT),
  search: z.string().max(MAX_SEARCH_QUERY_LENGTH).optional(),
  category: z.enum(DICTIONARY_CATEGORIES).optional(),
  row: z.string().max(20).optional().refine(
    (v) => v === undefined || isKanaRowLabel(v),
    { message: '無効な行フィルタです' },
  ),
})
export type DictionaryListQuery = z.infer<typeof dictionaryListQuerySchema>

export const dictionarySlugSchema = z.string().min(1).max(MAX_SLUG_LENGTH)

// ── レスポンス型 ──────────────────────────────────────────────

export type DictionaryTermSummary = {
  id: string
  slug: string
  term: string
  reading: string
  category: string
  description: string
}

export type DictionaryTermDetail = DictionaryTermSummary & {
  description: string
}

// ── 一覧取得 ─────────────────────────────────────────────────

export async function listDictionaryTerms(query: DictionaryListQuery): Promise<{
  items: DictionaryTermSummary[]
  nextCursor: string | null
}> {
  const { cursor, limit, search, category, row } = query

  try {
    const effectiveLimit = limit ?? DEFAULT_PAGE_LIMIT

    // row フィルタは in-memory で行うため、DB からは category/search のみで絞り込む
    // 取得件数は MAX_DICTIONARY_TERMS_LIMIT を上限とする
    const dbTake = row ? MAX_DICTIONARY_TERMS_LIMIT : effectiveLimit + 1

    const terms = await prisma.bonsaiTerm.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(search
          ? {
              OR: [
                { term: { contains: search } },
                { reading: { contains: search } },
                { description: { contains: search } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        slug: true,
        term: true,
        reading: true,
        category: true,
        description: true,
      },
      orderBy: [{ reading: 'asc' }, { sortOrder: 'asc' }],
      take: dbTake,
      ...(cursor && !row ? { cursor: { slug: cursor }, skip: 1 } : {}),
    })

    // row フィルタを in-memory で適用（Web の TermList.tsx と同等の処理）
    const filtered = row
      ? terms.filter((t) => {
          const kanaRow = KANA_ROWS.find((r) => r.pattern.test(t.reading))
          return kanaRow?.label === row
        })
      : terms

    if (row) {
      // row フィルタ適用後はカーソル方式ではなく全件返却
      return {
        items: filtered.slice(0, effectiveLimit),
        nextCursor: filtered.length > effectiveLimit ? (filtered[effectiveLimit - 1]?.slug ?? null) : null,
      }
    }

    const hasMore = filtered.length > effectiveLimit
    const items = hasMore ? filtered.slice(0, effectiveLimit) : filtered

    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.slug ?? null) : null,
    }
  } catch (error) {
    logger.error('listDictionaryTerms failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { items: [], nextCursor: null }
  }
}

// ── 詳細取得 ─────────────────────────────────────────────────

export async function getDictionaryTermBySlug(slug: string): Promise<{
  term: DictionaryTermDetail | null
  prev: DictionaryTermSummary | null
  next: DictionaryTermSummary | null
  related: DictionaryTermSummary[]
}> {
  try {
    const term = await prisma.bonsaiTerm.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        term: true,
        reading: true,
        description: true,
        category: true,
        sortOrder: true,
      },
    })

    if (!term) {
      return { term: null, prev: null, next: null, related: [] }
    }

    // prev/next と related を並列取得
    const [adjacentResult, relatedResult] = await Promise.all([
      prisma.bonsaiTerm.findMany({
        where: { category: term.category },
        select: { id: true, slug: true, term: true, reading: true, category: true, description: true },
        orderBy: [{ reading: 'asc' }, { sortOrder: 'asc' }],
        take: MAX_DICTIONARY_TERMS_LIMIT,
      }),
      prisma.bonsaiTerm.findMany({
        where: { category: term.category, slug: { not: slug } },
        select: { id: true, slug: true, term: true, reading: true, category: true, description: true },
        orderBy: [{ reading: 'asc' }, { sortOrder: 'asc' }],
        take: DICTIONARY_RELATED_TERMS_LIMIT,
      }),
    ])

    const idx = adjacentResult.findIndex((t) => t.slug === slug)
    const prev = idx > 0 ? (adjacentResult[idx - 1] ?? null) : null
    const next =
      idx >= 0 && idx < adjacentResult.length - 1 ? (adjacentResult[idx + 1] ?? null) : null

    return {
      term: {
        id: term.id,
        slug: term.slug,
        term: term.term,
        reading: term.reading,
        description: term.description,
        category: term.category,
      },
      prev,
      next,
      related: relatedResult,
    }
  } catch (error) {
    logger.error('getDictionaryTermBySlug failed', {
      error: error instanceof Error ? error.message : String(error),
    })
    return { term: null, prev: null, next: null, related: [] }
  }
}
