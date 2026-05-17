/**
 * @file 管理者用投稿管理ページのローディング画面
 * @description 投稿一覧の読み込み中に表示されるローディング画面。
 *              Next.jsのSuspense機能と連携して自動的に表示される。
 */

// 共通ローディングスクリーンコンポーネント
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * 投稿管理ページのローディングコンポーネント
 * データ取得中に自動的に表示され、読み込み完了後は実際のページに置き換わる
 *
 * @returns ローディング画面のJSX要素
 *
 * 仕組み:
 * - Next.jsのloading.tsxファイルは、同階層のpage.tsxがデータ取得中に自動表示される
 * - Server Componentの非同期処理が完了するまでフォールバックとして使用される
 */
export default function AdminPostsLoading() {
  return <LoadingScreen message="投稿一覧を読み込んでいます..." />
}
