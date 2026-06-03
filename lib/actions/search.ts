/**
 * 検索機能のServer Actions（バレル再エクスポート）
 *
 * 実装は以下のサブファイルに分割されている:
 * - search-posts.ts  : searchPosts, searchByTag
 * - search-users.ts  : searchUsers
 * - search-meta.ts   : getPopularTags, getAllGenres, getSearchModeInfo
 * - search-entities.ts : searchShops, searchEvents, searchBonsais, searchGlobal
 *
 * 後方互換のため `@/lib/actions/search` からこれらを再エクスポートする。
 *
 * @module lib/actions/search
 */

'use server'

import {
  searchPosts as _searchPosts,
  searchByTag as _searchByTag,
} from './search-posts'
import { searchUsers as _searchUsers } from './search-users'
import {
  getPopularTags as _getPopularTags,
  getAllGenres as _getAllGenres,
  getSearchModeInfo as _getSearchModeInfo,
} from './search-meta'
import {
  searchShops as _searchShops,
  searchEvents as _searchEvents,
  searchBonsais as _searchBonsais,
  searchGlobal as _searchGlobal,
} from './search-entities'
import { DEFAULT_PAGE_LIMIT, POPULAR_TAGS_LIMIT } from '@/lib/constants/limits'

export async function searchPosts(
  query: string,
  genreIds?: string[],
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
  filters?: {
    dateFrom?: string
    dateTo?: string
    minLikes?: number
    mediaType?: 'images' | 'videos' | 'text'
  }
) {
  return _searchPosts(query, genreIds, cursor, limit, filters)
}

export async function searchUsers(
  query: string,
  cursor?: string,
  limit = DEFAULT_PAGE_LIMIT,
): ReturnType<typeof _searchUsers> {
  return _searchUsers(query, cursor, limit)
}

export async function searchByTag(tag: string, cursor?: string, limit = DEFAULT_PAGE_LIMIT) {
  return _searchByTag(tag, cursor, limit)
}

export async function getPopularTags(limit = POPULAR_TAGS_LIMIT) {
  return _getPopularTags(limit)
}

export async function getAllGenres() {
  return _getAllGenres()
}

export async function getSearchModeInfo() {
  return _getSearchModeInfo()
}

export async function searchShops(query: string, cursor?: string, limit?: number, prefecture?: string) {
  return _searchShops(query, cursor, limit, prefecture)
}

export async function searchEvents(
  query: string,
  cursor?: string,
  limit?: number,
  options?: { prefecture?: string; includeExpired?: boolean },
) {
  return _searchEvents(query, cursor, limit, options)
}

export async function searchBonsais(query: string, cursor?: string, limit?: number) {
  return _searchBonsais(query, cursor, limit)
}

export async function searchGlobal(query: string) {
  return _searchGlobal(query)
}
