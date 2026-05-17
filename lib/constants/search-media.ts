/**
 * @module lib/constants/search-media
 * 検索フィルタの mediaType 仕様値と型ガード。
 * page / API / action 各所で `as` キャストを使わず narrowing できるようにする。
 */

export const SEARCH_MEDIA_TYPES = ['images', 'videos', 'text'] as const
export type SearchMediaType = (typeof SEARCH_MEDIA_TYPES)[number]

export function isSearchMediaType(value: string | undefined): value is SearchMediaType {
  if (!value) return false
  return (SEARCH_MEDIA_TYPES as readonly string[]).includes(value)
}
