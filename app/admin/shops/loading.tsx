/**
 * @file 管理者用盆栽園管理ページのローディング画面
 * @description 盆栽園一覧の読み込み中に表示されるローディング画面。
 *              Next.jsのSuspense機能と連携して自動的に表示される。
 */

// 共通ローディングスクリーンコンポーネント
import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * 盆栽園管理ページのローディングコンポーネント
 * データ取得中に自動的に表示され、読み込み完了後は実際のページに置き換わる
 *
 * @returns ローディング画面のJSX要素
 *
 * 仕組み:
 * - Next.jsのloading.tsxファイルは、同階層のpage.tsxがデータ取得中に自動表示される
 * - Server Componentの非同期処理が完了するまでフォールバックとして使用される
 */
export default function AdminShopsLoading() {
  return <LoadingScreen message="盆栽園一覧を読み込んでいます..." />
}
