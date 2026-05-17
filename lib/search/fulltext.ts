/**
 * PostgreSQL 全文検索ユーティリティ（barrel）
 *
 * 元 1296 行のファイルを以下に分割:
 * - {@link './fulltext-config'} 検索モード設定・拡張機能管理・インデックス作成・状態取得
 * - {@link './fulltext-search'} 各エンティティの検索クエリ実行
 *
 * 既存の `import { ... } from '@/lib/search/fulltext'` パスは変更不要。
 */
export type { SearchMode } from './fulltext-config'
export {
  getSearchMode,
  checkExtensionAvailable,
  enableExtension,
  createSearchIndexes,
  setupFulltextSearch,
  getSearchIndexes,
  getSearchStatus,
} from './fulltext-config'
export {
  fulltextSearchPosts,
  fulltextSearchUsers,
  fulltextSearchShops,
  fulltextSearchEvents,
  fulltextSearchBonsais,
  fulltextSearchGlobal,
} from './fulltext-search'
