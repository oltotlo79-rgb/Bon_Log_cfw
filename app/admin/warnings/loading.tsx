/**
 * @file 管理者用警告管理ページのローディング画面
 * @description 警告一覧の読み込み中に表示されるローディング画面。
 *              Next.jsのSuspense機能と連携して自動的に表示される。
 */

import { LoadingScreen } from '@/components/common/LoadingScreen'

/**
 * 警告管理ページのローディングコンポーネント
 * データ取得中に自動的に表示され、読み込み完了後は実際のページに置き換わる
 *
 * @returns ローディング画面のJSX要素
 */
export default function AdminWarningsLoading() {
  return <LoadingScreen message="警告一覧を読み込んでいます..." />
}
