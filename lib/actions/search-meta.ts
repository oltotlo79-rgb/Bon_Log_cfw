/**
 * 検索補助データ（人気タグ、ジャンル、検索モード情報）の RSC 内部モジュール
 *
 * このファイルは外部公開しない内部実装。クライアントから到達可能な Server Action は
 * `lib/actions/search.ts` のバレル経由のみ。`'use server'` を付けないことで
 * 全 export を RPC バンドル対象から外し、攻撃面を最小化する。
 * これにより CLAUDE.md ルール2 の Server Action 規約は適用されない。
 *
 * @module lib/actions/search-meta
 */

import 'server-only'

import logger from '@/lib/logger'
import { getCachedGenres, getCachedPopularTags } from '@/lib/cache'
import { getSearchMode } from '@/lib/search/fulltext'
import { POPULAR_TAGS_LIMIT } from '@/lib/constants/limits'

/**
 * 人気のハッシュタグを取得（キャッシュ経由）。
 */
export async function getPopularTags(limit = POPULAR_TAGS_LIMIT) {
  try {
    return await getCachedPopularTags(limit)
  } catch (error) {
    logger.error('getPopularTags failed', { error: error instanceof Error ? error.message : String(error) })
    return { tags: [] }
  }
}

/**
 * 全てのジャンルを取得（キャッシュ経由）。
 */
export async function getAllGenres() {
  try {
    const result = await getCachedGenres()
    return { genres: result.genres }
  } catch (error) {
    logger.error('getAllGenres failed', { error: error instanceof Error ? error.message : String(error) })
    return { genres: {} as Record<string, never[]> }
  }
}

/**
 * 現在の検索モードを取得（'bigm' | 'trgm' | 'like'）。
 */
export async function getSearchModeInfo() {
  return { mode: getSearchMode() }
}
