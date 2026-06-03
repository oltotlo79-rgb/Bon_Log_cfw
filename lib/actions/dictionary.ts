/**
 * 盆栽用語辞典の RSC データ取得モジュール
 *
 * これらは React Server Components から直接 await で呼び出される読み取り専用
 * データ取得関数であり、フォーム送信や client → server の RPC では使われない。
 * そのため `'use server'` は付けず、通常のサーバー側モジュールとして提供する。
 *
 * `'use server'` を付けると Next.js は全 export を RPC エンドポイントとしてバンドルし、
 * クライアントから到達可能になるが、ここでは RSC からのみ参照されるため不要。
 * これにより CLAUDE.md ルール2（Server Action は ActionResult 必須）の対象外となる。
 *
 * @module lib/actions/dictionary
 */

import 'server-only'

import { cache } from 'react'
import { prisma } from '@/lib/db'
import logger from '@/lib/logger'
import { MAX_DICTIONARY_TERMS_LIMIT } from '@/lib/constants/limits'


export type BonsaiTermSummary = {
  id: string
  slug: string
  term: string
  reading: string
  category: string
  description: string
}

export type BonsaiTermDetail = BonsaiTermSummary & {
  sortOrder: number
}

type GetTermsOptions = {
  search?: string
  category?: string
}

export async function getTerms({ search, category }: GetTermsOptions = {}): Promise<{
  terms: BonsaiTermSummary[]
}> {
  try {
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
      take: MAX_DICTIONARY_TERMS_LIMIT,
    })

    return { terms }
  } catch (error) {
    logger.error('getTerms failed', { error: error instanceof Error ? error.message : String(error) })
    return { terms: [] }
  }
}

// generateMetadata と本体での二重取得を React cache() でリクエスト内 1 回に集約する。
// unstable_cache は standalone 出力（CI は .next/cache を同梱しない）で不安定なため使わない。
const getTermBySlugCached = cache(
  (slug: string): Promise<BonsaiTermDetail | null> =>
    prisma.bonsaiTerm.findUnique({
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
    }),
)

export async function getTermBySlug(slug: string): Promise<{ term: BonsaiTermDetail | null }> {
  try {
    const term = await getTermBySlugCached(slug)
    return { term }
  } catch (error) {
    logger.error('getTermBySlug failed', { error: error instanceof Error ? error.message : String(error) })
    return { term: null }
  }
}

export async function getAdjacentTerms(
  slug: string,
  category: string
): Promise<{ prev: BonsaiTermSummary | null; next: BonsaiTermSummary | null }> {
  try {
    const allInCategory = await prisma.bonsaiTerm.findMany({
      where: { category },
      select: { id: true, slug: true, term: true, reading: true, category: true, description: true },
      orderBy: [{ reading: 'asc' }, { sortOrder: 'asc' }],
      take: MAX_DICTIONARY_TERMS_LIMIT,
    })

    const idx = allInCategory.findIndex((t: { slug: string }) => t.slug === slug)
    return {
      prev: idx > 0 ? allInCategory[idx - 1] ?? null : null,
      next: idx >= 0 && idx < allInCategory.length - 1 ? allInCategory[idx + 1] ?? null : null,
    }
  } catch (error) {
    logger.error('getAdjacentTerms failed', { error: error instanceof Error ? error.message : String(error) })
    return { prev: null, next: null }
  }
}
