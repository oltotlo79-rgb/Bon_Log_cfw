/**
 * @module lib/constants/search-setup
 * 全文検索インフラ (`/api/admin/search/setup`) で使う action 名、推奨 GIN index、
 * 関連 error message を集約する。route ハンドラと UI から共通参照する。
 */

/** POST body で受け付ける action の一覧。Zod enum で runtime 検証される。 */
export const SEARCH_SETUP_ACTIONS = ['enable_extension', 'create_indexes', 'full_setup'] as const
export type SearchSetupAction = (typeof SEARCH_SETUP_ACTIONS)[number]

/**
 * 全文検索で推奨される pg_trgm GIN index の一覧。
 * `/api/admin/search/setup` GET で existing と diff を取り missing index を可視化する。
 */
export const RECOMMENDED_SEARCH_INDEXES = [
  'posts_content_trgm_idx',
  'users_nickname_trgm_idx',
  'users_bio_trgm_idx',
  'bonsai_shops_name_trgm_idx',
  'bonsai_shops_address_trgm_idx',
  'events_title_trgm_idx',
  'events_description_trgm_idx',
  'bonsais_name_trgm_idx',
  'bonsais_species_trgm_idx',
  'bonsais_description_trgm_idx',
  'hashtags_name_trgm_idx',
  'comments_content_trgm_idx',
] as const
